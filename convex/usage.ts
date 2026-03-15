import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Atomic mutation: count current usage, check against limit, write event if allowed.
 * Must be a single mutation to prevent race conditions.
 */
export const recordAndCheckQuota = mutation({
  args: {
    userId: v.id("users"),
    type: v.union(v.literal("agent_query"), v.literal("chat_query")),
    periodStart: v.number(),
    limit: v.number(),
    teamDomain: v.optional(v.string()),
  },
  handler: async (ctx, { userId, type, periodStart, limit, teamDomain }) => {
    // Count existing usage in this period
    let used: number;
    if (teamDomain) {
      // Team pooled counting
      const events = await ctx.db
        .query("usageEvents")
        .withIndex("by_team_domain_period", (q) =>
          q.eq("teamDomain", teamDomain).eq("periodStart", periodStart)
        )
        .filter((q) => q.eq(q.field("type"), type))
        .collect();
      used = events.length;
    } else {
      const events = await ctx.db
        .query("usageEvents")
        .withIndex("by_user_type_period", (q) =>
          q.eq("userId", userId).eq("type", type).eq("periodStart", periodStart)
        )
        .collect();
      used = events.length;
    }

    if (used >= limit) {
      return { allowed: false, used, limit };
    }

    // Write the usage event
    await ctx.db.insert("usageEvents", {
      userId,
      type,
      teamDomain,
      periodStart,
      createdAt: Date.now(),
    });

    return { allowed: true, used: used + 1, limit };
  },
});

export const getUsageSummary = query({
  args: { userId: v.id("users"), periodStart: v.number() },
  handler: async (ctx, { userId, periodStart }) => {
    const agentEvents = await ctx.db
      .query("usageEvents")
      .withIndex("by_user_type_period", (q) =>
        q.eq("userId", userId).eq("type", "agent_query").eq("periodStart", periodStart)
      )
      .collect();

    return {
      agentQueriesUsed: agentEvents.length,
    };
  },
});

export const countTeamAgentQueries = query({
  args: { teamDomain: v.string(), periodStart: v.number() },
  handler: async (ctx, { teamDomain, periodStart }) => {
    const events = await ctx.db
      .query("usageEvents")
      .withIndex("by_team_domain_period", (q) =>
        q.eq("teamDomain", teamDomain).eq("periodStart", periodStart)
      )
      .filter((q) => q.eq(q.field("type"), "agent_query"))
      .collect();

    return events.length;
  },
});
