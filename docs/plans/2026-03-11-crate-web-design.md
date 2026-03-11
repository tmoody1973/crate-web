# Crate Web — Design Document

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the Crate music research agent to the browser as a collaborative workspace with dynamic artifacts, persistent audio player, and sharable sessions.

**Architecture:** Next.js App Router on Vercel, Convex for real-time data, Clerk for auth, OpenUI for agent-generated dynamic components, YouTube IFrame API for audio playback. Imports MCP servers from `crate-cli` npm package.

**Tech Stack:** Next.js 15, Convex, Clerk, OpenUI (@thesysdev/openui), YouTube IFrame API, Vercel AI SDK, Claude API

---

## Section 1: Workspace Layout

Split-pane interface inspired by Claude Cowork:

```
┌─────────────────────────────────────────────────────────────┐
│  🎵 Crate   [Session History ▼]        ⚙ Settings  [User] │
├────────────────────────┬────────────────────────────────────┤
│                        │                                    │
│   Chat Panel (40%)     │    Artifacts Canvas (60%)          │
│                        │                                    │
│   Streaming convo      │    Sample trees, album grids,      │
│   Tool progress        │    timelines, playlists —          │
│   Inline play buttons  │    rendered by OpenUI              │
│                        │                                    │
│                        │                                    │
│   [Message input...]   │                                    │
├────────────────────────┴────────────────────────────────────┤
│  [art] Track - Artist     ◄◄  ▶  ►►   ━━●━━━  2:14  🔊 [Q]│
└─────────────────────────────────────────────────────────────┘
```

- **Chat panel (left, 40%):** Streaming conversation with visible tool progress (which MCP servers the agent is querying). Inline `♫ [▶]` buttons next to track mentions.
- **Artifacts canvas (right, 60%):** Dynamic components rendered by OpenUI from agent-generated structured data. Multiple artifacts stack vertically with tabs or scroll.
- **Audio player (bottom, fixed 72px):** Persistent across all navigation. Shows album art, track info, transport controls, seek bar, volume, queue toggle.
- **Navbar (top):** Logo, session history dropdown, settings gear, Clerk user button.
- **Resizable split:** User can drag the divider. Artifacts panel collapses fully on mobile (tabs instead).

---

## Section 2: Data Flow

```
User types message
  │
  ▼
Convex mutation: create message in session
  │
  ▼
Next.js API route (/api/chat)
  │
  ├─ Decrypts user's API keys from Convex
  ├─ Initializes Claude with user's Anthropic key via Vercel AI SDK
  ├─ Registers MCP servers based on which keys the user has
  │
  ▼
Claude streams response
  │
  ├─ Text tokens → streamed to chat panel (SSE / Vercel AI SDK stream)
  ├─ Tool calls → tool progress shown in chat, results feed back to Claude
  ├─ render_artifact() calls → structured data sent to artifacts panel
  ├─ play_track() / queue_track() calls → sent to audio player
  │
  ▼
All persisted to Convex
  ├─ Messages (text + role)
  ├─ Artifacts (type + data JSON)
  ├─ Tool calls (name + args + result + timing)
  └─ Player queue (track list for session)
```

Key streaming considerations:
- Text and tool progress stream simultaneously — chat panel handles interleaving
- Artifacts appear in the canvas as soon as the tool call completes (not after the full response)
- Player actions are fire-and-forget from the agent's perspective — no blocking on playback

---

## Section 3: Convex Schema

Six tables:

```typescript
// users — synced from Clerk via webhook
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.optional(v.string()),
  encryptedKeys: v.optional(v.bytes()), // AES-256-GCM encrypted blob
  createdAt: v.number(),
}).index("by_clerk_id", ["clerkId"]),

// sessions — one per research conversation
sessions: defineTable({
  userId: v.id("users"),
  title: v.optional(v.string()), // auto-generated from first message
  isShared: v.boolean(),         // enables /s/[sessionId] public link
  createdAt: v.number(),
  updatedAt: v.number(),
}).index("by_user", ["userId"]),

// messages — chat history within a session
messages: defineTable({
  sessionId: v.id("sessions"),
  role: v.union(v.literal("user"), v.literal("assistant")),
  content: v.string(),
  createdAt: v.number(),
}).index("by_session", ["sessionId"]),

// artifacts — agent-generated visual components
artifacts: defineTable({
  sessionId: v.id("sessions"),
  messageId: v.optional(v.id("messages")), // which message generated it
  type: v.string(),  // "sample-tree" | "album-grid" | "playlist" | etc.
  data: v.string(),  // JSON blob matching the type's Zod schema
  createdAt: v.number(),
}).index("by_session", ["sessionId"]),

// toolCalls — separate from messages for real-time progress
toolCalls: defineTable({
  sessionId: v.id("sessions"),
  messageId: v.optional(v.id("messages")),
  toolName: v.string(),
  args: v.string(),          // JSON
  result: v.optional(v.string()), // JSON, populated on completion
  status: v.union(v.literal("running"), v.literal("complete"), v.literal("error")),
  startedAt: v.number(),
  completedAt: v.optional(v.number()),
}).index("by_session", ["sessionId"]),

// playerQueue — persistent audio queue per session
playerQueue: defineTable({
  sessionId: v.id("sessions"),
  tracks: v.array(v.object({
    title: v.string(),
    artist: v.string(),
    source: v.union(v.literal("youtube"), v.literal("bandcamp")),
    sourceId: v.string(),    // YouTube video ID or Bandcamp embed URL
    imageUrl: v.optional(v.string()),
  })),
  currentIndex: v.number(),
}).index("by_session", ["sessionId"]),
```

Design decisions:
- **`encryptedKeys` as a single blob** rather than per-key fields — add/remove services without schema migrations
- **`toolCalls` separate from `messages`** — enables real-time progress UI via Convex subscriptions without over-fetching message content
- **`artifacts` separate from `messages`** — artifacts can be reordered, pinned, or shared independently

---

## Section 4: OpenUI Component Library & Artifact Types

The agent returns structured JSON that OpenUI renders into components.

### Artifact Types

| Type | Trigger | Data Shape | Visual |
|------|---------|------------|--------|
| `sample-tree` | Sample archaeology queries | `{ root: Track, samples: Track[], sampledBy: Track[] }` | Interactive node graph with playable nodes |
| `album-grid` | Artist deep dives, discography | `{ albums: Album[] }` | Card grid with cover art, year, label |
| `track-comparison` | "Compare these tracks" | `{ tracks: Track[], dimensions: string[] }` | Side-by-side table with audio previews |
| `artist-network` | Influence mapping | `{ center: Artist, connections: { artist: Artist, relationship: string }[] }` | Force-directed graph |
| `playlist` | Playlist generation | `{ tracks: Track[], title: string }` | Ordered list with drag-to-reorder, play-all |
| `timeline` | Historical queries | `{ events: { year: number, description: string, tracks?: Track[] }[] }` | Vertical timeline with embedded players |

### Flow

1. Claude returns `render_artifact({ type: "sample-tree", data: {...} })` tool call
2. API route extracts this and streams to artifacts panel via Convex mutation
3. OpenUI receives typed data + component spec from library
4. Renders pre-built component if available, generates dynamically if not

### Fallback Strategy

Pre-build the top 3 (`sample-tree`, `album-grid`, `playlist`) as reliable React components. Other types start as OpenUI-generated, promoted to pre-built once design stabilizes.

### Component Registration

```typescript
const crateComponents = createComponentLibrary({
  SampleTree: z.object({
    root: TrackSchema,
    samples: z.array(TrackSchema),
    sampledBy: z.array(TrackSchema),
  }),
  AlbumGrid: z.object({
    albums: z.array(AlbumSchema),
  }),
  Playlist: z.object({
    title: z.string(),
    tracks: z.array(TrackSchema),
  }),
  // ... other types
});
```

Zod schemas ensure Claude returns exact shapes — no hallucinated fields.

### Image Sourcing

Cover art follows a priority chain from existing MCP servers:

1. **MusicBrainz / Cover Art Archive** — Free, high-quality, canonical
2. **Discogs** — Release images via API
3. **Bandcamp** — Album art from scraping
4. **Last.fm** — Artist/album images via API

The agent passes through image URLs it already gets from research. No new infrastructure needed.

---

## Section 5: Audio Player

Persistent 72px bar at the bottom of the viewport, always visible.

### Layout

```
┌──────────────────────────────────────────────────────────────┐
│ [art] Track Title - Artist    ◄◄  ▶  ►►   ━━●━━━  2:14/4:32   🔊  [queue] │
└──────────────────────────────────────────────────────────────┘
```

### Primary Source: YouTube IFrame API

- Agent finds a track → calls `play_track({ title, artist })` tool
- API route searches YouTube Data API v3 for `"artist - track"`, picks top result
- Embeds via YouTube IFrame API (hidden iframe, `height: 0` for audio-only)
- Controls driven by IFrame API: `player.playVideo()`, `player.seekTo()`, etc.

### Secondary Source: Bandcamp Embeds

- When agent finds a track on Bandcamp with a `streamUrl`, uses Bandcamp embed player
- Better audio quality, supports indie artists YouTube may not have

### Queue System

- Agent queues tracks via `queue_track({ title, artist, source })` tool
- Queue stored in Convex `playerQueue` table (persists across refreshes)
- Queue panel: slide-up drawer from player bar
- "Play All" on playlist artifacts sends entire playlist to queue

### Agent-Triggered Playback

- Claude can call `play_track` mid-research: "Let me play you the original sample"
- Chat shows inline play button: `♫ "Impeach the President" — The Honey Drippers [▶]`
- Clicking inline buttons also sends to player

### State Management

- `PlayerProvider` React context: current track, queue, playback state, volume
- Convex syncs queue for persistence
- Playback position is client-only (no need to persist scrub position)

---

## Section 6: Settings & API Key Management

### Access

Gear icon in navbar → slide-out drawer (stays in workspace flow).

### Layout

```
┌─ API Keys ──────────────────────────────────────┐
│                                                  │
│  Anthropic (Required)                            │
│  [••••••••••••sk-ant-3kf]  ✓ Valid    [Edit]    │
│                                                  │
│  Discogs (Optional)                              │
│  [Not configured]                    [Add Key]   │
│                                                  │
│  YouTube Data API (Optional — enables player)    │
│  [Not configured]                    [Add Key]   │
│                                                  │
│  [Show all services ▼]                          │
└─────────────────────────────────────────────────┘
```

### Key Tiers

- **Required:** Anthropic API key
- **Recommended:** Discogs, Last.fm, Genius
- **Optional:** YouTube Data API, Bandcamp, Tumblr, Telegraph, etc.

### Security

- Single `ENCRYPTION_KEY` env var on Vercel (random 32-byte key)
- AES-256-GCM encryption before writing to Convex
- Keys never returned to client after entry — only masked version + validity status
- Decrypted server-side only when making API calls

### Validation Flow

User enters key → `POST /api/keys/validate` → server makes lightweight test call → returns valid/invalid → if valid, encrypts and stores in Convex.

### Server Activation

Same pattern as CLI — servers only register when their key is present. Available tools change per-user based on configured keys.

---

## Section 7: API Key Onboarding & Guided Setup

### Inline Guides

Each key entry includes an expandable "How to get this key" section:

```
▼ How to get this key
┌───────────────────────────────────────────┐
│ 1. Go to discogs.com/settings/developers  │
│ 2. Click "Generate new token"             │
│ 3. Copy the token and paste it above      │
│                                           │
│ Free tier: 60 requests/min (plenty)       │
│ Estimated time: ~30 seconds               │
│ [Open Discogs Developer Page →]           │
└───────────────────────────────────────────┘
```

Each guide includes:
- 2-4 numbered steps (no jargon)
- Direct link to the exact developer/settings page
- Free tier info (so they know it won't cost money)
- Estimated setup time

### First-Run Experience

1. New user signs in via Clerk → welcome screen before workspace
2. Shows 3 tiers: Required, Recommended, Optional
3. "Quick start: just add your Anthropic key to begin."
4. Big "Add Anthropic Key" CTA → inline guide → paste → validate → enter workspace
5. Skip button for recommended/optional keys

### Contextual Nudges

When the agent tries a tool the user doesn't have a key for:
> *"I'd normally check Discogs for pressing details, but that source isn't connected yet. [Add Discogs key →]"*

Links directly to settings drawer with that service pre-expanded.

---

## Section 8: Routing & Pages

Minimal page count — the workspace IS the app.

| Route | Purpose |
|-------|---------|
| `/` | Landing page (signed out) / redirect to `/w` (signed in) |
| `/sign-in` | Clerk sign-in |
| `/sign-up` | Clerk sign-up |
| `/w` | Main workspace — split-pane + player |
| `/w/[sessionId]` | Workspace with specific session loaded |
| `/s/[sessionId]` | Shared session (read-only, no auth) |

Everything else lives inside the workspace:
- Settings → drawer overlay on `/w`
- Session history → sidebar within `/w`
- Queue → slide-up panel on the player bar

### Session URLs

- New research → Convex creates session → URL updates to `/w/abc123` via `history.replaceState`
- Shared sessions at `/s/abc123` → read-only with chat history, artifacts rendered, track listing visible but not playable

### Auth Flow

- Clerk middleware protects `/w` and `/w/*`
- `/s/*` is public (read-only)
- `/` checks auth → signed in redirects to `/w`, signed out shows landing

### Landing Page

Port existing crate-cli landing page design, adapted for web. "Try Crate" CTA → sign up → onboarding → workspace.
