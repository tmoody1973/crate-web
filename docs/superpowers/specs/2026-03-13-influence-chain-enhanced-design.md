# Enhanced InfluenceChain Component — Design Spec

**Date:** 2026-03-13
**Status:** Approved

## Goal

Enhance the InfluenceChain OpenUI component to tell a narrative story (who shaped the artist, what they built, who they shaped) instead of displaying a flat list of connections. Must respect the existing token budget — zero prompt changes, zero agent output changes.

## Decisions

| Question | Choice | Reasoning |
|----------|--------|-----------|
| Where does grouping logic live? | Component-side (B) | Keeps prompt lean, agent already outputs `relationship` field |
| Lineage arc style? | Visual mini-chain (B) | Compact horizontal avatars + arrows, max 5 nodes, uses existing imageUrl |
| Layout approach? | Compact Header + Tabs (B) | Arc in header card, tabbed sections reduce scrolling in 55%-width panel |
| Summary prop handling? | Auto-generated fallback (B) | Optional prop; component generates data-driven summary if agent omits it |
| Prompt changes? | Component-only (A) | Zero prompt tokens added; component derives everything from existing data |

## Architecture

Pure component-side enhancement. The existing contract `InfluenceChain("Artist", "[{connections JSON}]")` stays identical. All new behavior comes from the React component parsing the `relationship` field it already receives.

## New Props

- `summary` (optional string) — Agent can provide a narrative thesis. If omitted, auto-generated from grouped connection counts: "N influences shaped [artist]'s sound, leading to M collaborations and K artists carrying the lineage forward."

## Component Structure

### Header Card
- Artist name + "Influence Chain" subtitle
- Lineage arc: auto-extracted horizontal chain (max 5 nodes)
  - Pick top 2 highest-weight "influenced by" connections
  - Central artist (accent ring, slightly larger)
  - Pick top 2 highest-weight "influenced" connections
  - Uses existing `imageUrl` from connections data
- Summary text rendered as accent-quoted line below arc

### Tabbed Sections
Three tabs with color coding:

| Tab | Color | Matches relationship values |
|-----|-------|-----------------------------|
| Roots | Green (#22c55e) | "influenced by", "family lineage", "inspired by" |
| Built With | Yellow (#eab308) | "collaborated with", "collaboration", "co_mention" |
| Legacy | Cyan (#06b6d4) | "influenced", "shaped", "mentored" |

Unmatched relationships default to "Built With".

Each tab shows:
- Connection count badge
- Active tab highlighted with section color bottom border
- Connections listed with weight-colored dots, artist images, expandable detail (context + sources)

### Fallback Behavior
If grouping produces only one non-empty bucket, skip tabs and render flat list (current behavior). Graceful degradation for edge cases.

### Lineage Arc Extraction Algorithm
```
// Normalize relationship before lookup (lowercase + trim)
rel = conn.relationship.toLowerCase().trim()

// Use ensureNumber() on weight before sorting
roots = connections
  .filter(c => ROOTS_SET.has(c.relationship.toLowerCase().trim()))
  .sort((a, b) => ensureNumber(b.weight) - ensureNumber(a.weight))
  .slice(0, 2)

legacy = connections
  .filter(c => LEGACY_SET.has(c.relationship.toLowerCase().trim()))
  .sort((a, b) => ensureNumber(b.weight) - ensureNumber(a.weight))
  .slice(0, 2)

arc = [...roots.reverse(), centralArtist, ...legacy]  // max 5 nodes
// If arc has fewer than 3 nodes (just central artist), hide the arc entirely
```

### Implementation Notes
- Apply `.toLowerCase().trim()` to `relationship` before set lookup to handle agent output variations
- Use `ensureNumber(conn.weight)` during sort/filter, not just at display time
- `summary` prop is a plain string — no JSON parsing needed, just pass-through
- Use ARIA `role="tablist"` / `role="tab"` / `role="tabpanel"` for accessibility

## Token Impact

- Prompt tokens: **0 change**
- Agent output tokens: **0 change**
- Component bundle: **~60 lines net change** (replacing existing render with grouped/tabbed version)

## Files Modified

1. `src/lib/openui/components.tsx` — InfluenceChain component rewrite (same Zod schema + optional summary prop, new render logic)
2. `src/lib/openui/prompt.ts` — Add `summary` as optional param in InfluenceChain component docs (~10 chars added)

## Constraints

- Artifact panel is 55% width, full height, overflow-y scroll
- maxTurns for research commands: 35 (with nudge at 3 remaining)
- RESEARCH_SERVERS: 10 tool servers for /influence
- OpenUI Renderer bypasses Zod — must use `ensureArray()`/`ensureNumber()` at render time
- Current OPENUI_LANG_PROMPT: ~12,879 chars / ~3,220 tokens
