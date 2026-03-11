import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", {
      sessionId: args.sessionId,
      messageId: args.messageId,
      type: args.type,
      data: args.data,
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
