/**
 * Shared rate-limit helper for Vercel route handlers.
 *
 * Calls the Convex `rateLimits.checkAndIncrement` mutation which atomically
 * increments and returns whether the request is allowed. Replaces the broken
 * in-memory `Map` pattern that didn't work across Vercel serverless function
 * instances.
 */

import type { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
};

export type RateLimitArgs = {
  convex: ConvexHttpClient;
  userId: Id<"users">;
  endpoint: string;
  limit: number;
  windowMs: number;
};

export async function checkRateLimit({
  convex,
  userId,
  endpoint,
  limit,
  windowMs,
}: RateLimitArgs): Promise<RateLimitResult> {
  return await convex.mutation(api.rateLimits.checkAndIncrement, {
    userId,
    endpoint,
    limit,
    windowMs,
  });
}

/**
 * Build the `Retry-After` header value (seconds until reset) from a
 * failed rate-limit result. Used in 429 responses.
 */
export function retryAfterSeconds(result: RateLimitResult): number {
  return Math.max(1, Math.ceil((result.resetAt - Date.now()) / 1000));
}

/**
 * Build standard rate-limit response headers for returning to the client.
 */
export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(Math.floor(result.resetAt / 1000)),
  };
}
