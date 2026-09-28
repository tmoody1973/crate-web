import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  checkRateLimit,
  rateLimitHeaders,
  retryAfterSeconds,
  type RateLimitResult,
} from "../rate-limit";
import type { Id } from "../../../convex/_generated/dataModel";

// Minimal ConvexHttpClient mock — only `mutation` is invoked by checkRateLimit.
function makeMockConvex(response: RateLimitResult) {
  return {
    mutation: vi.fn().mockResolvedValue(response),
  } as unknown as Parameters<typeof checkRateLimit>[0]["convex"];
}

describe("checkRateLimit", () => {
  it("forwards args to the Convex mutation and returns its response", async () => {
    const response: RateLimitResult = {
      allowed: true,
      remaining: 9,
      resetAt: Date.now() + 3_600_000,
      limit: 10,
    };
    const convex = makeMockConvex(response);

    const result = await checkRateLimit({
      convex,
      userId: "u1" as Id<"users">,
      endpoint: "influence_expand",
      limit: 10,
      windowMs: 3_600_000,
    });

    expect(result).toEqual(response);
    // Verify the mutation was called with the expected args shape
    const mutation = (convex as unknown as { mutation: ReturnType<typeof vi.fn> })
      .mutation;
    expect(mutation).toHaveBeenCalledTimes(1);
    const [, args] = mutation.mock.calls[0]!;
    expect(args).toEqual({
      userId: "u1",
      endpoint: "influence_expand",
      limit: 10,
      windowMs: 3_600_000,
    });
  });

  it("propagates blocked responses (allowed=false)", async () => {
    const response: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 120_000,
      limit: 10,
    };
    const convex = makeMockConvex(response);

    const result = await checkRateLimit({
      convex,
      userId: "u1" as Id<"users">,
      endpoint: "influence_expand",
      limit: 10,
      windowMs: 3_600_000,
    });

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });
});

describe("retryAfterSeconds", () => {
  // Fake timers: pin Date.now() so tests are deterministic regardless of
  // wall-clock latency between result construction and assertion.
  const FROZEN_TIME = 1700000000000; // arbitrary stable epoch ms

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(FROZEN_TIME);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns seconds until reset", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: FROZEN_TIME + 30_000,
      limit: 10,
    };
    expect(retryAfterSeconds(result)).toBe(30);
  });

  it("returns at least 1 even when reset is in the past", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: FROZEN_TIME - 10_000,
      limit: 10,
    };
    expect(retryAfterSeconds(result)).toBe(1);
  });

  it("rounds up fractional seconds (ceil)", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: FROZEN_TIME + 1500,
      limit: 10,
    };
    // 1500ms = 1.5s, rounds up to 2
    expect(retryAfterSeconds(result)).toBe(2);
  });

  it("handles exactly 1 second", () => {
    const result: RateLimitResult = {
      allowed: false,
      remaining: 0,
      resetAt: FROZEN_TIME + 1000,
      limit: 10,
    };
    expect(retryAfterSeconds(result)).toBe(1);
  });
});

describe("rateLimitHeaders", () => {
  it("returns X-RateLimit-Limit/Remaining/Reset headers", () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 7,
      resetAt: 1700000000000, // 2023-11-14 in seconds = 1700000000
      limit: 10,
    };
    const headers = rateLimitHeaders(result);
    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("7");
    expect(headers["X-RateLimit-Reset"]).toBe("1700000000");
  });

  it("stringifies all header values (per HTTP spec)", () => {
    const result: RateLimitResult = {
      allowed: true,
      remaining: 0,
      resetAt: Date.now() + 1000,
      limit: 60,
    };
    const headers = rateLimitHeaders(result);
    for (const value of Object.values(headers)) {
      expect(typeof value).toBe("string");
    }
  });
});
