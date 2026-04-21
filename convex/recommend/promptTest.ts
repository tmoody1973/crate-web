"use node";

/**
 * One-off test harness for verifying that prompt changes actually shift
 * Perplexity's retrieval toward music-criticism sources.
 *
 * Run:
 *   bunx convex run recommend/promptTest:compareRetrieval '{"query":"jazz for winter morning coffee"}'
 *
 * Prints citation-host distribution so we can see whether the new prompt
 * pulls more pitchfork/quietus/etc. and fewer youtube/streaming hits.
 */

import { v } from "convex/values";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction } from "../_generated/server";
import { recommendFromPerplexity } from "./perplexityRecommend";
import type { StructuredQuery } from "./types";

function buildSlug(prefix: string, n: number): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let out = prefix + "-";
  for (let i = 0; i < n; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

const CRITICISM_HOSTS = new Set([
  "pitchfork.com",
  "thequietus.com",
  "bandcamp.com",
  "daily.bandcamp.com",
  "npr.org",
  "ra.co",
  "residentadvisor.net",
  "theguardian.com",
  "wire.co.uk",
  "stereogum.com",
  "allmusic.com",
  "jazztimes.com",
  "factmag.com",
  "thefader.com",
  "crackmagazine.net",
  "rollingstone.com",
  "downbeat.com",
  "popmatters.com",
  "brooklynvegan.com",
  "clashmusic.com",
  "nme.com",
  "pastemagazine.com",
  "treblezine.com",
  "dummymag.com",
  "vulture.com",
  "nytimes.com",
]);

const STREAMING_HOSTS = new Set([
  "youtube.com",
  "music.apple.com",
  "open.spotify.com",
  "soundcloud.com",
  "deezer.com",
  "qobuz.com",
  "zvuk.com",
  "rutube.ru",
  "yandex.kz",
  "yandex.ru",
  "tidal.com",
  "audiomack.com",
]);

function classifyHost(url: string): "criticism" | "streaming" | "other" {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (CRITICISM_HOSTS.has(host)) return "criticism";
    for (const h of CRITICISM_HOSTS) if (host.endsWith(`.${h}`)) return "criticism";
    if (STREAMING_HOSTS.has(host)) return "streaming";
    for (const h of STREAMING_HOSTS) if (host.endsWith(`.${h}`)) return "streaming";
    return "other";
  } catch {
    return "other";
  }
}

export const compareRetrieval = internalAction({
  args: {
    query: v.string(),
    intentType: v.optional(
      v.union(
        v.literal("mood_theme"),
        v.literal("era_genre"),
        v.literal("artist_similar"),
        v.literal("activity"),
        v.literal("emotional"),
        v.literal("show_prep"),
        v.literal("single_artist"),
        v.literal("vague"),
      ),
    ),
    artistHints: v.optional(v.array(v.string())),
    eraHint: v.optional(v.string()),
    activityHint: v.optional(v.string()),
    sonicHints: v.optional(v.array(v.string())),
    themes: v.optional(v.array(v.string())),
  },
  handler: async (
    _ctx,
    { query, intentType = "mood_theme", artistHints, eraHint, activityHint, sonicHints, themes },
  ) => {
    const structuredQuery: StructuredQuery = {
      raw_text: query,
      intent_type: intentType,
      ...(artistHints ? { artist_hints: artistHints } : {}),
      ...(eraHint ? { era_hint: eraHint } : {}),
      ...(activityHint ? { activity_hint: activityHint } : {}),
      ...(sonicHints ? { sonic_hints: sonicHints } : {}),
      ...(themes ? { themes } : {}),
    };

    const result = await recommendFromPerplexity({ structuredQuery });

    const hostCounts = { criticism: 0, streaming: 0, other: 0 };
    const byHost = new Map<string, number>();
    const urls: string[] = [];

    for (const r of result.searchResults ?? []) {
      const cls = classifyHost(r.url);
      hostCounts[cls] += 1;
      try {
        const host = new URL(r.url).hostname.replace(/^www\./, "");
        byHost.set(host, (byHost.get(host) ?? 0) + 1);
      } catch {
        // skip
      }
      urls.push(r.url);
    }

    const topHosts = [...byHost.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([h, n]) => `${h}: ${n}`);

    return {
      query,
      intentType,
      searchResultCount: result.searchResults?.length ?? 0,
      hostDistribution: hostCounts,
      criticismPct:
        hostCounts.criticism /
        Math.max(1, hostCounts.criticism + hostCounts.streaming + hostCounts.other),
      topHosts,
      picksCount: result.picks.length,
      firstThreePicks: result.picks.slice(0, 3).map((p) => ({
        name: p.name,
        album: p.album,
        quote_publication: p.quote_publication,
      })),
      sampleUrls: urls.slice(0, 10),
    };
  },
});

/**
 * Re-run tour generation for an existing tour's prompt, under the CURRENT
 * code (new prompts + expanded denylist). Creates a fresh tour row with a
 * new slug. Returns the new slug — fetch via getTourBySlug to inspect.
 */
export const regenerateBySlug = internalAction({
  args: { slug: v.string() },
  handler: async (ctx, { slug }): Promise<{ newSlug: string; newTourId: Id<"artifactsRecommend"> }> => {
    const tour = await ctx.runQuery(api.recommend.mutations.getTourBySlug, { slug });
    if (!tour) throw new Error(`Tour not found: ${slug}`);

    const provisionalSlug = buildSlug("regen", 6);
    const newTourId = await ctx.runMutation(internal.recommend.mutations.createInitialTour, {
      userId: tour.userId,
      prompt: tour.prompt,
      slug: provisionalSlug,
    });

    await ctx.runAction(internal.recommend.index.runGenerationFlow, {
      tourId: newTourId,
      userId: tour.userId,
      prompt: tour.prompt,
    });

    const regenerated = await ctx.runQuery(api.recommend.mutations.getTourBySlug, { slug: provisionalSlug });
    const finalSlug = regenerated?.slug ?? provisionalSlug;

    return { newSlug: finalSlug, newTourId };
  },
});
