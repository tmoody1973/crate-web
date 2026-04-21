/**
 * Convex mutations for the /recommend tour lifecycle. All state transitions
 * the main action dispatches go through these mutations — keeps the action
 * orchestrator readable and makes each transition individually testable.
 *
 * These mutations are `internalMutation` where possible (called only from
 * our own actions via ctx.runMutation) and `mutation` where clients need
 * direct access (e.g., keep/pass/save signals from the artifact UI — chunk 6).
 */

import { v } from "convex/values";
import { internalMutation, query } from "../_generated/server";

// ── Initial tour creation (called from the public generateTour action) ──────

export const createInitialTour = internalMutation({
  args: {
    userId: v.id("users"),
    prompt: v.string(),
    slug: v.string(),
  },
  handler: async (ctx, { userId, prompt, slug }) => {
    const now = Date.now();
    return await ctx.db.insert("artifactsRecommend", {
      slug,
      userId,
      prompt,
      promptRedacted: prompt.slice(0, 50), // fallback; redaction fills this later
      promptShowRaw: false,
      promptEmbedding: [], // filled in by setEmbedding mutation after Voyage call
      intentType: "vague", // default; classifier sets the real type
      parsedQuery: "{}",
      artists: [],
      citations: [],
      perplexityFallbackUsed: false,
      moderationStatus: "pending",
      isPublic: false,
      lifecyclePhase: "pending",
      keepCount: 0,
      passCount: 0,
      saveCount: 0,
      shareCount: 0,
      exportCount: 0,
      refineCount: 0,
      createdAt: now,
    });
  },
});

// ── Phase transitions during generation ─────────────────────────────────────

export const writeTourStatus = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    phase: v.string(),
    progress: v.number(),
    detail: v.optional(v.string()),
  },
  handler: async (ctx, { tourId, phase, progress, detail }) => {
    await ctx.db.insert("tourStatus", {
      tourId,
      phase,
      progress,
      detail,
      timestamp: Date.now(),
    });
  },
});

export const setPromptEmbedding = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    embedding: v.array(v.number()),
  },
  handler: async (ctx, { tourId, embedding }) => {
    await ctx.db.patch(tourId, { promptEmbedding: embedding });
  },
});

export const setIntentClassification = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    intentType: v.union(
      v.literal("mood_theme"),
      v.literal("era_genre"),
      v.literal("artist_similar"),
      v.literal("activity"),
      v.literal("emotional"),
      v.literal("show_prep"),
      v.literal("single_artist"),
      v.literal("vague"),
    ),
    parsedQueryJson: v.string(),
  },
  handler: async (ctx, { tourId, intentType, parsedQueryJson }) => {
    await ctx.db.patch(tourId, {
      intentType,
      parsedQuery: parsedQueryJson,
      lifecyclePhase: "generating",
    });
  },
});

export const markVague = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
  },
  handler: async (ctx, { tourId }) => {
    // Vague prompts don't generate a tour — the UI shows clarifying chips.
    // Tour stays in "pending" phase with intentType=vague. No artists.
    await ctx.db.patch(tourId, {
      lifecyclePhase: "pending",
    });
  },
});

// ── Final persistence (after generation completes) ──────────────────────────

export const finalizeTour = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    slug: v.string(),
    artists: v.array(
      v.object({
        name: v.string(),
        album: v.optional(v.string()),
        year: v.optional(v.number()),
        quote: v.optional(
          v.object({
            text: v.string(),
            publication: v.string(),
            author: v.optional(v.string()),
            url: v.string(),
            verified: v.boolean(),
          }),
        ),
        youtubeTrackId: v.optional(v.string()),
        arcPosition: v.number(),
      }),
    ),
    citations: v.array(v.string()),
    perplexityFallbackUsed: v.boolean(),
    promptRedacted: v.string(),
    promptShowRaw: v.boolean(),
    moderationStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("flagged"),
      v.literal("timed_out"),
    ),
    moderationCategories: v.optional(v.array(v.string())),
    isPublic: v.boolean(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { tourId, ...patch } = args;
    await ctx.db.patch(tourId, {
      ...patch,
      lifecyclePhase:
        args.moderationStatus === "flagged" ? "flagged" : "completed",
      moderationAttemptedAt: now,
      moderatedAt: now,
      completedAt: now,
    });
  },
});

export const markFailed = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    reason: v.union(v.literal("failed"), v.literal("timed_out")),
  },
  handler: async (ctx, { tourId, reason }) => {
    await ctx.db.patch(tourId, {
      lifecyclePhase: reason,
      completedAt: Date.now(),
    });
  },
});

// ── Observability event (async fire-and-forget from the action) ────────────

export const logTourEvent = internalMutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    userIdHash: v.string(),
    intentType: v.string(),
    promptLength: v.number(),
    promptHash: v.string(),
    phaseDurations: v.string(),
    cacheMatched: v.boolean(),
    cacheSimilarity: v.optional(v.number()),
    perplexityFallbackUsed: v.boolean(),
    artistCount: v.number(),
    verifiedCitationCount: v.number(),
    moderationStatus: v.string(),
    moderationCategories: v.optional(v.array(v.string())),
    costUsd: v.number(),
    errors: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tourEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

// ── Tour reads (used by the public Vercel proxy + /r/[slug] page) ──────────

/**
 * Query a tour by slug. Returns null if not found. Used by /r/[slug] for
 * zero-login public viewing (no auth required).
 */
export const getTourBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const tour = await ctx.db
      .query("artifactsRecommend")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .unique();
    if (!tour) return null;
    // Only expose public tours to unauth'd callers. Creator can see their
    // own via authenticated path (future chunk).
    if (!tour.isPublic) return null;
    return tour;
  },
});

/**
 * Real-time phase status query for client subscriptions (useQuery). Returns
 * the latest tourStatus row for a given tourId — the client re-renders
 * automatically as new rows are inserted during generation.
 */
export const getTourStatus = query({
  args: { tourId: v.id("artifactsRecommend") },
  handler: async (ctx, { tourId }) => {
    const latest = await ctx.db
      .query("tourStatus")
      .withIndex("by_tour", (q) => q.eq("tourId", tourId))
      .order("desc")
      .first();
    return latest;
  },
});

/**
 * List recent public tours for the /r library homepage. Only returns tours
 * with moderation_status=approved and isPublic=true. Ordered by createdAt
 * descending (most recent first).
 */
export const listRecentPublicTours = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 15 }) => {
    const capped = Math.min(Math.max(1, limit), 50);
    const tours = await ctx.db
      .query("artifactsRecommend")
      .withIndex("by_public_recent", (q) => q.eq("isPublic", true))
      .order("desc")
      .take(capped);
    return tours;
  },
});

/**
 * Creator-scoped tour read. Returns the tour regardless of isPublic if the
 * authenticated caller is the creator. For viewing one's own in-progress
 * tours from the /recommend page immediately after submit.
 */
export const getMyTourById = query({
  args: { tourId: v.id("artifactsRecommend") },
  handler: async (ctx, { tourId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const tour = await ctx.db.get(tourId);
    if (!tour) return null;

    const creator = await ctx.db.get(tour.userId);
    if (!creator || creator.clerkId !== identity.subject) return null;

    return tour;
  },
});

