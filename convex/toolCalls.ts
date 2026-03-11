import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const start = mutation({
  args: {
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    args: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolCalls", {
      sessionId: args.sessionId,
      messageId: args.messageId,
      toolName: args.toolName,
      args: args.args,
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("toolCalls"),
    result: v.string(),
    status: v.union(v.literal("complete"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      result: args.result,
      status: args.status,
      completedAt: Date.now(),
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
