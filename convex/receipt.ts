/**
 * Convex functions for the Influence Receipt feature.
 * Handles receipt caching and IP-based rate limiting.
 */

import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";

// ── Rate Limiting ────────────────────────────────────────────────────────────

const RATE_LIMIT_PER_IP_PER_HOUR = 10;
const RATE_LIMIT_GLOBAL_PER_DAY = 500;
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;

/**
 * Atomic rate limit check + increment.
 * Returns { allowed: true } or { allowed: false, retryAfterMs }.
 */
export const checkAndIncrementRateLimit = mutation({
  args: { ip: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Per-IP check: single document with rolling timestamp array
    const existing = await ctx.db
      .query("receiptRateLimits")
      .withIndex("by_ip", (q) => q.eq("ip", args.ip))
      .first();

    if (existing) {
      // Filter to timestamps within the last hour
      const recentTimestamps = existing.timestamps.filter(
        (ts) => now - ts < ONE_HOUR_MS,
      );

      if (recentTimestamps.length >= RATE_LIMIT_PER_IP_PER_HOUR) {
        const oldestInWindow = Math.min(...recentTimestamps);
        return {
          allowed: false,
          retryAfterMs: ONE_HOUR_MS - (now - oldestInWindow),
          reason: "ip_limit",
        };
      }

      // Update with new timestamp, pruning old ones
      await ctx.db.patch(existing._id, {
        timestamps: [...recentTimestamps, now],
      });
    } else {
      await ctx.db.insert("receiptRateLimits", {
        ip: args.ip,
        timestamps: [now],
        createdAt: now,
      });
    }

    // Global daily check: count all timestamps from today across all IPs
    const allLimits = await ctx.db.query("receiptRateLimits").collect();
    let globalCount = 0;
    for (const entry of allLimits) {
      globalCount += entry.timestamps.filter(
        (ts) => now - ts < ONE_DAY_MS,
      ).length;
    }

    if (globalCount > RATE_LIMIT_GLOBAL_PER_DAY) {
      return {
        allowed: false,
        retryAfterMs: ONE_DAY_MS,
        reason: "global_limit",
      };
    }

    return { allowed: true, retryAfterMs: 0, reason: null };
  },
});

// ── Receipt Cache ────────────────────────────────────────────────────────────

/**
 * Look up a cached receipt by slug.
 */
export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("receiptCache")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

/**
 * Store a generated receipt in the cache.
 */
export const cacheReceipt = mutation({
  args: {
    slug: v.string(),
    artist: v.string(),
    tier: v.union(v.literal("full"), v.literal("partial"), v.literal("unknown")),
    data: v.string(),
    generatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    // Upsert: check if slug already exists
    const existing = await ctx.db
      .query("receiptCache")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        artist: args.artist,
        tier: args.tier,
        data: args.data,
        generatedAt: args.generatedAt,
      });
      return existing._id;
    }

    return await ctx.db.insert("receiptCache", {
      slug: args.slug,
      artist: args.artist,
      tier: args.tier,
      data: args.data,
      generatedAt: args.generatedAt,
    });
  },
});

/**
 * List all cached receipts with influence preview (for the landing page).
 */
export const listCached = query({
  args: {},
  handler: async (ctx) => {
    const receipts = await ctx.db.query("receiptCache").collect();
    return receipts.map((r) => {
      // Parse data to extract top influences for preview
      let topInfluences: Array<{ name: string; relationship: string }> = [];
      try {
        const data = JSON.parse(r.data);
        topInfluences = (data.influences || [])
          .slice(0, 3)
          .map((inf: { name: string; relationship: string }) => ({
            name: inf.name,
            relationship: inf.relationship,
          }));
      } catch {
        // Non-fatal
      }
      return {
        slug: r.slug,
        artist: r.artist,
        tier: r.tier,
        generatedAt: r.generatedAt,
        topInfluences,
      };
    });
  },
});

/**
 * Clean up old rate limit entries (run periodically).
 */
export const cleanupRateLimits = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const allLimits = await ctx.db.query("receiptRateLimits").collect();
    for (const entry of allLimits) {
      const recent = entry.timestamps.filter((ts) => now - ts < ONE_DAY_MS);
      if (recent.length === 0) {
        await ctx.db.delete(entry._id);
      } else if (recent.length !== entry.timestamps.length) {
        await ctx.db.patch(entry._id, { timestamps: recent });
      }
    }
  },
});
