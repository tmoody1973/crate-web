// convex/ingestion/pipeline.ts
//
// Five stages, each its own Convex function. The scheduler fans out
// per-review work so one slow fetch or a single parse failure doesn't
// stall the batch.
//
//   discover   — action,           returns URL list for a publication
//   fetch      — internalAction,   pulls HTML, parses, dedup check
//   extract    — internalAction,   calls Claude Haiku for NER + artist resolve
//   embed      — internalAction,   batched Voyage embeddings
//   write      — internalMutation, writes review row + artist_edges

import { action, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import Anthropic from "@anthropic-ai/sdk";
import { VoyageAIClient } from "voyageai";
import { getAdapter, listAdapters } from "./publications/registry";
import { NER_SYSTEM_PROMPT, buildNerUserMessage, parseNerResponse, edgeWeightFor } from "./prompts";
import type { NerResult } from "./prompts";

// ─── Tuning knobs ────────────────────────────────────────────────────────
const NER_CHUNK_TOKENS = 3000;
const EMBED_BATCH_SIZE = 96;
const DISCOVER_CONCURRENCY = 2;
const RATE_LIMIT_MS_PER_PUB = 1200;
const FETCH_DELAY_MS_BETWEEN_JOBS = 1500;  // staggers scheduler fan-out
const MAX_REVIEW_CHARS = 40000;             // hard cap to keep NER costs sane
// ─────────────────────────────────────────────────────────────────────────

const anthropic = () => new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const voyage = () => new VoyageAIClient({ apiKey: process.env.VOYAGE_API_KEY });

// ═════════════════════════════════════════════════════════════════════════
// Orchestrators — entry points
// ═════════════════════════════════════════════════════════════════════════

export const backfillPublication = action({
  args: {
    pubSlug: v.string(),
    limit: v.optional(v.number()),   // null/undefined = all reviews
  },
  handler: async (ctx, { pubSlug, limit }) => {
    const adapter = getAdapter(pubSlug);
    const discovered = await adapter.discover({ limit: limit ?? undefined });

    const pubId = await ctx.runMutation(internal.ingestion.pipeline.upsertPublication, {
      slug: adapter.slug,
      name: adapter.displayName,
      baseUrl: adapter.baseUrl,
    });

    let scheduled = 0;
    for (const item of discovered) {
      // Pre-filter by URL to skip anything we already have. Coarse but
      // much cheaper than fetching every URL during a large backfill.
      const existing = await ctx.runQuery(internal.ingestion.pipeline.findReviewByUrl, {
        url: item.url,
      });
      if (existing) continue;

      await ctx.scheduler.runAfter(scheduled * FETCH_DELAY_MS_BETWEEN_JOBS, internal.ingestion.pipeline.fetchOne, {
        url: item.url,
        pubId,
        pubSlug,
      });
      scheduled++;
    }
    return { scheduled, discoveredTotal: discovered.length };
  },
});

export const nightlyDelta = internalAction({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    for (const adapter of listAdapters()) {
      const pub = await ctx.runQuery(internal.ingestion.pipeline.getPublicationBySlug, {
        slug: adapter.slug,
      });
      const since = pub?.last_ingested_at ?? 0;
      await ctx.scheduler.runAfter(0, internal.ingestion.pipeline.backfillPublicationInternal, {
        pubSlug: adapter.slug,
        since,
      });
      await ctx.runMutation(internal.ingestion.pipeline.touchPublicationIngested, {
        slug: adapter.slug,
        at: now,
      });
    }
  },
});

export const backfillPublicationInternal = internalAction({
  args: { pubSlug: v.string(), since: v.number() },
  handler: async (ctx, { pubSlug, since }) => {
    const adapter = getAdapter(pubSlug);
    const discovered = await adapter.discover({ since });
    const pubId = await ctx.runMutation(internal.ingestion.pipeline.upsertPublication, {
      slug: adapter.slug,
      name: adapter.displayName,
      baseUrl: adapter.baseUrl,
    });
    let scheduled = 0;
    for (const item of discovered) {
      const existing = await ctx.runQuery(internal.ingestion.pipeline.findReviewByUrl, {
        url: item.url,
      });
      if (existing) continue;
      await ctx.scheduler.runAfter(scheduled * FETCH_DELAY_MS_BETWEEN_JOBS, internal.ingestion.pipeline.fetchOne, {
        url: item.url,
        pubId,
        pubSlug,
      });
      scheduled++;
    }
  },
});

// ═════════════════════════════════════════════════════════════════════════
// Stage 1: fetch + parse + dedup
// ═════════════════════════════════════════════════════════════════════════

export const fetchOne = internalAction({
  args: { url: v.string(), pubId: v.id("publications"), pubSlug: v.string() },
  handler: async (ctx, { url, pubId, pubSlug }) => {
    const adapter = getAdapter(pubSlug);
    let html: string;
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Crate/1.0" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      html = await res.text();
    } catch (e) {
      console.warn(`[fetch] ${url} failed: ${e}`);
      return;
    }

    let parsed;
    try {
      parsed = adapter.parse(html, url);
    } catch (e) {
      console.warn(`[parse] ${url} failed: ${e}`);
      return;
    }

    // Dedup by body hash — catches syndication even when URLs differ
    const dupe = await ctx.runQuery(internal.ingestion.pipeline.findReviewByHash, {
      hash: parsed.body_hash,
    });
    if (dupe) return;

    const truncatedBody = parsed.body.slice(0, MAX_REVIEW_CHARS);

    // Hand off to extract
    await ctx.scheduler.runAfter(0, internal.ingestion.pipeline.extractOne, {
      pubId,
      pubSlug,
      parsed: { ...parsed, body: truncatedBody },
    });
  },
});

// ═════════════════════════════════════════════════════════════════════════
// Stage 2: NER via Claude Haiku
// ═════════════════════════════════════════════════════════════════════════

export const extractOne = internalAction({
  args: {
    pubId: v.id("publications"),
    pubSlug: v.string(),
    parsed: v.any(),   // ParsedReview — see publications/types.ts
  },
  handler: async (ctx, { pubId, pubSlug, parsed }) => {
    const userMessage = buildNerUserMessage(parsed.body, parsed.title);

    let nerRaw: string;
    try {
      const response = await anthropic().messages.create({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 2000,
        system: NER_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      });
      const block = response.content[0];
      nerRaw = block.type === "text" ? block.text : "";
    } catch (e) {
      console.warn(`[ner] ${parsed.url} failed: ${e}`);
      return;
    }

    const ner = parseNerResponse(nerRaw);
    if (!ner) {
      console.warn(`[ner] ${parsed.url} produced invalid JSON; skipping`);
      return;
    }

    // Resolve all artists (primary + mentioned) to canonical artist IDs
    const primaryId = await ctx.runMutation(internal.ingestion.pipeline.upsertArtist, {
      name: ner.primary_subject,
    });

    const mentionEntries: { artistId: string; weight: number }[] = [];
    for (const m of ner.mentioned_artists) {
      // Skip self-references
      if (normalizeArtistName(m.name) === normalizeArtistName(ner.primary_subject)) continue;
      const id = await ctx.runMutation(internal.ingestion.pipeline.upsertArtist, { name: m.name });
      mentionEntries.push({
        artistId: id as string,
        weight: edgeWeightFor(m.position, m.salience),
      });
    }

    // Hand off to embed
    await ctx.scheduler.runAfter(0, internal.ingestion.pipeline.embedOne, {
      pubId,
      parsed,
      primaryArtistId: primaryId as string,
      mentions: mentionEntries,
    });
  },
});

export function normalizeArtistName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")       // strip accents
    .replace(/[^\p{L}\p{N}\s]/gu, "")      // strip punctuation
    .replace(/^(the|a|an)\s+/i, "")         // strip leading articles
    .replace(/\s+/g, " ")
    .trim();
}

// ═════════════════════════════════════════════════════════════════════════
// Stage 3: embed via Voyage
// ═════════════════════════════════════════════════════════════════════════

export const embedOne = internalAction({
  args: {
    pubId: v.id("publications"),
    parsed: v.any(),
    primaryArtistId: v.string(),
    mentions: v.array(v.object({ artistId: v.string(), weight: v.number() })),
  },
  handler: async (ctx, args) => {
    let embedding: number[];
    try {
      const response = await voyage().embed({
        input: [args.parsed.body],
        model: "voyage-3",
        inputType: "document",
      });
      embedding = response.data?.[0]?.embedding ?? [];
      if (embedding.length === 0) throw new Error("empty embedding");
    } catch (e) {
      console.warn(`[embed] ${args.parsed.url} failed: ${e}`);
      return;
    }

    await ctx.runMutation(internal.ingestion.pipeline.writeReviewAndEdges, {
      ...args,
      embedding,
    });
  },
});

// ═════════════════════════════════════════════════════════════════════════
// Stage 4: write to Convex
// ═════════════════════════════════════════════════════════════════════════

export const writeReviewAndEdges = internalMutation({
  args: {
    pubId: v.id("publications"),
    parsed: v.any(),
    primaryArtistId: v.string(),
    mentions: v.array(v.object({ artistId: v.string(), weight: v.number() })),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, { pubId, parsed, primaryArtistId, mentions, embedding }) => {
    // Re-check dedup inside the transaction (races between scheduled jobs)
    const existing = await ctx.db.query("reviews").withIndex("by_hash", (q) =>
      q.eq("body_hash", parsed.body_hash),
    ).first();
    if (existing) return;

    const mentionedIds = mentions.map((m) => m.artistId as any);

    const reviewId = await ctx.db.insert("reviews", {
      publication_id: pubId,
      primary_artist_id: primaryArtistId as any,
      album_title: parsed.title,
      author: parsed.author,
      published_at: parsed.published_at,
      url: parsed.canonical_url,
      body: parsed.body,
      body_hash: parsed.body_hash,
      embedding,
      mentioned_artist_ids: mentionedIds,
    });

    // Bump primary artist review count
    await bumpArtistReviewCount(ctx, primaryArtistId as any, parsed.published_at);

    // Upsert edges: primary → each mentioned artist
    for (const m of mentions) {
      await upsertEdge(ctx, {
        from: primaryArtistId as any,
        to: m.artistId as any,
        weight: m.weight,
        reviewId,
      });
    }
  },
});

async function upsertEdge(
  ctx: any,
  args: { from: any; to: any; weight: number; reviewId: any },
) {
  const existing = await ctx.db
    .query("artist_edges")
    .withIndex("by_pair", (q: any) => q.eq("from_artist_id", args.from).eq("to_artist_id", args.to))
    .first();

  if (existing) {
    await ctx.db.patch(existing._id, {
      weight: existing.weight + args.weight,
      review_ids: [...existing.review_ids, args.reviewId],
    });
  } else {
    await ctx.db.insert("artist_edges", {
      from_artist_id: args.from,
      to_artist_id: args.to,
      weight: args.weight,
      review_ids: [args.reviewId],
    });
  }
}

async function bumpArtistReviewCount(ctx: any, artistId: any, publishedAt: number) {
  const artist = await ctx.db.get(artistId);
  if (!artist) return;
  const year = new Date(publishedAt).getFullYear();
  await ctx.db.patch(artistId, {
    review_count: (artist.review_count ?? 0) + 1,
    first_review_year: Math.min(artist.first_review_year ?? year, year),
    last_review_year: Math.max(artist.last_review_year ?? year, year),
  });
}

// ═════════════════════════════════════════════════════════════════════════
// Small helpers: publication + artist upserts, lookups
// ═════════════════════════════════════════════════════════════════════════

export const upsertPublication = internalMutation({
  args: { slug: v.string(), name: v.string(), baseUrl: v.string() },
  handler: async (ctx, { slug, name, baseUrl }) => {
    const existing = await ctx.db.query("publications").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (existing) return existing._id;
    return await ctx.db.insert("publications", {
      slug,
      name,
      tier: 1,
      base_url: baseUrl,
      ingestion_method: "rss",
      authority_weight: 1.0,
      last_ingested_at: 0,
    });
  },
});

export const touchPublicationIngested = internalMutation({
  args: { slug: v.string(), at: v.number() },
  handler: async (ctx, { slug, at }) => {
    const pub = await ctx.db.query("publications").withIndex("by_slug", (q) => q.eq("slug", slug)).first();
    if (pub) await ctx.db.patch(pub._id, { last_ingested_at: at });
  },
});

export const getPublicationBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) =>
    ctx.db.query("publications").withIndex("by_slug", (q) => q.eq("slug", slug)).first(),
});

export const findReviewByUrl = internalQuery({
  args: { url: v.string() },
  handler: async (ctx, { url }) =>
    ctx.db.query("reviews").withIndex("by_url", (q) => q.eq("url", url)).first(),
});

export const findReviewByHash = internalQuery({
  args: { hash: v.string() },
  handler: async (ctx, { hash }) =>
    ctx.db.query("reviews").withIndex("by_hash", (q) => q.eq("body_hash", hash)).first(),
});

export const upsertArtist = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const canonical = name.trim();
    const normalized = normalizeArtistName(canonical);

    // Exact normalized match
    const existing = await ctx.db
      .query("artists")
      .withIndex("by_canonical_name", (q) => q.eq("canonical_name", canonical))
      .first();
    if (existing) return existing._id;

    // Fallback: scan for alias or normalized-name match.
    // This is O(n) and will get slow past 50K artists — upgrade to a
    // dedicated lookup index (normalized_name) before that.
    const all = await ctx.db.query("artists").collect();
    for (const a of all) {
      if (normalizeArtistName(a.canonical_name) === normalized) return a._id;
      if ((a.aliases ?? []).some((alias: string) => normalizeArtistName(alias) === normalized)) {
        return a._id;
      }
    }

    return await ctx.db.insert("artists", {
      canonical_name: canonical,
      aliases: [],
      review_count: 0,
    });
  },
});
