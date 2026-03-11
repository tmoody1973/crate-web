import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    label: v.string(),
    data: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("contentHash"), args.contentHash))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("artifacts", {
      sessionId: args.sessionId,
      userId: args.userId,
      messageId: args.messageId,
      type: args.type,
      label: args.label,
      data: args.data,
      contentHash: args.contentHash,
      createdAt: Date.now(),
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});
