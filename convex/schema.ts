import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    encryptedKeys: v.optional(v.bytes()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  sessions: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    isShared: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  artifacts: defineTable({
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    data: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  toolCalls: defineTable({
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    args: v.string(),
    result: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_session", ["sessionId"]),

  playerQueue: defineTable({
    sessionId: v.id("sessions"),
    tracks: v.array(
      v.object({
        title: v.string(),
        artist: v.string(),
        source: v.union(v.literal("youtube"), v.literal("bandcamp")),
        sourceId: v.string(),
        imageUrl: v.optional(v.string()),
      }),
    ),
    currentIndex: v.number(),
  }).index("by_session", ["sessionId"]),
});
