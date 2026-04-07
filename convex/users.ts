import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});

export const setHelpPersona = mutation({
  args: {
    clerkId: v.string(),
    helpPersona: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { helpPersona: args.helpPersona });
  },
});

export const completeOnboarding = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});

export const updateStripeCustomerId = mutation({
  args: {
    userId: v.id("users"),
    stripeCustomerId: v.string(),
  },
  handler: async (ctx, { userId, stripeCustomerId }) => {
    await ctx.db.patch(userId, { stripeCustomerId });
  },
});

/** Remap Clerk IDs after dev-to-prod migration. Protected by admin secret. */
export const remapClerkIds = mutation({
  args: {
    adminSecret: v.string(),
    mappings: v.array(
      v.object({
        oldClerkId: v.string(),
        newClerkId: v.string(),
        email: v.optional(v.string()),
      }),
    ),
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { adminSecret, mappings, dryRun }) => {
    // Simple admin check — use ENCRYPTION_KEY as the shared secret
    if (adminSecret !== process.env.ENCRYPTION_KEY) {
      throw new Error("Unauthorized: invalid admin secret");
    }
    const results: Array<{
      oldClerkId: string;
      newClerkId: string;
      email?: string;
      status: string;
      userId?: string;
    }> = [];

    for (const mapping of mappings) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", mapping.oldClerkId))
        .unique();

      if (!user) {
        results.push({ ...mapping, status: "missing" });
        continue;
      }

      if (mapping.oldClerkId === mapping.newClerkId) {
        results.push({ ...mapping, status: "noop", userId: user._id });
        continue;
      }

      // Check for conflict — new ID already exists on a different user
      const conflict = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q) => q.eq("clerkId", mapping.newClerkId))
        .unique();

      if (conflict && conflict._id !== user._id) {
        results.push({ ...mapping, status: "conflict", userId: user._id });
        continue;
      }

      if (!dryRun) {
        await ctx.db.patch(user._id, { clerkId: mapping.newClerkId });
      }

      results.push({
        ...mapping,
        status: dryRun ? "would_update" : "updated",
        userId: user._id,
      });
    }

    return {
      total: mappings.length,
      updated: results.filter((r) => r.status === "updated" || r.status === "would_update").length,
      missing: results.filter((r) => r.status === "missing").length,
      conflicts: results.filter((r) => r.status === "conflict").length,
      noop: results.filter((r) => r.status === "noop").length,
      results,
    };
  },
});
