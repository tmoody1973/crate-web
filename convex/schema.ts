import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    encryptedKeys: v.optional(v.bytes()),
    onboardingCompleted: v.optional(v.boolean()),
    helpPersona: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
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

  playlists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    coverUrl: v.optional(v.string()),
    trackCount: v.number(),
    totalDurationMs: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  playlistTracks: defineTable({
    playlistId: v.id("playlists"),
    title: v.string(),
    artist: v.string(),
    album: v.optional(v.string()),
    year: v.optional(v.string()),
    source: v.union(v.literal("youtube"), v.literal("bandcamp"), v.literal("unknown")),
    sourceId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    position: v.number(),
    addedAt: v.number(),
  }).index("by_playlist", ["playlistId", "position"]),

  collection: defineTable({
    userId: v.id("users"),
    title: v.string(),
    artist: v.string(),
    label: v.optional(v.string()),
    year: v.optional(v.string()),
    format: v.optional(v.string()),
    genre: v.optional(v.string()),
    notes: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    discogsId: v.optional(v.string()),
    rating: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .searchIndex("search_collection", {
      searchField: "title",
      filterFields: ["userId"],
    }),

  // Publishing: Telegraph (per-user anonymous accounts)
  telegraphAuth: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    authorName: v.string(),
    authorUrl: v.optional(v.string()),
    indexPagePath: v.optional(v.string()),
    indexPageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  telegraphEntries: defineTable({
    userId: v.id("users"),
    title: v.string(),
    telegraphPath: v.string(),
    telegraphUrl: v.string(),
    category: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  // Publishing: Tumblr (per-user OAuth 1.0a credentials)
  tumblrAuth: defineTable({
    userId: v.id("users"),
    oauthToken: v.string(),
    oauthTokenSecret: v.string(),
    blogName: v.string(),
    blogUrl: v.string(),
    blogUuid: v.string(),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  tumblrPosts: defineTable({
    userId: v.id("users"),
    tumblrPostId: v.string(),
    title: v.string(),
    blogName: v.string(),
    postUrl: v.string(),
    category: v.optional(v.string()),
    tags: v.optional(v.string()), // JSON array
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  orgKeys: defineTable({
    domain: v.string(),
    encryptedKeys: v.bytes(),
    adminUserId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_domain", ["domain"]),

  // Influence mapping cache
  influenceArtists: defineTable({
    userId: v.id("users"),
    name: v.string(),
    nameLower: v.string(),
    genres: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user_name", ["userId", "nameLower"]),

  influenceEdges: defineTable({
    userId: v.id("users"),
    fromArtistId: v.id("influenceArtists"),
    toArtistId: v.id("influenceArtists"),
    relationship: v.string(),
    weight: v.number(),
    mentionCount: v.optional(v.number()),
    context: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_from", ["userId", "fromArtistId"])
    .index("by_to", ["userId", "toArtistId"]),

  artistTagProfiles: defineTable({
    userId: v.id("users"),
    artistId: v.id("influenceArtists"),
    tags: v.string(), // JSON object: {"electronic": 100, "ambient": 85, "idm": 60}
    fetchedAt: v.number(),
  }).index("by_artist", ["artistId"])
    .index("by_user", ["userId"]),

  sonicProfiles: defineTable({
    userId: v.id("users"),
    artistId: v.id("influenceArtists"),
    features: v.string(), // JSON: {tempo, energy, loudness, danceability, speechiness, ...}
    source: v.string(), // "lastfm_tags" | "essentia" | "manual"
    fetchedAt: v.number(),
  }).index("by_artist", ["artistId"])
    .index("by_user", ["userId"]),

  influenceEdgeSources: defineTable({
    edgeId: v.id("influenceEdges"),
    sourceType: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceName: v.optional(v.string()),
    snippet: v.optional(v.string()),
    discoveredAt: v.number(),
  }).index("by_edge", ["edgeId"]),

  subscriptions: defineTable({
    userId: v.id("users"),
    plan: v.union(v.literal("free"), v.literal("pro"), v.literal("team")),
    status: v.union(v.literal("active"), v.literal("canceled"), v.literal("past_due")),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
    teamDomain: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_stripe_sub", ["stripeSubscriptionId"])
    .index("by_team_domain", ["teamDomain"]),

  usageEvents: defineTable({
    userId: v.id("users"),
    type: v.union(v.literal("agent_query"), v.literal("chat_query")),
    teamDomain: v.optional(v.string()),
    periodStart: v.number(),
    createdAt: v.number(),
  }).index("by_user_period", ["userId", "periodStart"])
    .index("by_user_type_period", ["userId", "type", "periodStart"])
    .index("by_team_domain_period", ["teamDomain", "periodStart"]),

  userSkills: defineTable({
    userId: v.id("users"),
    command: v.string(),
    name: v.string(),
    description: v.string(),
    triggerPattern: v.optional(v.string()),
    promptTemplate: v.string(),
    toolHints: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
    lastResults: v.optional(v.string()),
    gotchas: v.optional(v.string()),
    runCount: v.number(),
    visibility: v.literal("private"),
    isEnabled: v.boolean(),
    schedule: v.optional(v.string()),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_command", ["userId", "command"]),
});
