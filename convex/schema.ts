import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    usernameSlug: v.optional(v.string()),
    encryptedKeys: v.optional(v.bytes()),
    onboardingCompleted: v.optional(v.boolean()),
    helpPersona: v.optional(v.string()),
    stripeCustomerId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_username_slug", ["usernameSlug"]),

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

  // ───── /recommend v1 tables ────────────────────────────────────────────────
  // All tables here support the /recommend tour generation flow. See
  // docs/crate-recommend-feature/v1-scope.md for the locked design.

  // Persistent store of every generated tour. Prompt embedding enables future
  // similarity-cache tuning (current threshold: 0.90 cosine; near-misses
  // 0.85–0.95 logged for week-2 calibration). Cross-user cache-match UI
  // deferred to Phase 2 per Codex privacy review.
  artifactsRecommend: defineTable({
    slug: v.string(),
    userId: v.id("users"),

    // Prompt + classification
    prompt: v.string(),                   // raw, creator-only
    promptRedacted: v.string(),           // generic 4-8 word summary for public display
    promptShowRaw: v.boolean(),           // creator opted to show raw on public page
    promptEmbedding: v.array(v.number()), // Voyage-3, 1024-dim
    intentType: v.union(
      v.literal("mood_theme"),
      v.literal("era_genre"),
      v.literal("artist_similar"),
      v.literal("activity"),
      v.literal("emotional"),
      v.literal("show_prep"),
      v.literal("single_artist"),
      v.literal("vague"),
    ),
    parsedQuery: v.string(),              // JSON of StructuredQuery from classifier

    // The tour — structured data
    artists: v.array(v.object({
      name: v.string(),
      album: v.optional(v.string()),
      year: v.optional(v.number()),
      // 600x600 album cover from iTunes Search API. Attached server-side
      // after picks come back, so the tour card renders without a client
      // fetch round-trip. Null when iTunes has no match (rare for major
      // artists, common for obscure small-label releases).
      artworkUrl: v.optional(v.string()),
      quote: v.optional(v.object({
        text: v.string(),
        publication: v.string(),
        author: v.optional(v.string()),
        url: v.string(),
        verified: v.boolean(),            // survived HEAD + quote-on-page check
      })),
      youtubeTrackId: v.optional(v.string()),
      arcPosition: v.number(),            // 0..N-1 ordering
    })),
    citations: v.array(v.string()),       // source URLs from Perplexity (legacy flat list; prefer `sources`)
    // Rich per-source cards from Perplexity's `search_results` response field.
    // Unlike the old model-generated quote_url path, every entry here has a
    // real title + snippet + URL that Perplexity actually searched. The UI
    // renders these as ReviewSourceCard cards (see /cuts for the pattern).
    // `artistsMentioned` is computed server-side by scanning each snippet +
    // title for tour artist names, which lets the UI cluster sources under
    // the relevant artist stops.
    sources: v.optional(v.array(v.object({
      url: v.string(),
      publication: v.string(),            // derived from hostname (e.g. "pitchfork.com")
      title: v.string(),
      snippet: v.optional(v.string()),
      date: v.optional(v.string()),
      // Optional hero image from Perplexity's images[] response field
      // (populated when the sonar-pro call is made with return_images: true).
      // Matched to this source entry by origin_url equality.
      heroImageUrl: v.optional(v.string()),
      artistsMentioned: v.array(v.string()),
    }))),
    perplexityFallbackUsed: v.boolean(),  // true if sparse-result fallback fired

    // Moderation + lifecycle state
    moderationStatus: v.union(
      v.literal("pending"),
      v.literal("approved"),
      v.literal("flagged"),
      v.literal("timed_out"),
    ),
    moderationCategories: v.optional(v.array(v.string())),
    moderationAttemptedAt: v.optional(v.number()),
    isPublic: v.boolean(),                // derived from moderationStatus; governs library visibility
    lifecyclePhase: v.union(
      v.literal("pending"),
      v.literal("generating"),
      v.literal("verifying"),
      v.literal("moderating"),
      v.literal("completed"),
      v.literal("timed_out"),
      v.literal("failed"),
      v.literal("flagged"),
    ),

    // Aggregate signal counts (Cherry-pick #12 scaffolding — UI deferred)
    keepCount: v.number(),
    passCount: v.number(),
    saveCount: v.number(),
    shareCount: v.number(),
    exportCount: v.number(),
    refineCount: v.number(),              // chip refinements spawned from this tour (observation-sprint signal)

    createdAt: v.number(),
    completedAt: v.optional(v.number()),
    moderatedAt: v.optional(v.number()),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"])
    .index("by_public_recent", ["isPublic", "createdAt"])
    .index("by_intent_public", ["intentType", "isPublic"])
    .index("by_moderation_status", ["moderationStatus"])
    .vectorIndex("by_embedding", {
      vectorField: "promptEmbedding",
      dimensions: 1024,
    }),

  // Real-time phase streaming state. Written during generation, read via
  // Convex useQuery subscription on the client. TTL-pruned by a cron after
  // 1 hour (completed tours don't need status rows anymore).
  tourStatus: defineTable({
    tourId: v.id("artifactsRecommend"),
    phase: v.string(),                    // e.g. "classifying", "perplexity_calling"
    progress: v.number(),                 // 0..1
    detail: v.optional(v.string()),       // user-visible text for the phase
    timestamp: v.number(),
  }).index("by_tour", ["tourId"]),

  // Per-tour observability record (cost, latency, errors, moderation outcome).
  // Also emitted to PostHog. TTL-pruned after 90 days.
  tourEvents: defineTable({
    tourId: v.id("artifactsRecommend"),
    userIdHash: v.string(),               // sha256(user._id + salt), first 16 chars — PII rule
    intentType: v.string(),
    promptLength: v.number(),
    promptHash: v.string(),               // first 8 chars of sha256(prompt)
    phaseDurations: v.string(),           // JSON per-phase ms
    cacheMatched: v.boolean(),
    cacheSimilarity: v.optional(v.number()),
    perplexityFallbackUsed: v.boolean(),
    artistCount: v.number(),
    verifiedCitationCount: v.number(),
    moderationStatus: v.string(),
    moderationCategories: v.optional(v.array(v.string())),
    costUsd: v.number(),
    errors: v.array(v.string()),          // named exception class names that fired
    createdAt: v.number(),
  })
    .index("by_tour", ["tourId"])
    .index("by_created", ["createdAt"]),

  // User-submitted tour reports. Rate-limited 5/user/day via the shared
  // rateLimits table (endpoint=recommend_report). Admin reviews via admin UI.
  tourReports: defineTable({
    tourId: v.id("artifactsRecommend"),
    userId: v.id("users"),
    reason: v.string(),                   // user-provided short description
    status: v.union(
      v.literal("pending"),
      v.literal("reviewed_approved"),
      v.literal("reviewed_blocked"),
    ),
    createdAt: v.number(),
    reviewedAt: v.optional(v.number()),
  })
    .index("by_tour", ["tourId"])
    .index("by_user_day", ["userId", "createdAt"])
    .index("by_status", ["status"]),

  // Admin-editable paywall domain list. Citation verification drops any quote
  // whose URL redirects to a domain here. Initial seed list ships in
  // src/lib/paywall-domains.ts; this table is for runtime edits without deploy.
  paywallDomains: defineTable({
    domain: v.string(),                   // bare hostname, lowercased (e.g. "nytimes.com")
    addedBy: v.id("users"),
    addedAt: v.number(),
    isActive: v.boolean(),
  }).index("by_domain", ["domain"]),

  // Cache for citation verification results. Keyed by URL + quote prefix hash
  // so the same URL + different quote re-verifies but the same combination
  // reuses the result for 24 hours. Pruned by cron after 24h.
  citationCache: defineTable({
    cacheKey: v.string(),                 // sha256(url + "|" + quote_prefix).slice(0,32)
    url: v.string(),
    quotePrefix: v.string(),              // first 30 chars of the quote we checked
    verified: v.boolean(),                // true if both URL check AND quote-on-page passed
    failureReason: v.optional(v.string()),// "paywall" | "url_unreachable" | "quote_not_found" | "cloudflare_challenge"
    checkedAt: v.number(),
  }).index("by_cache_key", ["cacheKey"]),

  // Per-user per-artist signals on a tour. Powers the keep/pass/save UI and
  // the aggregate signal counts on artifactsRecommend. Logical uniqueness:
  // (userId, tourId, artistPosition) — enforced at the mutation layer by
  // looking up the existing row via by_user_tour before inserting.
  //
  // Signal values:
  //   - "keep": tells us the user liked this artist (weights future tours)
  //   - "pass": user rejected it (negative weight for future tours)
  //   - "save": user wants to remember this artist (future: personal crate)
  tourSignals: defineTable({
    userId: v.id("users"),
    tourId: v.id("artifactsRecommend"),
    artistPosition: v.number(),           // 0..N-1 in the tour's artists array
    signal: v.union(
      v.literal("keep"),
      v.literal("pass"),
      v.literal("save"),
    ),
    createdAt: v.number(),
  })
    .index("by_user_tour", ["userId", "tourId"])
    .index("by_tour", ["tourId"]),

  // ───── End /recommend v1 tables ────────────────────────────────────────────

  // Shared rate-limit table. Composite logical key is (userId, endpoint).
  // Each (user, endpoint) pair has one row. The row is reused across windows
  // by resetting windowStart + count when a new window begins.
  // Rows live forever per (user, endpoint) — no cleanup needed because N is
  // bounded by users × endpoints.
  //
  // The `by_user_endpoint` index is a standard Convex index for query
  // performance only — Convex indexes do NOT enforce uniqueness. Atomicity
  // of the check-and-increment is guaranteed by Convex mutations being
  // serialized transactions (see convex/rateLimits.ts).
  rateLimits: defineTable({
    userId: v.id("users"),
    endpoint: v.string(),
    windowStart: v.number(),
    count: v.number(),
    lastHitAt: v.number(),
  }).index("by_user_endpoint", ["userId", "endpoint"]),

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

  // Deep Cuts: published/shared research artifacts
  shares: defineTable({
    shareId: v.string(),
    artifactId: v.id("artifacts"),
    userId: v.id("users"),
    label: v.string(),
    type: v.string(),
    data: v.string(),
    isPublic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_share_id", ["shareId"])
    .index("by_user", ["userId"])
    .index("by_artifact", ["artifactId"]),

  tinydeskCompanions: defineTable({
    slug: v.string(),
    artist: v.string(),
    tagline: v.string(),
    tinyDeskVideoId: v.string(),
    nodes: v.string(),
    userId: v.id("users"),
    genre: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    isCommunitySubmitted: v.optional(v.boolean()),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_user", ["userId"]),

  // Music Wiki: persistent, compounding artist knowledge base
  wikiPages: defineTable({
    userId: v.id("users"),
    slug: v.string(),
    entityType: v.literal("artist"),
    entityName: v.string(),
    description: v.optional(v.string()),
    sections: v.array(v.object({
      heading: v.string(),
      content: v.string(),
      sources: v.array(v.object({
        tool: v.string(),
        url: v.optional(v.string()),
        fetchedAt: v.number(),
      })),
      lastSynthesizedAt: v.optional(v.number()),
    })),
    contradictions: v.array(v.object({
      claim1: v.object({ source: v.string(), value: v.string() }),
      claim2: v.object({ source: v.string(), value: v.string() }),
      field: v.string(),
    })),
    metadata: v.object({
      origin: v.optional(v.string()),
      yearsActive: v.optional(v.string()),
      members: v.optional(v.array(v.string())),
      genreDNA: v.optional(v.array(v.string())),
    }),
    visibility: v.union(v.literal("private"), v.literal("unlisted"), v.literal("public")),
    archivedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"])
    .index("by_slug", ["slug"]),

  wikiIndexEntries: defineTable({
    userId: v.id("users"),
    pageId: v.id("wikiPages"),
    slug: v.string(),
    entityName: v.string(),
    entityType: v.string(),
    summary: v.optional(v.string()),
    visibility: v.optional(v.string()),
    sourceCount: v.number(),
    lastUpdated: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_slug", ["userId", "slug"]),

  // Influence Receipt: public rate limiting
  receiptRateLimits: defineTable({
    ip: v.string(),
    timestamps: v.array(v.number()),
    createdAt: v.number(),
  }).index("by_ip", ["ip"]),

  // Influence Receipt: cached receipt data (keyed by slug)
  receiptCache: defineTable({
    slug: v.string(),
    artist: v.string(),
    tier: v.union(v.literal("full"), v.literal("partial"), v.literal("unknown")),
    data: v.string(), // JSON-encoded ReceiptData
    generatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  wikiLogEntries: defineTable({
    userId: v.id("users"),
    timestamp: v.number(),
    operation: v.union(
      v.literal("ingest"), v.literal("query"),
      v.literal("lint"), v.literal("synthesize"),
    ),
    entitySlug: v.optional(v.string()),
    description: v.string(),
    toolsUsed: v.optional(v.array(v.string())),
  })
    .index("by_user_time", ["userId", "timestamp"]),
});
