# Tiny Desk Companion Generation Pipeline Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Save as Tiny Desk Companion" reliably produce a complete companion page with influence chain + videos, and provide a way to fix broken companions.

**Architecture:** Move all enrichment server-side into a single `/api/tinydesk/save` API route that accepts the raw InfluenceChain data, validates it, enriches it (YouTube IDs + genre), and writes to Convex. The client button becomes a thin caller. Add a "Regenerate" button on broken companion pages. Add a backfill Convex action for existing broken companions.

**Tech Stack:** Next.js API routes, Convex mutations, YouTube Data API / scrape fallback, Last.fm

---

## Root Cause Analysis

The current pipeline has five failure modes:

1. **Empty connections prop** — `rawConnections` is `[]` when the LLM's JSON parse fails silently via `ensureArray`. The button guard catches this now, but companions saved before the guard have `nodes: "[]"`.

2. **Silent enrich failure** — If `/api/tinydesk/enrich` fails or times out, the save proceeds with `videoId: ""` and `genre: []`. The companion page works but shows no thumbnail in the catalog and no videos in the chain.

3. **Client-side YouTube scrape blocked** — The previous version fetched YouTube search pages from the browser, which YouTube blocks. Fixed to run server-side, but the architecture is fragile — the button does too much (build nodes, call enrich, call Convex).

4. **No re-generate flow** — A broken companion page (empty nodes, wrong video) has no self-repair path. User must re-run `/influence` and re-save, which overwrites the old data — but only if they know to do this.

5. **Vercel function timeout** — The enrich API resolves YouTube videos for 10+ connections. Each scrape takes 1-3s. Even in parallel, this can exceed Vercel's default timeout.

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/app/api/tinydesk/save/route.ts` | **Create** | Server-side save endpoint: validate, enrich, write to Convex |
| `src/app/api/tinydesk/enrich/route.ts` | Modify | Remove connectionNames — moved to save route |
| `src/lib/openui/components.tsx` | Modify | Simplify SaveTinyDeskButton to POST to /api/tinydesk/save |
| `src/components/tinydesk/video-influence-chain.tsx` | Modify | Add "Regenerate" button for broken/empty chains |
| `src/app/tinydesk/[slug]/page.tsx` | Modify | Pass companion metadata to VideoInfluenceChain for regen |
| `convex/tinydeskCompanions.ts` | Modify | Add validation in create mutation (reject empty nodes) |
| `scripts/backfill-companion-videos.py` | Modify | Also backfill companions with empty nodes via re-enrichment |

---

### Task 1: Create server-side save endpoint

**Files:**
- Create: `src/app/api/tinydesk/save/route.ts`

- [ ] **Step 1: Create the save API route**

This route accepts the raw InfluenceChain data from the client, validates it has at least 3 connections, calls the enrich API logic internally for YouTube + genre, builds companion nodes, and writes to Convex via HTTP mutation.

```typescript
// src/app/api/tinydesk/save/route.ts
import { NextRequest, NextResponse } from "next/server";
import catalogData from "../../../../../public/tinydesk/catalog.json";
import { toSlug } from "@/components/tinydesk/catalog-types";

export const maxDuration = 30;

interface SaveRequest {
  artist: string;
  tagline: string;
  userId: string; // Convex user ID
  connections: Array<{
    name: string;
    weight: number;
    relationship: string;
    context: string;
    sources?: Array<{ name?: string; url?: string }>;
    pullQuote?: string;
    sonicElements?: string[];
    keyWorks?: string;
  }>;
}

interface CatalogEntry {
  artist: string;
  slug: string;
  genre: string[];
  youtubeId: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SaveRequest;
  const { artist, tagline, userId, connections } = body;

  // Validate
  if (!artist || !userId) {
    return NextResponse.json({ error: "artist and userId required" }, { status: 400 });
  }
  if (!connections || connections.length < 1) {
    return NextResponse.json({ error: "at least 1 connection required" }, { status: 400 });
  }

  const slug = toSlug(artist);
  const catalog = catalogData as CatalogEntry[];
  const catalogEntry = catalog.find((c) => c.slug === slug);

  // Resolve main artist video + genre
  const catalogYoutubeId = catalogEntry?.youtubeId ?? null;
  const catalogGenre = catalogEntry?.genre ?? [];

  const [mainVideoId, genre] = await Promise.all([
    catalogYoutubeId
      ? Promise.resolve(catalogYoutubeId)
      : resolveYoutubeId(`${artist} tiny desk concert NPR`),
    catalogGenre.length > 0
      ? Promise.resolve(catalogGenre)
      : resolveGenre(artist),
  ]);

  // Resolve connection videos in parallel (max 10 at a time, 5s timeout each)
  const connectionNames = connections.map((c) => c.name).filter(Boolean);
  const connectionVideos = await resolveConnectionVideos(connectionNames);

  // Build nodes
  const nodes = connections.map((c) => ({
    name: c.name,
    role: c.relationship,
    connection: c.context,
    strength: c.weight,
    source: c.sources?.[0]?.name ?? "",
    sourceUrl: c.sources?.[0]?.url ?? "",
    sourceQuote: c.pullQuote ?? "",
    sonicDna: c.sonicElements ?? [],
    keyWorks: c.keyWorks
      ? c.keyWorks.split("→").map((w: string) => {
          const m = w.trim().match(/^(.+?)\s*\((\d{4})\)$/);
          return m ? { title: m[1].trim(), year: m[2] } : { title: w.trim(), year: "" };
        })
      : [],
    videoId: connectionVideos[c.name] ?? "",
    videoTitle: connectionVideos[c.name] ? c.name : "",
  }));

  // Write to Convex
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "CONVEX_URL not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "tinydeskCompanions:create",
        args: {
          slug,
          artist,
          tagline: tagline.slice(0, 200),
          tinyDeskVideoId: mainVideoId ?? "",
          nodes: JSON.stringify(nodes),
          userId,
          genre: genre.length > 0 ? genre : undefined,
          isCommunitySubmitted: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Convex error: ${err}` }, { status: 500 });
    }

    return NextResponse.json({
      slug,
      artist,
      videoId: mainVideoId,
      genre,
      nodeCount: nodes.length,
      nodesWithVideo: nodes.filter((n) => n.videoId).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Save failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }
}

// --- YouTube + Genre resolution (same as enrich/route.ts) ---

async function resolveConnectionVideos(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const results: Record<string, string> = {};
  const batches: string[][] = [];
  for (let i = 0; i < names.length; i += 10) {
    batches.push(names.slice(i, i + 10));
  }
  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (name) => {
        const videoId = await resolveYoutubeId(`${name} music`);
        if (videoId) results[name] = videoId;
      }),
    );
  }
  return results;
}

async function resolveYoutubeId(query: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "1");
      url.searchParams.set("key", apiKey);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const id = data.items?.[0]?.id?.videoId;
        if (id) return id;
      }
    } catch { /* fall through */ }
  }
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match) return match[1];
    }
  } catch { /* give up */ }
  return null;
}

async function resolveGenre(artist: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];
  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "artist.gettoptags");
    url.searchParams.set("artist", artist);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const tags: Array<{ name: string; count: number }> = data.toptags?.tag ?? [];
    const genreMap: Record<string, string> = {
      rnb: "R&B/Soul", "r&b": "R&B/Soul", soul: "R&B/Soul", "neo-soul": "R&B/Soul",
      rock: "Rock", "indie rock": "Rock", alternative: "Rock",
      latin: "Latin", reggaeton: "Latin", salsa: "Latin",
      pop: "Pop", "indie pop": "Pop",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", rap: "Hip-Hop",
      jazz: "Jazz", "smooth jazz": "Jazz", bebop: "Jazz", fusion: "Jazz",
      folk: "Folk", "singer-songwriter": "Folk", americana: "Folk", bluegrass: "Folk",
      classical: "Classical", orchestral: "Classical",
      world: "World", afrobeat: "World", afropop: "World",
      electronic: "Electronic/Dance", edm: "Electronic/Dance", dance: "Electronic/Dance",
      country: "Country", gospel: "Gospel", reggae: "Reggae", dub: "Reggae", blues: "Blues",
    };
    const matched = new Set<string>();
    for (const tag of tags.slice(0, 10)) {
      const genre = genreMap[tag.name.toLowerCase()];
      if (genre) matched.add(genre);
    }
    return [...matched].slice(0, 3);
  } catch { return []; }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/tinydesk/save/route.ts
git commit -m "feat: add /api/tinydesk/save endpoint for reliable companion generation"
```

---

### Task 2: Simplify SaveTinyDeskButton to use /api/tinydesk/save

**Files:**
- Modify: `src/lib/openui/components.tsx:147-230`

- [ ] **Step 1: Replace handleSave to POST raw connections to the server**

Replace the `handleSave` function body in `SaveTinyDeskButton` (lines 153-228) with:

```typescript
  const handleSave = async () => {
    if (!user) return;
    if (connections.length === 0) {
      setStatus("error");
      return;
    }
    setStatus("saving");
    try {
      // Send raw connections to server — it handles enrichment + Convex save
      const res = await fetch("/api/tinydesk/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artist,
          tagline: tagline.slice(0, 200),
          userId: user._id,
          connections: connections.map((c) => ({
            name: String(c.name ?? ""),
            weight: typeof c.weight === "number" ? c.weight : 0.5,
            relationship: String(c.relationship ?? ""),
            context: String(c.context ?? ""),
            sources: Array.isArray(c.sources)
              ? (c.sources as Array<{ name?: string; url?: string }>)
              : [],
            pullQuote: typeof c.pullQuote === "string" ? c.pullQuote : undefined,
            sonicElements: Array.isArray(c.sonicElements)
              ? (c.sonicElements as string[])
              : undefined,
            keyWorks: typeof c.keyWorks === "string" ? c.keyWorks : undefined,
          })),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(err.error ?? "Save failed");
      }

      setStatus("saved");
    } catch {
      setStatus("error");
    }
  };
```

This removes all client-side enrichment logic. The server does everything.

- [ ] **Step 2: Remove unused imports**

The `SaveTinyDeskButton` no longer calls `useMutation(api.tinydeskCompanions.create)` directly. Remove the `createCompanion` line. Keep `useAuth` and `useQuery` for the user check.

```typescript
function SaveTinyDeskButton({ artist, connections, tagline }: { artist: string; connections: readonly Record<string, unknown>[]; tagline: string }) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  // removed: const createCompanion = useMutation(...)
```

- [ ] **Step 3: Type check and commit**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

```bash
git add src/lib/openui/components.tsx
git commit -m "refactor: simplify SaveTinyDeskButton to use server-side save endpoint"
```

---

### Task 3: Add Convex validation — reject empty nodes

**Files:**
- Modify: `convex/tinydeskCompanions.ts:38-73`

- [ ] **Step 1: Add node count validation to the create mutation**

Add a check after the args parsing that rejects saves with empty nodes:

```typescript
export const create = mutation({
  args: {
    slug: v.string(),
    artist: v.string(),
    tagline: v.string(),
    tinyDeskVideoId: v.string(),
    nodes: v.string(),
    userId: v.id("users"),
    genre: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
    isCommunitySubmitted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    // Validate nodes are not empty
    let parsedNodes: unknown[];
    try {
      parsedNodes = JSON.parse(args.nodes);
    } catch {
      throw new Error("Invalid nodes JSON");
    }
    if (!Array.isArray(parsedNodes) || parsedNodes.length === 0) {
      throw new Error("Companion must have at least one influence connection");
    }

    const existing = await ctx.db
      .query("tinydeskCompanions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        artist: args.artist,
        tagline: args.tagline,
        tinyDeskVideoId: args.tinyDeskVideoId,
        nodes: args.nodes,
        genre: args.genre,
        sourceUrl: args.sourceUrl,
      });
      return existing._id;
    }

    return await ctx.db.insert("tinydeskCompanions", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
```

- [ ] **Step 2: Deploy Convex**

Run: `npx convex deploy --yes`
Expected: `✔ Deployed Convex functions`

- [ ] **Step 3: Commit**

```bash
git add convex/tinydeskCompanions.ts
git commit -m "fix: reject companion saves with empty nodes in Convex mutation"
```

---

### Task 4: Add "Regenerate" button on broken companion pages

**Files:**
- Modify: `src/components/tinydesk/video-influence-chain.tsx`
- Modify: `src/app/tinydesk/[slug]/page.tsx`

- [ ] **Step 1: Add empty-state with regenerate link to VideoInfluenceChain**

At the top of `VideoInfluenceChain`, before the map, add:

```typescript
export function VideoInfluenceChain({ nodes, artist }: VideoInfluenceChainProps) {
  if (nodes.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-zinc-500 mb-4">
          This influence chain hasn&apos;t been generated yet.
        </p>
        <a
          href={`/w?prompt=${encodeURIComponent(`/influence ${artist}`)}`}
          className="inline-block rounded-lg px-6 py-3 text-sm font-medium tracking-wide transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#22d3ee", color: "#09090b" }}
        >
          Generate Musical DNA in Crate
        </a>
        <p className="text-zinc-600 text-xs mt-3">
          Then click &quot;Save as Tiny Desk Companion&quot; on the result
        </p>
      </div>
    );
  }

  return (
    // ... existing map code
```

Update the interface to include `artist`:

```typescript
interface VideoInfluenceChainProps {
  nodes: TinyDeskNode[];
  artist?: string;
}
```

- [ ] **Step 2: Pass artist name from companion page to VideoInfluenceChain**

In `src/app/tinydesk/[slug]/page.tsx`, update the component usage:

```tsx
<VideoInfluenceChain nodes={data.nodes} artist={data.artist} />
```

- [ ] **Step 3: Type check and commit**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

```bash
git add src/components/tinydesk/video-influence-chain.tsx src/app/tinydesk/[slug]/page.tsx
git commit -m "feat: add regenerate prompt on empty companion pages"
```

---

### Task 5: Delete broken Nora Brown companion and clean up

**Files:**
- Modify: `convex/tinydeskCompanions.ts` (add delete mutation)

- [ ] **Step 1: Add a delete mutation to tinydeskCompanions**

```typescript
export const deleteBySlug = mutation({
  args: { slug: v.string() },
  handler: async (ctx, { slug }) => {
    const existing = await ctx.db
      .query("tinydeskCompanions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (existing) {
      await ctx.db.delete(existing._id);
      return true;
    }
    return false;
  },
});
```

- [ ] **Step 2: Deploy and delete Nora Brown's broken companion**

```bash
npx convex deploy --yes

# Delete the broken companion
curl -s "https://charming-pony-311.convex.cloud/api/mutation" \
  -H "Content-Type: application/json" \
  -d '{"path":"tinydeskCompanions:deleteBySlug","args":{"slug":"nora-brown"}}'
```

- [ ] **Step 3: Commit**

```bash
git add convex/tinydeskCompanions.ts
git commit -m "feat: add deleteBySlug mutation for companion cleanup"
```

---

### Task 6: Simplify enrich API (remove connection video logic)

**Files:**
- Modify: `src/app/api/tinydesk/enrich/route.ts`

- [ ] **Step 1: Remove connectionNames from enrich API**

The save route now handles connection videos. The enrich API only needs to resolve the main artist's YouTube ID and genre (used by the catalog page and other callers).

```typescript
export async function POST(req: NextRequest) {
  const { artist } = (await req.json()) as { artist: string };
  if (!artist) {
    return NextResponse.json({ error: "artist required" }, { status: 400 });
  }

  const catalog = catalogData as CatalogEntry[];
  const slug = toSlug(artist);
  const catalogEntry = catalog.find((c) => c.slug === slug);

  const [youtubeId, genre] = await Promise.all([
    catalogEntry?.youtubeId ?? resolveYoutubeId(`${artist} tiny desk concert NPR`),
    (catalogEntry?.genre?.length ?? 0) > 0
      ? Promise.resolve(catalogEntry!.genre)
      : resolveGenre(artist),
  ]);

  return NextResponse.json({ youtubeId, genre });
}
```

Remove `resolveConnectionVideos` function and `connectionNames` parameter.

- [ ] **Step 2: Type check and commit**

```bash
git add src/app/api/tinydesk/enrich/route.ts
git commit -m "refactor: simplify enrich API — connection videos moved to save route"
```

---

### Task 7: End-to-end test — save a new companion and verify

- [ ] **Step 1: Test the save API locally**

```bash
# Start dev server
npx next dev --port 3000

# Test with a known catalog artist (Kamasi Washington)
curl -s http://localhost:3000/api/tinydesk/save \
  -X POST -H "Content-Type: application/json" \
  -d '{
    "artist": "Kamasi Washington",
    "tagline": "Jazz maximalism — from Compton church to The Epic",
    "userId": "<your-convex-user-id>",
    "connections": [
      {"name":"John Coltrane","weight":0.9,"relationship":"influenced by","context":"Spiritual jazz lineage"},
      {"name":"Thundercat","weight":0.8,"relationship":"collaborated with","context":"West Coast Gets Some/Brainfeeder connection"},
      {"name":"Kendrick Lamar","weight":0.75,"relationship":"collaborated with","context":"To Pimp A Butterfly saxophone"}
    ]
  }'
```

Expected response:
```json
{
  "slug": "kamasi-washington",
  "artist": "Kamasi Washington",
  "videoId": "<youtube-id>",
  "genre": ["Jazz"],
  "nodeCount": 3,
  "nodesWithVideo": 3
}
```

- [ ] **Step 2: Verify companion page loads**

Navigate to `http://localhost:3000/tinydesk/kamasi-washington`
Expected: Video embed, 3 influence connections each with YouTube video

- [ ] **Step 3: Verify catalog listing**

Navigate to `http://localhost:3000/tinydesk`
Expected: Kamasi Washington appears with "EXPLORE DNA" badge, sorted to top

- [ ] **Step 4: Deploy and verify on production**

```bash
npx convex deploy --yes
npx vercel --prod --yes
```

Navigate to `https://digcrate.app/tinydesk`
Expected: All companions visible with thumbnails and DNA badges

---

## Summary of changes

| Problem | Fix |
|---------|-----|
| Empty nodes saved | Convex mutation rejects `nodes: "[]"` |
| Silent save failures | Server-side save with explicit error responses |
| Client-side YouTube scrape failing | All enrichment runs server-side in `/api/tinydesk/save` |
| No re-generate flow | Empty companion pages show "Generate Musical DNA" link |
| Broken Nora Brown companion | Delete via `deleteBySlug` mutation, user re-generates |
| Kamasi Washington 404 | Save route returns errors instead of failing silently |
