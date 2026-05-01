import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getAuth = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("telegraphAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const saveAuth = mutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    authorName: v.string(),
    authorUrl: v.optional(v.string()),
    indexPagePath: v.optional(v.string()),
    indexPageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegraphAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        authorName: args.authorName,
        authorUrl: args.authorUrl,
        indexPagePath: args.indexPagePath,
        indexPageUrl: args.indexPageUrl,
      });
      return existing._id;
    }
    return ctx.db.insert("telegraphAuth", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const listEntries = query({
  args: { userId: v.id("users"), category: v.optional(v.string()) },
  handler: async (ctx, args) => {
    let q = ctx.db
      .query("telegraphEntries")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");
    const entries = await q.collect();
    if (args.category) {
      return entries.filter((e) => e.category === args.category);
    }
    return entries;
  },
});

export const addEntry = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    telegraphPath: v.string(),
    telegraphUrl: v.string(),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("telegraphEntries", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const removeEntry = mutation({
  args: { entryId: v.id("telegraphEntries") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.entryId);
  },
});
