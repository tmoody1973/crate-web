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
