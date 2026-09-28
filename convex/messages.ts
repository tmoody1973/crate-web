import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const list = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => q.search("content", args.query))
      .take(50);
    return results;
  },
});
