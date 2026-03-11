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

  crates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    crateId: v.optional(v.id("crates")),
    title: v.optional(v.string()),
    isShared: v.boolean(),
    isStarred: v.boolean(),
    isArchived: v.boolean(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_starred", ["userId", "isStarred"])
    .index("by_user_crate", ["userId", "crateId"])
    .index("by_user_recent", ["userId", "lastMessageAt"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["sessionId"],
    }),

  artifacts: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    label: v.string(),
    data: v.string(),
    contentHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

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
