# Kernel.sh + WhoSampled + Bandcamp Related Tags Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Kernel.sh cloud browser, WhoSampled sample discovery, and Bandcamp related tags into the agentic chat loop.

**Architecture:** Create web-side CrateToolDef wrappers around crate-cli's exported handler functions (whosampled) and withBrowser utility (browser). Add a standalone HTTP tool for Bandcamp's related_tags API. Wire all into the chat route gated by KERNEL_API_KEY.

**Tech Stack:** TypeScript, crate-cli (handlers + withBrowser), @onkernel/sdk, playwright-core, zod, Bandcamp internal API

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/web-tools/whosampled.ts` | Create | 3 WhoSampled CrateToolDef wrappers using crate-cli handlers |
| `src/lib/web-tools/browser.ts` | Create | 2 browser CrateToolDef wrappers using crate-cli withBrowser |
| `src/lib/web-tools/bandcamp.ts` | Create | 1 Bandcamp related_tags tool (standalone HTTP) |
| `src/app/api/chat/route.ts` | Modify | Import + inject new tool groups, fix RESEARCH_SERVERS |

---

## Chunk 1: Tool Implementations

### Task 1: Bandcamp Related Tags Tool

**Files:**
- Create: `src/lib/web-tools/bandcamp.ts`

- [ ] **Step 1: Create the bandcamp web tool file**

```typescript
// src/lib/web-tools/bandcamp.ts
/**
 * Web-specific Bandcamp tools — extends crate-cli's bandcamp server
 * with the undocumented related_tags API endpoint.
 *
 * Endpoint: POST /api/tag_search/2/related_tags
 * Discovered via robots.txt Allow directive + bandcamp-fetch library.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const RELATED_TAGS_URL = "https://bandcamp.com/api/tag_search/2/related_tags";
const FETCH_TIMEOUT_MS = 10_000;
const MIN_DELAY_MS = 1500;
let lastRequest = 0;

async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequest;
  if (elapsed < MIN_DELAY_MS) {
    await new Promise((r) => setTimeout(r, MIN_DELAY_MS - elapsed));
  }
  lastRequest = Date.now();
}

interface RelatedTag {
  id: number;
  name: string;
  norm_name: string;
  relation: number;
  isloc: boolean;
}

interface RelatedTagsResponse {
  single_results?: Array<{
    tag: { name: string; norm_name: string };
    related_tags: RelatedTag[];
  }>;
  combo_result?: {
    related_tags: RelatedTag[];
  };
}

export function createBandcampWebTools(): CrateToolDef[] {
  return [
    {
      name: "get_related_tags",
      description:
        "Get related genre/style tags from Bandcamp for given tags. " +
        "Returns weighted relationships (0-1) showing how closely genres are connected. " +
        "Use for genre exploration, finding sub-genres, and understanding style relationships. " +
        "Example: ['jazz'] returns modern-jazz (0.85), contemporary-jazz (0.79), swing (0.65), etc.",
      inputSchema: {
        tags: z
          .array(z.string())
          .min(1)
          .max(5)
          .describe("Tag/genre names to find related tags for (e.g., ['jazz', 'funk'])"),
        size: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Number of related tags to return per input tag (default 20)"),
      },
      handler: async (args: { tags: string[]; size?: number }) => {
        await rateLimit();

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const res = await fetch(RELATED_TAGS_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Crate/1.0 (music-research-agent)",
            },
            body: JSON.stringify({
              tag_names: args.tags,
              combo: true,
              size: args.size ?? 20,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return {
              content: [{ type: "text" as const, text: JSON.stringify({ error: `Bandcamp API ${res.status}: ${text}` }) }],
            };
          }

          const data = (await res.json()) as RelatedTagsResponse;

          // Flatten into a cleaner format
          const results = {
            per_tag: (data.single_results ?? []).map((r) => ({
              tag: r.tag.name,
              related: r.related_tags.map((t) => ({
                name: t.name,
                weight: Math.round(t.relation * 1000) / 1000,
                is_location: t.isloc,
              })),
            })),
            ...(data.combo_result && args.tags.length > 1
              ? {
                  combined: data.combo_result.related_tags.map((t) => ({
                    name: t.name,
                    weight: Math.round(t.relation * 1000) / 1000,
                    is_location: t.isloc,
                  })),
                }
              : {}),
          };

          return {
            content: [{ type: "text" as const, text: JSON.stringify(results, null, 2) }],
          };
        } finally {
          clearTimeout(timer);
        }
      },
    },
  ];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/web-tools/bandcamp.ts
git commit -m "feat: add Bandcamp get_related_tags tool via internal API"
```

---

### Task 2: WhoSampled Web Tools

**Files:**
- Create: `src/lib/web-tools/whosampled.ts`

- [ ] **Step 1: Create the whosampled web tool file**

```typescript
// src/lib/web-tools/whosampled.ts
/**
 * Web-compatible WhoSampled tools.
 * Thin CrateToolDef wrappers around crate-cli's exported handler functions.
 *
 * crate-cli exports the handlers but not the tool definitions (those are
 * internal `const` not `export const`). We recreate the tool definitions
 * here with matching names, descriptions, and zod schemas.
 *
 * Requires KERNEL_API_KEY — handlers call withBrowser({ stealth: true })
 * internally to bypass Cloudflare Turnstile.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

export function createWhoSampledTools(): CrateToolDef[] {
  return [
    {
      name: "search_whosampled",
      description:
        "Search WhoSampled for a track by artist and title. " +
        "Returns matching tracks with links to their sample detail pages. " +
        "Use this first to find the WhoSampled URL, then use get_track_samples for details.",
      inputSchema: {
        artist: z.string().max(200).describe("Artist name to search for"),
        track: z.string().max(200).describe("Track title to search for"),
      },
      handler: async (args: { artist: string; track: string }) => {
        const { searchWhoSampledHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return searchWhoSampledHandler(args);
      },
    },
    {
      name: "get_track_samples",
      description:
        "Get sample relationships for a specific track from its WhoSampled page. " +
        "Returns samples used by the track and tracks that sampled it, " +
        "with type (sample/interpolation/replay), year, and artist info.",
      inputSchema: {
        whosampled_url: z
          .string()
          .max(500)
          .describe("WhoSampled URL or path for the track (e.g., /Kanye-West/Stronger/)"),
      },
      handler: async (args: { whosampled_url: string }) => {
        const { getTrackSamplesHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return getTrackSamplesHandler(args);
      },
    },
    {
      name: "get_artist_connections",
      description:
        "Get an artist's sampling connections from WhoSampled. " +
        "Returns their most-sampled tracks, top sampling tracks, and overall sample counts.",
      inputSchema: {
        artist: z.string().max(200).describe("Artist name (will be slugified for URL lookup)"),
      },
      handler: async (args: { artist: string }) => {
        const { getArtistConnectionsHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return getArtistConnectionsHandler(args);
      },
    },
  ];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/web-tools/whosampled.ts
git commit -m "feat: add WhoSampled web tools wrapping crate-cli handlers"
```

---

### Task 3: Browser Web Tools

**Files:**
- Create: `src/lib/web-tools/browser.ts`

- [ ] **Step 1: Create the browser web tool file**

```typescript
// src/lib/web-tools/browser.ts
/**
 * Web-compatible cloud browser tools powered by Kernel.sh.
 * Thin CrateToolDef wrappers around crate-cli's withBrowser utility.
 *
 * Enables the agent to read full articles and take screenshots from
 * sources that block simple HTTP fetches (Pitchfork, RYM, Resident Advisor, etc.).
 *
 * Requires KERNEL_API_KEY — withBrowser connects to Kernel's remote Chromium via CDP.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const MAX_CONTENT_LENGTH = 15_000;
const NAVIGATE_TIMEOUT_MS = 30_000;

/** CSS selectors for common music publication article containers. */
const ARTICLE_SELECTORS = [
  "article",
  '[role="article"]',
  ".review-body",
  ".article-body",
  ".post-content",
  ".entry-content",
  ".story-body",
  ".article__body",
  ".article-content",
  ".body-text",
  "main",
];

/** Elements to strip when falling back to full-page text extraction. */
const STRIP_SELECTORS = [
  "nav", "header", "footer", "aside",
  "script", "style", "noscript", "iframe",
  '[role="navigation"]', '[role="banner"]', '[role="complementary"]',
  ".ad", ".ads", ".advertisement", ".sidebar",
  ".cookie-banner", ".newsletter-signup", ".popup",
];

export function createBrowserTools(): CrateToolDef[] {
  return [
    {
      name: "browse_url",
      description:
        "Navigate to a URL using a cloud browser and extract the page content. " +
        "Use for reading full articles, reviews, and pages that block simple HTTP requests. " +
        "Best for music publications (Pitchfork, Resident Advisor, RYM, etc.) and pages with anti-bot protection.",
      inputSchema: {
        url: z.string().url().describe("The URL to navigate to"),
        wait_for: z
          .string()
          .optional()
          .describe("Optional CSS selector to wait for before extracting content"),
      },
      handler: async (args: { url: string; wait_for?: string }) => {
        const { withBrowser } = await import("crate-cli/dist/servers/browser.js");

        return withBrowser(async (page) => {
          await page.goto(args.url, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATE_TIMEOUT_MS,
          });

          if (args.wait_for) {
            await page.waitForSelector(args.wait_for, { timeout: 10_000 }).catch(() => {});
          } else {
            await page.waitForTimeout(2000);
          }

          const title = await page.title();

          const meta = await page.evaluate(() => {
            const get = (name: string) => {
              const el =
                document.querySelector(`meta[property="${name}"]`) ??
                document.querySelector(`meta[name="${name}"]`);
              return el?.getAttribute("content") ?? "";
            };
            return {
              description: get("og:description") || get("description"),
              author: get("author") || get("article:author"),
              published: get("article:published_time") || get("date"),
              siteName: get("og:site_name"),
            };
          });

          // Try article selectors first
          let content = "";
          for (const selector of ARTICLE_SELECTORS) {
            const text = await page.evaluate((sel: string) => {
              const el = document.querySelector(sel);
              return el ? el.textContent?.trim() ?? "" : "";
            }, selector);
            if (text.length > 200) {
              content = text.slice(0, MAX_CONTENT_LENGTH);
              break;
            }
          }

          // Fallback: strip noise, return body text
          if (!content) {
            content = await page.evaluate((stripSels: string[]) => {
              for (const sel of stripSels) {
                document.querySelectorAll(sel).forEach((el) => el.remove());
              }
              return document.body?.textContent?.trim() ?? "";
            }, STRIP_SELECTORS);
            content = content.slice(0, MAX_CONTENT_LENGTH);
          }

          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  url: page.url(),
                  title,
                  meta,
                  contentLength: content.length,
                  content,
                }),
              },
            ],
          };
        });
      },
    },
    {
      name: "screenshot_url",
      description:
        "Take a screenshot of a web page using a cloud browser. " +
        "Returns the screenshot as base64 image data. " +
        "Useful for capturing visual layouts, charts, or pages where text extraction isn't enough.",
      inputSchema: {
        url: z.string().url().describe("The URL to screenshot"),
        full_page: z
          .boolean()
          .optional()
          .describe("Capture full scrollable page instead of viewport (default false)"),
        selector: z
          .string()
          .optional()
          .describe("CSS selector of a specific element to screenshot"),
      },
      handler: async (args: { url: string; full_page?: boolean; selector?: string }) => {
        const { withBrowser } = await import("crate-cli/dist/servers/browser.js");

        return withBrowser(async (page) => {
          await page.goto(args.url, {
            waitUntil: "domcontentloaded",
            timeout: NAVIGATE_TIMEOUT_MS,
          });
          await page.waitForTimeout(2000);

          let screenshotBuffer: Buffer;
          if (args.selector) {
            const el = await page.$(args.selector);
            if (!el) {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({ error: `Element not found: ${args.selector}` }),
                  },
                ],
              };
            }
            screenshotBuffer = await el.screenshot({ type: "png" }) as Buffer;
          } else {
            screenshotBuffer = await page.screenshot({
              type: "png",
              fullPage: args.full_page ?? false,
            }) as Buffer;
          }

          const base64 = screenshotBuffer.toString("base64");
          const title = await page.title();

          return {
            content: [
              {
                type: "image" as const,
                data: base64,
                mimeType: "image/png",
              },
              {
                type: "text" as const,
                text: JSON.stringify({
                  url: page.url(),
                  title,
                  screenshotSize: `${Math.round(screenshotBuffer.length / 1024)}KB`,
                }),
              },
            ],
          };
        });
      },
    },
  ];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/web-tools/browser.ts
git commit -m "feat: add cloud browser tools wrapping crate-cli withBrowser"
```

---

## Chunk 2: Chat Route Wiring + Vercel

### Task 4: Wire Tools into Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts:1-18` (imports)
- Modify: `src/app/api/chat/route.ts:220-277` (tool assembly + RESEARCH_SERVERS)

- [ ] **Step 1: Add imports**

After line 11 (`import { createRadioTools }`), add:

```typescript
import { createWhoSampledTools } from "@/lib/web-tools/whosampled";
import { createBrowserTools } from "@/lib/web-tools/browser";
import { createBandcampWebTools } from "@/lib/web-tools/bandcamp";
```

- [ ] **Step 2: Create tool instances**

After the `webMemoryTools` block (after line 227), add:

```typescript
        // Kernel.sh browser tools (WhoSampled + browse/screenshot)
        const hasKernel = !!(envKeys.KERNEL_API_KEY || process.env.KERNEL_API_KEY);
        const webWhoSampledTools = hasKernel ? createWhoSampledTools() : [];
        const webBrowserTools = hasKernel ? createBrowserTools() : [];

        // Bandcamp related tags (no key needed)
        const webBandcampTools = createBandcampWebTools();
```

- [ ] **Step 3: Add to allToolGroups**

Inside the `allToolGroups` array (before the closing `];` on line 266), add:

```typescript
          ...(webWhoSampledTools.length > 0
            ? [{ serverName: "whosampled", tools: webWhoSampledTools }]
            : []),
          ...(webBrowserTools.length > 0
            ? [{ serverName: "browser", tools: webBrowserTools }]
            : []),
          { serverName: "bandcamp-web", tools: webBandcampTools },
```

- [ ] **Step 4: Fix RESEARCH_SERVERS**

Replace the RESEARCH_SERVERS set (lines 270-274):

```typescript
        const RESEARCH_SERVERS = new Set([
          "influence", "influencecache", "websearch", "musicbrainz",
          "genius", "lastfm", "discogs", "images", "infographic", "itunes",
          "memory", "whosampled", "browser", "bandcamp-web",
        ]);
```

Note: `"web-search"` changed to `"websearch"` to match crate-cli's actual serverName.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: wire whosampled, browser, bandcamp-web tools into chat route"
```

---

### Task 5: Push Kernel API Key to Vercel

- [ ] **Step 1: Check if key exists locally**

Run: `grep KERNEL_API_KEY .env.local`
Expected: Should show the key value

- [ ] **Step 2: Push to Vercel production**

```bash
grep KERNEL_API_KEY .env.local | cut -d= -f2 | vercel env add EMBEDDED_KERNEL_KEY production
```

- [ ] **Step 3: Push to Vercel preview**

```bash
grep KERNEL_API_KEY .env.local | cut -d= -f2 | vercel env add EMBEDDED_KERNEL_KEY preview
```

- [ ] **Step 4: Verify**

```bash
vercel env ls 2>&1 | grep -i kernel
```

Expected: Shows `EMBEDDED_KERNEL_KEY` in the list

- [ ] **Step 5: Push code to trigger deploy**

```bash
git push origin main
```

---

### Task 6: Verify Deployment

- [ ] **Step 1: Check Vercel build succeeds**

```bash
vercel ls 2>&1 | head -8
```

Expected: Latest deployment shows `● Ready`

- [ ] **Step 2: Test bandcamp related tags locally**

```bash
curl -s -X POST "https://bandcamp.com/api/tag_search/2/related_tags" \
  -H "Content-Type: application/json" \
  -d '{"tag_names": ["jazz-fusion"], "combo": true, "size": 5}' | python3 -m json.tool | head -20
```

Expected: Returns related tags with relation weights

- [ ] **Step 3: Functional test in chat**

Open the deployed app. Test each tool group:
1. "What genres are related to jazz fusion on Bandcamp?" → should use `get_related_tags`
2. "What songs sampled Amen Brother by The Winstons?" → should use `search_whosampled` + `get_track_samples`
3. "Read this Pitchfork review: [URL]" → should use `browse_url`
