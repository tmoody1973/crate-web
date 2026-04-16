# Influence Chain Enhancement — Perplexity Enrichment + Dynamic UI

> Enrich influence connections with deep storytelling via Perplexity Sonar Pro. Upgrade the InfluenceChain component with interactive, visually compelling UI.

## Problem

The influence chain is Crate's signature feature, but the connection context is thin:
- "Co-mentioned in 12 reviews across Pitchfork, Wire, and The Quietus"
- No interview quotes, no sonic analysis, no specific album references
- Citations link to publication homepages, not specific articles
- The UI is functional but static — timeline with expandable cards

SongDNA shows credits. Crate should show **stories**.

## Architecture

### Hybrid: Co-mention Discovery + Perplexity Enrichment

```
PHASE 1: DISCOVER (existing, proprietary — the moat)
  lookup_influences() → check Convex cache
  search_reviews() → co-mention analysis across 26 publications
  extract_influences() → parse review text for influence signals

  This is Badillo-Goicoechea 2025 methodology.
  Discovers THAT connections exist + initial weight scores.

PHASE 2: ENRICH (new — Perplexity Sonar Pro)
  For the top 5-6 strongest connections:
    research_influence(from, to) → Perplexity API call
    Returns: deep context paragraph + real cited URLs

  This adds the WHY — interview quotes, sonic analysis,
  specific albums, production DNA transfer stories.

PHASE 3: CACHE + OUTPUT
  Save enriched context to influence cache (Convex)
  Output enhanced InfluenceChain with deep stories + real citations

  Next query for same artist returns enriched data instantly.
```

### Why Not Replace Co-mention with Perplexity?

Co-mention analysis is the moat. It finds **non-obvious connections** that Perplexity's general knowledge wouldn't surface — like discovering that an obscure Ethiopian jazz artist and a UK grime producer are connected through reviews in The Wire. Anyone with a Perplexity API key can ask "who influenced Flying Lotus?" Only Crate has the 26-publication co-mention engine.

## Perplexity API Design

### Model: Sonar Pro (`sonar-pro`)

Best balance of depth and speed for research queries. With `search_context_size: "high"` for maximum grounding.

Cost: ~$0.014/request × 5-6 connections = **~$0.07-0.08 per influence map**.

### Citation Strategy (CRITICAL — no hallucinated URLs)

Perplexity's response has two URL systems:

1. **`citations` + `search_results` arrays** — from the search infrastructure, **REAL URLs**
2. **URLs in generated text** — from the language model, **CAN BE HALLUCINATED**

**Strategy:**
- Request `response_format: "text"` (NOT json_schema — structured output can hallucinate URLs)
- Parse the model's text content for the influence story
- Extract citations from the `search_results` array (includes title, url, snippet, date)
- Map inline references `[1]`, `[2]` to the `citations` array
- Store both the enriched context AND the verified source URLs

### Tool: `research_influence`

```typescript
// In src/lib/web-tools/prep-research.ts (alongside research_track)

research_influence(fromArtist: string, toArtist: string): {
  context: string;        // Rich paragraph: quotes, sonic elements, albums
  sources: Array<{        // From Perplexity's search_results (REAL URLs)
    name: string;         // Page title
    url: string;          // Verified URL
    snippet: string;      // Text excerpt
    date?: string;        // Publication date
  }>;
  direction: string;      // "influenced" | "collaborated" | "co_mention"
  sonicElements: string;  // Key sonic/stylistic connections
  keyWorks: string;       // Albums/tracks demonstrating the connection
}
```

### Prompt Design

```
Explain the musical influence relationship between {fromArtist} and {toArtist}.

Include:
- DIRECTION: Who influenced whom? How do we know? (interviews, timeline, acknowledged)
- SONIC ELEMENTS: What specific musical qualities were transmitted? (rhythm, harmony, production techniques, instrumentation)
- KEY WORKS: Which albums or tracks demonstrate this connection?
- TIMELINE: When did this influence manifest? Key moments.
- QUOTES: Any interviews where either artist acknowledged the connection?

Be specific. Name albums, tracks, producers, studios. Cite sources.
If the direction is unclear, note it as a "mutual influence" or "co-mention."
```

## Enhanced InfluenceChain UI

### Current State
- Timeline with expandable cards
- Each connection: artist image + name + relationship tag + weight badge + "More" expand
- Expanded: thin context text + small citation links
- Lineage arc at top (small circles with arrows)
- Roots/Built/Legacy tabs

### Enhanced Design

#### 1. Connection Cards — Expanded by Default for Top 3

Instead of everything collapsed, the top 3 connections (by weight) are expanded by default, showing the full enriched context. This is the "lean forward" moment — the stories are visible without clicking.

#### 2. Rich Context Section

When expanded, each connection shows:

```
┌─────────────────────────────────────────────────────┐
│  [Artist Image]  Parliament-Funkadelic               │
│                  ● influenced by  (0.92)             │
│                                                      │
│  "Clinton taught me funk could be psychedelic and    │
│   spiritual at the same time."                       │
│   — Flying Lotus, Pitchfork Interview, 2012          │
│                                                      │
│  ┌─ SONIC DNA ──────────────────────────────────┐   │
│  │ Synthesizer textures • cosmic imagery •       │   │
│  │ psychedelic funk arrangements                 │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  ┌─ KEY WORKS ──────────────────────────────────┐   │
│  │ 🎵 Mothership Connection (1975) →             │   │
│  │    Cosmogramma (2010)                         │   │
│  └──────────────────────────────────────────────┘   │
│                                                      │
│  Sources:                                            │
│  📄 Pitchfork Interview 2012 ↗                      │
│  📄 Red Bull Music Academy Lecture ↗                │
│  📄 NPR First Listen: Cosmogramma ↗                │
└─────────────────────────────────────────────────────┘
```

#### 3. Pull Quote Treatment

The most impactful element: a styled pull quote when the artist or a journalist has explicitly stated the influence. Large italic text with attribution:

```tsx
<blockquote className="border-l-2 border-violet-500 pl-4 my-3">
  <p className="text-base italic text-zinc-200">
    "Clinton taught me funk could be psychedelic and spiritual at the same time."
  </p>
  <cite className="text-xs text-zinc-500 not-italic">
    — Flying Lotus, Pitchfork, 2012
  </cite>
</blockquote>
```

#### 4. Sonic DNA Chips

Visual tags showing what was transmitted between artists:

```tsx
<div className="flex flex-wrap gap-1.5 mt-2">
  <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300 border border-violet-500/30">
    synthesizer textures
  </span>
  <span className="rounded-full bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300 border border-violet-500/30">
    cosmic imagery
  </span>
</div>
```

#### 5. Key Works Timeline

A mini visual showing the album-to-album influence transfer:

```tsx
<div className="flex items-center gap-2 text-xs text-zinc-400 mt-2">
  <span className="font-medium text-zinc-300">Mothership Connection</span>
  <span className="text-zinc-600">(1975)</span>
  <span className="text-violet-500">→</span>
  <span className="font-medium text-zinc-300">Cosmogramma</span>
  <span className="text-zinc-600">(2010)</span>
</div>
```

#### 6. Source Cards (Not Just Links)

Instead of tiny inline links, sources become small cards with title + snippet + date:

```tsx
<div className="mt-3 space-y-1.5">
  <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">Sources</p>
  {sources.map(src => (
    <a href={src.url} target="_blank" className="block rounded border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 hover:border-zinc-600 transition">
      <p className="text-xs font-medium text-cyan-400">{src.name}</p>
      <p className="text-[11px] text-zinc-500 line-clamp-1">{src.snippet}</p>
      {src.date && <p className="text-[10px] text-zinc-600 mt-0.5">{src.date}</p>}
    </a>
  ))}
</div>
```

#### 7. Enhanced Lineage Arc

The top arc gets bigger — actual artist photos (already auto-fetched), larger circles, and the connection type labeled on each arrow:

```
  [Parliament]  —influenced→  [Flying Lotus]  —signed→  [Thundercat]
     (root)                     (center)                   (legacy)
```

### New Props for InfluenceChain

```typescript
connections: Array<{
  name: string;
  weight: number;
  relationship: string;
  context: string;            // Existing — now enriched by Perplexity
  pullQuote?: string;         // NEW — direct quote from artist/journalist
  pullQuoteAttribution?: string; // NEW — "Flying Lotus, Pitchfork, 2012"
  sonicElements?: string[];   // NEW — ["synthesizer textures", "cosmic imagery"]
  keyWorks?: string;          // NEW — "Mothership Connection (1975) → Cosmogramma (2010)"
  sources: Array<{
    name: string;
    url: string;
    snippet?: string;         // NEW — text excerpt from the source
    date?: string;            // NEW — publication date
  }>;
  imageUrl?: string;
}>;
```

These new fields are optional — the component gracefully degrades if they're absent (backward compatible with existing cached connections that don't have enrichment yet).

## Data Flow

```
User types: /influence Flying Lotus

1. DISCOVER (co-mention engine, 2-3 calls)
   └→ Returns 8-12 connections with weights + thin context

2. ENRICH top 5-6 (Perplexity Sonar Pro, 5-6 calls)
   For each connection:
   └→ POST api.perplexity.ai/v1/sonar
      Model: sonar-pro
      search_context_size: "high"
      response_format: "text"
   └→ Parse response:
      - content → context paragraph, pull quote, sonic elements, key works
      - search_results → verified source URLs with titles + snippets + dates
   └→ Save enriched data to influence cache (Convex)

3. OUTPUT
   └→ InfluenceChain with enriched props
   └→ Top 3 connections expanded by default
   └→ Pull quotes, sonic DNA chips, key works timeline, source cards

Total: 7-9 tool calls, ~$0.08, within 25-call budget
```

## Citation Guarantee (No Hallucinated URLs)

```typescript
// In research_influence handler:

const response = await fetch("https://api.perplexity.ai/chat/completions", {
  body: JSON.stringify({
    model: "sonar-pro",
    messages: [...],
    max_tokens: 1000,
    temperature: 0.2,
    web_search_options: { search_context_size: "high" },
    // NO response_format — use text to avoid URL hallucination
  }),
});

const data = await response.json();
const content = data.choices[0].message.content;  // Story text
const searchResults = data.search_results ?? [];   // REAL URLs from search layer
const citations = data.citations ?? [];            // REAL URL array

// Map inline [1], [2] references to actual URLs
// NEVER use URLs from the content text itself

return {
  context: content,           // Rich story paragraph
  sources: searchResults.map(sr => ({
    name: sr.title,
    url: sr.url,              // VERIFIED — from search infrastructure
    snippet: sr.snippet,
    date: sr.date,
  })),
};
```

## Alignment with Badillo-Goicoechea 2025

The paper's core methodology:
- **Review-based semantic distance** — co-mention frequency across publications
- **Direction convention** — from=INFLUENCER, to=INFLUENCED
- **Bridge artists** — seminal figures connecting disparate musical territories
- **Knowledge graph traversal** — recommendations via optimal sequences through the graph

Perplexity enrichment preserves all of this:
- Co-mention discovery remains the connection source (proprietary moat)
- Direction is verified/corrected by Perplexity's research (interviews, timeline evidence)
- Bridge artists get the richest stories (cross-genre connections are the most interesting)
- The knowledge graph gains richer node metadata without changing its structure

The enrichment makes the academic methodology **accessible to non-academics** — turning network properties into stories people can understand and share.

## Files to Create/Modify

### New/Modified
| File | Change |
|------|--------|
| `src/lib/web-tools/prep-research.ts` | Add `research_influence` tool (Sonar Pro with search_results extraction) |
| `src/lib/openui/components.tsx` | Enhance `ConnectionNode` with pull quotes, sonic chips, key works, source cards. Expand top 3 by default. |
| `src/lib/chat-utils.ts` | Update `/influence` prompt to include Phase 2 (Perplexity enrichment) |
| `src/app/api/chat/route.ts` | Ensure `prep-research` tools available for influence commands (already in RESEARCH_SERVERS) |

### No Changes Needed
| File | Why |
|------|-----|
| `convex/schema.ts` | Influence cache `context` field is already a string — enriched context just replaces thin description |
| `src/lib/web-tools/influence-cache.ts` | Cache tools already accept context string — no API change needed |
| `convex/influenceEdges.ts` | Edge schema already stores context, sources — just richer data |
