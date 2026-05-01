# Interactive Influence Graph Exploration

## Overview

Add an interactive force-directed graph view to the InfluenceChain component. Users tap nodes to expand connections and explore the music influence network visually. Cached connections load instantly; uncached connections trigger background Perplexity discovery. A new batch enrichment tool reduces agent tool calls from 8-12 to up to 4 per `/influence` command (2 on cache hit).

## Goals

- Let users explore influence connections visually and go down the rabbit hole
- Reduce `/influence` tool call cost by ~60% via batch enrichment
- Fix empty influence chains (Nellee Hooper problem) with better prompt budgeting
- Build the data layer that makes the "growing knowledge graph" tangible

## Non-Goals

- Full-screen standalone `/graph` page (future work, built on this data layer)
- 3D graph rendering
- Real-time collaborative graph editing

## File Structure

```
src/lib/openui/
  components.tsx              MODIFY: Add List/Graph toggle to InfluenceChain
  influence-graph.tsx         NEW: Graph component (~300 lines)

src/lib/web-tools/
  prep-research.ts            MODIFY: Add research_influences_batch tool

src/app/api/influence/
  expand/route.ts             NEW: Node expansion endpoint

src/lib/chat-utils.ts         MODIFY: Update /influence prompt for batch tool
```

## Component Architecture

### InfluenceChain (modified)

Adds a top-level toggle between List and Graph views. In List mode, existing Roots/Built With/Legacy tabs render as today. In Graph mode, delegates to InfluenceGraph.

```
InfluenceChain
  ├── [List/Graph toggle]
  ├── List mode (existing)
  │   ├── Lineage arc header
  │   ├── Roots / Built With / Legacy tabs
  │   └── ConnectionNode cards
  └── Graph mode (new)
      └── InfluenceGraph
          ├── react-force-graph-2d canvas
          ├── Detail panel (desktop) / Bottom sheet (mobile)
          └── Breadcrumb navigation
```

### InfluenceGraph (new file)

Props:
- `artist: string` — central artist name
- `connections: ParsedConnection[]` — initial seed from agent research
- `isPro: boolean` — controls enrichment tier

Internal state:
- `graphData: { nodes: GraphNode[], links: GraphLink[] }` — full graph data
- `expandedNodes: Set<string>` — which nodes have been expanded
- `selectedNode: string | null` — selected node for detail panel
- `breadcrumb: string[]` — navigation history
- `loadingNodes: Set<string>` — nodes with pending data fetches

Types:
```typescript
interface GraphNode {
  id: string;           // artist name (normalized lowercase)
  name: string;         // display name
  group: "roots" | "built" | "legacy" | "central";
  weight: number;       // influence weight, controls node size
  imageUrl?: string;    // auto-fetched from /api/artwork
  context?: string;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  sonicElements?: string[];
  keyWorks?: string;
  sources?: Array<{ name: string; url: string; snippet?: string }>;
  expanded: boolean;    // whether this node's connections have been loaded
  loading: boolean;     // whether data is being fetched
}

interface GraphLink {
  source: string;       // from node id
  target: string;       // to node id
  relationship: string;
  weight: number;       // controls line thickness
}
```

### Desktop Layout

```
┌─────────────────────────────────────────────────────┐
│ [List] [Graph]     Nellee → Bjork     12n · 18e     │
├───────────────────────────────────┬──────────────────┤
│                                   │ ● Bjork          │
│     Force-directed graph          │ influenced by    │
│     canvas with zoom/pan          │ weight: 0.95     │
│                                   │                  │
│     ● nodes colored by group      │ Context text...  │
│     ○ selected node glows         │                  │
│     ◌ loading nodes pulse         │ "Quote..."       │
│                                   │ — Attribution    │
│                                   │                  │
│                                   │ [trip-hop] [orch]│
│                                   │                  │
│                              [+]  │ Key Works:       │
│                              [−]  │ Debut → Post     │
│                                   │                  │
│                                   │ [Explore →][Dive]│
├───────────────────────────────────┴──────────────────┤
│ [⟳ Reset] [▶ Export Playlist] [# Slack]              │
└─────────────────────────────────────────────────────┘
```

### Mobile Layout

```
┌──────────────────────────┐
│ ← Bjork      [List][Graph]│
├──────────────────────────┤
│                          │
│   Force-directed graph   │
│   full width, pinch-zoom │
│                          │
│   Larger touch targets   │
│   (min 44px nodes)       │
│                          │
├──────────────────────────┤  ← bottom sheet (on tap)
│ ● Bjork                  │
│ influenced by · 0.95     │
│ Context text...          │
│ [trip-hop] [orchestral]  │
│ [Explore Bjork →] [Dive] │
└──────────────────────────┘
```

## SSR & Dynamic Import

`react-force-graph-2d` requires `window` (canvas rendering). The `InfluenceGraph` component must be dynamically imported with SSR disabled:

```typescript
const InfluenceGraph = dynamic(() => import('./influence-graph'), { ssr: false });
```

This follows the same pattern used for other canvas/browser-only components in the codebase.

## GraphNode Field Mapping

Fields come from different sources depending on cache state and tier:

| Field | Convex cache | Free expansion | Pro expansion |
|-------|-------------|----------------|---------------|
| name, weight, relationship | Yes | Yes | Yes |
| context | Yes (if previously enriched) | Basic (from sonar discovery) | Rich (from sonar-pro) |
| pullQuote, pullQuoteAttribution | No (not in Convex schema) | No | Yes (from sonar-pro) |
| sonicElements, keyWorks | No (not in Convex schema) | No | Yes (from sonar-pro) |
| sources | Yes (via influenceEdgeSources table) | Yes (from sonar citations) | Yes (from sonar-pro citations) |
| imageUrl | Yes (if cached) | Auto-fetched by component via useAutoImage | Auto-fetched by component |

`pullQuote`, `sonicElements`, and `keyWorks` are only available after sonar-pro enrichment. Free-tier detail panels show context + sources but not these fields. This creates a natural upgrade signal — Pro users see richer detail panels.

## "Central" Group Type

`GraphNode.group` includes `"central"` as a presentation-only value. It is not derived from `classifyRelationship()` — it is assigned directly to the seed artist (the artist from the original `/influence` command). All other nodes use the standard `roots`/`built`/`legacy` classification.

## Node Expansion Flow

### Tap a node (desktop)

1. Node gets selection ring (animated glow matching group color)
2. Detail panel slides in from right with node's data
3. If node not yet expanded:
   a. Set `loading: true` on node (pulse animation)
   b. Call `POST /api/influence/expand` with `{ artist, tier }`
   c. Endpoint checks Convex cache first
   d. If >= 3 cached edges, returns immediately
   e. If < 3, awaits Perplexity `sonar` discovery (Pro: also batch-enriches top 3)
   f. Returns all connections; new nodes animate into graph from expanded node's position
   g. All results cached to Convex for next time
4. "Explore →" button: push current artist to breadcrumb, re-center on selected

### Tap a node (mobile)

Same as desktop except detail panel is a bottom sheet (~40% screen height). Swipe down or tap outside to dismiss.

### Detail Panel Actions

- **"Explore [Artist] →"** — refocuses the graph on that artist (see Refocus below)
- **"Deep Dive"** — injects `/artist [name]` into the chat textarea via `injectChatMessage()`, triggering a full ArtistProfile research in chat. Bridges the graph view back to the conversational research flow.

### "Explore →" (refocus)

1. Push current central artist onto breadcrumb stack
2. Selected artist becomes new central node (larger, violet)
3. Their connections become the primary ring
4. All non-current-ring nodes share 20% opacity regardless of depth (no stacking — nodes from A's ring and B's ring both show at 20% when viewing C)
5. Breadcrumb updates in top bar
6. Back arrow pops breadcrumb and reverses the transition

## API: /api/influence/expand

**Method: POST** (triggers side effects: Perplexity calls + Convex mutations)

```
POST /api/influence/expand
Body: { "artist": "Bjork", "tier": "free" }
Auth: Clerk session (same pattern as other API routes)

Response (single awaited response):
{
  "connections": [
    { "name": "Kate Bush", "weight": 0.8, "relationship": "influenced by", "context": "...", ... },
    { "name": "Arca", "weight": 0.7, "relationship": "influenced", "context": "...", ... }
  ],
  "fromCache": true,      // false if Perplexity discovery was needed
  "enriched": false        // true if sonar-pro enrichment ran (Pro tier only)
}
```

Implementation:
1. Read `userId` from Clerk auth (same pattern as other API routes)
2. Instantiate `ConvexHttpClient` (same pattern as `influence-cache.ts`)
3. Query Convex `influence.lookupInfluences` for the artist
4. If >= 3 cached edges, return immediately with `{ fromCache: true, enriched: false }`
5. If < 3 cached edges, await Perplexity discovery within the request:
   - Free tier: 1 `sonar` call (~$0.007) for connection discovery
   - Pro tier: 1 `sonar` call + `research_influences_batch` for top 3 (~$0.09)
6. Cache all results to Convex via `influence.cacheBatchEdges`
7. Return full results with `{ fromCache: false, enriched: tier === "pro" }`

The request is fully awaited (no polling, no background jobs). The Vercel function timeout (60s for Pro routes) accommodates the Perplexity call (30s timeout). If the Perplexity call times out, the endpoint returns whatever cached data exists. Free-tier users on the default 10s Vercel timeout may hit timeouts on cache-miss expansions — configure the route segment with `export const maxDuration = 30` to allow adequate time.

**Rate limiting:**
- Free tier: 10 expansions per hour per user
- Pro tier: 60 expansions per hour per user
- Enforced via a simple counter in Convex or in-memory rate limiter

## Batch Enrichment Tool

New tool in `prep-research.ts`:

```typescript
research_influences_batch({
  artist: "Nellee Hooper",
  connections: ["Bjork", "Massive Attack", "Madonna"]
})
```

Internally fires `Promise.allSettled` with parallel Perplexity `sonar-pro` calls. Returns all enrichment results in a single tool response. The agent makes 1 tool call instead of 3-5.

Used in two places:
1. Agent's `/influence` command (Phase 3 enrichment)
2. `/api/influence/expand` endpoint (Pro tier background enrichment)

## Updated /influence Prompt

```
Phase 1: lookup_influences (cache check)              — 1 tool call
Phase 2: search_web for broad discovery (if needed)   — 1 tool call
Phase 3: research_influences_batch (top 3-5)          — 1 tool call
Phase 4: cache_batch_influences                       — 1 tool call
Phase 5: Output InfluenceChain                        — 0 tool calls
Total: 4 tool calls (down from 8-12)
```

Budget awareness rule: "If you've used 30+ tool calls, STOP researching and OUTPUT NOW with the data you have."

## Cost Model

### Per /influence command (agent)

| Scenario | Before | After |
|----------|--------|-------|
| Cache hit | $0 | $0 |
| Cache miss, 5 connections | ~$0.14 Perplexity + ~$0.08 LLM inference | ~$0.09 Perplexity + ~$0.03 LLM inference |
| Savings | — | ~40% total |

### Per graph node expansion (client-side, no LLM cost)

| Tier | Cache hit | Cache miss |
|------|-----------|------------|
| Free | $0 | ~$0.007 (1 sonar call) |
| Pro  | $0 | ~$0.09 (1 sonar + 3 sonar-pro) |

## Visual Design

- Node colors match existing tab colors: green (#4ade80) = roots, yellow (#facc15) = built with, cyan (#22d3ee) = legacy
- Central node: violet (#7c3aed) with ring (#a78bfa), larger radius
- Selected node: animated glow ring in group color
- Loading node: pulsing opacity animation
- Edge thickness: proportional to weight (1px for 0.3, 2px for 0.9)
- Edge opacity: 0.3-0.6 based on weight
- Background: #09090b with subtle dot grid
- Detail panel: #18181b with #27272a borders (matches existing zinc theme)
- Zoom controls: bottom-right, same zinc button style

## Dependencies

- `react-force-graph-2d` — new npm dependency (~30KB)
- Convex `influence.lookupInfluences` — existing
- Convex `influence.cacheBatchEdges` — existing
- Perplexity Sonar API — existing integration in prep-research.ts
- `useIsMobile()` hook — existing
- `useAutoImage()` — existing (for node images)
- `ParsedConnection` type — existing
- `groupConnections()` — existing

## Edge Cases

- **Zero connections from agent**: Empty-state fallback already added — shows "Retry influence map" button
- **Node expansion returns 0 results**: Node marked as expanded (no pulse), tooltip says "No additional connections found"
- **Perplexity API timeout**: 30s timeout per call. Expansion returns whatever cache had. No error shown to user — cached data is always valid.
- **Circular references**: A→B and B→A both exist. Graph handles this naturally — just two edges between the same nodes. No dedup needed.
- **Very large graphs (50+ nodes)**: react-force-graph-2d handles this on canvas. Add max node limit of 60 with "graph is getting large, zoom or reset" hint.
- **Mobile touch conflicts**: Pinch-to-zoom on graph vs page scroll. Set graph canvas to capture touch events when focused, release when not.
- **No Perplexity key**: Expansion works cache-only. Discovery disabled. Free tier still shows cached connections.
- **Accessibility**: Canvas-rendered graph is not screen-reader accessible. The List view remains the accessible alternative (same data, DOM-based). Canvas element gets `aria-label="{artist} influence graph with {n} nodes and {m} connections"`. Detail panel content is fully accessible (standard DOM elements).
- **Node ID collisions**: Artist names are normalized to lowercase for node IDs. Collisions are extremely unlikely in practice (artist names within a user's influence graph are contextually distinct). If a collision occurs, the second artist's data overwrites the first — acceptable given the rarity.
