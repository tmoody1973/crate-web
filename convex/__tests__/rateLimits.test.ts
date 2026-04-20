import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api } from "../_generated/api";

// convex-test loads all Convex modules via Vite's import.meta.glob. The glob
// pattern must be relative to this test file. This is the canonical convex-test
// setup — see https://docs.convex.dev/testing. Vite-specific API; TypeScript
// lacks the ambient type so we cast once here.
const modules = (
  import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }
).glob("../**/*.*s");

async function makeUser(t: ReturnType<typeof convexTest>) {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `test-${Math.random().toString(36).slice(2)}`,
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
}

const ENDPOINT = "influence_expand";
const LIMIT = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1 hour

describe("rateLimits.checkAndIncrement", () => {
  it("allows the first request and records the window", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    const result = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: ENDPOINT,
      limit: LIMIT,
      windowMs: WINDOW_MS,
    });

    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
    expect(result.limit).toBe(10);
    expect(result.resetAt).toBeGreaterThan(Date.now());
  });

  it("decrements remaining on each subsequent request within the window", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    for (let i = 1; i <= 5; i++) {
      const result = await t.mutation(api.rateLimits.checkAndIncrement, {
        userId,
        endpoint: ENDPOINT,
        limit: LIMIT,
        windowMs: WINDOW_MS,
      });
      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(LIMIT - i);
    }
  });

  it("blocks at the limit and returns allowed=false", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    // Exhaust the quota
    for (let i = 0; i < LIMIT; i++) {
      const r = await t.mutation(api.rateLimits.checkAndIncrement, {
        userId,
        endpoint: ENDPOINT,
        limit: LIMIT,
        windowMs: WINDOW_MS,
      });
      expect(r.allowed).toBe(true);
    }

    // One more — should fail
    const blocked = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: ENDPOINT,
      limit: LIMIT,
      windowMs: WINDOW_MS,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
  });

  it("resets the window after windowMs elapses", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    const shortWindow = 50; // 50 ms window for fast test

    // Exhaust the quota
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.checkAndIncrement, {
        userId,
        endpoint: ENDPOINT,
        limit: 3,
        windowMs: shortWindow,
      });
    }

    const blocked = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: ENDPOINT,
      limit: 3,
      windowMs: shortWindow,
    });
    expect(blocked.allowed).toBe(false);

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, shortWindow + 10));

    const afterReset = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: ENDPOINT,
      limit: 3,
      windowMs: shortWindow,
    });
    expect(afterReset.allowed).toBe(true);
    expect(afterReset.remaining).toBe(2);
  });

  it("keeps separate counters per (user, endpoint)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    // Exhaust quota on endpoint A
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.checkAndIncrement, {
        userId,
        endpoint: "endpoint_a",
        limit: 3,
        windowMs: WINDOW_MS,
      });
    }
    const blockedA = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: "endpoint_a",
      limit: 3,
      windowMs: WINDOW_MS,
    });
    expect(blockedA.allowed).toBe(false);

    // Endpoint B should be unaffected
    const b = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId,
      endpoint: "endpoint_b",
      limit: 3,
      windowMs: WINDOW_MS,
    });
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(2);
  });

  it("keeps separate counters per user on the same endpoint", async () => {
    const t = convexTest(schema, modules);
    const userA = await makeUser(t);
    const userB = await makeUser(t);

    // Exhaust quota for user A
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.checkAndIncrement, {
        userId: userA,
        endpoint: ENDPOINT,
        limit: 3,
        windowMs: WINDOW_MS,
      });
    }
    const blockedA = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId: userA,
      endpoint: ENDPOINT,
      limit: 3,
      windowMs: WINDOW_MS,
    });
    expect(blockedA.allowed).toBe(false);

    // User B should be unaffected
    const b = await t.mutation(api.rateLimits.checkAndIncrement, {
      userId: userB,
      endpoint: ENDPOINT,
      limit: 3,
      windowMs: WINDOW_MS,
    });
    expect(b.allowed).toBe(true);
    expect(b.remaining).toBe(2);
  });
});

// ─── RT1 REGRESSION TEST (critical per eng review plan) ──────────────────────
//
// RT1 verifies that rate-limiting works across simulated concurrent function
// instances — the failure mode the old in-memory Map pattern had on Vercel
// serverless. Convex mutations are serialized transactions, so parallel
// mutation calls to the same row must all consume from a single counter.
//
// Without the migration, the old in-memory Map was per-function-instance, so
// 10 parallel requests across 10 instances each saw count=0 and all passed.
// With the Convex table, all 10 parallel requests serialize through the same
// row and the 11th is blocked.
// ─────────────────────────────────────────────────────────────────────────────

describe("RT1: rate-limit enforced across simulated concurrent instances", () => {
  it("serializes 15 parallel requests against a limit of 10 — only 10 allowed", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    // Fire 15 parallel requests — simulating concurrent Vercel function
    // instances hitting the same rate-limited endpoint simultaneously.
    const results = await Promise.all(
      Array.from({ length: 15 }, () =>
        t.mutation(api.rateLimits.checkAndIncrement, {
          userId,
          endpoint: ENDPOINT,
          limit: LIMIT,
          windowMs: WINDOW_MS,
        }),
      ),
    );

    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;

    // Exactly 10 should be allowed (the limit), 5 blocked. The old in-memory
    // Map would have allowed all 15 because each instance saw its own count=0.
    expect(allowed).toBe(10);
    expect(blocked).toBe(5);
  });

  it("does not double-count under concurrent re-window contention", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    const shortWindow = 30;

    // Exhaust the quota
    for (let i = 0; i < 3; i++) {
      await t.mutation(api.rateLimits.checkAndIncrement, {
        userId,
        endpoint: ENDPOINT,
        limit: 3,
        windowMs: shortWindow,
      });
    }

    // Wait for window to expire
    await new Promise((resolve) => setTimeout(resolve, shortWindow + 10));

    // Fire 5 parallel requests against a fresh window with limit 3
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        t.mutation(api.rateLimits.checkAndIncrement, {
          userId,
          endpoint: ENDPOINT,
          limit: 3,
          windowMs: shortWindow,
        }),
      ),
    );

    const allowed = results.filter((r) => r.allowed).length;
    // Exactly 3 should pass — the fresh-window transition must not double-open
    expect(allowed).toBe(3);
  });
});
