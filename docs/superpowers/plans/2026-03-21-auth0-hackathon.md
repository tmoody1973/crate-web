# Auth0 Token Vault Hackathon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate Auth0 Token Vault into Crate so users click "Connect" instead of pasting API keys, enabling Spotify library access, playlist export, Slack delivery, and Google Docs saving — all for the Auth0 "Authorized to Act" hackathon (deadline April 6, 2026).

**Architecture:** Clerk stays for user sign-in. Auth0 Token Vault is added alongside for OAuth connections to Spotify, Slack, and Google. The `auth0-token-vault.ts` module provides a `getTokenVaultToken(service)` function that tools call to get OAuth tokens. If no connection exists, tools fall back to embedded platform keys or prompt the user to connect. New tools (`read_spotify_library`, `export_to_spotify`, `send_to_slack`, `save_to_google_doc`) use Token Vault tokens directly.

**Tech Stack:** Next.js 14 (App Router), Auth0 (`@auth0/ai-vercel`, `@auth0/nextjs-auth0`), Spotify Web API, Slack API, Google Docs API (`googleapis`), TypeScript

**Spec:** `docs/plans/2026-03-21-auth0-hackathon-design.md`

**Working directory:** `/Users/tarikmoody/Documents/Projects/crate-web-subscription` (branch `feat/subscription-pricing`)

**Prerequisite:** Auth0 account created with Token Vault connections configured for Spotify, Slack, and Google in the Auth0 Dashboard. This is manual setup (not code) — do this before starting Task 1.

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/auth0-token-vault.ts` | Token Vault client — `getTokenVaultToken(clerkId, service)` function, connection status check |
| `src/app/api/auth0/connect/route.ts` | Initiates Auth0 Token Vault OAuth flow (redirects to Auth0) |
| `src/app/api/auth0/callback/route.ts` | Handles Auth0 OAuth callback, stores connection status |
| `src/app/api/auth0/status/route.ts` | Returns which services the user has connected |
| `src/lib/web-tools/spotify-connected.ts` | `read_spotify_library` + `export_to_spotify` agent tools |
| `src/lib/web-tools/slack.ts` | `send_to_slack` agent tool |
| `src/lib/web-tools/google-docs.ts` | `save_to_google_doc` agent tool |
| `src/components/settings/connected-services.tsx` | "Connected Services" UI with Connect/Disconnect buttons |

### Modified Files
| File | Change |
|------|--------|
| `src/app/api/chat/route.ts` | Import and register new tool servers (spotify-connected, slack, google-docs) |
| `src/components/settings/settings-drawer.tsx` | Add `ConnectedServices` section above `PlanSection` |
| `.env.local.example` | Add Auth0 env vars (`AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_TOKEN_VAULT_AUDIENCE`) |
| `package.json` | Add `@auth0/ai-vercel`, `@auth0/ai`, `googleapis` |

---

## Chunk 1: Auth0 Foundation

### Task 1: Install Dependencies and Add Env Vars

**Files:**
- Modify: `package.json`
- Modify: `.env.local.example`

- [ ] **Step 1: Install Auth0 and Google dependencies**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web-subscription
npm install @auth0/ai @auth0/ai-vercel googleapis
```

- [ ] **Step 2: Add Auth0 env vars to `.env.local.example`**

Add after the `ADMIN_EMAILS` line:

```bash
# Auth0 Token Vault (for OAuth connections to Spotify, Slack, Google)
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your-auth0-client-id
AUTH0_CLIENT_SECRET=your-auth0-client-secret
AUTH0_TOKEN_VAULT_AUDIENCE=https://your-api-audience
AUTH0_CALLBACK_URL=http://localhost:3000/api/auth0/callback
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore: add Auth0 AI SDK and Google APIs dependencies"
```

---

### Task 2: Create Token Vault Client

**Files:**
- Create: `src/lib/auth0-token-vault.ts`

This module provides the core function that all Token Vault-powered tools use to get OAuth tokens. It wraps the Auth0 AI SDK's token exchange mechanism.

- [ ] **Step 1: Create the Token Vault client**

```typescript
/**
 * Auth0 Token Vault client for Crate.
 * Provides OAuth tokens for connected services (Spotify, Slack, Google).
 * Tokens are managed by Auth0 — Crate never stores raw OAuth credentials.
 */

type TokenVaultService = "spotify" | "slack" | "google";

const SERVICE_CONFIG: Record<TokenVaultService, { connection: string; scopes: string[] }> = {
  spotify: {
    connection: "spotify",
    scopes: [
      "user-library-read",
      "user-top-read",
      "playlist-read-private",
      "playlist-modify-public",
      "playlist-modify-private",
    ],
  },
  slack: {
    connection: "slack",
    scopes: ["chat:write", "channels:read"],
  },
  google: {
    connection: "google-oauth2",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
};

/**
 * Exchange a user's Auth0 access token for a third-party service token via Token Vault.
 * Returns the OAuth token for the requested service, or null if not connected.
 */
export async function getTokenVaultToken(
  service: TokenVaultService,
): Promise<string | null> {
  const config = SERVICE_CONFIG[service];
  if (!config) return null;

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    console.warn("[token-vault] Auth0 credentials not configured");
    return null;
  }

  try {
    // Token Vault exchange: use Auth0 AI SDK to get a service-specific token.
    // The @auth0/ai-vercel SDK's withTokenVault() handles the token exchange
    // flow — converting an Auth0 access token into a Spotify/Slack/Google token.
    //
    // IMPLEMENTATION NOTE: The exact integration pattern depends on how Token
    // Vault connections are configured in the Auth0 Dashboard. The implementer
    // should reference the Auth0 sample app:
    // https://github.com/auth0-samples/auth0-ai-samples/tree/main/call-apis-on-users-behalf/others-api
    //
    // Until Token Vault is fully wired, this returns null — forcing all tools
    // to show the "not connected" graceful error message. This is safe because:
    // 1. No management token is ever returned to tools
    // 2. Existing embedded keys still work for non-OAuth services
    // 3. Tools handle null by prompting the user to connect

    console.warn(`[token-vault] Token Vault exchange not yet implemented for ${service}. Returning null.`);
    return null;
  } catch (err) {
    console.error(`[token-vault] Failed to get ${service} token:`, err);
    return null;
  }
}

/** Check if Token Vault is configured (Auth0 env vars present). */
export function isTokenVaultConfigured(): boolean {
  return !!(
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET
  );
}

export { type TokenVaultService, SERVICE_CONFIG };
```

**Note:** The exact Token Vault token exchange API will be refined during Task 2 implementation. The Auth0 AI SDK (`@auth0/ai-vercel`) provides higher-level wrappers that may simplify this. The implementer should read the Auth0 sample app at `https://github.com/auth0-samples/auth0-ai-samples/tree/main/call-apis-on-users-behalf/others-api` and adapt the token exchange pattern to Crate's architecture (Clerk for user auth, Auth0 for Token Vault only).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/auth0-token-vault.ts
git commit -m "feat: add Auth0 Token Vault client for OAuth token resolution"
```

---

### Task 3: Create Auth0 Connect/Callback/Status API Routes

**Files:**
- Create: `src/app/api/auth0/connect/route.ts`
- Create: `src/app/api/auth0/callback/route.ts`
- Create: `src/app/api/auth0/status/route.ts`

These routes handle the OAuth connection flow. The connect route redirects to Auth0, the callback route handles the return, and the status route tells the frontend which services are connected.

- [ ] **Step 1: Create the connect route**

`src/app/api/auth0/connect/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { SERVICE_CONFIG, type TokenVaultService } from "@/lib/auth0-token-vault";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const service = url.searchParams.get("service") as TokenVaultService | null;

  if (!service || !SERVICE_CONFIG[service]) {
    return Response.json({ error: "Invalid service" }, { status: 400 });
  }

  const config = SERVICE_CONFIG[service];
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const callbackUrl = process.env.AUTH0_CALLBACK_URL || `${url.origin}/api/auth0/callback`;

  // Generate CSRF nonce and store state in a signed cookie (not in the URL)
  const crypto = await import("crypto");
  const nonce = crypto.randomBytes(16).toString("hex");

  // Store service + clerkId keyed by nonce in a short-lived signed cookie
  const statePayload = JSON.stringify({ service, clerkId, nonce });
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.AUTH0_CLIENT_SECRET!.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(statePayload)),
  ).toString("hex");
  const signedState = `${Buffer.from(statePayload).toString("base64")}.${signature}`;

  // Redirect to Auth0 authorization endpoint
  const authUrl = new URL(`https://${domain}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("connection", config.connection);
  authUrl.searchParams.set("state", nonce); // Only nonce in URL, not user data

  const response = Response.redirect(authUrl.toString());
  // Store signed state in httpOnly cookie (expires in 10 minutes)
  response.headers.set(
    "Set-Cookie",
    `auth0_state=${signedState}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth0; Max-Age=600`,
  );
  return response;
}
```

- [ ] **Step 2: Create the callback route**

`src/app/api/auth0/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");

  if (!code || !nonce) {
    return NextResponse.redirect(new URL("/settings?auth0_error=missing_params", url.origin));
  }

  // Verify CSRF nonce against signed cookie
  const cookies = req.headers.get("cookie") ?? "";
  const stateCookie = cookies.split(";").find((c) => c.trim().startsWith("auth0_state="));
  if (!stateCookie) {
    return NextResponse.redirect(new URL("/settings?auth0_error=no_state_cookie", url.origin));
  }

  const signedState = stateCookie.split("=").slice(1).join("=").trim();
  const [payloadB64, signature] = signedState.split(".");
  const statePayload = Buffer.from(payloadB64, "base64").toString();

  // Verify HMAC signature
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.AUTH0_CLIENT_SECRET!.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signature, "hex"),
    encoder.encode(statePayload),
  );
  if (!valid) {
    return NextResponse.redirect(new URL("/settings?auth0_error=invalid_signature", url.origin));
  }

  let state: { service: string; clerkId: string; nonce: string };
  try {
    state = JSON.parse(statePayload);
  } catch {
    return NextResponse.redirect(new URL("/settings?auth0_error=invalid_state", url.origin));
  }

  // Verify nonce matches
  if (state.nonce !== nonce) {
    return NextResponse.redirect(new URL("/settings?auth0_error=nonce_mismatch", url.origin));
  }

  // Exchange code for tokens via Auth0
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const callbackUrl = process.env.AUTH0_CALLBACK_URL || `${url.origin}/api/auth0/callback`;

  try {
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      console.error("[auth0/callback] Token exchange failed:", detail);
      return NextResponse.redirect(new URL(`/settings?auth0_error=token_exchange&service=${state.service}`, url.origin));
    }

    // Token is now stored in Auth0's Token Vault — we don't store it ourselves
    // The connection is now active for this user

    return NextResponse.redirect(new URL(`/settings?auth0_connected=${state.service}`, url.origin));
  } catch (err) {
    console.error("[auth0/callback] Error:", err);
    return NextResponse.redirect(new URL("/settings?auth0_error=unknown", url.origin));
  }
}
```

- [ ] **Step 3: Create the status route**

`src/app/api/auth0/status/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { isTokenVaultConfigured } from "@/lib/auth0-token-vault";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({
      configured: false,
      connections: { spotify: false, slack: false, google: false },
    });
  }

  // TODO: Query Auth0 to check which connections exist for this user
  // For the hackathon MVP, this can check if tokens are retrievable
  // by attempting a token exchange for each service

  return Response.json({
    configured: true,
    connections: {
      spotify: false, // Will be populated once Auth0 is configured
      slack: false,
      google: false,
    },
  });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/auth0/
git commit -m "feat: add Auth0 connect, callback, and status API routes"
```

---

## Chunk 2: Agent Tools

### Task 4: Create Spotify Connected Tools

**Files:**
- Create: `src/lib/web-tools/spotify-connected.ts`

- [ ] **Step 1: Create the Spotify tools file**

```typescript
/**
 * Spotify tools powered by Auth0 Token Vault.
 * Read user's library, export playlists — requires user to connect Spotify via OAuth.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createSpotifyConnectedTools(): CrateToolDef[] {
  const readLibraryHandler = async (args: {
    type: string;
    limit?: number;
  }) => {
    const token = await getTokenVaultToken("spotify");
    if (!token) {
      return toolResult({
        error: "Spotify not connected. Ask the user to connect Spotify in Settings.",
        action: "connect_spotify",
      });
    }

    const limit = args.limit ?? 20;
    let endpoint: string;

    switch (args.type) {
      case "saved_tracks":
        endpoint = `https://api.spotify.com/v1/me/tracks?limit=${limit}`;
        break;
      case "top_artists":
        endpoint = `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=medium_term`;
        break;
      case "playlists":
        endpoint = `https://api.spotify.com/v1/me/playlists?limit=${limit}`;
        break;
      default:
        return toolResult({ error: "Invalid type. Use: saved_tracks, top_artists, or playlists" });
    }

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({ error: `Spotify API error: ${res.status}`, detail });
      }

      const data = await res.json();

      if (args.type === "saved_tracks") {
        return toolResult({
          type: "saved_tracks",
          total: data.total,
          tracks: data.items.map((item: { track: { name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string } } }) => ({
            name: item.track.name,
            artist: item.track.artists.map((a: { name: string }) => a.name).join(", "),
            album: item.track.album.name,
            year: item.track.album.release_date?.slice(0, 4),
          })),
        });
      }

      if (args.type === "top_artists") {
        return toolResult({
          type: "top_artists",
          artists: data.items.map((a: { name: string; genres: string[]; images: Array<{ url: string }> }) => ({
            name: a.name,
            genres: a.genres,
            imageUrl: a.images?.[0]?.url,
          })),
        });
      }

      // playlists
      return toolResult({
        type: "playlists",
        playlists: data.items.map((p: { name: string; tracks: { total: number }; id: string }) => ({
          name: p.name,
          trackCount: p.tracks.total,
          id: p.id,
        })),
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Spotify request failed" });
    }
  };

  const exportPlaylistHandler = async (args: {
    name: string;
    description: string;
    trackQueries: string[];
  }) => {
    const token = await getTokenVaultToken("spotify");
    if (!token) {
      return toolResult({
        error: "Spotify not connected. Ask the user to connect Spotify in Settings.",
        action: "connect_spotify",
      });
    }

    try {
      // Step 1: Get user ID
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return toolResult({ error: "Failed to get Spotify user info" });
      const me = await meRes.json();

      // Step 2: Create playlist
      const createRes = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          public: true,
        }),
      });
      if (!createRes.ok) return toolResult({ error: "Failed to create Spotify playlist" });
      const playlist = await createRes.json();

      // Step 3: Search for each track and collect URIs
      const trackUris: string[] = [];
      const notFound: string[] = [];

      for (const query of args.trackQueries) {
        try {
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const track = searchData.tracks?.items?.[0];
            if (track) {
              trackUris.push(track.uri);
            } else {
              notFound.push(query);
            }
          }
        } catch {
          notFound.push(query);
        }
      }

      // Step 4: Add tracks to playlist (max 100 per request)
      if (trackUris.length > 0) {
        for (let i = 0; i < trackUris.length; i += 100) {
          const batch = trackUris.slice(i, i + 100);
          await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: batch }),
          });
        }
      }

      return toolResult({
        success: true,
        playlistUrl: playlist.external_urls.spotify,
        playlistName: args.name,
        tracksAdded: trackUris.length,
        tracksNotFound: notFound,
        message: `Playlist "${args.name}" created with ${trackUris.length} tracks!${notFound.length > 0 ? ` ${notFound.length} tracks not found on Spotify.` : ""}`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Playlist export failed" });
    }
  };

  return [
    {
      name: "read_spotify_library",
      description:
        "Read the user's Spotify library — saved tracks, top artists, or playlists. Requires the user to have connected their Spotify account via Settings. Use this to personalize research based on what the user already listens to.",
      inputSchema: {
        type: z.enum(["saved_tracks", "top_artists", "playlists"]).describe("What to read from the library"),
        limit: z.number().optional().describe("Number of items to return (default 20, max 50)"),
      },
      handler: readLibraryHandler,
    },
    {
      name: "export_to_spotify",
      description:
        "Create a playlist in the user's Spotify account. Pass track queries as 'Artist Name Track Title' strings — the tool searches Spotify to find the right track. Requires Spotify connection.",
      inputSchema: {
        name: z.string().describe("Playlist name (e.g. 'Ezra Collective: The Influence Chain')"),
        description: z.string().describe("Playlist description"),
        trackQueries: z.array(z.string()).describe("Array of 'Artist - Track' strings to search for on Spotify"),
      },
      handler: exportPlaylistHandler,
    },
  ];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/web-tools/spotify-connected.ts
git commit -m "feat: add Spotify library read and playlist export tools via Token Vault"
```

---

### Task 5: Create Slack and Google Docs Tools

**Files:**
- Create: `src/lib/web-tools/slack.ts`
- Create: `src/lib/web-tools/google-docs.ts`

- [ ] **Step 1: Create the Slack tool**

`src/lib/web-tools/slack.ts`:

```typescript
/**
 * Slack tool powered by Auth0 Token Vault.
 * Send research, show prep, or news segments to a Slack channel.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createSlackTools(): CrateToolDef[] {
  const sendToSlackHandler = async (args: {
    channel: string;
    content: string;
    title?: string;
  }) => {
    const token = await getTokenVaultToken("slack");
    if (!token) {
      return toolResult({
        error: "Slack not connected. Ask the user to connect Slack in Settings.",
        action: "connect_slack",
      });
    }

    // Normalize channel name (add # if missing)
    const channel = args.channel.startsWith("#") ? args.channel.slice(1) : args.channel;

    const blocks = [];
    if (args.title) {
      blocks.push({
        type: "header",
        text: { type: "plain_text", text: args.title },
      });
    }

    // Split content into chunks of 3000 chars (Slack block limit)
    const chunks = [];
    let remaining = args.content;
    while (remaining.length > 0) {
      chunks.push(remaining.slice(0, 3000));
      remaining = remaining.slice(3000);
    }

    for (const chunk of chunks) {
      blocks.push({
        type: "section",
        text: { type: "mrkdwn", text: chunk },
      });
    }

    try {
      const res = await fetch("https://slack.com/api/chat.postMessage", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          channel,
          blocks,
          text: args.title || "Crate Research",
        }),
      });

      const data = await res.json();

      if (!data.ok) {
        return toolResult({ error: `Slack API error: ${data.error}` });
      }

      return toolResult({
        success: true,
        channel: `#${channel}`,
        permalink: data.message?.permalink,
        message: `Sent to #${channel} on Slack!`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Slack send failed" });
    }
  };

  return [
    {
      name: "send_to_slack",
      description:
        "Send research results, show prep, or news segments to a Slack channel. Requires the user to have connected Slack in Settings. Use this when the user says 'send to Slack' or 'share with my team'.",
      inputSchema: {
        channel: z.string().describe("Slack channel name (e.g. '#hyfin-evening' or 'general')"),
        content: z.string().describe("Content to send (supports Slack markdown)"),
        title: z.string().optional().describe("Optional header for the message"),
      },
      handler: sendToSlackHandler,
    },
  ];
}
```

- [ ] **Step 2: Create the Google Docs tool**

`src/lib/web-tools/google-docs.ts`:

```typescript
/**
 * Google Docs tool powered by Auth0 Token Vault.
 * Save research output as shareable Google Docs.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createGoogleDocsTools(): CrateToolDef[] {
  const saveToGoogleDocHandler = async (args: {
    title: string;
    content: string;
  }) => {
    const token = await getTokenVaultToken("google");
    if (!token) {
      return toolResult({
        error: "Google not connected. Ask the user to connect Google in Settings.",
        action: "connect_google",
      });
    }

    try {
      // Step 1: Create an empty doc
      const createRes = await fetch("https://docs.googleapis.com/v1/documents", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: args.title }),
      });

      if (!createRes.ok) {
        const detail = await createRes.text().catch(() => "");
        return toolResult({ error: `Google Docs API error: ${createRes.status}`, detail });
      }

      const doc = await createRes.json();
      const docId = doc.documentId;

      // Step 2: Insert content
      await fetch(`https://docs.googleapis.com/v1/documents/${docId}:batchUpdate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requests: [
            {
              insertText: {
                location: { index: 1 },
                text: args.content,
              },
            },
          ],
        }),
      });

      const docUrl = `https://docs.google.com/document/d/${docId}/edit`;

      return toolResult({
        success: true,
        docUrl,
        docId,
        title: args.title,
        message: `Saved to Google Docs: ${docUrl}`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Google Docs save failed" });
    }
  };

  return [
    {
      name: "save_to_google_doc",
      description:
        "Save research output as a Google Doc. Creates a new document with the given title and content, returns a shareable link. Requires Google connection in Settings.",
      inputSchema: {
        title: z.string().describe("Document title (e.g. 'Flying Lotus Influence Chain')"),
        content: z.string().describe("Document content (plain text, will be inserted into the doc)"),
      },
      handler: saveToGoogleDocHandler,
    },
  ];
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/web-tools/slack.ts src/lib/web-tools/google-docs.ts
git commit -m "feat: add Slack and Google Docs tools via Token Vault"
```

---

## Chunk 3: Wire Tools Into Chat Route

### Task 6: Register New Tool Servers in Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Add imports at the top**

After the existing web-tools imports, add:

```typescript
import { createSpotifyConnectedTools } from "@/lib/web-tools/spotify-connected";
import { createSlackTools } from "@/lib/web-tools/slack";
import { createGoogleDocsTools } from "@/lib/web-tools/google-docs";
import { isTokenVaultConfigured } from "@/lib/auth0-token-vault";
```

- [ ] **Step 2: Create tools in `streamAgenticResponse`**

After the `webUserSkillTools` creation and before the `allToolGroups` array, add:

```typescript
        // Auth0 Token Vault-powered tools (Spotify, Slack, Google Docs)
        const webSpotifyConnectedTools = isTokenVaultConfigured()
          ? createSpotifyConnectedTools()
          : [];
        const webSlackTools = isTokenVaultConfigured()
          ? createSlackTools()
          : [];
        const webGoogleDocsTools = isTokenVaultConfigured()
          ? createGoogleDocsTools()
          : [];
```

- [ ] **Step 3: Add to `allToolGroups` array**

After the `user-skills` entry, add:

```typescript
          ...(webSpotifyConnectedTools.length > 0
            ? [{ serverName: "spotify-connected", tools: webSpotifyConnectedTools }]
            : []),
          ...(webSlackTools.length > 0
            ? [{ serverName: "slack", tools: webSlackTools }]
            : []),
          ...(webGoogleDocsTools.length > 0
            ? [{ serverName: "google-docs", tools: webGoogleDocsTools }]
            : []),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: wire Spotify, Slack, Google Docs tools into agentic loop"
```

---

## Chunk 4: Settings UI

### Task 7: Create Connected Services Component

**Files:**
- Create: `src/components/settings/connected-services.tsx`
- Modify: `src/components/settings/settings-drawer.tsx`

- [ ] **Step 1: Create the Connected Services component**

```tsx
"use client";

import { useState, useEffect } from "react";

interface ConnectionStatus {
  configured: boolean;
  connections: {
    spotify: boolean;
    slack: boolean;
    google: boolean;
  };
}

const SERVICES = [
  {
    id: "spotify" as const,
    name: "Spotify",
    description: "Read your library, export playlists",
    icon: "🎵",
  },
  {
    id: "slack" as const,
    name: "Slack",
    description: "Send research to your team",
    icon: "💬",
  },
  {
    id: "google" as const,
    name: "Google",
    description: "Save research to Google Docs",
    icon: "📄",
  },
];

export function ConnectedServices() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth0/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Check for callback params (connected or error)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("auth0_connected");
    if (connected) {
      // Refresh status after connection
      fetch("/api/auth0/status")
        .then((r) => r.json())
        .then(setStatus)
        .catch(() => {});
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  if (!status?.configured) return null;

  const handleConnect = (serviceId: string) => {
    setConnecting(serviceId);
    // Open Auth0 OAuth flow in current window
    window.location.href = `/api/auth0/connect?service=${serviceId}`;
  };

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        Connected Services
      </h3>
      <div className="space-y-2">
        {SERVICES.map((service) => {
          const isConnected = status.connections[service.id];
          return (
            <div
              key={service.id}
              className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{service.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{service.name}</p>
                  <p className="text-xs text-zinc-500">{service.description}</p>
                </div>
              </div>
              {isConnected ? (
                <span className="rounded-full bg-green-500/20 px-3 py-1 text-xs text-green-400">
                  Connected
                </span>
              ) : (
                <button
                  onClick={() => handleConnect(service.id)}
                  disabled={connecting === service.id}
                  className="rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  {connecting === service.id ? "Connecting..." : "Connect"}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add to Settings drawer**

In `src/components/settings/settings-drawer.tsx`, add import:

```typescript
import { ConnectedServices } from "./connected-services";
```

Add `<ConnectedServices />` before `<PlanSection />`:

```tsx
        <ConnectedServices />

        <PlanSection />
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/components/settings/connected-services.tsx src/components/settings/settings-drawer.tsx
git commit -m "feat: add Connected Services UI with Spotify, Slack, Google connect buttons"
```

---

## Chunk 5: Final Verification

### Task 8: Build Verification and Push

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify no regressions**

Check that existing commands still work:
- `/influence`, `/prep`, `/news` prompts unchanged in chat-utils.ts
- Existing API key resolution still works (resolve-user-keys.ts unchanged)
- Subscription system intact (plans.ts, subscriptions.ts unchanged)
- Custom skills intact (userSkills.ts, user-skills.ts unchanged)

- [ ] **Step 3: Push to branch**

```bash
git push origin feat/subscription-pricing
```

- [ ] **Step 4: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: finalize Auth0 Token Vault hackathon integration"
```

---

## Post-Implementation: Hackathon Submission Checklist

After code is complete, before April 6 deadline:

- [ ] Set up Auth0 account with Token Vault connections (Spotify, Slack, Google) in Dashboard
- [ ] Add Auth0 env vars to Vercel deployment
- [ ] Test full flow: Connect Spotify → read library → export playlist → send to Slack
- [ ] Record 3-minute demo video (use demo script from design spec)
- [ ] Write Devpost submission text
- [ ] Write blog post (250+ words, bonus $250 prize)
- [ ] Submit on Devpost with: description, video link, repo URL, published link

---

## Verification Checklist

### Build
- `npx tsc --noEmit` — TypeScript compiles
- All imports resolve correctly

### Manual Testing
1. **Connect flow**: Click "Connect Spotify" in Settings → Auth0 OAuth popup → authorize → status shows "Connected"
2. **Read library**: Ask "What's in my Spotify library?" → agent calls read_spotify_library → shows saved tracks
3. **Export playlist**: After influence chain, say "save as Spotify playlist" → agent creates playlist → URL works
4. **Send to Slack**: Run /prep, say "send to #general on Slack" → message appears in Slack
5. **Save to Google Docs**: Say "save this to Google Docs" → doc created → URL works
6. **Fallback**: Without Token Vault configured → existing embedded keys still work → no regression
7. **No connection**: Without connecting Spotify → agent says "Connect Spotify in Settings" → graceful error
