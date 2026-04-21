"use node";

/**
 * Main /recommend action — end-to-end tour generation per v1-scope.md.
 *
 * Two actions:
 *   - `generateTour` (public): called from the Vercel route handler. Does
 *     auth + rate-limit + creates the initial tour row + schedules the
 *     internal runGenerationFlow. Returns { tourId, slug } fast so the
 *     client can navigate to a loading page and subscribe to tourStatus
 *     for real-time phase updates.
 *   - `runGenerationFlow` (internal): the full orchestration pipeline
 *     from classify → embed → Perplexity → verify → arc + moderate + redact
 *     → persist. Writes tourStatus rows throughout for client reactivity.
 *
 * Error handling follows the Section 2 error map: named exceptions, retry
 * policies, fallbacks on per-helper failure, and a 45s overall timeout
 * race per eng review Issue 2.5.
 */

import { v } from "convex/values";
import { action, internalAction, type ActionCtx } from "../_generated/server";
import { api, internal } from "../_generated/api";
import { createHash } from "node:crypto";

import type { Id } from "../_generated/dataModel";
import { classifyIntent } from "./intentClassify";
import { embedText } from "./voyageEmbed";
import { recommendFromPerplexity } from "./perplexityRecommend";
import { verifyCitation } from "./citationVerify";
import { orderArc, fallbackArcOrder } from "./arcOrder";
import { classifyModeration, summarizeTourForModeration } from "./moderationClassify";
import { redactPrompt, fallbackRedact } from "./promptRedact";
import { buildSlug } from "./slug";
import { resolveYouTubeVideoId } from "./youtubeResolve";
import { lookupAlbumArtwork } from "./itunesArtwork";
import type { StructuredQuery } from "./types";
import type { WikiMemory } from "./wikiMemory";

// ── Constants ────────────────────────────────────────────────────────────────

const RATE_LIMIT_ENDPOINT = "recommend_generate";
const RATE_LIMIT_MAX = 20;                  // free tier; pro tier could scale higher later
const RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours
const GENERATION_TIMEOUT_MS = 45_000;       // per Issue 2.5 — abort at 45s
const MAX_PROMPT_LENGTH = 2000;             // truncate on ingress (per Section 4 edge cases)
const MIN_PROMPT_LENGTH = 1;
const MAX_SLUG_ATTEMPTS = 3;

// ── Public action: generateTour ──────────────────────────────────────────────

export const generateTour = action({
  args: {
    prompt: v.string(),
    // Optional: resolved by the Vercel route handler from Auth0 Token Vault.
    // Top artist names from the user's Spotify, passed as a soft taste hint.
    spotifySeeds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { prompt, spotifySeeds },
  ): Promise<{ tourId: Id<"artifactsRecommend">; slug: string }> => {
    // 1. Auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // 2. Find user by Clerk subject
    const user = await ctx.runQuery(api.users.getByClerkId, {
      clerkId: identity.subject,
    });
    if (!user) throw new Error("User not found");

    // 3. Input validation
    const trimmed = prompt.trim();
    if (trimmed.length < MIN_PROMPT_LENGTH) {
      throw new Error("Prompt is required");
    }
    const normalized = trimmed.slice(0, MAX_PROMPT_LENGTH);

    // 4. Rate-limit check
    const rl = await ctx.runMutation(api.rateLimits.checkAndIncrement, {
      userId: user._id,
      endpoint: RATE_LIMIT_ENDPOINT,
      limit: RATE_LIMIT_MAX,
      windowMs: RATE_LIMIT_WINDOW_MS,
    });
    if (!rl.allowed) {
      throw new Error(
        `Daily tour limit reached. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 60000)} minutes.`,
      );
    }

    // 5. Create initial tour row with a provisional slug. The real slug
    //    is regenerated in runGenerationFlow once we have the first artist
    //    name (can't know it yet — prompt hasn't been Perplexity'd).
    const provisionalSlug = buildSlug("tour", 8);
    const tourId = await ctx.runMutation(internal.recommend.mutations.createInitialTour, {
      userId: user._id,
      prompt: normalized,
      slug: provisionalSlug,
    });

    // 6. Schedule the heavy generation flow in the background. Returns
    //    immediately so the client can navigate to the loading page and
    //    subscribe to tourStatus.
    await ctx.scheduler.runAfter(0, internal.recommend.index.runGenerationFlow, {
      tourId,
      userId: user._id,
      prompt: normalized,
      spotifySeeds: spotifySeeds?.slice(0, 10), // hard cap to keep prompt compact
    });

    return { tourId, slug: provisionalSlug };
  },
});

// ── Internal action: runGenerationFlow ───────────────────────────────────────

export const runGenerationFlow = internalAction({
  args: {
    tourId: v.id("artifactsRecommend"),
    userId: v.id("users"),
    prompt: v.string(),
    spotifySeeds: v.optional(v.array(v.string())),
  },
  handler: async (
    ctx,
    { tourId, userId, prompt, spotifySeeds },
  ): Promise<void> => {
    const startTime = Date.now();
    const phaseDurations: Record<string, number> = {};
    const errors: string[] = [];
    let cost = 0; // accumulated USD estimate

    // Race the whole pipeline against the 45s timeout per Issue 2.5.
    const timeoutPromise = new Promise<"timeout">((resolve) =>
      setTimeout(() => resolve("timeout"), GENERATION_TIMEOUT_MS),
    );

    const workPromise = runWork({
      ctx,
      tourId,
      userId,
      prompt,
      spotifySeeds,
      phaseDurations,
      errors,
      addCost: (usd) => {
        cost += usd;
      },
    });

    const result = await Promise.race([workPromise, timeoutPromise]);
    const totalMs = Date.now() - startTime;

    // Persist observability event regardless of outcome
    try {
      await ctx.runMutation(internal.recommend.mutations.logTourEvent, {
        tourId,
        userIdHash: hashUserId(userId),
        intentType: "unknown",
        promptLength: prompt.length,
        promptHash: hashPrompt(prompt),
        phaseDurations: JSON.stringify(phaseDurations),
        cacheMatched: false,
        perplexityFallbackUsed: false,
        artistCount: 0,
        verifiedCitationCount: 0,
        moderationStatus: "unknown",
        costUsd: cost,
        errors,
      });
    } catch {
      // logging failure must never kill the action
    }

    if (result === "timeout") {
      await ctx.runMutation(internal.recommend.mutations.markFailed, {
        tourId,
        reason: "timed_out",
      });
    }

    // Ship an aggregate event to PostHog so dashboards see tour outcomes even
    // though the Vercel route returned long ago. Best-effort — never throws.
    await capturePostHog({
      distinctId: hashUserId(userId),
      event: "recommend_tour_completed",
      properties: {
        outcome: result === "timeout" ? "timed_out" : result,
        totalMs,
        costUsd: cost,
        errorCount: errors.length,
        errors: errors.slice(0, 5),
        phaseDurations,
      },
    });
  },
});

// ── PostHog HTTP capture (Convex can't use posthog-node cleanly) ────────────

async function capturePostHog(args: {
  distinctId: string;
  event: string;
  properties?: Record<string, unknown>;
}): Promise<void> {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? process.env.POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";
  if (!key) return; // Observability is optional — never block the action on it.
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2000);
    try {
      await fetch(`${host.replace(/\/$/, "")}/capture/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: key,
          event: args.event,
          distinct_id: args.distinctId,
          properties: args.properties ?? {},
          timestamp: new Date().toISOString(),
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch {
    // telemetry failure is never fatal
  }
}

// ── Core work pipeline ───────────────────────────────────────────────────────

type WorkCtx = {
  ctx: ActionCtx;
  tourId: Id<"artifactsRecommend">;
  userId: Id<"users">;
  prompt: string;
  spotifySeeds?: string[];
  phaseDurations: Record<string, number>;
  errors: string[];
  addCost: (usd: number) => void;
};

async function runWork(w: WorkCtx): Promise<"done" | "flagged" | "failed"> {
  const { ctx, tourId, userId, prompt, spotifySeeds } = w;

  try {
    // Phase 1: Classify intent ────────────────────────────────────────────
    await writeStatus(ctx, tourId, "classifying", 0.1, "Understanding your request");
    const structuredQuery = await timedPhase(w, "classify", async () => {
      try {
        w.addCost(0.0015);
        return await classifyIntent(prompt);
      } catch (e) {
        w.errors.push(errName(e));
        // Per Section 2 error-map: default to mood_theme on classifier failure
        return {
          intent_type: "mood_theme" as const,
          raw_text: prompt,
        } satisfies StructuredQuery;
      }
    });

    await ctx.runMutation(internal.recommend.mutations.setIntentClassification, {
      tourId,
      intentType: structuredQuery.intent_type,
      parsedQueryJson: JSON.stringify(structuredQuery),
    });

    // Short-circuit on vague — UI shows clarifying chips, no tour generated
    if (structuredQuery.intent_type === "vague") {
      await ctx.runMutation(internal.recommend.mutations.markVague, { tourId });
      await writeStatus(ctx, tourId, "done_vague", 1.0, "Need a little more direction");
      return "done";
    }

    // Phase 2: Embed prompt ───────────────────────────────────────────────
    await writeStatus(ctx, tourId, "embedding", 0.2, "Reading your mood");
    const embedding = await timedPhase(w, "embed", async () => {
      try {
        w.addCost(0.0001);
        const result = await embedText({ text: prompt, inputType: "query" });
        return result.embedding;
      } catch (e) {
        w.errors.push(errName(e));
        // If Voyage is down, proceed with empty embedding — it just means the
        // similarity cache won't have useful data for this tour. Generation continues.
        return [];
      }
    });

    if (embedding.length > 0) {
      await ctx.runMutation(internal.recommend.mutations.setPromptEmbedding, {
        tourId,
        embedding,
      });
    }

    // Phase 3: Read wiki memory ───────────────────────────────────────────
    await writeStatus(ctx, tourId, "reading_memory", 0.3, "Remembering what you like");
    const wikiMemory: WikiMemory = await timedPhase(w, "memory", () =>
      ctx.runQuery(internal.recommend.wikiMemory.getWikiMemoryForIntent, {
        userId,
        intentType: structuredQuery.intent_type,
      }),
    );

    // Phase 4: Call Perplexity ────────────────────────────────────────────
    await writeStatus(ctx, tourId, "reading_reviews", 0.4, "Reading recent reviews");
    const perplexityResult = await timedPhase(w, "perplexity", async () => {
      w.addCost(0.04);
      return await recommendFromPerplexity({
        structuredQuery,
        keptArtistNames: wikiMemory.keptArtistNames,
        passedArtistNames: wikiMemory.passedArtistNames,
        spotifySeedArtists: spotifySeeds,
      });
    });

    // Observability: record how many real sources Perplexity actually
    // returned vs how many model-generated URLs survived matching.
    w.errors.push(
      `Perplexity:picks=${perplexityResult.picks.length},citations=${perplexityResult.citations.length},withUrl=${perplexityResult.picks.filter((p) => p.quote_url).length}`,
    );

    if (perplexityResult.picks.length === 0) {
      // Total failure — nothing to render. Mark failed.
      w.errors.push("PerplexityZeroResultsError");
      await ctx.runMutation(internal.recommend.mutations.markFailed, {
        tourId,
        reason: "failed",
      });
      return "failed";
    }

    const picks = perplexityResult.picks.slice(0, 12); // cap at 12
    const citations = perplexityResult.citations;

    // Phase 5: Verify citations + resolve YouTube ids in parallel ───────
    await writeStatus(ctx, tourId, "verifying", 0.7, "Verifying sources");
    const verifiedPicks = await timedPhase(w, "verify", async () => {
      return await Promise.all(
        picks.map(async (pick) => {
          const [verifyResult, youtubeResult] = await Promise.all([
            (async () => {
              if (!pick.quote_text || !pick.quote_url) return { verified: false };
              try {
                return await verifyCitation({
                  url: pick.quote_url,
                  quote: pick.quote_text,
                });
              } catch (e) {
                w.errors.push(`CitationVerify:${errName(e)}`);
                return { verified: false };
              }
            })(),
            resolveYouTubeVideoId({
              artistName: pick.name,
              album: pick.album,
            }),
          ]);
          // Log EVERY outcome so we can count hits vs misses in the errors
          // array. Even successes get a "YouTubeResolve:ok" tag so we know
          // the code path ran at all.
          w.errors.push(
            youtubeResult.videoId
              ? `YouTubeResolve:ok`
              : `YouTubeResolve:${youtubeResult.failureReason ?? "unknown"}`,
          );
          return {
            pick,
            verified: verifyResult.verified,
            youtubeTrackId: youtubeResult.videoId ?? undefined,
          };
        }),
      );
    });

    // Phase 6: Parallel arc + moderation + redaction ─────────────────────
    await writeStatus(ctx, tourId, "ordering", 0.85, "Ordering the tour");
    const artistNames = verifiedPicks.map((vp) => vp.pick.name);
    const tourSummary = summarizeTourForModeration(
      verifiedPicks.map((vp) => ({
        name: vp.pick.name,
        quote: vp.pick.quote_text ? { text: vp.pick.quote_text } : undefined,
      })),
    );

    const [arcResult, moderationResult, redactionResult] = await Promise.all([
      arcWithFallback(w, artistNames, structuredQuery.raw_text),
      moderationWithFallback(w, prompt, tourSummary),
      redactionWithFallback(w, prompt),
    ]);

    // Phase 7: Build artists array with arc position + per-pick citation
    // URLs drawn from Perplexity's real `search_results`. Trust model:
    // a quote is attached to an artist only when a search_result snippet
    // both contains that quote text AND names the artist. Unmatched quotes
    // are dropped rather than stamped with the tour's top citation.
    const arcByName = new Map(arcResult.map((a) => [a.name, a.arcPosition]));
    const searchResults = perplexityResult.searchResults ?? [];

    const artists = verifiedPicks.map((vp) => {
      const { pick, youtubeTrackId } = vp;
      const arcPos = arcByName.get(pick.name) ?? 0;
      const artist: {
        name: string;
        album?: string;
        year?: number;
        artworkUrl?: string;
        quote?: {
          text: string;
          publication: string;
          author?: string;
          url: string;
          verified: boolean;
        };
        youtubeTrackId?: string;
        arcPosition: number;
      } = {
        name: pick.name,
        arcPosition: arcPos,
      };
      if (pick.album) artist.album = pick.album;
      if (pick.year) artist.year = pick.year;
      if (pick.quote_text && pick.quote_publication) {
        // Never fall back to a generic "top tour citation" on miss —
        // stamping the tour's headline article onto an unmatched per-artist
        // quote launders model fabrications into authoritative-looking
        // citations.
        const match = matchQuoteToSnippet(
          pick.quote_text,
          pick.name,
          searchResults,
        );
        if (match) {
          artist.quote = {
            text: pick.quote_text,
            publication: pick.quote_publication,
            author: pick.quote_author,
            url: match.url,
            verified: true,
          };
        }
      }
      if (youtubeTrackId) {
        artist.youtubeTrackId = youtubeTrackId;
      }
      return artist;
    });

    // Per-publication cap: prevent a single host from dominating citations
    // across the tour. When retrieval skews heavily toward one publication
    // (AllMusic album pages, Bandcamp Daily), the first N picks to claim
    // that host keep their quote; subsequent picks drop the quote rather
    // than compound the monoculture. Preserves arcPosition ordering for
    // the cap — we keep the earliest claimants, not the "strongest" ones,
    // because all matches have already passed the matcher's trust tiers.
    const hostCounts = new Map<string, number>();
    for (const a of [...artists].sort((x, y) => x.arcPosition - y.arcPosition)) {
      if (!a.quote) continue;
      const host = hostFromUrl(a.quote.url);
      const n = hostCounts.get(host) ?? 0;
      if (n >= MAX_CITATIONS_PER_PUBLICATION) {
        delete a.quote;
        continue;
      }
      hostCounts.set(host, n + 1);
    }

    // Phase 8: Finalize ───────────────────────────────────────────────────
    const isApproved = moderationResult.categories.length === 0;
    const finalSlug = artists[0]?.name
      ? buildSlug(artists[0].name, 4)
      : buildSlug("tour", 8);

    // Build the per-source cards from Perplexity's search_results. Each
    // source gets a hostname-derived publication name, an optional hero
    // image (matched from Perplexity's images[] by originUrl equality),
    // and an artistsMentioned[] list computed by scanning the title +
    // snippet for every tour artist name. Empty artistsMentioned is still
    // kept — the UI renders those as "General sources for this tour."
    const imagesByOrigin = new Map<string, string>();
    for (const img of perplexityResult.images ?? []) {
      if (img.originUrl && !imagesByOrigin.has(img.originUrl)) {
        imagesByOrigin.set(img.originUrl, img.imageUrl);
      }
    }
    const sources = (perplexityResult.searchResults ?? []).map((r) => {
      const heroImageUrl = imagesByOrigin.get(r.url);
      const base = {
        url: r.url,
        publication: hostFromUrl(r.url),
        title: r.title ?? "",
        snippet: r.snippet,
        date: r.date,
        artistsMentioned: mentionedArtists(
          artists.map((a) => a.name),
          `${r.title ?? ""} ${r.snippet ?? ""}`,
        ),
      };
      return heroImageUrl ? { ...base, heroImageUrl } : base;
    });

    // Parallel iTunes Search API lookups for album cover art. Attached to
    // each artist in the tour. Failures are silent (null artworkUrl) —
    // artwork is decorative, never blocks tour generation.
    await Promise.all(
      artists.map(async (artist) => {
        if (!artist.album) return;
        const art = await lookupAlbumArtwork(artist.name, artist.album);
        if (art) artist.artworkUrl = art.artworkUrl;
      }),
    );

    await writeStatus(ctx, tourId, "finalizing", 0.95, "Wrapping up");
    await ctx.runMutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: finalSlug,
      artists,
      citations,
      sources,
      perplexityFallbackUsed: perplexityResult.isSparse || perplexityResult.isCitationless,
      promptRedacted: redactionResult,
      promptShowRaw: false,
      moderationStatus: isApproved ? "approved" : "flagged",
      moderationCategories: isApproved ? undefined : moderationResult.categories,
      isPublic: isApproved,
    });

    await writeStatus(
      ctx,
      tourId,
      "done",
      1.0,
      isApproved ? "Your tour is ready" : "Staying private — moderation flagged this",
    );

    return isApproved ? "done" : "flagged";
  } catch (e) {
    w.errors.push(errName(e));
    await ctx.runMutation(internal.recommend.mutations.markFailed, {
      tourId,
      reason: "failed",
    });
    return "failed";
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function arcWithFallback(
  w: WorkCtx,
  artistNames: string[],
  queryContext: string,
): Promise<Array<{ name: string; arcPosition: number }>> {
  return timedPhase(w, "arc", async () => {
    try {
      w.addCost(0.002);
      return await orderArc({ artistNames, queryContext });
    } catch (e) {
      w.errors.push(`Arc:${errName(e)}`);
      return fallbackArcOrder(artistNames);
    }
  });
}

async function moderationWithFallback(
  w: WorkCtx,
  prompt: string,
  tourSummary: string,
): Promise<{ categories: string[] }> {
  return timedPhase(w, "moderation", async () => {
    try {
      w.addCost(0.0015);
      return await classifyModeration({ prompt, tourOutputSummary: tourSummary });
    } catch (e) {
      // Fail-closed per Open Decision from CEO review: on moderation error,
      // treat as flagged (stay private). Cron will retry.
      w.errors.push(`Moderation:${errName(e)}`);
      return { categories: ["unknown-moderation-failure"] };
    }
  });
}

async function redactionWithFallback(
  w: WorkCtx,
  prompt: string,
): Promise<string> {
  return timedPhase(w, "redact", async () => {
    try {
      w.addCost(0.0005);
      return await redactPrompt(prompt);
    } catch (e) {
      w.errors.push(`Redact:${errName(e)}`);
      return fallbackRedact(prompt);
    }
  });
}

async function timedPhase<T>(
  w: WorkCtx,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  const start = Date.now();
  try {
    return await fn();
  } finally {
    w.phaseDurations[name] = Date.now() - start;
  }
}

async function writeStatus(
  ctx: ActionCtx,
  tourId: Id<"artifactsRecommend">,
  phase: string,
  progress: number,
  detail?: string,
): Promise<void> {
  try {
    await ctx.runMutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase,
      progress,
      detail,
    });
  } catch {
    // Never let a status-write failure kill the pipeline
  }
}

function errName(e: unknown): string {
  if (e instanceof Error) return e.name;
  return "UnknownError";
}

function hashUserId(userId: Id<"users">): string {
  // Per PII rule: hash the user ID with a salt, truncate to 16 chars
  const salt = process.env.PII_HASH_SALT ?? "crate-default-salt";
  return createHash("sha256")
    .update(`${String(userId)}${salt}`)
    .digest("hex")
    .slice(0, 16);
}

function hashPrompt(prompt: string): string {
  return createHash("sha256").update(prompt).digest("hex").slice(0, 8);
}

/**
 * Match a model-generated quote to a real Perplexity search_result by
 * looking for substantive text overlap between the quote and each
 * snippet. Returns the matched source (with real URL) or null.
 *
 * Matching heuristic — from strict to loose:
 *   1. 25-char prefix of the quote appears verbatim in a snippet.
 *   2. 4+ significant words (length ≥ 4) from the quote appear in a
 *      snippet in any order, AND the snippet/title mentions the artist.
 *   3. Otherwise: no match.
 *
 * Case-insensitive. No fuzzy matching — the LLM paraphrases often enough
 * that a false positive there would be common.
 */
function matchQuoteToSnippet(
  quote: string,
  artistName: string,
  searchResults: ReadonlyArray<{ url: string; title?: string; snippet?: string }>,
): { url: string } | null {
  if (!quote || searchResults.length === 0) return null;
  // Filter aggregator-bio URLs out of the matching pool entirely. These are
  // catalog/self-host pages (allmusic.com/artist/<slug>, bare
  // <artist>.bandcamp.com subdomains) that technically live on the
  // allowlist because their editorial paths publish real reviews — but the
  // bio paths themselves aren't criticism, and letting them into ANY tier
  // (even Tier 1 by coincidental snippet overlap) launders synthesized
  // prose into authoritative-looking citations.
  const eligible = searchResults.filter((r) => !isAggregatorBioUrl(r.url));
  if (eligible.length === 0) return null;

  const quoteLower = quote.toLowerCase();
  const prefix = quoteLower.slice(0, 25);
  const artistLower = artistName.toLowerCase();
  const quoteWords = Array.from(
    new Set(
      quoteLower
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 4),
    ),
  );

  // Tier 1 — Strict: verbatim 25-char quote prefix appears in the snippet
  for (const r of eligible) {
    const snippet = (r.snippet ?? "").toLowerCase();
    if (snippet.length > 0 && snippet.includes(prefix)) {
      return { url: r.url };
    }
  }

  // Tier 2 — Medium: search_result title or URL path explicitly names the
  // artist. Treat this as "source IS about this artist" — weaker than
  // verbatim-quote-in-snippet but strong enough for editorial articles.
  if (artistLower.length >= 4) {
    const artistDashed = artistLower.replace(/\s+/g, "-");
    const artistUnderscored = artistLower.replace(/\s+/g, "_");
    for (const r of eligible) {
      const title = (r.title ?? "").toLowerCase();
      const url = r.url.toLowerCase();
      if (
        title.includes(artistLower) ||
        url.includes(artistDashed) ||
        url.includes(artistUnderscored)
      ) {
        return { url: r.url };
      }
    }
  }

  // Tier 3 — Loose: artist appears in the title+snippet hay AND the quote
  // has 4+ significant-word overlap with it.
  for (const r of eligible) {
    const hay = `${r.title ?? ""} ${r.snippet ?? ""}`.toLowerCase();
    if (!hay.includes(artistLower)) continue;
    const overlap = quoteWords.filter((w) => hay.includes(w)).length;
    if (overlap >= 4) {
      return { url: r.url };
    }
  }

  return null;
}

function hostFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * True if the URL is an aggregator/bio page rather than an editorial article.
 * These hosts appear in the allowlist because they DO publish real reviews on
 * other paths, but their catalog paths match every artist by slug and would
 * otherwise dominate Tier 2 matching with prose that isn't from the page.
 *
 * Aggregator-bio patterns blocked from Tier 2:
 *   - allmusic.com/artist/<slug>   (discography + auto-bio, not a review)
 *   - <artist>.bandcamp.com        (self-hosted artist page, not criticism)
 *
 * Still allowed (real editorial): allmusic.com/album/<slug>,
 * daily.bandcamp.com/..., anything else on the allowlist.
 */
function isAggregatorBioUrl(url: string): boolean {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "allmusic.com" && u.pathname.startsWith("/artist/")) return true;
    // bare bandcamp.com is Bandcamp Daily / editorial via daily.bandcamp.com;
    // any other <slug>.bandcamp.com is the artist's own self-hosted page.
    if (host.endsWith(".bandcamp.com") && host !== "daily.bandcamp.com") return true;
    return false;
  } catch {
    return false;
  }
}

const MAX_CITATIONS_PER_PUBLICATION = 3;

/**
 * Return the subset of `artistNames` mentioned anywhere in `text`
 * (case-insensitive). Used to cluster Perplexity search_results under the
 * matching artist stop. Not stemmed — we only match on the exact artist
 * string. "Bill Evans" matches "Bill Evans Trio" but not "evans"; close
 * enough for v1.
 */
function mentionedArtists(
  artistNames: ReadonlyArray<string>,
  text: string,
): string[] {
  const lower = text.toLowerCase();
  return artistNames.filter((n) => n.length >= 2 && lower.includes(n.toLowerCase()));
}
