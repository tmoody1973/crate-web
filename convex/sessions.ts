import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sessions", {
      userId: args.userId,
      isShared: false,
      isStarred: false,
      isArchived: false,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listRecent = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_recent", (q) => q.eq("userId", args.userId))
      .order("desc")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(limit);
  },
});

export const listStarred = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_starred", (q) =>
        q.eq("userId", args.userId).eq("isStarred", true),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

export const listByCrate = query({
  args: { userId: v.id("users"), crateId: v.id("crates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_crate", (q) =>
        q.eq("userId", args.userId).eq("crateId", args.crateId),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("sessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const toggleStar = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(args.id, { isStarred: !session.isStarred });
  },
});

export const assignToCrate = mutation({
  args: {
    id: v.id("sessions"),
    crateId: v.optional(v.id("crates")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      crateId: args.crateId,
      updatedAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});

export const toggleShare = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(args.id, { isShared: !session.isShared });
  },
});

export const remove = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    // Delete all messages for this session
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const m of messages) {
      await ctx.db.delete(m._id);
    }

    // Delete all artifacts for this session
    const artifacts = await ctx.db
      .query("artifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const a of artifacts) {
      await ctx.db.delete(a._id);
    }

    // Delete all tool calls for this session
    const toolCalls = await ctx.db
      .query("toolCalls")
      .withIndex("by_session", (q) => q.eq("sessionId", args.id))
      .collect();
    for (const t of toolCalls) {
      await ctx.db.delete(t._id);
    }

    // Delete the session itself
    await ctx.db.delete(args.id);
  },
});

export const touchLastMessage = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      lastMessageAt: now,
      updatedAt: now,
    });
  },
});
