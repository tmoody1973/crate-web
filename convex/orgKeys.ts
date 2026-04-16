import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByDomain = query({
  args: { domain: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("orgKeys")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();
  },
});

export const store = mutation({
  args: {
    domain: v.string(),
    encryptedKeys: v.bytes(),
    adminUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("orgKeys")
      .withIndex("by_domain", (q) => q.eq("domain", args.domain))
      .first();

    const now = Date.now();
    if (existing) {
      // Only the original admin can update
      if (existing.adminUserId !== args.adminUserId) {
        throw new Error("Only the org admin can update shared keys");
      }
      await ctx.db.patch(existing._id, {
        encryptedKeys: args.encryptedKeys,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert("orgKeys", {
      domain: args.domain,
      encryptedKeys: args.encryptedKeys,
      adminUserId: args.adminUserId,
      createdAt: now,
      updatedAt: now,
    });
  },
});
