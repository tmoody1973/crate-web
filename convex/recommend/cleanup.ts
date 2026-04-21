/**
 * TTL cleanup mutations for /recommend v1 tables. Called from convex/crons.ts.
 *
 * Convex doesn't auto-expire documents — we sweep explicitly. Each mutation
 * deletes a bounded batch of rows so we don't blow out the mutation size
 * limit on big backlogs. Crons re-invoke until the sweep catches up.
 *
 * Deletion budgets are tuned conservatively (< 200 docs per run). A typical
 * day only produces dozens of rows per table, so the crons converge quickly.
 */

import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

const DEFAULT_BATCH_LIMIT = 200;

// ── tourStatus: phase streaming rows become useless once the tour is done ──

/**
 * Delete tourStatus rows for tours that completed more than an hour ago.
 * The table is a real-time subscription source; once the client has landed
 * on /r/[slug] the rows can go. We keep 1h as a buffer for slow clients.
 */
export const pruneTourStatus = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? 60 * 60 * 1000);
    const rows = await ctx.db
      .query("tourStatus")
      .filter((q) => q.lt(q.field("timestamp"), cutoff))
      .take(DEFAULT_BATCH_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, cutoff };
  },
});

// ── tourEvents: observability records, 90-day retention ────────────────────

export const pruneTourEvents = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? 90 * 24 * 60 * 60 * 1000);
    const rows = await ctx.db
      .query("tourEvents")
      .withIndex("by_created", (q) => q.lt("createdAt", cutoff))
      .take(DEFAULT_BATCH_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, cutoff };
  },
});

// ── citationCache: URL verification cache, 24h TTL ─────────────────────────

export const pruneCitationCache = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  handler: async (ctx, { olderThanMs }) => {
    const cutoff = Date.now() - (olderThanMs ?? 24 * 60 * 60 * 1000);
    const rows = await ctx.db
      .query("citationCache")
      .filter((q) => q.lt(q.field("checkedAt"), cutoff))
      .take(DEFAULT_BATCH_LIMIT);
    for (const row of rows) {
      await ctx.db.delete(row._id);
    }
    return { deleted: rows.length, cutoff };
  },
});
