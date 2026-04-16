# Tiny Desk Catalog — Design Doc

**Date:** 2026-04-07
**Status:** Approved

## Overview

Transform `/tinydesk` from a simple companion page index into a full music discovery experience built on 626 Tiny Desk concerts (2021-2025). Genre-filtered browse, chronological timeline, "Surprise Me" random discovery, and on-demand companion page generation. No login required for browsing. Sign up required to generate new companion pages.

## Data Source

`tiny_desk_concerts_last_5_years.json` — 626 concerts with:
- `artist` (string)
- `date` (YYYY-MM-DD)
- `year` (number)
- `genre` (string array, can be multi-genre like ["World", "Hip-Hop"])
- `concert_type` ("Tiny Desk Concert" or "Tiny Desk Home Concert")
- `source_url` (NPR article URL)

Genre distribution: R&B/Soul (111), Rock (110), Latin (91), Pop (82), Hip-Hop (73), Jazz (66), Folk (60), Classical (41), World (40), Electronic/Dance (22), Country (16), Gospel (13), Reggae (6), Blues (5)

## Architecture

### Data Storage
- Import 626 concerts into a Convex `tinydeskCatalog` table (or serve from a static JSON since the data doesn't change often)
- Each concert entry gets a YouTube video ID resolved via search (can be done in batch or on-demand)
- Pre-generated companion pages stored in existing `tinydeskCompanions` table

### Page Structure: `digcrate.app/tinydesk`

**Header:**
- Crate logo + "Tiny Desk Companion" label
- "Surprise Me" button (picks random artist)
- View toggle: Grid / Timeline
- "Try Crate Free" CTA

**Genre filter bar:**
- Horizontal scrollable pills: All (626), R&B/Soul (111), Rock (110), Latin (91), Pop (82), Hip-Hop (73), Jazz (66), Folk (60), Classical (41), World (40), Electronic (22), Country (16), Gospel (13)
- Click to filter. Active pill highlighted in cyan.
- Show count next to each genre

**Grid view (default):**
- 3 columns desktop, 2 tablet, 1 mobile
- Each card: YouTube thumbnail (from NPR article OG image or generated), artist name, date, genre tags, concert type badge
- Cards with existing companion pages show "Explore DNA" badge
- Cards without companion pages show "Watch" with link to NPR source URL
- Click on a companion-enabled card → `/tinydesk/[slug]`
- Click on a non-companion card → either NPR URL or a teaser page

**Timeline view:**
- Vertical chronological scroll, grouped by year
- Year headers as section dividers (2021, 2022, 2023, 2024, 2025)
- Within each year: cards in date order
- Same card design as grid view
- Genre color-coded dots on a vertical line

**"Surprise Me" flow:**
1. Button click
2. Pick random artist from the 626
3. Show a modal/overlay: artist name, genre, date, "Watch Tiny Desk" button (NPR URL)
4. "Explore Musical DNA" button → if companion exists, go to companion page. If not, prompt to sign up and generate one.

### Companion Page Enhancement

The existing `/tinydesk/[slug]` companion page gets a "Back to catalog" breadcrumb and a "More in [genre]" section at the bottom showing other Tiny Desk artists in the same genre.

### On-demand Generation (requires auth)

When a user clicks "Explore DNA" on an artist that doesn't have a companion page:
1. If logged in: redirect to Crate chat with `/influence [artist]` pre-filled, plus a prompt to save as companion
2. If not logged in: show sign-up CTA: "Sign up free to generate this artist's musical DNA"

## Files to Create/Modify

| File | Action | Purpose |
|------|--------|---------|
| `convex/schema.ts` | Modify | Add `tinydeskCatalog` table (or use static JSON) |
| `convex/tinydeskCatalog.ts` | Create | Query functions: listAll, filterByGenre, getRandom |
| `src/app/tinydesk/page.tsx` | Major rewrite | Genre browse + timeline + surprise me |
| `src/components/tinydesk/genre-filter.tsx` | Create | Horizontal genre pill bar |
| `src/components/tinydesk/artist-grid.tsx` | Create | Filterable artist card grid |
| `src/components/tinydesk/timeline-view.tsx` | Create | Chronological timeline |
| `src/components/tinydesk/surprise-modal.tsx` | Create | Random artist overlay |
| `public/tinydesk/catalog.json` | Create | Static copy of 626 concerts for SSR |
| `scripts/import-tinydesk-catalog.ts` | Create | Import JSON into Convex |

## UI Details

### Genre pills
- Scrollable horizontal bar with overflow fade on mobile
- Each pill: genre name + count in parentheses
- Active: cyan bg, white text
- Inactive: zinc-800 bg, zinc-400 text
- "All" pill always first

### Artist cards
- YouTube thumbnail or NPR OG image as background
- Gradient overlay bottom → transparent top
- Artist name (Bebas Neue, white)
- Genre tags as small pills
- Date (zinc-500, 11px)
- Concert type badge: "Tiny Desk" or "Home Concert" in a corner badge
- If companion exists: green "Explore DNA" badge
- Hover: slight scale up, border color change

### Timeline
- Left edge: vertical line with year markers
- Right side: cards arranged chronologically
- Year headers span full width with a count
- Genre dots on the timeline line (color matches genre)

### Surprise Me modal
- Full-screen dark overlay
- Center: artist name (large), genre, date
- YouTube thumbnail
- Two buttons: "Watch on NPR" + "Explore Musical DNA"
- "Try Another" link at bottom
- Close with X or click outside

## Conversion Funnel

```
Browse /tinydesk (no auth) → 626 artists visible
  ↓
Click artist card → companion page OR NPR link
  ↓
"Explore Musical DNA" on non-companion artist
  ↓
Sign up for Crate (free)
  ↓
/influence [artist] + save as companion
  ↓
Companion page created, added to catalog
  ↓
User is now a Crate user with one influence chain completed
```

## Success Criteria

- [ ] 626 artists browsable with genre filtering
- [ ] Timeline view renders chronologically
- [ ] Surprise Me picks a random artist
- [ ] Existing companion pages (Khruangbin) show "Explore DNA" badge
- [ ] Non-companion artists link to NPR Tiny Desk URL
- [ ] Mobile responsive
- [ ] No auth required for browsing
- [ ] Page loads in under 2 seconds
- [ ] Open Graph preview shows "Tiny Desk Companion" branding
