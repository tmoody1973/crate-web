import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("collection")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const search = query({
  args: { query: v.string(), userId: v.id("users") },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];
    const results = await ctx.db
      .query("collection")
      .withSearchIndex("search_collection", (q) =>
        q.search("title", args.query).eq("userId", args.userId),
      )
      .take(20);
    return results;
  },
});

export const add = mutation({
  args: {
    userId: v.id("users"),
    title: v.string(),
    artist: v.string(),
    label: v.optional(v.string()),
    year: v.optional(v.string()),
    format: v.optional(v.string()),
    genre: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    discogsId: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("collection", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const addMultiple = mutation({
  args: {
    userId: v.id("users"),
    items: v.array(
      v.object({
        title: v.string(),
        artist: v.string(),
        label: v.optional(v.string()),
        year: v.optional(v.string()),
        format: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const ids = [];
    for (const item of args.items) {
      const id = await ctx.db.insert("collection", {
        userId: args.userId,
        ...item,
        createdAt: Date.now(),
      });
      ids.push(id);
    }
    return ids;
  },
});

export const update = mutation({
  args: {
    id: v.id("collection"),
    title: v.optional(v.string()),
    artist: v.optional(v.string()),
    label: v.optional(v.string()),
    year: v.optional(v.string()),
    format: v.optional(v.string()),
    genre: v.optional(v.string()),
    notes: v.optional(v.string()),
    rating: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    if (Object.keys(updates).length > 0) {
      await ctx.db.patch(id, updates);
    }
  },
});

export const remove = mutation({
  args: { id: v.id("collection") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

export const stats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const items = await ctx.db
      .query("collection")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const formats = new Map<string, number>();
    const genres = new Map<string, number>();

    for (const item of items) {
      if (item.format) {
        formats.set(item.format, (formats.get(item.format) ?? 0) + 1);
      }
      if (item.genre) {
        genres.set(item.genre, (genres.get(item.genre) ?? 0) + 1);
      }
    }

    return {
      total: items.length,
      formats: Object.fromEntries(formats),
      genres: Object.fromEntries(genres),
    };
  },
});
