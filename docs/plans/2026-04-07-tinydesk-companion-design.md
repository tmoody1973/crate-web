# Tiny Desk Companion — Design Doc

**Date:** 2026-04-07
**Status:** Approved

## Overview

Public pages at `digcrate.app/tinydesk/[artist]` showing video-linked influence chains with YouTube embeds at each artist node. No login required. Pre-generated data using Crate's influence methodology (co-mention analysis, Last.fm similarity, WhoSampled, MusicBrainz, Perplexity enrichment). Start with 5 artists.

## Goal

Demonstrate Crate's intelligence layer as a front-facing consumer experience. The page someone shares after watching a Tiny Desk Concert. Designed to be viral (each node has fans who share it), demonstrate value to NPR Music, and showcase the YouTube video-linked influence chain for the streaming company acqui-hire thesis.

## Architecture

- Static JSON data in `public/tinydesk/[slug].json`
- Server-rendered Next.js page at `src/app/tinydesk/[slug]/page.tsx`
- Client component for the interactive video timeline
- No auth, no database queries, no API calls on page load
- Dynamic SEO metadata per artist

## Data Schema

```typescript
interface TinyDeskCompanion {
  artist: string;
  slug: string;
  tagline: string;
  tinyDeskVideoId: string;
  ogImage?: string;
  nodes: TinyDeskNode[];
}

interface TinyDeskNode {
  name: string;
  role: string;
  era?: string;
  connection: string;
  strength: number;       // 0-1, from Last.fm similarity or manual
  source?: string;        // "Pitchfork, 2018"
  sourceUrl?: string;
  videoId: string;        // YouTube video ID
  videoTitle: string;
}
```

## Pages

### Index: `digcrate.app/tinydesk`
- Grid of artist cards with name, tagline, and thumbnail
- Links to each companion page
- Header: "Tiny Desk Companion — Explore the musical DNA behind the performance"
- CTA: "Try Crate free" button

### Companion: `digcrate.app/tinydesk/[slug]`
- Hero: Artist name (large Bebas Neue) + tagline + "Watch the Tiny Desk" YouTube embed
- Vertical influence timeline: nodes connected by lines
- Each node: artist card + YouTube embed + connection text + source citation
- Footer: "Explore more artists" + "Dig deeper with Crate" CTA
- SEO: `<title>Tiny Desk Companion: Khruangbin — Musical DNA | Crate</title>`

## Component: VideoInfluenceChain

Props: `nodes: TinyDeskNode[]`

Renders a vertical timeline:
- Left side: vertical line with colored dots at each node
- Right side: node cards with content + YouTube embed
- Dot color: green (#22C55E) for strength > 0.8, yellow (#EAB308) for > 0.5, orange (#F97316) for rest
- YouTube embeds are lazy-loaded (only load when scrolled into view)
- Mobile: full-width cards, line on left edge

## Initial 5 Artists

1. **Khruangbin** — Thai funk > surf rock > psychedelic soul
2. **Noname** — Chicago poetry > neo-soul > conscious hip-hop
3. **Mac Miller** — J Dilla > jazz rap > Pittsburgh underground
4. **Anderson .Paak** — Timbaland > funk > gospel > Silk Sonic
5. **Lizzo** — gospel > funk > Minneapolis sound > Prince lineage

## Data Generation Process

For each artist:
1. Run `/influence [artist]` in Crate to get the influence chain
2. Extract the key nodes (5-7 per artist)
3. Search YouTube for the best live performance or interview video for each node artist
4. Copy the video ID
5. Write the connection text from Crate's cited output
6. Save as `public/tinydesk/[slug].json`

## Files to Create

| File | Purpose |
|------|---------|
| `src/app/tinydesk/page.tsx` | Index page with artist grid |
| `src/app/tinydesk/[slug]/page.tsx` | Companion page |
| `src/components/tinydesk/video-influence-chain.tsx` | Video timeline component |
| `public/tinydesk/khruangbin.json` | Data |
| `public/tinydesk/noname.json` | Data |
| `public/tinydesk/mac-miller.json` | Data |
| `public/tinydesk/anderson-paak.json` | Data |
| `public/tinydesk/lizzo.json` | Data |

## Verification

- [ ] `digcrate.app/tinydesk` shows index with 5 artist cards
- [ ] `digcrate.app/tinydesk/khruangbin` shows full companion page
- [ ] YouTube videos play inline when clicked
- [ ] Source citations link to real articles
- [ ] Open Graph preview renders when shared on Twitter/LinkedIn
- [ ] Mobile responsive (cards stack, videos resize)
- [ ] No auth required
- [ ] `npm run build` passes
