import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Server-side registry of allowed rate-limit endpoints and their maximum
 * per-hour caps. The `limit` arg on `checkAndIncrement` is clamped to the
 * max for the endpoint, so a malicious caller cannot bypass rate-limits by
 * passing `limit: 99999999` from the browser console. Adding a new endpoint
 * here is the only way to enable rate-limiting on a new route.
 *
 * Values here are ceilings — the actual limit applied to a request is
 * min(caller-passed limit, MAX_LIMITS[endpoint]). Callers decide the plan-
 * scaled limit (free vs pro), but they can't exceed what the server allows.
 */
const MAX_LIMITS: Record<string, number> = {
  influence_expand: 60, // free=10, pro/team=60 — server cap matches pro/team
  recommend_generate: 20, // per CEO review: 20 tours/day/user
  recommend_signal: 500, // keep/pass/save signals (10 tours × ~50 signals each)
  recommend_report: 5, // user-submitted tour reports, per day
  recommend_refine: 10, // chip refinement per session (rolling window)
};

const MIN_WINDOW_MS = 1000; // 1 second — floor to prevent per-ms windows that bypass rate-limiting under load
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours — ceiling to prevent effectively banning users forever

/**
 * Atomic rate-limit check+increment. One call per API request.
 *
 * Returns { allowed, remaining, resetAt, limit }:
 *   - allowed: whether this request is within quota
 *   - remaining: requests remaining in the current window AFTER this call
 *   - resetAt: epoch ms when the current window ends
 *   - limit: the effective (clamped) limit applied to this request
 *
 * The row for (userId, endpoint) is reused across windows. When a new window
 * starts (now >= windowStart + windowMs), the row's count resets.
 *
 * SECURITY: this mutation is public so Vercel route handlers can call it via
 * ConvexHttpClient. To prevent callers from bypassing rate-limits by passing
 * arbitrary args, the handler validates:
 *   - `endpoint` must exist in MAX_LIMITS (unknown endpoints rejected)
 *   - `limit` is clamped to MAX_LIMITS[endpoint]
 *   - `windowMs` is bounded to [1 minute, 24 hours]
 *
 * Cross-user DOS (caller passes another user's userId to consume their quota)
 * is not addressed at this layer — follow-up TODO: require ctx.auth and
 * derive userId from the authenticated identity. Requires wiring Convex JWT
 * template in Clerk config; out of scope for this PR.
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
  handler: async (ctx, { userId, endpoint, limit: requestedLimit, windowMs }) => {
    // Server-side validation: reject unknown endpoints (prevents callers from
    // inventing endpoint names to create rate-limit rows that aren't enforced
    // elsewhere).
    const maxLimit = MAX_LIMITS[endpoint];
    if (maxLimit === undefined) {
      throw new Error(`Unknown rate-limit endpoint: ${endpoint}`);
    }

    // Clamp caller-passed limit to the server's maximum for this endpoint.
    const limit = Math.min(Math.max(1, requestedLimit), maxLimit);

    // Validate window is in a reasonable range (prevents 1ms windows that
    // effectively disable rate limiting, or year-long windows that effectively
    // ban a user forever).
    if (windowMs < MIN_WINDOW_MS || windowMs > MAX_WINDOW_MS) {
      throw new Error(
        `windowMs must be between ${MIN_WINDOW_MS}ms and ${MAX_WINDOW_MS}ms`,
      );
    }
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
