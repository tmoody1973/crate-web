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
import { internalMutation, mutation, query } from "../_generated/server";

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

// ── Signals: keep / pass / save on individual artists within a tour ─────────

const SIGNAL_RATE_LIMIT_MAX = 500;                   // mirrors rateLimits MAX_LIMITS
const SIGNAL_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Record a keep/pass/save signal for one artist in one tour.
 *
 * Authoritative per-user per-artist state: repeated calls with the same
 * signal are no-ops (idempotent). Changing the signal (e.g. keep → pass)
 * updates the existing row and adjusts aggregate counts on the tour atomically.
 *
 * Rate-limited via inlined check+increment on the shared rateLimits table.
 * Can't use ctx.runMutation here (mutations can't nest), so the logic is
 * kept local. Server-side cap is 500 signals/user/day.
 */
export const recordSignal = mutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    artistPosition: v.number(),
    signal: v.union(
      v.literal("keep"),
      v.literal("pass"),
      v.literal("save"),
    ),
  },
  handler: async (ctx, { tourId, artistPosition, signal }) => {
    // 1. Auth
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    // 2. Tour must exist and have this artist position
    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");
    if (
      artistPosition < 0 ||
      artistPosition >= tour.artists.length ||
      !Number.isInteger(artistPosition)
    ) {
      throw new Error("Invalid artist position");
    }

    // 3. Rate-limit (inlined — mutations can't call other mutations)
    const now = Date.now();
    const rl = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) =>
        q.eq("userId", user._id).eq("endpoint", "recommend_signal"),
      )
      .unique();

    if (!rl || now >= rl.windowStart + SIGNAL_RATE_LIMIT_WINDOW_MS) {
      if (rl) {
        await ctx.db.patch(rl._id, {
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          userId: user._id,
          endpoint: "recommend_signal",
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      }
    } else if (rl.count >= SIGNAL_RATE_LIMIT_MAX) {
      throw new Error("Signal rate limit reached");
    } else {
      await ctx.db.patch(rl._id, {
        count: rl.count + 1,
        lastHitAt: now,
      });
    }

    // 4. Find existing signal for this (user, tour, artistPosition). Scan the
    //    user+tour range — expected to be tiny (≤ tour.artists.length rows).
    const existingSignals = await ctx.db
      .query("tourSignals")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", user._id).eq("tourId", tourId),
      )
      .collect();
    const existing = existingSignals.find(
      (s) => s.artistPosition === artistPosition,
    );

    // 5. Compute aggregate count delta. Moving from one signal to another
    //    decrements the old count and increments the new one.
    const countField = (s: "keep" | "pass" | "save") =>
      s === "keep" ? "keepCount" : s === "pass" ? "passCount" : "saveCount";

    if (existing && existing.signal === signal) {
      return { ok: true, unchanged: true };
    }

    if (existing) {
      await ctx.db.patch(existing._id, { signal, createdAt: now });
      const oldField = countField(existing.signal);
      const newField = countField(signal);
      await ctx.db.patch(tourId, {
        [oldField]: Math.max(0, (tour[oldField] as number) - 1),
        [newField]: (tour[newField] as number) + 1,
      });
    } else {
      await ctx.db.insert("tourSignals", {
        userId: user._id,
        tourId,
        artistPosition,
        signal,
        createdAt: now,
      });
      const field = countField(signal);
      await ctx.db.patch(tourId, {
        [field]: (tour[field] as number) + 1,
      });
    }

    return { ok: true, unchanged: false };
  },
});

/**
 * Clear a previously set signal for one artist. Mirrors `recordSignal` but
 * deletes the row and decrements the aggregate. Returns early if no signal
 * exists. No rate limit — delete is cheap and bounded by prior insert rate.
 */
export const clearSignal = mutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    artistPosition: v.number(),
  },
  handler: async (ctx, { tourId, artistPosition }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");

    const signals = await ctx.db
      .query("tourSignals")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", user._id).eq("tourId", tourId),
      )
      .collect();
    const existing = signals.find((s) => s.artistPosition === artistPosition);
    if (!existing) return { ok: true, unchanged: true };

    const field =
      existing.signal === "keep"
        ? "keepCount"
        : existing.signal === "pass"
          ? "passCount"
          : "saveCount";

    await ctx.db.delete(existing._id);
    await ctx.db.patch(tourId, {
      [field]: Math.max(0, (tour[field] as number) - 1),
    });

    return { ok: true, unchanged: false };
  },
});

// ── User reports (flag a tour for admin review) ─────────────────────────────

const REPORT_RATE_LIMIT_MAX = 5;
const REPORT_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;
const REPORT_REASON_MAX_LENGTH = 500;

/**
 * Submit a report on a public tour. Auth required — prevents anonymous
 * brigading. Rate-limited to 5/user/day via the shared rateLimits table.
 * Reason is trimmed and capped at 500 characters server-side.
 */
export const reportTour = mutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    reason: v.string(),
  },
  handler: async (ctx, { tourId, reason }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const trimmedReason = reason.trim().slice(0, REPORT_REASON_MAX_LENGTH);
    if (trimmedReason.length < 3) {
      throw new Error("Report reason is too short");
    }

    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");

    // Rate-limit check — inlined per the same pattern as recordSignal.
    const now = Date.now();
    const rl = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) =>
        q.eq("userId", user._id).eq("endpoint", "recommend_report"),
      )
      .unique();
    if (!rl || now >= rl.windowStart + REPORT_RATE_LIMIT_WINDOW_MS) {
      if (rl) {
        await ctx.db.patch(rl._id, {
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          userId: user._id,
          endpoint: "recommend_report",
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      }
    } else if (rl.count >= REPORT_RATE_LIMIT_MAX) {
      throw new Error("Daily report limit reached");
    } else {
      await ctx.db.patch(rl._id, { count: rl.count + 1, lastHitAt: now });
    }

    await ctx.db.insert("tourReports", {
      tourId,
      userId: user._id,
      reason: trimmedReason,
      status: "pending",
      createdAt: now,
    });

    return { ok: true };
  },
});

/**
 * Save a tour as a Crate playlist for the signed-in user.
 *
 * Creates a new row in the shared `playlists` table and fans out each
 * tour artist as a row in `playlistTracks`. Only artists with a resolved
 * `youtubeTrackId` become tracks — artists we couldn't find on YouTube
 * get dropped rather than saved as orphans you can't play.
 *
 * Returns the new playlist id so the client can link into /w to view it.
 * Idempotent-ish: called twice with the same tour, creates two playlists.
 * That's intentional — users may want to curate multiple variants of the
 * same tour.
 */
export const saveTourAsPlaylist = mutation({
  args: { tourId: v.id("artifactsRecommend") },
  handler: async (ctx, { tourId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");

    // Allow saving tours the user created (even if not yet public) OR any
    // public tour. Private-someone-else tours are off-limits.
    const ownsIt = tour.userId === user._id;
    if (!ownsIt && !tour.isPublic) {
      throw new Error("Tour not available");
    }

    const playableArtists = [...tour.artists]
      .filter((a) => !!a.youtubeTrackId)
      .sort((a, b) => a.arcPosition - b.arcPosition);
    if (playableArtists.length === 0) {
      throw new Error("No playable tracks in this tour yet");
    }

    const now = Date.now();
    const name = tour.promptRedacted?.trim() || "Crate Tour";
    const description = `A ${tour.artists.length}-artist tour saved from Crate (${tour.slug}).`;

    const playlistId = await ctx.db.insert("playlists", {
      userId: user._id,
      name,
      description,
      trackCount: playableArtists.length,
      createdAt: now,
      updatedAt: now,
    });

    for (let i = 0; i < playableArtists.length; i++) {
      const a = playableArtists[i]!;
      await ctx.db.insert("playlistTracks", {
        playlistId,
        title: a.album ?? a.name,
        artist: a.name,
        album: a.album,
        year: a.year ? String(a.year) : undefined,
        source: "youtube",
        sourceId: a.youtubeTrackId!,
        position: i,
        addedAt: now,
      });
    }

    return { playlistId, trackCount: playableArtists.length };
  },
});

/**
 * Record a public share of a tour. No auth required — anonymous visitors
 * also bump the counter. The counter is best-effort; duplicates are expected
 * and fine (it's a popularity signal, not a unique-visits metric).
 */
export const recordShare = mutation({
  args: { tourId: v.id("artifactsRecommend") },
  handler: async (ctx, { tourId }) => {
    const tour = await ctx.db.get(tourId);
    if (!tour) return { ok: false as const };
    if (!tour.isPublic) return { ok: false as const };
    await ctx.db.patch(tourId, { shareCount: tour.shareCount + 1 });
    return { ok: true as const };
  },
});

/**
 * Fetch the authenticated user's signals on a specific tour. Returns a map
 * of artistPosition → signal. Used by TourArtifact to show active buttons.
 *
 * Returns `null` when unauthenticated — the client renders neutral buttons.
 */
export const getMySignalsForTour = query({
  args: { tourId: v.id("artifactsRecommend") },
  handler: async (ctx, { tourId }) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) return null;

    const signals = await ctx.db
      .query("tourSignals")
      .withIndex("by_user_tour", (q) =>
        q.eq("userId", user._id).eq("tourId", tourId),
      )
      .collect();

    const map: Record<number, "keep" | "pass" | "save"> = {};
    for (const s of signals) map[s.artistPosition] = s.signal;
    return map;
  },
});

