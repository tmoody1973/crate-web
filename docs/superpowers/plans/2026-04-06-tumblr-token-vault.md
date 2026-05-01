# Tumblr Auth0 Token Vault Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Tumblr to Crate's Auth0 Token Vault integration with music discovery tools (dashboard, tag search, likes), OpenUI components, and `/tumblr` chat command.

**Architecture:** Extends the existing Auth0 Token Vault pattern (Spotify/Slack/Google) with a fourth service. New `tumblr-connected.ts` tools use OAuth 2.0 bearer tokens via `getTokenVaultToken("tumblr")`. Reuses `markdownToNpf()` from the legacy `tumblr.ts` for post publishing.

**Tech Stack:** Next.js 14 App Router, Auth0 Token Vault, Tumblr API v2, Zod, OpenUI defineComponent, Tailwind CSS

**Design Doc:** `docs/plans/2026-04-06-tumblr-token-vault-design.md`

---

### Task 1: Add Tumblr to Token Vault Config

**Files:**
- Modify: `src/lib/auth0-token-vault.ts`

- [ ] **Step 1: Update the TokenVaultService union type**

In `src/lib/auth0-token-vault.ts`, change line 7:

```typescript
// Before:
type TokenVaultService = "spotify" | "slack" | "google";

// After:
type TokenVaultService = "spotify" | "slack" | "google" | "tumblr";
```

- [ ] **Step 2: Add tumblr entry to SERVICE_CONFIG**

After the `google` entry (line 35), add:

```typescript
  tumblr: {
    connection: "tumblr",
    scopes: ["basic", "write", "offline_access"],
  },
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/auth0-token-vault.ts
git commit -m "feat: add Tumblr to Auth0 Token Vault config"
```

---

### Task 2: Add Tumblr to Settings UI

**Files:**
- Modify: `src/components/settings/connected-services.tsx`
- Modify: `src/app/api/auth0/status/route.ts`

- [ ] **Step 1: Add Tumblr to SERVICES array in connected-services.tsx**

In `src/components/settings/connected-services.tsx`, add to the `SERVICES` array after the Google entry (line 32):

```typescript
  {
    id: "tumblr" as const,
    name: "Tumblr",
    description: "Discover music, publish research",
    icon: "📝",
  },
```

- [ ] **Step 2: Update ConnectionStatus interface**

In `src/components/settings/connected-services.tsx`, update the `ConnectionStatus` interface at line 5:

```typescript
interface ConnectionStatus {
  configured: boolean;
  connections: {
    spotify: boolean;
    slack: boolean;
    google: boolean;
    tumblr: boolean;
  };
}
```

- [ ] **Step 3: Update useEffect localStorage loader**

In the first `useEffect` (line 60), add `tumblr` to the connections object:

```typescript
    setStatus({
      configured: true,
      connections: {
        spotify: stored.spotify ?? false,
        slack: stored.slack ?? false,
        google: stored.google ?? false,
        tumblr: stored.tumblr ?? false,
      },
    });
```

- [ ] **Step 4: Update callback param check**

On line 75, update the type guard to include tumblr:

```typescript
    if (connected && (connected === "spotify" || connected === "slack" || connected === "google" || connected === "tumblr")) {
```

- [ ] **Step 5: Update server-side status merge**

In the second `useEffect` (line 87), update the merge logic:

```typescript
        setStatus({
          configured: true,
          connections: {
            spotify: data.connections.spotify || stored.spotify || false,
            slack: data.connections.slack || stored.slack || false,
            google: data.connections.google || stored.google || false,
            tumblr: data.connections.tumblr || stored.tumblr || false,
          },
        });
```

- [ ] **Step 6: Update the status API route**

In `src/app/api/auth0/status/route.ts`, add `tumblr` to both connections objects:

```typescript
  if (!isTokenVaultConfigured()) {
    return Response.json({
      configured: false,
      connections: { spotify: false, slack: false, google: false, tumblr: false },
    });
  }

  // ... (cookie parsing stays the same)

  return Response.json({
    configured: true,
    connections: {
      spotify: connectedServices.includes("spotify"),
      slack: connectedServices.includes("slack"),
      google: connectedServices.includes("google"),
      tumblr: connectedServices.includes("tumblr"),
    },
  });
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 8: Commit**

```bash
git add src/components/settings/connected-services.tsx src/app/api/auth0/status/route.ts
git commit -m "feat: add Tumblr to Connected Services settings UI"
```

---

### Task 3: Create Tumblr Connected Tools

**Files:**
- Create: `src/lib/web-tools/tumblr-connected.ts`

This file follows the exact same pattern as `src/lib/web-tools/spotify-connected.ts`. It exports `createTumblrConnectedTools(auth0UserId)` which returns an array of `CrateToolDef[]`.

- [ ] **Step 1: Create the file with helper functions and types**

Create `src/lib/web-tools/tumblr-connected.ts`:

```typescript
/**
 * Tumblr tools powered by Auth0 Token Vault (OAuth 2.0).
 * Read dashboard, search tags, read likes, publish posts.
 * Replaces the old OAuth 1.0a flow in tumblr.ts for new connections.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import { markdownToNpf } from "@/lib/web-tools/tumblr";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const TUMBLR_API = "https://api.tumblr.com/v2";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

/** Normalize a Tumblr post into a consistent shape for the agent. */
function normalizePost(post: Record<string, unknown>): Record<string, unknown> {
  const base = {
    type: post.type,
    id: post.id,
    blog_name: post.blog_name,
    blog_url: (post.blog as Record<string, unknown>)?.url ?? `https://${post.blog_name}.tumblr.com`,
    post_url: post.post_url,
    timestamp: post.timestamp,
    date: post.date,
    tags: post.tags,
    note_count: post.note_count,
    summary: post.summary,
  };

  switch (post.type) {
    case "audio":
      return {
        ...base,
        artist: post.artist ?? post.source_title,
        track_name: post.track_name,
        album: post.album,
        album_art: post.album_art,
        plays: post.plays,
        audio_url: post.audio_url,
        external_url: post.external_url,
        audio_source_url: post.audio_source_url,
      };
    case "photo":
      return {
        ...base,
        caption: typeof post.caption === "string" ? post.caption.slice(0, 300) : "",
        image_url: Array.isArray(post.photos)
          ? (post.photos[0] as Record<string, unknown>)?.original_size
            ? ((post.photos[0] as Record<string, unknown>).original_size as Record<string, unknown>)?.url
            : undefined
          : undefined,
      };
    case "text":
      return {
        ...base,
        title: post.title,
        body_excerpt: typeof post.body === "string" ? post.body.replace(/<[^>]*>/g, "").slice(0, 300) : "",
      };
    case "link":
      return {
        ...base,
        title: post.title,
        url: post.url,
        description: typeof post.description === "string" ? post.description.replace(/<[^>]*>/g, "").slice(0, 200) : "",
      };
    case "video":
      return {
        ...base,
        caption: typeof post.caption === "string" ? post.caption.replace(/<[^>]*>/g, "").slice(0, 200) : "",
        video_url: post.video_url,
        thumbnail_url: post.thumbnail_url,
      };
    case "quote":
      return {
        ...base,
        text: post.text,
        source: post.source,
      };
    default:
      return base;
  }
}
```

- [ ] **Step 2: Add the read_tumblr_dashboard tool handler**

Append to the file:

```typescript
export function createTumblrConnectedTools(auth0UserId?: string): CrateToolDef[] {
  const readDashboardHandler = async (args: { limit?: number }) => {
    const token = await getTokenVaultToken("tumblr", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
        action: "connect_tumblr",
      });
    }

    const limit = Math.min(args.limit ?? 20, 50);

    try {
      const res = await fetch(`${TUMBLR_API}/user/dashboard?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
      }

      const data = await res.json();
      const posts = (data.response?.posts ?? []).map(normalizePost);

      return toolResult({
        source: "dashboard",
        total: posts.length,
        posts,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Tumblr request failed" });
    }
  };
```

- [ ] **Step 3: Add the read_tumblr_tagged tool handler**

Append inside `createTumblrConnectedTools` (before the closing of the function):

```typescript
  const readTaggedHandler = async (args: { tag: string; before?: number }) => {
    const token = await getTokenVaultToken("tumblr", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
        action: "connect_tumblr",
      });
    }

    const tag = args.tag.replace(/^#/, "").trim();
    if (!tag) {
      return toolResult({ error: "Tag is required. Example: read_tumblr_tagged({tag: 'afrobeat'})" });
    }

    let url = `${TUMBLR_API}/tagged?tag=${encodeURIComponent(tag)}`;
    if (args.before) {
      url += `&before=${args.before}`;
    }

    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
      }

      const data = await res.json();
      const posts = (data.response ?? []).map(normalizePost);

      return toolResult({
        source: "tagged",
        tag,
        total: posts.length,
        posts,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Tumblr request failed" });
    }
  };
```

- [ ] **Step 4: Add the read_tumblr_likes tool handler**

Append inside `createTumblrConnectedTools`:

```typescript
  const readLikesHandler = async (args: { limit?: number }) => {
    const token = await getTokenVaultToken("tumblr", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
        action: "connect_tumblr",
      });
    }

    const limit = Math.min(args.limit ?? 20, 50);

    try {
      const res = await fetch(`${TUMBLR_API}/user/likes?limit=${limit}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({ error: `Tumblr API error: ${res.status}`, detail });
      }

      const data = await res.json();
      const posts = (data.response?.liked_posts ?? []).map(normalizePost);

      return toolResult({
        source: "likes",
        total: data.response?.liked_count ?? posts.length,
        posts,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Tumblr request failed" });
    }
  };
```

- [ ] **Step 5: Add the post_to_tumblr tool handler**

Append inside `createTumblrConnectedTools`:

```typescript
  const postToTumblrHandler = async (args: {
    title: string;
    content: string;
    tags?: string[];
    category?: string;
  }) => {
    const token = await getTokenVaultToken("tumblr", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Tumblr not connected. Ask the user to connect Tumblr in Settings.",
        action: "connect_tumblr",
      });
    }

    try {
      // Get user's blog name
      const infoRes = await fetch(`${TUMBLR_API}/user/info`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!infoRes.ok) {
        return toolResult({ error: "Failed to get Tumblr user info" });
      }

      const infoData = await infoRes.json();
      const blog = infoData.response?.user?.blogs?.[0];
      if (!blog) {
        return toolResult({ error: "No blog found on this Tumblr account" });
      }

      const blogName = blog.name;

      // Convert markdown to NPF blocks
      const npfBlocks = markdownToNpf(args.content);
      const contentBlocks = [
        { type: "text", subtype: "heading1", text: args.title },
        ...npfBlocks,
      ];

      // Build tags
      const tags = [...(args.tags ?? [])];
      if (args.category && !tags.includes(args.category)) {
        tags.unshift(args.category);
      }
      tags.push("crate", "music");

      // Create post
      const postRes = await fetch(`${TUMBLR_API}/blog/${blogName}/posts`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          content: contentBlocks,
          tags: tags.join(","),
          state: "published",
        }),
      });

      if (!postRes.ok) {
        const detail = await postRes.text().catch(() => "");
        return toolResult({ error: `Failed to create post: ${postRes.status}`, detail });
      }

      const postData = await postRes.json();
      const postId = String(postData.response?.id ?? "unknown");
      const postUrl = `https://${blogName}.tumblr.com/post/${postId}`;

      return toolResult({
        status: "published",
        post_url: postUrl,
        tumblr_post_id: postId,
        blog_name: blogName,
        tags,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Post creation failed" });
    }
  };
```

- [ ] **Step 6: Add the tool definitions array and close the function**

Append to close out `createTumblrConnectedTools`:

```typescript
  return [
    {
      name: "read_tumblr_dashboard",
      description:
        "Read the user's Tumblr dashboard — posts from blogs they follow. Returns all post types (audio, text, photo, link, video, quote) with type labels. Audio posts include artist/track/album metadata. Text posts may contain Spotify/YouTube/Bandcamp URLs. Use this for discovering what music content the user's Tumblr network is sharing.",
      inputSchema: {
        limit: z.number().optional().describe("Number of posts to return (default 20, max 50)"),
      },
      handler: readDashboardHandler,
    },
    {
      name: "read_tumblr_tagged",
      description:
        "Search Tumblr posts by tag — the primary music discovery tool. Search tags like 'afrobeat', 'indie-rock', 'jazz', 'underground-hip-hop' to find music content from across Tumblr. Returns all post types. Audio posts have artist/track metadata. Text/photo posts provide cultural context and commentary. Strip the # if the user includes it.",
      inputSchema: {
        tag: z.string().describe("Tag to search (without #). Example: 'afrobeat', 'indie-rock'"),
        before: z.number().optional().describe("Unix timestamp for pagination — get posts before this time"),
      },
      handler: readTaggedHandler,
    },
    {
      name: "read_tumblr_likes",
      description:
        "Read the user's liked Tumblr posts. Shows what music content the user has liked. Returns all post types with type labels. Good for understanding the user's Tumblr music taste.",
      inputSchema: {
        limit: z.number().optional().describe("Number of liked posts to return (default 20, max 50)"),
      },
      handler: readLikesHandler,
    },
    {
      name: "post_to_tumblr",
      description:
        "Publish a post to the user's Tumblr blog. Content is markdown — headings, bold, italic, links, lists, blockquotes are converted to Tumblr NPF format. Use for publishing influence chains, show prep, playlists, or artist profiles to Tumblr.",
      inputSchema: {
        title: z.string().max(256).describe("Post title"),
        content: z.string().describe("Post content in markdown format"),
        tags: z.array(z.string()).optional().describe("Tags for the post (e.g. ['jazz', 'influence-chain'])"),
        category: z.enum(["influence", "artist", "playlist", "collection", "note"]).optional().describe("Category tag (auto-added to tags)"),
      },
      handler: postToTumblrHandler,
    },
  ];
}
```

- [ ] **Step 7: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors. The import of `markdownToNpf` from `tumblr.ts` should resolve since it's already exported.

- [ ] **Step 8: Commit**

```bash
git add src/lib/web-tools/tumblr-connected.ts
git commit -m "feat: add Tumblr connected tools via Auth0 Token Vault"
```

---

### Task 4: Wire Tumblr Tools into Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Add import for tumblr-connected tools**

In `src/app/api/chat/route.ts`, after the existing import of `createGoogleDocsTools` (line 19), add:

```typescript
import { createTumblrConnectedTools } from "@/lib/web-tools/tumblr-connected";
```

- [ ] **Step 2: Add tumblr to isSlashResearch regex**

On line 612, update the regex to include `tumblr`:

```typescript
  const isSlashResearch = /^\/(?:influence|show-prep|prep|news|story|track|artist|spotify|tumblr)\b/i.test(rawMessage.trim());
```

- [ ] **Step 3: Update auth0UserIds parameter type**

On line 191 in the `streamAgenticResponse` function signature, update the `auth0UserIds` parameter:

```typescript
  auth0UserIds?: { spotify?: string; slack?: string; google?: string; tumblr?: string },
```

- [ ] **Step 4: Create Tumblr connected tools instance**

After the Google Docs tools creation (around line 292), add:

```typescript
        const webTumblrConnectedTools = isTokenVaultConfigured()
          ? createTumblrConnectedTools(auth0UserIds?.tumblr)
          : [];
```

- [ ] **Step 5: Add tumblr-connected to allToolGroups**

After the google-docs entry in the `allToolGroups` array (around line 351), add:

```typescript
          ...(webTumblrConnectedTools.length > 0
            ? [{ serverName: "tumblr-connected", tools: webTumblrConnectedTools }]
            : []),
```

- [ ] **Step 6: Read tumblr Auth0 cookie**

After the `auth0UserIdGoogle` line (around line 711), add:

```typescript
  const auth0UserIdTumblr = readAuth0Cookie("tumblr");
```

- [ ] **Step 7: Pass tumblr cookie to streamAgenticResponse**

Update the `auth0UserIds` object in the `streamAgenticResponse` call (around line 719):

```typescript
    { spotify: auth0UserIdSpotify, slack: auth0UserIdSlack, google: auth0UserIdGoogle, tumblr: auth0UserIdTumblr },
```

- [ ] **Step 8: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 9: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: wire Tumblr Token Vault tools into chat route"
```

---

### Task 5: Add /tumblr Command to Chat Utils

**Files:**
- Modify: `src/lib/chat-utils.ts`

- [ ] **Step 1: Add tumblr case to preprocessSlashCommand**

In `src/lib/chat-utils.ts`, after the `case "spotify"` block (which ends around line 555), add:

```typescript
    case "tumblr": {
      if (!arg) {
        return [
          `The user wants to browse their Tumblr dashboard for music content. Follow these steps EXACTLY:`,
          ``,
          `1. Call read_tumblr_dashboard with limit=20`,
          `2. Take the posts array from the result and stringify it as JSON`,
          `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
          ``,
          `TumblrFeed takes three arguments:`,
          `  - posts (JSON string): the posts array`,
          `  - source (string): "dashboard"`,
          `  - totalCount (number): number of posts returned`,
          ``,
          `Example OpenUI Lang output:`,
          `root = TumblrFeed("[{\\"type\\":\\"audio\\",\\"blog_name\\":\\"musicblog\\",\\"artist\\":\\"Ezra Collective\\",\\"track_name\\":\\"No Confusion\\"}]", "dashboard", 20)`,
          ``,
          `If Tumblr is not connected, tell the user to connect Tumblr in Settings → Connected Services.`,
          ``,
          `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after. No markdown. No explanations. Just the OpenUI Lang.`,
        ].join("\n");
      }

      if (arg.toLowerCase().trim() === "likes") {
        return [
          `The user wants to see their liked Tumblr posts. Follow these steps EXACTLY:`,
          ``,
          `1. Call read_tumblr_likes with limit=20`,
          `2. Take the posts array from the result and stringify it as JSON`,
          `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
          ``,
          `TumblrFeed takes three arguments:`,
          `  - posts (JSON string): the posts array`,
          `  - source (string): "likes"`,
          `  - totalCount (number): number of posts returned`,
          ``,
          `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after.`,
        ].join("\n");
      }

      // /tumblr #tag or /tumblr tag
      const tag = arg.replace(/^#/, "").trim();
      return [
        `The user wants to discover music on Tumblr tagged "${tag}". Follow these steps EXACTLY:`,
        ``,
        `1. Call read_tumblr_tagged with tag="${tag}"`,
        `2. Take the posts array from the result and stringify it as JSON`,
        `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
        ``,
        `TumblrFeed takes four arguments:`,
        `  - posts (JSON string): the posts array`,
        `  - source (string): "tagged"`,
        `  - totalCount (number): number of posts returned`,
        `  - tag (string): "${tag}"`,
        ``,
        `Example OpenUI Lang output:`,
        `root = TumblrFeed("[{\\"type\\":\\"audio\\",\\"blog_name\\":\\"afrobeatfm\\",\\"artist\\":\\"Fela Kuti\\",\\"track_name\\":\\"Zombie\\"}]", "tagged", 15, "${tag}")`,
        ``,
        `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after. No markdown. No explanations.`,
      ].join("\n");
    }
```

- [ ] **Step 2: Add tumblr to titleForSlashCommand**

In the `titleForSlashCommand` function (around line 580), add after the `case "spotify"` entry:

```typescript
      case "tumblr":
        if (arg?.toLowerCase().trim() === "likes") return "Tumblr Likes";
        return arg ? `Tumblr: #${arg.replace(/^#/, "").trim()}` : "Tumblr Dashboard";
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat-utils.ts
git commit -m "feat: add /tumblr command with dashboard, likes, and tag search modes"
```

---

### Task 6: Create TumblrFeed OpenUI Component

**Files:**
- Create: `src/components/tumblr/tumblr-feed.tsx`

- [ ] **Step 1: Create the TumblrFeed component file**

Create `src/components/tumblr/tumblr-feed.tsx`:

```typescript
"use client";

import { useState } from "react";

interface TumblrPost {
  type: string;
  id?: number;
  blog_name?: string;
  blog_url?: string;
  post_url?: string;
  timestamp?: number;
  date?: string;
  tags?: string[];
  note_count?: number;
  summary?: string;
  // Audio
  artist?: string;
  track_name?: string;
  album?: string;
  album_art?: string;
  plays?: number;
  external_url?: string;
  // Text
  title?: string;
  body_excerpt?: string;
  // Photo
  caption?: string;
  image_url?: string;
  // Link
  url?: string;
  description?: string;
  // Video
  video_url?: string;
  thumbnail_url?: string;
  // Quote
  text?: string;
  source?: string;
}

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return "";
  const seconds = Math.floor(Date.now() / 1000 - timestamp);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function AudioPost({ post }: { post: TumblrPost }) {
  return (
    <div className="flex gap-3">
      {post.album_art && (
        <img
          src={post.album_art}
          alt={post.track_name ?? "Album art"}
          className="h-16 w-16 rounded-md object-cover flex-shrink-0"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-white">
          {post.track_name ?? "Untitled Track"}
        </p>
        <p className="truncate text-xs text-zinc-400">
          {post.artist ?? post.blog_name}
          {post.album ? ` — ${post.album}` : ""}
        </p>
        {post.plays != null && post.plays > 0 && (
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {post.plays.toLocaleString()} plays
          </p>
        )}
        {post.external_url && (
          <a
            href={post.external_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-[10px] text-cyan-500 hover:text-cyan-400"
          >
            Listen externally
          </a>
        )}
      </div>
    </div>
  );
}

function TextPost({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.title && (
        <p className="text-sm font-medium text-white">{post.title}</p>
      )}
      {post.body_excerpt && (
        <p className="mt-1 text-xs text-zinc-400 line-clamp-3">{post.body_excerpt}</p>
      )}
    </div>
  );
}

function PhotoPost({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.image_url && (
        <img
          src={post.image_url}
          alt={post.caption ?? "Photo"}
          className="w-full max-h-48 rounded-md object-cover"
        />
      )}
      {post.caption && (
        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{post.caption}</p>
      )}
    </div>
  );
}

function LinkPost({ post }: { post: TumblrPost }) {
  return (
    <div>
      {post.title && (
        <a
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm font-medium text-cyan-400 hover:text-cyan-300"
        >
          {post.title}
        </a>
      )}
      {post.description && (
        <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{post.description}</p>
      )}
    </div>
  );
}

function QuotePost({ post }: { post: TumblrPost }) {
  return (
    <div>
      <blockquote className="border-l-2 border-zinc-600 pl-3 text-sm italic text-zinc-300">
        {post.text}
      </blockquote>
      {post.source && (
        <p className="mt-1 text-xs text-zinc-500">— {post.source}</p>
      )}
    </div>
  );
}

function PostContent({ post }: { post: TumblrPost }) {
  switch (post.type) {
    case "audio": return <AudioPost post={post} />;
    case "text": return <TextPost post={post} />;
    case "photo": return <PhotoPost post={post} />;
    case "link": return <LinkPost post={post} />;
    case "quote": return <QuotePost post={post} />;
    case "video":
      return (
        <div>
          {post.thumbnail_url && (
            <img src={post.thumbnail_url} alt="Video thumbnail" className="w-full max-h-48 rounded-md object-cover" />
          )}
          <p className="mt-1 text-xs text-zinc-400 line-clamp-2">{post.caption ?? post.summary}</p>
        </div>
      );
    default:
      return post.summary ? <p className="text-xs text-zinc-400">{post.summary}</p> : null;
  }
}

const TYPE_BADGES: Record<string, { label: string; color: string }> = {
  audio: { label: "Audio", color: "bg-purple-500/20 text-purple-400" },
  text: { label: "Text", color: "bg-blue-500/20 text-blue-400" },
  photo: { label: "Photo", color: "bg-green-500/20 text-green-400" },
  link: { label: "Link", color: "bg-yellow-500/20 text-yellow-400" },
  video: { label: "Video", color: "bg-red-500/20 text-red-400" },
  quote: { label: "Quote", color: "bg-orange-500/20 text-orange-400" },
};

export interface TumblrFeedProps {
  posts: TumblrPost[];
  source: "dashboard" | "tagged" | "likes";
  totalCount: number;
  tag?: string;
  onAction?: (action: string, data: unknown) => void;
}

export function TumblrFeed({ posts, source, totalCount, tag, onAction }: TumblrFeedProps) {
  const [filter, setFilter] = useState<string>("all");

  const filteredPosts = filter === "all"
    ? posts
    : posts.filter((p) => p.type === filter);

  const postTypes = [...new Set(posts.map((p) => p.type))];

  const sourceLabel = source === "tagged"
    ? `#${tag}`
    : source === "likes"
      ? "Liked Posts"
      : "Dashboard";

  // Collect artist/track names for Spotify export
  const musicEntries = posts
    .filter((p) => p.type === "audio" && (p.artist || p.track_name))
    .map((p) => `${p.artist ?? ""} ${p.track_name ?? ""}`.trim());

  return (
    <div className="w-full rounded-xl border border-zinc-800 bg-zinc-900/80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-base">📝</span>
            <h3 className="text-sm font-semibold text-white">Tumblr {sourceLabel}</h3>
          </div>
          <p className="mt-0.5 text-[10px] text-zinc-500">
            {totalCount} posts
            {posts.filter((p) => p.type === "audio").length > 0 &&
              ` · ${posts.filter((p) => p.type === "audio").length} audio`}
          </p>
        </div>
        {musicEntries.length > 0 && (
          <button
            onClick={() => onAction?.("export_to_spotify", { tracks: musicEntries })}
            className="rounded-md bg-green-600/20 px-3 py-1.5 text-xs font-medium text-green-400 hover:bg-green-600/30 transition-colors"
          >
            Export to Spotify Playlist
          </button>
        )}
      </div>

      {/* Filter tabs */}
      {postTypes.length > 1 && (
        <div className="flex gap-1 border-b border-zinc-800 px-4 py-2">
          <button
            onClick={() => setFilter("all")}
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
              filter === "all"
                ? "bg-zinc-700 text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            All ({posts.length})
          </button>
          {postTypes.map((type) => {
            const badge = TYPE_BADGES[type];
            const count = posts.filter((p) => p.type === type).length;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors ${
                  filter === type
                    ? badge?.color ?? "bg-zinc-700 text-white"
                    : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {badge?.label ?? type} ({count})
              </button>
            );
          })}
        </div>
      )}

      {/* Posts */}
      <div className="max-h-[500px] overflow-y-auto">
        {filteredPosts.map((post, i) => {
          const badge = TYPE_BADGES[post.type];
          return (
            <div
              key={post.id ?? i}
              className="border-b border-zinc-800/50 px-4 py-3 last:border-b-0 hover:bg-zinc-800/30 transition-colors"
            >
              {/* Blog name + type badge + time */}
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[10px] font-medium text-zinc-400">
                  {post.blog_name}
                </span>
                {badge && (
                  <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${badge.color}`}>
                    {badge.label}
                  </span>
                )}
                <span className="ml-auto text-[10px] text-zinc-600">
                  {formatTimeAgo(post.timestamp)}
                </span>
              </div>

              {/* Post content */}
              <PostContent post={post} />

              {/* Tags */}
              {post.tags && post.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(post.tags as string[]).slice(0, 6).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] text-zinc-500"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}

              {/* Notes + link */}
              <div className="mt-1.5 flex items-center gap-3">
                {post.note_count != null && (
                  <span className="text-[10px] text-zinc-600">
                    {post.note_count.toLocaleString()} notes
                  </span>
                )}
                {post.post_url && (
                  <a
                    href={post.post_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[10px] text-zinc-600 hover:text-zinc-400"
                  >
                    View on Tumblr
                  </a>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="border-t border-zinc-800 px-4 py-2 flex items-center justify-between">
        <span className="text-[10px] text-zinc-600">via Crate — AI Music Research</span>
        {source === "tagged" && tag && (
          <span className="text-[10px] text-zinc-500">#{tag}</span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the component has no import errors**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add src/components/tumblr/tumblr-feed.tsx
git commit -m "feat: add TumblrFeed OpenUI component with post type rendering and filters"
```

---

### Task 7: Register TumblrFeed in OpenUI Components

**Files:**
- Modify: `src/lib/openui/components.tsx`

- [ ] **Step 1: Add dynamic import for TumblrFeed**

Near the top of `src/lib/openui/components.tsx`, after the `SpotifyWebPlayer` dynamic import (around line 13), add:

```typescript
const TumblrFeedComponent = dynamic(
  () => import("@/components/tumblr/tumblr-feed").then((m) => ({ default: m.TumblrFeed })),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900/80 px-4 py-6">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
        <span className="text-xs text-zinc-500">Loading Tumblr feed...</span>
      </div>
    ),
  },
);
```

- [ ] **Step 2: Add TumblrFeed defineComponent**

After the `SlackChannelPicker` component (at the end of the connected services section, around line 2520), add:

```typescript
// ── Tumblr Connected Components ─────────────────────────────────

export const TumblrFeed = defineComponent({
  name: "TumblrFeed",
  description:
    "Display Tumblr posts from dashboard, tag search, or likes. Shows audio, text, photo, link, video, and quote posts with type-specific rendering. Audio posts show artist/track/album art. Includes 'Export to Spotify Playlist' action button for audio posts. Use after read_tumblr_dashboard, read_tumblr_tagged, or read_tumblr_likes.",
  props: z.object({
    posts: z.preprocess(jsonPreprocess, z.array(z.object({
      type: z.string(),
      id: z.number().optional(),
      blog_name: z.string().optional(),
      blog_url: z.string().optional(),
      post_url: z.string().optional(),
      timestamp: z.number().optional(),
      tags: z.array(z.string()).optional(),
      note_count: z.number().optional(),
      summary: z.string().optional(),
      artist: z.string().optional(),
      track_name: z.string().optional(),
      album: z.string().optional(),
      album_art: z.string().optional(),
      plays: z.number().optional(),
      external_url: z.string().optional(),
      title: z.string().optional(),
      body_excerpt: z.string().optional(),
      caption: z.string().optional(),
      image_url: z.string().optional(),
      url: z.string().optional(),
      description: z.string().optional(),
      text: z.string().optional(),
      source: z.string().optional(),
    }))).describe("Array of normalized Tumblr posts"),
    source: z.enum(["dashboard", "tagged", "likes"]).describe("Feed source"),
    totalCount: z.number().describe("Total posts returned"),
    tag: z.string().optional().describe("Tag searched (for tagged source)"),
  }),
  render: (props) => (
    <TumblrFeedComponent
      posts={props.posts}
      source={props.source}
      totalCount={props.totalCount}
      tag={props.tag}
    />
  ),
});
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: register TumblrFeed in OpenUI component registry"
```

---

### Task 8: Final Build Verification

**Files:** None (verification only)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Verify all modified files**

Run: `git diff --stat`
Expected output should include:
- `src/lib/auth0-token-vault.ts` — modified
- `src/components/settings/connected-services.tsx` — modified
- `src/app/api/auth0/status/route.ts` — modified
- `src/lib/web-tools/tumblr-connected.ts` — new
- `src/components/tumblr/tumblr-feed.tsx` — new
- `src/lib/openui/components.tsx` — modified
- `src/app/api/chat/route.ts` — modified
- `src/lib/chat-utils.ts` — modified

- [ ] **Step 4: Final commit if any remaining changes**

```bash
git add -A
git commit -m "chore: final build verification for Tumblr Token Vault integration"
```

---

## Post-Implementation: Auth0 Dashboard Setup

After the code is deployed, configure Auth0:

1. Go to Auth0 Dashboard → Authentication → Social → Create Connection
2. Select **Tumblr**
3. Register app at https://www.tumblr.com/oauth/apps — set callback to `https://{AUTH0_DOMAIN}/login/callback`
4. Enter the OAuth Consumer Key and Consumer Secret from Tumblr
5. Enable scopes: **basic**, **write**, **offline_access**
6. Toggle **"Connected Accounts for Token Vault"** ON
7. Enable the connection for your Auth0 application

## Testing Checklist

After Auth0 is configured and code is deployed:

- [ ] Settings → Connect Tumblr → OAuth flow completes → "Connected" badge shows
- [ ] `/tumblr` → returns TumblrFeed with dashboard posts
- [ ] `/tumblr #jazz` → returns TumblrFeed with tagged posts
- [ ] `/tumblr likes` → returns TumblrFeed with liked posts
- [ ] "Export to Spotify Playlist" button visible when audio posts present
- [ ] Settings → Disconnect Tumblr → reconnect works
