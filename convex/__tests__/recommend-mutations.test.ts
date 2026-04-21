import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../schema";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

// Convex module glob — see rateLimits.test.ts for the pattern rationale.
const modules = (
  import.meta as unknown as { glob: (p: string) => Record<string, () => Promise<unknown>> }
).glob("../**/*.*s");

async function makeUser(t: ReturnType<typeof convexTest>): Promise<Id<"users">> {
  return await t.run(async (ctx) => {
    return await ctx.db.insert("users", {
      clerkId: `test-${Math.random().toString(36).slice(2)}`,
      email: "test@example.com",
      createdAt: Date.now(),
    });
  });
}

describe("createInitialTour", () => {
  it("inserts a tour row with pending state + empty counters", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);

    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "sad about the climate", slug: "test-abcd" },
    );

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour).toBeTruthy();
    expect(tour!.slug).toBe("test-abcd");
    expect(tour!.prompt).toBe("sad about the climate");
    expect(tour!.lifecyclePhase).toBe("pending");
    expect(tour!.moderationStatus).toBe("pending");
    expect(tour!.isPublic).toBe(false);
    expect(tour!.artists).toEqual([]);
    expect(tour!.keepCount).toBe(0);
    expect(tour!.refineCount).toBe(0);
  });
});

describe("writeTourStatus", () => {
  it("appends a phase status row", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase: "classifying",
      progress: 0.1,
      detail: "Understanding your request",
    });
    await t.mutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase: "embedding",
      progress: 0.2,
    });

    const statuses = await t.run(
      async (ctx) =>
        await ctx.db
          .query("tourStatus")
          .withIndex("by_tour", (q) => q.eq("tourId", tourId))
          .collect(),
    );
    expect(statuses).toHaveLength(2);
    expect(statuses.map((s) => s.phase).sort()).toEqual(["classifying", "embedding"]);
  });
});

describe("setIntentClassification", () => {
  it("updates intentType + parsedQuery + moves lifecycle to generating", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.setIntentClassification, {
      tourId,
      intentType: "mood_theme",
      parsedQueryJson: '{"intent_type":"mood_theme"}',
    });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.intentType).toBe("mood_theme");
    expect(tour!.lifecyclePhase).toBe("generating");
  });
});

describe("markVague", () => {
  it("keeps lifecyclePhase at pending (UI shows clarify chips)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "good music", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.markVague, { tourId });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.lifecyclePhase).toBe("pending");
    // Note: intentType was set to "vague" by createInitialTour default, and
    // the caller (runGenerationFlow) also writes intentType=vague via
    // setIntentClassification BEFORE markVague. Either way, it's vague.
  });
});

describe("setPromptEmbedding", () => {
  it("sets the prompt embedding array", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    const embedding = Array.from({ length: 1024 }, (_, i) => i / 1024);
    await t.mutation(internal.recommend.mutations.setPromptEmbedding, {
      tourId,
      embedding,
    });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.promptEmbedding).toHaveLength(1024);
    expect(tour!.promptEmbedding[0]).toBe(0);
  });
});

describe("finalizeTour", () => {
  it("sets artists, completedAt, and approved → completed phase", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: "final-slug",
      artists: [
        { name: "ANOHNI", arcPosition: 0 },
        { name: "Moor Mother", arcPosition: 1 },
      ],
      citations: ["https://pitchfork.com/x"],
      perplexityFallbackUsed: false,
      promptRedacted: "climate grief music",
      promptShowRaw: false,
      moderationStatus: "approved",
      isPublic: true,
    });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.slug).toBe("final-slug");
    expect(tour!.artists).toHaveLength(2);
    expect(tour!.lifecyclePhase).toBe("completed");
    expect(tour!.isPublic).toBe(true);
    expect(tour!.completedAt).toBeTruthy();
    expect(tour!.moderatedAt).toBeTruthy();
  });

  it("flagged moderation → flagged phase + isPublic false", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: "final-slug",
      artists: [{ name: "X", arcPosition: 0 }],
      citations: [],
      perplexityFallbackUsed: false,
      promptRedacted: "x",
      promptShowRaw: false,
      moderationStatus: "flagged",
      moderationCategories: ["hate"],
      isPublic: false,
    });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.lifecyclePhase).toBe("flagged");
    expect(tour!.isPublic).toBe(false);
    expect(tour!.moderationCategories).toEqual(["hate"]);
  });
});

describe("markFailed", () => {
  it("sets lifecyclePhase to the given failure reason", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.markFailed, {
      tourId,
      reason: "timed_out",
    });

    const tour = await t.run(async (ctx) => await ctx.db.get(tourId));
    expect(tour!.lifecyclePhase).toBe("timed_out");
    expect(tour!.completedAt).toBeTruthy();
  });
});

describe("getTourBySlug", () => {
  it("returns a public tour by slug", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "test-slug-1" },
    );
    await t.mutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: "test-slug-1",
      artists: [{ name: "X", arcPosition: 0 }],
      citations: [],
      perplexityFallbackUsed: false,
      promptRedacted: "x",
      promptShowRaw: false,
      moderationStatus: "approved",
      isPublic: true,
    });

    const result = await t.query(api.recommend.mutations.getTourBySlug, {
      slug: "test-slug-1",
    });
    expect(result).toBeTruthy();
    expect(result!.slug).toBe("test-slug-1");
  });

  it("returns null for unknown slugs", async () => {
    const t = convexTest(schema, modules);
    const result = await t.query(api.recommend.mutations.getTourBySlug, {
      slug: "does-not-exist",
    });
    expect(result).toBeNull();
  });

  it("returns null for private tours (isPublic=false)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    await t.mutation(internal.recommend.mutations.createInitialTour, {
      userId,
      prompt: "x",
      slug: "private-tour",
    });
    // createInitialTour leaves isPublic=false — tour is not yet public
    const result = await t.query(api.recommend.mutations.getTourBySlug, {
      slug: "private-tour",
    });
    expect(result).toBeNull();
  });
});

describe("getTourStatus", () => {
  it("returns the latest status row for a tour", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "test-1" },
    );

    await t.mutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase: "classifying",
      progress: 0.1,
    });
    await t.mutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase: "embedding",
      progress: 0.2,
    });
    await t.mutation(internal.recommend.mutations.writeTourStatus, {
      tourId,
      phase: "done",
      progress: 1.0,
    });

    const latest = await t.query(api.recommend.mutations.getTourStatus, {
      tourId,
    });
    expect(latest).toBeTruthy();
    expect(latest!.phase).toBe("done");
    expect(latest!.progress).toBe(1.0);
  });

  it("returns null when no status rows exist for a tour", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "test-2" },
    );

    const latest = await t.query(api.recommend.mutations.getTourStatus, {
      tourId,
    });
    expect(latest).toBeNull();
  });
});

describe("recordSignal", () => {
  async function seedTour(
    t: ReturnType<typeof convexTest>,
  ): Promise<{ userId: Id<"users">; clerkId: string; tourId: Id<"artifactsRecommend"> }> {
    const clerkId = `clerk-${Math.random().toString(36).slice(2)}`;
    const userId = await t.run(async (ctx) =>
      ctx.db.insert("users", {
        clerkId,
        email: "sig@test.com",
        createdAt: Date.now(),
      }),
    );
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "sig test", slug: "sig-1234" },
    );
    await t.mutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: "sig-1234",
      artists: [
        { name: "Artist A", arcPosition: 0 },
        { name: "Artist B", arcPosition: 1 },
      ],
      citations: [],
      perplexityFallbackUsed: false,
      promptRedacted: "sig test",
      promptShowRaw: false,
      moderationStatus: "approved",
      isPublic: true,
    });
    return { userId, clerkId, tourId };
  }

  it("records a keep signal and increments the aggregate count", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, tourId } = await seedTour(t);

    const auth = t.withIdentity({ subject: clerkId });
    await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 0,
      signal: "keep",
    });

    const tour = await t.run(async (ctx) => ctx.db.get(tourId));
    expect(tour!.keepCount).toBe(1);
    expect(tour!.passCount).toBe(0);

    const map = await auth.query(
      api.recommend.mutations.getMySignalsForTour,
      { tourId },
    );
    expect(map).toEqual({ 0: "keep" });
  });

  it("switching signals updates counts atomically (keep → pass)", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, tourId } = await seedTour(t);
    const auth = t.withIdentity({ subject: clerkId });

    await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 1,
      signal: "keep",
    });
    await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 1,
      signal: "pass",
    });

    const tour = await t.run(async (ctx) => ctx.db.get(tourId));
    expect(tour!.keepCount).toBe(0);
    expect(tour!.passCount).toBe(1);
  });

  it("clearSignal deletes the row and decrements the aggregate", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, tourId } = await seedTour(t);
    const auth = t.withIdentity({ subject: clerkId });

    await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 0,
      signal: "save",
    });
    await auth.mutation(api.recommend.mutations.clearSignal, {
      tourId,
      artistPosition: 0,
    });

    const tour = await t.run(async (ctx) => ctx.db.get(tourId));
    expect(tour!.saveCount).toBe(0);

    const map = await auth.query(
      api.recommend.mutations.getMySignalsForTour,
      { tourId },
    );
    expect(map).toEqual({});
  });

  it("rejects invalid artistPosition", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, tourId } = await seedTour(t);
    const auth = t.withIdentity({ subject: clerkId });

    await expect(
      auth.mutation(api.recommend.mutations.recordSignal, {
        tourId,
        artistPosition: 99,
        signal: "keep",
      }),
    ).rejects.toThrow(/Invalid artist position/);
  });

  it("throws when unauthenticated", async () => {
    const t = convexTest(schema, modules);
    const { tourId } = await seedTour(t);

    await expect(
      t.mutation(api.recommend.mutations.recordSignal, {
        tourId,
        artistPosition: 0,
        signal: "keep",
      }),
    ).rejects.toThrow(/Not authenticated/);
  });

  it("idempotent: recording the same signal twice leaves counts at 1", async () => {
    const t = convexTest(schema, modules);
    const { clerkId, tourId } = await seedTour(t);
    const auth = t.withIdentity({ subject: clerkId });

    await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 0,
      signal: "keep",
    });
    const res = await auth.mutation(api.recommend.mutations.recordSignal, {
      tourId,
      artistPosition: 0,
      signal: "keep",
    });
    expect(res.unchanged).toBe(true);

    const tour = await t.run(async (ctx) => ctx.db.get(tourId));
    expect(tour!.keepCount).toBe(1);
  });
});

describe("recordShare", () => {
  it("increments shareCount on a public tour", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "share-1" },
    );
    await t.mutation(internal.recommend.mutations.finalizeTour, {
      tourId,
      slug: "share-1",
      artists: [{ name: "A", arcPosition: 0 }],
      citations: [],
      perplexityFallbackUsed: false,
      promptRedacted: "x",
      promptShowRaw: false,
      moderationStatus: "approved",
      isPublic: true,
    });

    await t.mutation(api.recommend.mutations.recordShare, { tourId });
    await t.mutation(api.recommend.mutations.recordShare, { tourId });

    const tour = await t.run(async (ctx) => ctx.db.get(tourId));
    expect(tour!.shareCount).toBe(2);
  });

  it("returns ok:false for private tours (does not leak state)", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "priv-1" },
    );
    const res = await t.mutation(api.recommend.mutations.recordShare, {
      tourId,
    });
    expect(res.ok).toBe(false);
  });
});

describe("logTourEvent", () => {
  it("inserts a tourEvents row with all fields", async () => {
    const t = convexTest(schema, modules);
    const userId = await makeUser(t);
    const tourId = await t.mutation(
      internal.recommend.mutations.createInitialTour,
      { userId, prompt: "x", slug: "x-1234" },
    );

    await t.mutation(internal.recommend.mutations.logTourEvent, {
      tourId,
      userIdHash: "abc123",
      intentType: "mood_theme",
      promptLength: 42,
      promptHash: "hash1234",
      phaseDurations: '{"classify":500}',
      cacheMatched: false,
      perplexityFallbackUsed: false,
      artistCount: 10,
      verifiedCitationCount: 7,
      moderationStatus: "approved",
      costUsd: 0.05,
      errors: [],
    });

    const events = await t.run(
      async (ctx) =>
        await ctx.db
          .query("tourEvents")
          .withIndex("by_tour", (q) => q.eq("tourId", tourId))
          .collect(),
    );
    expect(events).toHaveLength(1);
    expect(events[0]!.intentType).toBe("mood_theme");
    expect(events[0]!.costUsd).toBeCloseTo(0.05);
  });
});
