# Tumblr Auth0 Token Vault Integration — Design Doc

**Date:** 2026-04-06
**Author:** Tarik Moody + Claude
**Status:** Approved

## Overview

Migrate Crate's Tumblr integration from OAuth 1.0a (Convex-stored credentials) to Auth0 Token Vault (OAuth 2.0 bearer tokens), matching the existing Spotify/Slack/Google pattern. Add music discovery tools (dashboard feed, tag search, liked posts) and OpenUI components for rendering Tumblr content in chat.

## Goals

1. Auth0 Token Vault integration for Tumblr (same pattern as Spotify)
2. Read tools: dashboard audio feed, tag-based discovery, liked posts
3. Write tools: publish to Tumblr blog (migrated from OAuth 1.0a)
4. OpenUI components: `TumblrFeed` and `TumblrPost`
5. `/tumblr` chat command with sub-modes
6. Cross-reference with Spotify via "Export to Spotify Playlist" action button

## Architecture

### Token Vault Config

Add `tumblr` to `SERVICE_CONFIG` in `src/lib/auth0-token-vault.ts`:

```typescript
tumblr: {
  connection: "tumblr",
  scopes: ["basic", "write", "offline_access"],
}
```

Update `TokenVaultService` union: `"spotify" | "slack" | "google" | "tumblr"`

### OAuth Flow

Same as Spotify:
1. User clicks Connect in Settings → `/api/auth0/connect?service=tumblr`
2. Auth0 redirects to Tumblr OAuth 2.0 authorization
3. Callback stores `auth0_user_id_tumblr` cookie
4. No special scope handling needed (Tumblr scopes go in standard `scope` param)

### API Calls

New file: `src/lib/web-tools/tumblr-connected.ts`
- Uses `getTokenVaultToken("tumblr", auth0UserId)` for bearer token
- All API calls use `Authorization: Bearer {token}` header
- Base URL: `https://api.tumblr.com/v2`

### Old Code

The existing `src/lib/web-tools/tumblr.ts` (OAuth 1.0a + Convex) stays for backwards compatibility. New connections go through Auth0. The `markdownToNpf()` function is reused by the new tools.

## Tools

### `tumblr-connected.ts` — `createTumblrConnectedTools(auth0UserId)`

#### 1. `read_tumblr_dashboard`
- **Purpose:** User's dashboard feed (posts from blogs they follow)
- **API:** `GET /v2/user/dashboard?limit={limit}`
- **Returns:** All post types with type label. Agent filters for music-relevant content.
- **Params:** `limit` (default 20, max 50)

#### 2. `read_tumblr_tagged`
- **Purpose:** Tag-based music discovery
- **API:** `GET /v2/tagged?tag={tag}`
- **Returns:** All post types matching the tag. Agent identifies music content.
- **Params:** `tag` (required), `before` (timestamp for pagination)

#### 3. `read_tumblr_likes`
- **Purpose:** User's liked posts
- **API:** `GET /v2/user/likes?limit={limit}`
- **Returns:** All post types. Agent filters for music-relevant content.
- **Params:** `limit` (default 20, max 50)

#### 4. `post_to_tumblr`
- **Purpose:** Publish to user's blog
- **API:** `GET /v2/user/info` (get blog name) → `POST /v2/blog/{blog}/posts`
- **Content:** Markdown converted to NPF via `markdownToNpf()` (reused from old tumblr.ts)
- **Params:** `title`, `content` (markdown), `tags` (string[]), `category`

### Post Type Handling

All read tools return posts with their `type` field preserved. Post types include:
- `audio` — Has artist, track_name, album, album_art, plays, player embed
- `text` — Has body (may contain Spotify/YouTube/Bandcamp URLs)
- `photo` — Has photos array with URLs and captions
- `link` — Has url, title, description
- `video` — Has video_url, thumbnail
- `quote` — Has text, source

The agent receives all types and identifies music-relevant content from context (embedded URLs, artist mentions, album art, music tags). This approach gives the richest discovery results without sparse audio-only filtering.

## OpenUI Components

### `TumblrFeed`

**Props:**
- `posts` — JSON string of post array
- `source` — `"dashboard"` | `"tagged"` | `"likes"`
- `tag` — Optional string (for tagged mode)
- `totalCount` — Number of posts

**Renders by post type:**
- **Audio:** Album art, artist/track name, play count, player embed
- **Text:** Excerpt (~200 chars), blog name, tags
- **Photo:** Thumbnail, caption excerpt, blog name
- **Link:** Title, URL preview, description

**Common elements on all posts:**
- Blog avatar + name (source attribution)
- Tags as pills
- Timestamp
- Reblog/note count

**Action buttons:**
- "Export to Spotify Playlist" — Agent collects artist/track names, chains `export_to_spotify`
- "Post to Tumblr" — Agent formats research as NPF and publishes

### `TumblrPost`

Single post detail view.

**Props:** `postUrl`, `blogName`, `content`, `tags`, `noteCount`, `type`

## `/tumblr` Command

### Routing

Add `tumblr` to `isSlashResearch` regex in `route.ts`:
```typescript
const isSlashResearch = /^\/(?:influence|show-prep|prep|news|story|track|artist|spotify|tumblr)\b/i.test(rawMessage.trim());
```

### Sub-modes

| Command | Tool Called | OpenUI Output |
|---------|-----------|---------------|
| `/tumblr` | `read_tumblr_dashboard` | `TumblrFeed(posts, "dashboard", totalCount)` |
| `/tumblr #afrobeat` | `read_tumblr_tagged` tag="afrobeat" | `TumblrFeed(posts, "tagged", totalCount, "afrobeat")` |
| `/tumblr likes` | `read_tumblr_likes` | `TumblrFeed(posts, "likes", totalCount)` |

### Prompt (in `chat-utils.ts`)

Enforce OpenUI Lang output format matching `/spotify` and `/artist` patterns:
- No-args: call `read_tumblr_dashboard`, return `TumblrFeed(...)`
- `#tag`: call `read_tumblr_tagged`, return `TumblrFeed(...)`
- `likes`: call `read_tumblr_likes`, return `TumblrFeed(...)`

## Settings UI

Add Tumblr to `connected-services.tsx`:

```typescript
{
  id: "tumblr" as const,
  name: "Tumblr",
  description: "Discover music, publish research",
  icon: "📝",
}
```

Update `ConnectionStatus` interface and all type references to include `tumblr`.

## Auth0 Dashboard Setup

1. Create Tumblr social connection in Auth0 Dashboard
2. Register app at Tumblr Developer Console (https://www.tumblr.com/oauth/apps)
3. Set callback: `https://{AUTH0_DOMAIN}/login/callback`
4. Enable "Connected Accounts for Token Vault" toggle
5. Scopes: basic, write, offline_access

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/auth0-token-vault.ts` | Modify | Add tumblr to SERVICE_CONFIG and TokenVaultService |
| `src/lib/web-tools/tumblr-connected.ts` | Create | New Token Vault tools (4 tools) |
| `src/lib/openui/components.tsx` | Modify | Add TumblrFeed and TumblrPost components |
| `src/components/tumblr/tumblr-feed.tsx` | Create | TumblrFeed component |
| `src/components/tumblr/tumblr-post.tsx` | Create | TumblrPost component |
| `src/components/settings/connected-services.tsx` | Modify | Add Tumblr service |
| `src/app/api/auth0/status/route.ts` | Modify | Add tumblr connection check |
| `src/app/api/chat/route.ts` | Modify | Add tumblr to isSlashResearch, wire tools |
| `src/lib/chat-utils.ts` | Modify | Add /tumblr command prompt |

## Verification

1. `npm run build` — no type errors
2. Auth0 Tumblr connection configured in dashboard
3. Connect flow: Settings → Connect Tumblr → OAuth → callback → cookie set
4. `/tumblr` returns dashboard feed as TumblrFeed component
5. `/tumblr #jazz` returns tagged posts
6. `/tumblr likes` returns liked posts
7. "Export to Spotify Playlist" action button works
8. `post_to_tumblr` publishes successfully
