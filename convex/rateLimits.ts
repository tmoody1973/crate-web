import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Atomic rate-limit check+increment. One call per API request.
 *
 * Returns { allowed, remaining, resetAt, limit }:
 *   - allowed: whether this request is within quota
 *   - remaining: requests remaining in the current window AFTER this call
 *   - resetAt: epoch ms when the current window ends
 *   - limit: the limit value passed in (echoed back for response headers)
 *
 * The row for (userId, endpoint) is reused across windows. When a new window
 * starts (now >= windowStart + windowMs), the row's count resets.
 *
 * NOTE: this is a mutation rather than a query so it atomically increments.
 * Running as two calls (query then mutate) introduces a race where concurrent
 * requests can both pass the check before either increments.
 */
export const checkAndIncrement = mutation({
  args: {
    userId: v.id("users"),
    endpoint: v.string(),
    limit: v.number(),
    windowMs: v.number(),
  },
  handler: async (ctx, { userId, endpoint, limit, windowMs }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("rateLimits")
      .withIndex("by_user_endpoint", (q) =>
        q.eq("userId", userId).eq("endpoint", endpoint),
      )
      .unique();

    // Fresh window: either no row yet, or previous window expired
    if (!existing || now >= existing.windowStart + windowMs) {
      if (existing) {
        await ctx.db.patch(existing._id, {
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      } else {
        await ctx.db.insert("rateLimits", {
          userId,
          endpoint,
          windowStart: now,
          count: 1,
          lastHitAt: now,
        });
      }
      return {
        allowed: true,
        remaining: Math.max(0, limit - 1),
        resetAt: now + windowMs,
        limit,
      };
    }

    // Active window: enforce limit
    if (existing.count >= limit) {
      return {
        allowed: false,
        remaining: 0,
        resetAt: existing.windowStart + windowMs,
        limit,
      };
    }

    await ctx.db.patch(existing._id, {
      count: existing.count + 1,
      lastHitAt: now,
    });
    return {
      allowed: true,
      remaining: Math.max(0, limit - existing.count - 1),
      resetAt: existing.windowStart + windowMs,
      limit,
    };
  },
});
