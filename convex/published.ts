import { v } from "convex/values";
import { query } from "./_generated/server";

/** List all published items (Telegraph entries + Tumblr posts) merged and sorted by date. */
export const listAll = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [telegraphEntries, tumblrPosts] = await Promise.all([
      ctx.db
        .query("telegraphEntries")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("tumblrPosts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    const items = [
      ...telegraphEntries.map((e) => ({
        _id: e._id,
        platform: "telegraph" as const,
        title: e.title,
        url: e.telegraphUrl,
        category: e.category,
        createdAt: e.createdAt,
      })),
      ...tumblrPosts.map((p) => ({
        _id: p._id,
        platform: "tumblr" as const,
        title: p.title,
        url: p.postUrl,
        category: p.category,
        createdAt: p.createdAt,
      })),
    ];

    items.sort((a, b) => b.createdAt - a.createdAt);
    return items;
  },
});

/** Count of published items per platform. */
export const stats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const [telegraphEntries, tumblrPosts] = await Promise.all([
      ctx.db
        .query("telegraphEntries")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
      ctx.db
        .query("tumblrPosts")
        .withIndex("by_user", (q) => q.eq("userId", args.userId))
        .collect(),
    ]);

    return {
      total: telegraphEntries.length + tumblrPosts.length,
      telegraph: telegraphEntries.length,
      tumblr: tumblrPosts.length,
    };
  },
});
