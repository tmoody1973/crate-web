import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    userId: v.id("users"),
    encryptedKeys: v.bytes(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      encryptedKeys: args.encryptedKeys,
    });
  },
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.encryptedKeys ?? null;
  },
});
