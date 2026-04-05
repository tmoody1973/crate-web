import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getAuth = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tumblrAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
  },
});

export const saveAuth = mutation({
  args: {
    userId: v.id("users"),
    oauthToken: v.string(),
    oauthTokenSecret: v.string(),
    blogName: v.string(),
    blogUrl: v.string(),
    blogUuid: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tumblrAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        oauthToken: args.oauthToken,
        oauthTokenSecret: args.oauthTokenSecret,
        blogName: args.blogName,
        blogUrl: args.blogUrl,
        blogUuid: args.blogUuid,
      });
      return existing._id;
    }
    return ctx.db.insert("tumblrAuth", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const removeAuth = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const auth = await ctx.db
      .query("tumblrAuth")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .first();
    if (auth) {
      await ctx.db.delete(auth._id);
    }
  },
});

export const listPosts = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return ctx.db
      .query("tumblrPosts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(20);
  },
});

export const addPost = mutation({
  args: {
    userId: v.id("users"),
    tumblrPostId: v.string(),
    title: v.string(),
    blogName: v.string(),
    postUrl: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("tumblrPosts", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
