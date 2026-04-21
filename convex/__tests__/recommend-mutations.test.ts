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
