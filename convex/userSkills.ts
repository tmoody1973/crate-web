import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getByUserCommand = query({
  args: { userId: v.id("users"), command: v.string() },
  handler: async (ctx, { userId, command }) => {
    return await ctx.db
      .query("userSkills")
      .withIndex("by_user_command", (q) =>
        q.eq("userId", userId).eq("command", command),
      )
      .first();
  },
});

export const countByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const skills = await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return skills.length;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    command: v.string(),
    name: v.string(),
    description: v.string(),
    promptTemplate: v.string(),
    toolHints: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userSkills")
      .withIndex("by_user_command", (q) =>
        q.eq("userId", args.userId).eq("command", args.command),
      )
      .first();
    if (existing) {
      throw new Error(`Command /${args.command} already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("userSkills", {
      ...args,
      visibility: "private" as const,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    skillId: v.id("userSkills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    promptTemplate: v.optional(v.string()),
    toolHints: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { skillId, ...fields }) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(skillId, updates);
  },
});

export const toggleEnabled = mutation({
  args: { skillId: v.id("userSkills") },
  handler: async (ctx, { skillId }) => {
    const skill = await ctx.db.get(skillId);
    if (!skill) throw new Error("Skill not found");
    await ctx.db.patch(skillId, {
      isEnabled: !skill.isEnabled,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { skillId: v.id("userSkills") },
  handler: async (ctx, { skillId }) => {
    await ctx.db.delete(skillId);
  },
});
