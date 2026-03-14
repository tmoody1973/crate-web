# Kernel.sh + WhoSampled + Bandcamp Related Tags Integration

**Goal:** Wire Kernel.sh cloud browser, WhoSampled sample tools, and Bandcamp related tags API into crate-web's agentic chat loop.

**Architecture:** Pass crate-cli's existing whosampled + browser servers through to the chat route (gated by KERNEL_API_KEY). Create one new web tool for Bandcamp's undocumented related_tags API. Add embedded Kernel key to Vercel.

**Tech Stack:** crate-cli (whosampled.js, browser.js), @onkernel/sdk, playwright-core (CDP), Bandcamp internal API

---

## Context

crate-web's chat agent has 8 Bandcamp tools and rich influence mapping, but two capabilities are missing:

1. **WhoSampled** — 3 tools for sample relationship discovery (search, track samples, artist connections). These exist in crate-cli but aren't registered in the tool registry. They require Kernel.sh's stealth browser to bypass Cloudflare Turnstile (10s wait per request).

2. **Browser** — 2 general tools (browse_url, screenshot_url) for reading anti-bot-protected pages (Pitchfork, Resident Advisor, RYM). Also in crate-cli, also unregistered. Bandcamp's existing `browserFetchHtml` fallback will automatically activate once Kernel is available.

3. **Bandcamp related tags** — `POST /api/tag_search/2/related_tags` returns weighted genre relationships. Not in crate-cli at all. Discovered via robots.txt Allow directive and reverse-engineered from bandcamp-fetch library.

All three depend on `KERNEL_API_KEY` (whosampled + browser) or are standalone HTTP (bandcamp tags).

## Design

### 1. Chat Route — Inject WhoSampled + Browser Servers

**File:** `src/app/api/chat/route.ts`

After env vars are set and crate-cli tools are loaded, dynamically import whosampled and browser servers when KERNEL_API_KEY is available:

```typescript
const hasKernel = !!(envKeys.KERNEL_API_KEY || process.env.KERNEL_API_KEY);

let kernelToolGroups: { serverName: string; tools: CrateToolDef[] }[] = [];
if (hasKernel) {
  const { whoSampledServer } = await import("crate-cli/dist/servers/whosampled.js");
  const { browserServer } = await import("crate-cli/dist/servers/browser.js");
  kernelToolGroups = [
    { serverName: "whosampled", tools: whoSampledServer.tools },
    { serverName: "browser", tools: browserServer.tools },
  ];
}
```

Add to `allToolGroups` spread and to `RESEARCH_SERVERS` set.

Dynamic import avoids loading playwright-core and @onkernel/sdk when no key is present.

### 2. Bandcamp Related Tags Tool

**File:** `src/lib/web-tools/bandcamp.ts` (new)

Single tool: `get_related_tags`

- **Input:** `tags: string[]` (1-5 tag names), `size?: number` (default 20)
- **Endpoint:** `POST https://bandcamp.com/api/tag_search/2/related_tags`
- **Body:** `{ tag_names: tags, combo: true, size }`
- **Output:** Per-tag related tags with relation weights (0-1), plus combo result for multi-tag queries
- **Rate limit:** 1.5s between requests (matches crate-cli's bandcamp rate limit)

Added to `allToolGroups` as serverName `"bandcamp-web"` (avoids collision with crate-cli's `"bandcamp"` server). Always available — no API key needed.

### 3. Embedded Kernel Key

**File:** `src/lib/resolve-user-keys.ts`

Add to `getEmbeddedKeys()`:
```typescript
if (process.env.EMBEDDED_KERNEL_KEY)
  embedded.KERNEL_API_KEY = process.env.EMBEDDED_KERNEL_KEY;
```

Push `EMBEDDED_KERNEL_KEY` to Vercel production + preview environments.

### 4. RESEARCH_SERVERS Update

Add `"whosampled"`, `"browser"`, and `"bandcamp-web"` to the `RESEARCH_SERVERS` set so these tools are available during `/influence` and other research commands.

## Constraints

- WhoSampled: 10s Turnstile wait per request. ~25-30 max lookups per 300s Vercel session. Typical research uses 3-5.
- Bandcamp related_tags: No API key needed, but rate-limited to 1.5s.
- Kernel sessions: ~300ms spin-up, plus page load + wait time. Each `withBrowser()` call creates and destroys a session.
- Convex caching for WhoSampled deferred to future work.

## Files

| File | Action | Description |
|------|--------|-------------|
| `src/app/api/chat/route.ts` | Modify | Import + inject whosampled, browser, bandcamp-web tool groups |
| `src/lib/web-tools/bandcamp.ts` | Create | `get_related_tags` tool |
| `src/lib/resolve-user-keys.ts` | Modify | Add EMBEDDED_KERNEL_KEY |

## Verification

1. `npx tsc --noEmit` — clean build
2. Without KERNEL_API_KEY: whosampled/browser tools not loaded, bandcamp-web loads, no errors
3. With KERNEL_API_KEY: all three tool groups load
4. Test in chat: ask "what songs sampled Amen Brother by The Winstons" — should use search_whosampled + get_track_samples
5. Test in chat: ask "what genres are related to jazz fusion on bandcamp" — should use get_related_tags
