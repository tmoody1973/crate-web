import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    shareId: v.string(),
    artifactId: v.id("artifacts"),
    userId: v.id("users"),
    label: v.string(),
    type: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("shares", {
      ...args,
      isPublic: true,
      createdAt: Date.now(),
    });
  },
});

export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
      .first();
  },
});

export const getByArtifact = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_artifact", (q) => q.eq("artifactId", artifactId))
      .first();
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const unpublish = mutation({
  args: { shareId: v.id("shares") },
  handler: async (ctx, { shareId }) => {
    await ctx.db.patch(shareId, {
      isPublic: false,
    });
  },
});
