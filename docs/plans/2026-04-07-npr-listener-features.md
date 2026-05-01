# NPR Listener Features — Implementation Plan

## Context

Crate already has the core capabilities for a public-facing listener experience. The influence chain component, Deep Cut publishing, and YouTube search all exist. These features create new entry points to the product that demonstrate Crate's value to NPR Music, streaming companies, and consumer music listeners without requiring a login.

**Goal:** Build two features this week that you can demo to NPR music directors and share on social media. No new backend logic needed. Primarily frontend routing and pre-rendering.

---

## Feature 1: Public Influence Maps

### What it is

A shareable, no-login-required influence chain page at `digcrate.app/explore/[artist]` that anyone can view. The "Keep Digging" link that goes under any article or Tiny Desk video.

### How it works today (already built)

1. User runs `/influence Flying Lotus` in Crate
2. Agent builds influence chain, renders as InfluenceChain OpenUI component
3. User clicks "Publish" on the Deep Cut
4. Published at `digcrate.app/cuts/[shareId]`
5. Anyone with the link can view it

### What's missing

- The URL isn't clean. `digcrate.app/cuts/abc123` doesn't say "influence map."
- No SEO. The published page doesn't have artist-specific metadata.
- No entry point for non-Crate users. You have to know the share link exists.

### What to build

**File: `src/app/explore/[artist]/page.tsx` (new)**

A public page at `digcrate.app/explore/flying-lotus` that:
1. Shows a clean landing with the artist name and "Explore the musical DNA of Flying Lotus"
2. Displays a pre-generated influence chain if one exists in the database (from a cached Deep Cut)
3. If no cached result exists, shows a teaser: "This influence map hasn't been generated yet. Be the first to explore it on Crate."
4. CTA: "Dig deeper — sign up free at digcrate.app"
5. SEO metadata: title, description, Open Graph image

**File: `src/app/api/explore/[artist]/route.ts` (new)**

API that:
1. Checks Convex for an existing published influence chain for this artist (search `shares` table by label containing the artist name)
2. If found, returns the OpenUI content
3. If not found, returns null (the page shows the teaser)

**Modify: `src/components/workspace/chat-panel.tsx`**

After a published influence chain, show: "Share this influence map: digcrate.app/explore/[artist-slug]"

### Effort

- 2-3 hours
- 3 files (1 new page, 1 new API route, 1 small edit)
- No new dependencies

### How to test

1. Run `/influence Flying Lotus` on Crate
2. Publish the Deep Cut
3. Visit `digcrate.app/explore/flying-lotus`
4. Should show the influence chain without login
5. Share the URL on Twitter. Does it render an Open Graph preview?

---

## Feature 2: Tiny Desk Companion Pages

### What it is

A dedicated page at `digcrate.app/tinydesk/[artist]` that shows an influence chain with embedded YouTube videos at each node. The page a Tiny Desk viewer lands on after watching a performance. "Want to know who influenced this artist?"

### How it differs from Feature 1

Feature 1 is a published influence chain (text + connections). Feature 2 adds YouTube video embeds at every node in the chain, making it a watchable experience. "Watch the lineage" from the video-linked influence chain strategy.

### What to build

**File: `src/app/tinydesk/[artist]/page.tsx` (new)**

A public page that:
1. Header: "Tiny Desk Companion: [Artist Name]"
2. Subheader: "Explore the musical DNA behind the performance"
3. Influence chain with YouTube embeds at each artist node
4. Each node shows: artist name, connection description, embedded YouTube video (best live performance)
5. At the bottom: "Create your own influence map — digcrate.app" CTA
6. SEO metadata with Tiny Desk branding

**File: `src/components/explore/video-influence-chain.tsx` (new)**

A public-facing (no auth required) version of the InfluenceChain component that:
1. Takes an array of artist nodes with YouTube video IDs
2. Renders each node as a card with the artist info + embedded YouTube iframe
3. Draws connection lines between nodes (can be simplified arrows, not the full SVG path)
4. Mobile responsive (cards stack vertically)
5. Dark theme matching Crate brand

**Data: Pre-generate 5 companion pages**

Use Crate to generate influence chains for 5 popular Tiny Desk artists, then manually add YouTube video IDs for the key artists. Store as JSON in `public/tinydesk/` or in Convex.

Suggested first 5:
1. **Khruangbin** — Thai funk > surf rock > psychedelic soul lineage
2. **Noname** — Chicago poetry > neo-soul > conscious hip-hop
3. **Mac Miller** — J Dilla > jazz rap > Pittsburgh underground
4. **Anderson .Paak** — Timbaland > funk > gospel
5. **Lizzo** — gospel > funk > Minneapolis sound

Each one maps to a URL: `digcrate.app/tinydesk/khruangbin`

### Effort

- 4-6 hours
- 3 files (1 page, 1 component, data for 5 artists)
- Depends on Feature 1 being done first (reuses the public page pattern)

### How to test

1. Visit `digcrate.app/tinydesk/khruangbin`
2. Should show the influence chain with YouTube videos embedded
3. Click a YouTube video — plays inline
4. Scroll through the full lineage
5. Click "Dig deeper" CTA — goes to Crate sign-up
6. Share on Twitter — Open Graph preview shows artist name + Tiny Desk branding

---

## Feature 3: "Keep Digging" Embed Script (later, after NPR conversation)

### What it is

A JavaScript embed that any website can drop in:

```html
<script src="https://digcrate.app/embed.js" data-artist="Flying Lotus"></script>
```

Renders a "Keep Digging: Explore the influence chain" button that links to the explore page.

### Why later

This is the NPR integration piece. Build it after you've shown Feature 1 and Feature 2 to music directors and confirmed they want it on their sites. Don't build the embed before you have demand for it.

---

## Pages to Create Summary

| URL | What it shows | Auth required | Feature |
|-----|-------------|---------------|---------|
| `digcrate.app/explore/[artist]` | Published influence chain | No | 1 |
| `digcrate.app/tinydesk/[artist]` | Influence chain + YouTube videos | No | 2 |
| `digcrate.app/tinydesk` | Index of all companion pages | No | 2 |

---

## Demo Script for NPR Music Directors

After building Features 1 and 2, send this email to 5 music directors:

---

Subject: Built something for show prep — want your feedback

Hey [Name],

I built a tool called Crate that I've been using at Radio Milwaukee for show prep and music research. It searches 19 music sources at once (Discogs, MusicBrainz, Genius, WhoSampled, etc.) and generates influence chains, talk breaks, and social copy.

Two things I want to show you:

1. **Show prep in 2 minutes:** I type `/prep HYFIN: Khruangbin > Little Simz > Noname` and get track context, talk breaks at 15/60/120 seconds, and Instagram copy. Try it free at digcrate.app.

2. **Tiny Desk Companion:** digcrate.app/tinydesk/khruangbin — an interactive influence chain with YouTube videos at every node. Imagine this under every Tiny Desk video on your station's site.

Would love 15 minutes to show you how it works. No pitch, just a fellow music person sharing a tool.

— Tarik

---

## Technical Notes

- Public pages don't require Clerk auth. Use `export const dynamic = "force-static"` for pre-generated pages or fetch from Convex without auth for shared content.
- The `shares` table in Convex already stores published Deep Cuts with `shareId`, `label`, and `content`. The explore page queries this table.
- YouTube embeds use the standard iframe: `<iframe src="https://www.youtube.com/embed/{videoId}" />`. No API key needed for embeds.
- The video-influence-chain component is a new component, not a modification of the existing InfluenceChain OpenUI component. Keep them separate. The OpenUI version is for the agent. The public version is for viewers.

## Verification

- [ ] `digcrate.app/explore/flying-lotus` loads without login
- [ ] Influence chain renders with cited sources
- [ ] Open Graph preview works when shared on Twitter/LinkedIn
- [ ] `digcrate.app/tinydesk/khruangbin` shows video-linked influence chain
- [ ] YouTube videos play inline
- [ ] Mobile responsive
- [ ] CTA links to digcrate.app sign-up
- [ ] `npm run build` passes
