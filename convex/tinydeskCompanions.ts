import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    return await ctx.db
      .query("tinydeskCompanions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("tinydeskCompanions")
      .order("desc")
      .take(50);
  },
});

export const listSlugs = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("tinydeskCompanions").collect();
    return all.map((c) => ({
      slug: c.slug,
      artist: c.artist,
      genre: c.genre,
      tinyDeskVideoId: c.tinyDeskVideoId,
      isCommunitySubmitted: c.isCommunitySubmitted,
    }));
  },
});

export const create = mutation({
  args: {
    slug: v.string(),
    artist: v.string(),
    tagline: v.string(),
    tinyDeskVideoId: v.string(),
    nodes: v.string(),
    userId: v.id("users"),
    genre: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    isCommunitySubmitted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate nodes are not empty
    let parsedNodes: unknown[];
    try {
      parsedNodes = JSON.parse(args.nodes);
    } catch {
      throw new Error("Invalid nodes JSON");
    }
    if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
      throw new Error("Companion must have at least one influence connection");
    }

    const existing = await ctx.db
      .query("tinydeskCompanions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        artist: args.artist,
        tagline: args.tagline,
        tinyDeskVideoId: args.tinyDeskVideoId,
        nodes: args.nodes,
        genre: args.genre,
        sourceUrl: args.sourceUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("tinydeskCompanions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const deleteBySlug = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const existing = await ctx.db
      .query("tinydeskCompanions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
