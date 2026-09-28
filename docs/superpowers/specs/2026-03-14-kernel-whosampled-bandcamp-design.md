# Kernel.sh + WhoSampled + Bandcamp Related Tags Integration

**Goal:** Wire Kernel.sh cloud browser, WhoSampled sample tools, and Bandcamp related tags API into crate-web's agentic chat loop.

**Architecture:** Create web-side tool wrappers for WhoSampled (reusing crate-cli's exported handlers) and browser (reusing crate-cli's `withBrowser`). Create a new tool for Bandcamp's related_tags API. All Kernel-dependent tools gated by KERNEL_API_KEY.

**Tech Stack:** crate-cli (exported handlers + withBrowser), @onkernel/sdk, playwright-core (CDP), Bandcamp internal API

---

## Context

crate-web's chat agent has 8 Bandcamp tools and rich influence mapping, but three capabilities are missing:

1. **WhoSampled** — 3 tools for sample relationship discovery (search, track samples, artist connections). These exist in crate-cli but aren't registered in the tool registry. They require Kernel.sh's stealth browser to bypass Cloudflare Turnstile (10s wait per request).

2. **Browser** — 2 general tools (browse_url, screenshot_url) for reading anti-bot-protected pages (Pitchfork, Resident Advisor, RYM). Also in crate-cli, also unregistered. Bandcamp's existing `browserFetchHtml` fallback will automatically activate once KERNEL_API_KEY is set in the environment.

3. **Bandcamp related tags** — `POST /api/tag_search/2/related_tags` returns weighted genre relationships. Not in crate-cli at all. Discovered via robots.txt Allow directive and reverse-engineered from bandcamp-fetch library.

### Why web-side wrappers instead of passing servers through

crate-cli exports `whoSampledServer` and `browserServer` as `McpSdkServerConfigWithInstance` objects (from `createSdkMcpServer`). These have shape `{ type, name, instance }` where tools live in `instance._registeredTools` — a private internal structure incompatible with crate-web's `CrateToolDef` interface (`{ name, description, inputSchema: Record<string, z.ZodTypeAny>, handler }`).

However, crate-cli does export the raw handler functions:
- `searchWhoSampledHandler`, `getTrackSamplesHandler`, `getArtistConnectionsHandler` from whosampled.js
- `withBrowser` from browser.js

We create thin CrateToolDef wrappers around these exported functions.

## Design

### 1. WhoSampled Web Tools

**File:** `src/lib/web-tools/whosampled.ts` (new)

Three tools wrapping crate-cli's exported handlers:

| Tool | Handler | Input |
|------|---------|-------|
| `search_whosampled` | `searchWhoSampledHandler` | `artist: string, track: string` |
| `get_track_samples` | `getTrackSamplesHandler` | `whosampled_url: string` |
| `get_artist_connections` | `getArtistConnectionsHandler` | `artist: string` |

Each wrapper: define name, description, zod inputSchema, handler that calls the crate-cli function.

Gated by KERNEL_API_KEY (handlers call `withBrowser({ stealth: true })` internally).

### 2. Browser Web Tools

**File:** `src/lib/web-tools/browser.ts` (new)

Two tools using crate-cli's exported `withBrowser`:

| Tool | Description | Input |
|------|-------------|-------|
| `browse_url` | Navigate + extract article text/metadata | `url: string, wait_for?: string` |
| `screenshot_url` | Take page screenshot | `url: string, full_page?: boolean, selector?: string` |

These tools call `withBrowser` from crate-cli's browser.js directly. Content extraction logic (article selectors, metadata parsing) is reimplemented in the wrapper since crate-cli doesn't export those helpers.

Gated by KERNEL_API_KEY.

### 3. Bandcamp Related Tags Tool

**File:** `src/lib/web-tools/bandcamp.ts` (new)

Single tool: `get_related_tags`

- **Input:** `tags: string[]` (1-5 tag names), `size?: number` (default 20)
- **Endpoint:** `POST https://bandcamp.com/api/tag_search/2/related_tags`
- **Body:** `{ tag_names: tags, combo: true, size }`
- **Output:** Per-tag related tags with relation weights (0-1), plus combo result for multi-tag queries
- **Rate limit:** 1.5s between requests (matches crate-cli's bandcamp rate limit)

Always available — no API key needed.

### 4. Chat Route Wiring

**File:** `src/app/api/chat/route.ts`

Import web tool creators. KERNEL_API_KEY must be set in process.env before handlers are called (already handled by the env var snapshot logic).

```typescript
import { createWhoSampledTools } from "@/lib/web-tools/whosampled";
import { createBrowserTools } from "@/lib/web-tools/browser";
import { createBandcampWebTools } from "@/lib/web-tools/bandcamp";
```

Tool group assembly:
```typescript
const hasKernel = !!(envKeys.KERNEL_API_KEY || process.env.KERNEL_API_KEY);

// Kernel-gated tools
const webWhoSampledTools = hasKernel ? createWhoSampledTools() : [];
const webBrowserTools = hasKernel ? createBrowserTools() : [];

// Always available
const webBandcampTools = createBandcampWebTools();
```

Add to `allToolGroups`:
- `{ serverName: "whosampled", tools: webWhoSampledTools }` (when hasKernel)
- `{ serverName: "browser", tools: webBrowserTools }` (when hasKernel)
- `{ serverName: "bandcamp-web", tools: webBandcampTools }` (always)

### 5. RESEARCH_SERVERS Update

Add `"whosampled"`, `"browser"`, and `"bandcamp-web"` to the `RESEARCH_SERVERS` set.

Also fix pre-existing bug: `"web-search"` in RESEARCH_SERVERS doesn't match the actual serverName `"websearch"` from crate-cli's tool-registry. Correct to `"websearch"`.

### 6. Vercel Environment

Push `EMBEDDED_KERNEL_KEY` to Vercel production + preview. The mapping in `resolve-user-keys.ts` (`EMBEDDED_KERNEL_KEY` → `KERNEL_API_KEY`) already exists — no code change needed there.

## Constraints

- WhoSampled: 10s Turnstile wait per request. ~25-30 max lookups per 300s Vercel session. Typical research uses 3-5.
- Bandcamp related_tags: No API key needed, but rate-limited to 1.5s.
- Kernel sessions: ~300ms spin-up, plus page load + wait time. Each `withBrowser()` call creates and destroys a session.
- Convex caching for WhoSampled deferred to future work.

## Files

| File | Action | Description |
|------|--------|-------------|
| `src/lib/web-tools/whosampled.ts` | Create | WhoSampled tool wrappers using crate-cli handlers |
| `src/lib/web-tools/browser.ts` | Create | Browser tool wrappers using crate-cli withBrowser |
| `src/lib/web-tools/bandcamp.ts` | Create | `get_related_tags` tool (standalone HTTP) |
| `src/app/api/chat/route.ts` | Modify | Import + inject whosampled, browser, bandcamp-web tool groups; fix websearch RESEARCH_SERVERS entry |

## Verification

1. `npx tsc --noEmit` — clean build
2. Without KERNEL_API_KEY: whosampled/browser tools not loaded, bandcamp-web loads, no errors
3. With KERNEL_API_KEY: all three tool groups load
4. Test in chat: ask "what songs sampled Amen Brother by The Winstons" — should use search_whosampled + get_track_samples
5. Test in chat: ask "what genres are related to jazz fusion on bandcamp" — should use get_related_tags
