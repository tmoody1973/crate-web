# Influence Chain Perplexity Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich influence chain connections with deep storytelling via Perplexity Sonar Pro, and upgrade the InfluenceChain UI with pull quotes, sonic DNA chips, key works timelines, and source cards with verified citations.

**Architecture:** Hybrid — co-mention discovery (Badillo-Goicoechea 2025, proprietary moat) finds connections, Perplexity Sonar Pro enriches the top 5-6 with deep context, interview quotes, and verified source URLs. The `search_results` response field (from Perplexity's search infrastructure) provides guaranteed-real URLs — never using model-generated URLs. The enhanced InfluenceChain component renders enriched data with new visual elements while gracefully degrading for non-enriched connections.

**Tech Stack:** TypeScript, Perplexity Sonar Pro API, React (OpenUI components), Zod

**Spec:** `docs/plans/2026-03-21-influence-chain-perplexity-design.md`

**Working directory:** `/Users/tarikmoody/Documents/Projects/crate-web-subscription` (branch `feat/subscription-pricing` — where prep-research.ts and Perplexity integration already exist)

**Prerequisites:** PR #10 must be the working context. The `prep-research.ts` file, `RESEARCH_SERVERS` set with `"prep-research"`, and Perplexity key wiring all exist on this branch.

---

## File Structure

### Modified Files
| File | Responsibility |
|------|---------------|
| `src/lib/web-tools/prep-research.ts` | Add `research_influence` tool — Perplexity Sonar Pro call with `search_results` extraction for verified citations |
| `src/lib/openui/components.tsx` | Enhance `ParsedConnection` type, `ConnectionNode` UI (pull quotes, sonic chips, key works, source cards), expand top 3 by default |
| `src/lib/chat-utils.ts` | Update `/influence` prompt to include Phase 2 enrichment step |

### No New Files
All changes are additions to existing files. No schema changes needed — the influence cache `context` field is already a string, and `sources` is already an array.

---

## Chunk 1: Perplexity Research Tool

### Task 1: Add `research_influence` Tool

**Files:**
- Modify: `src/lib/web-tools/prep-research.ts`

- [ ] **Step 1: Add the `researchInfluenceHandler` function**

After the existing `researchTrackHandler` (around line 91), add:

```typescript
  const researchInfluenceHandler = async (args: {
    fromArtist: string;
    toArtist: string;
  }) => {
    const { fromArtist, toArtist } = args;

    const prompt = [
      `Explain the musical influence relationship between ${fromArtist} and ${toArtist}.`,
      ``,
      `Include:`,
      `- DIRECTION: Who influenced whom? How do we know? (interviews, timeline, acknowledged influences)`,
      `- SONIC ELEMENTS: What specific musical qualities were transmitted? (rhythm, harmony, production techniques, instrumentation)`,
      `- KEY WORKS: Which specific albums or tracks demonstrate this connection? Format as "Album A (year) → Album B (year)"`,
      `- QUOTES: Any interviews where either artist acknowledged the connection? Include the exact quote and publication.`,
      ``,
      `Be specific. Name albums, tracks, producers, studios. If the direction is unclear, note it as mutual influence.`,
      `If you find a direct quote from either artist about the other, lead with it.`,
    ].join("\n");

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${perplexityKey}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: "You are a music historian and critic. Explain influence relationships between artists with specific evidence — quotes, albums, sonic elements. Be concise but detailed.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.2,
          web_search_options: {
            search_context_size: "high",
          },
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({
          error: `Perplexity API error: ${res.status}`,
          detail,
        });
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content ?? "";

      // Strip inline citation markers [1], [2] etc. — these look odd in the UI
      // The actual URLs come from search_results, not these markers
      const content = rawContent.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();

      // CRITICAL: Use search_results for verified URLs, NOT URLs from generated text
      const searchResults: Array<{
        title: string;
        url: string;
        snippet: string;
        date?: string;
      }> = (data.search_results ?? []).map((sr: { title?: string; url?: string; snippet?: string; date?: string }) => ({
        name: sr.title ?? "Source",
        url: sr.url ?? "",
        snippet: sr.snippet ?? "",
        date: sr.date,
      }));

      // Also capture the citations array (URL strings) as fallback
      const citationUrls: string[] = data.citations ?? [];

      // If search_results is empty but citations exist, build minimal source entries
      const sources = searchResults.length > 0
        ? searchResults
        : citationUrls.map((url, i) => ({
            name: `Source ${i + 1}`,
            url,
            snippet: "",
          }));

      return toolResult({
        fromArtist,
        toArtist,
        context: content,
        sources,
      });
    } catch (err) {
      return toolResult({
        error: err instanceof Error ? err.message : "Influence research failed",
        fromArtist,
        toArtist,
      });
    }
  };
```

- [ ] **Step 2: Add the tool definition to the returned array**

In the `return [...]` array (around line 93), add after the `research_track` entry:

```typescript
    {
      name: "research_influence",
      description:
        "Research the musical influence relationship between two artists using Perplexity Sonar Pro. Returns a deep context paragraph with verified source URLs, interview quotes, sonic elements, and key works. Use this to enrich influence chain connections with storytelling. Citations come from Perplexity's search infrastructure and are guaranteed real URLs.",
      inputSchema: {
        fromArtist: z.string().describe("The influencing artist (e.g. 'Parliament-Funkadelic')"),
        toArtist: z.string().describe("The influenced artist (e.g. 'Flying Lotus')"),
      },
      handler: researchInfluenceHandler,
    },
```

- [ ] **Step 3: Also upgrade the existing `research_track` to use `sonar-pro`**

In the existing `researchTrackHandler`, change the model from `"sonar"` to `"sonar-pro"` and add `web_search_options`:

Find (around line 54):
```typescript
          model: "sonar",
```

Replace with:
```typescript
          model: "sonar-pro",
```

And add after `max_tokens: 800,`:
```typescript
          temperature: 0.2,
          web_search_options: {
            search_context_size: "high",
          },
```

Also update `research_track` to extract `search_results` the same way — change the return from:

```typescript
      return toolResult({
        artist,
        track,
        research: content,
        sources: citations,
      });
```

To:

```typescript
      const searchResults = data.search_results ?? [];
      const sources = searchResults.length > 0
        ? searchResults.map((sr: { title?: string; url?: string; snippet?: string; date?: string }) => ({
            name: sr.title ?? "Source",
            url: sr.url ?? "",
            snippet: sr.snippet ?? "",
            date: sr.date,
          }))
        : (data.citations ?? []).map((url: string, i: number) => ({
            name: `Source ${i + 1}`,
            url,
            snippet: "",
          }));

      return toolResult({
        artist,
        track,
        research: content,
        sources,
      });
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/lib/web-tools/prep-research.ts
git commit -m "feat: add research_influence tool with Sonar Pro and verified citations"
```

---

## Chunk 2: Enhanced InfluenceChain UI

### Task 2: Update ParsedConnection Type and ConnectionNode Component

**Files:**
- Modify: `src/lib/openui/components.tsx`

- [ ] **Step 1: Extend `ParsedConnection` type**

Find (line 1326):
```typescript
type ParsedConnection = {
  name: string; weight: number; relationship: string;
  context: string; sources: unknown; imageUrl?: string;
};
```

Replace with:
```typescript
type ParsedConnection = {
  name: string; weight: number; relationship: string;
  context: string; sources: unknown; imageUrl?: string;
  pullQuote?: string; pullQuoteAttribution?: string;
  sonicElements?: string[]; keyWorks?: string;
};
```

- [ ] **Step 2: Update the Zod schema in the InfluenceChain component props**

Find the connection schema inside the `InfluenceChain` component `props` definition (around line 1459-1474). Add the new optional fields after `imageUrl`:

```typescript
        pullQuote: z.string().optional().describe("Direct quote from artist or journalist about this influence"),
        pullQuoteAttribution: z.string().optional().describe("Quote attribution (e.g. 'Flying Lotus, Pitchfork, 2012')"),
        sonicElements: z.preprocess(jsonPreprocess, z.array(z.string())).optional().describe("Sonic/stylistic elements transmitted"),
        keyWorks: z.string().optional().describe("Album-to-album influence (e.g. 'Mothership Connection (1975) → Cosmogramma (2010)')"),
```

Also update the source object schema to include `snippet` and `date`:

```typescript
              url: z.string().describe("Source URL"),
              snippet: z.string().optional().describe("Text excerpt from the source"),
              date: z.string().optional().describe("Publication date"),
```

- [ ] **Step 3: Rewrite the `ConnectionNode` component with enhanced UI**

Replace the entire `ConnectionNode` function (lines 1360-1411) with:

```tsx
function ConnectionNode({ conn, id, isExpanded, onToggle, dotColor }: {
  conn: ParsedConnection;
  id: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  dotColor: (w: number) => string;
}) {
  const imageUrl = useAutoImage(conn.name, conn.imageUrl);
  const weight = ensureNumber(conn.weight);
  const sources = ensureArray<{ name: string; url: string; snippet?: string; date?: string }>(conn.sources);
  const sonicElements = conn.sonicElements ? ensureArray<string>(conn.sonicElements) : [];

  return (
    <div className="relative pl-5">
      <div className={`absolute left-[-3px] top-2 h-2 w-2 rounded-full ${dotColor(weight)} ring-2 ring-zinc-900`} />
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
        <div className="flex items-center gap-2">
          {imageUrl ? (
            <img src={imageUrl} alt={conn.name} className="h-9 w-9 rounded-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700">
              <span className="text-xs font-medium text-zinc-400">{conn.name.charAt(0)}</span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white">{conn.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">{conn.relationship}</span>
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                weight > 0.7 ? "bg-green-500/20 text-green-400" : weight >= 0.5 ? "bg-yellow-500/20 text-yellow-400" : "bg-zinc-500/20 text-zinc-400"
              }`}>{weight.toFixed(2)}</span>
            </div>
          </div>
          <button onClick={() => onToggle(id)} className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300">
            {isExpanded ? "Less" : "More"}
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 space-y-3 border-t border-zinc-700 pt-3">
            {/* Pull quote — the "lean forward" moment */}
            {conn.pullQuote && (
              <blockquote className="border-l-2 border-violet-500 pl-3">
                <p className="text-sm italic text-zinc-200">&ldquo;{conn.pullQuote}&rdquo;</p>
                {conn.pullQuoteAttribution && (
                  <cite className="mt-1 block text-[11px] not-italic text-zinc-500">
                    — {conn.pullQuoteAttribution}
                  </cite>
                )}
              </blockquote>
            )}

            {/* Context paragraph */}
            <p className="text-sm leading-relaxed text-zinc-300">{conn.context}</p>

            {/* Sonic DNA chips */}
            {sonicElements.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sonic DNA</p>
                <div className="flex flex-wrap gap-1.5">
                  {sonicElements.map((el) => (
                    <span key={el} className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-300">
                      {el}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Key works timeline */}
            {conn.keyWorks && (
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Key Works</span>
                <span className="text-zinc-300">{conn.keyWorks}</span>
              </div>
            )}

            {/* Source cards with verified URLs */}
            {sources.length > 0 && (
              <div>
                <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sources</p>
                <div className="space-y-1.5">
                  {sources.map((src) => (
                    <a
                      key={src.url}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded border border-zinc-700/50 bg-zinc-800/30 px-3 py-2 transition hover:border-zinc-600"
                    >
                      <p className="text-xs font-medium text-cyan-400">{src.name}</p>
                      {src.snippet && (
                        <p className="mt-0.5 text-[11px] leading-tight text-zinc-500" style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                          {src.snippet}
                        </p>
                      )}
                      {src.date && <p className="mt-0.5 text-[10px] text-zinc-600">{src.date}</p>}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Auto-expand top 3 connections by weight**

In the `InfluenceChain` component (around line 1479), change the `expandedId` state initialization to auto-expand the top 3:

Find:
```typescript
    const [expandedId, setExpandedId] = useState<string | null>(null);
```

Replace with:
```typescript
    // Auto-expand top 3 connections (by weight) to show enriched content immediately
    const [toggledIds, setCollapsedIds] = useState<Set<string>>(new Set());
```

Then update the `ConnectionNode` usage (around line 1606). Find:

```typescript
              <ConnectionNode
                key={`${currentTab}-${conn.name}-${i}`}
                conn={conn}
                id={`${currentTab}-${conn.name}-${i}`}
                isExpanded={expandedId === `${currentTab}-${conn.name}-${i}`}
                onToggle={(id) => setExpandedId(expandedId === id ? null : id)}
                dotColor={dotColor}
              />
```

Replace with:

```typescript
              <ConnectionNode
                key={`${currentTab}-${conn.name}-${i}`}
                conn={conn}
                id={`${currentTab}-${conn.name}-${i}`}
                isExpanded={i < 3 ? !toggledIds.has(`${currentTab}-${conn.name}-${i}`) : toggledIds.has(`${currentTab}-${conn.name}-${i}`)}
                onToggle={(id) => setCollapsedIds(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                dotColor={dotColor}
              />
```

Logic: top 3 (i < 3) are expanded by default — clicking "Less" adds them to `toggledIds`. Others (i >= 3) are collapsed by default — clicking "More" adds them to `toggledIds` to toggle them open.

Wait — that logic is inverted for i >= 3. Let me fix:

```typescript
                isExpanded={i < 3
                  ? !toggledIds.has(`${currentTab}-${conn.name}-${i}`)   // top 3: expanded unless manually collapsed
                  : toggledIds.has(`${currentTab}-${conn.name}-${i}`)    // rest: collapsed unless manually expanded
                }
```

This is correct — `toggledIds` is a set of toggled IDs. For top 3, being in the set means collapsed. For rest, being in the set means expanded.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: enhance InfluenceChain UI with pull quotes, sonic chips, source cards, auto-expand top 3"
```

---

## Chunk 3: Update Influence Prompt

### Task 3: Update `/influence` Command Prompt

**Files:**
- Modify: `src/lib/chat-utils.ts`

- [ ] **Step 1: Update the influence prompt to include Phase 2 enrichment**

Find the `case "influence":` block (line 277). Replace the return statement (lines 282-322) with:

```typescript
      return [
        `Map the musical influences of ${arg}.`,
        ``,
        `PHASE 1 — DISCOVER (max 4 tool calls):`,
        `1. lookup_influences("${arg}") — check cache first`,
        `2. If cache < 5 connections, run discovery:`,
        `   - search_reviews for "${arg}" — co-mentions = influence signal`,
        `   - extract_influences from review text`,
        `   - search_web (Exa or Tavily) for "${arg} musical influences"`,
        `3. cache_batch_influences — save discoveries`,
        ``,
        `PHASE 2 — ENRICH top 5-6 connections (Perplexity):`,
        `For each of the top 5-6 connections by weight:`,
        `  Call research_influence(fromArtist, toArtist)`,
        `  This returns deep context with verified source URLs.`,
        `DO NOT skip this phase — it's what makes the output compelling.`,
        ``,
        `PHASE 2.5 — RE-CACHE enriched data:`,
        `After enriching, call cache_batch_influences again with the enriched context and sources.`,
        `This saves the Perplexity-enriched data so the next query for this artist serves cached results.`,
        ``,
        `PHASE 3 — OUTPUT (do this IMMEDIATELY after enrichment):`,
        `Output the InfluenceChain component with enriched data.`,
        ``,
        `For each connection, include ALL of these fields from the research_influence results:`,
        `- context: the enriched paragraph (not the thin co-mention description)`,
        `- pullQuote: if the research found a direct quote from either artist, include it`,
        `- pullQuoteAttribution: "Artist Name, Publication, Year"`,
        `- sonicElements: array of sonic/stylistic qualities transmitted (e.g. ["synthesizer textures", "cosmic imagery"])`,
        `- keyWorks: album-to-album reference (e.g. "Mothership Connection (1975) → Cosmogramma (2010)")`,
        `- sources: array with name, url, snippet, date FROM the research_influence results (these are verified URLs)`,
        ``,
        `DIRECTION CONVENTION (Badillo-Goicoechea 2025):`,
        `- from=INFLUENCER, to=INFLUENCED. If review of B mentions A → edge A→B`,
        `- "influenced by" for directional, "co_mention" for same-review co-occurrence`,
        ``,
        `OUTPUT FORMAT — HARD REQUIREMENT:`,
        `Output ONLY an OpenUI Lang code block. No prose, no markdown, no introduction.`,
        ``,
        `\`\`\``,
        `root = InfluenceChain("${arg}", "[{\\"name\\":\\"Artist Name\\",\\"weight\\":0.9,\\"relationship\\":\\"influenced by\\",\\"context\\":\\"Rich enriched paragraph from research_influence\\",\\"pullQuote\\":\\"Direct quote if found\\",\\"pullQuoteAttribution\\":\\"Artist, Publication, Year\\",\\"sonicElements\\":[\\"element1\\",\\"element2\\"],\\"keyWorks\\":\\"Album A (year) → Album B (year)\\",\\"sources\\":[{\\"name\\":\\"Source Title\\",\\"url\\":\\"https://verified-url\\",\\"snippet\\":\\"Text excerpt\\",\\"date\\":\\"2024-01-15\\"}],\\"imageUrl\\":\\"https://...or-omit\\"}]")`,
        `\`\`\``,
        ``,
        `RULES:`,
        `- connections is a JSON array string (escaped quotes)`,
        `- Include 6-12 connections sorted by weight descending`,
        `- Every connection MUST have sources with real URLs from research_influence`,
        `- pullQuote and sonicElements are optional — only include if found in research`,
        `- context must be the enriched paragraph, not a generic description`,
        `- Output ONLY the code block. Nothing else.`,
      ].join("\n");
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat-utils.ts
git commit -m "feat: update /influence prompt with Phase 2 Perplexity enrichment"
```

---

## Chunk 4: Verification

### Task 4: Final Build Verification

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify no regressions**

Read `src/lib/web-tools/prep-research.ts` and confirm:
- `research_track` still works (unchanged handler logic, just upgraded model + search_results)
- `research_influence` is a new tool alongside it
- Both use `sonar-pro` with `search_context_size: "high"`
- Both extract from `search_results` (verified URLs), not generated text

Read `src/lib/openui/components.tsx` and confirm:
- `ParsedConnection` type has new optional fields
- `ConnectionNode` renders pull quotes, sonic chips, key works, source cards
- New fields are optional — old cached data without enrichment still renders correctly
- Top 3 connections auto-expand

Read `src/lib/chat-utils.ts` and confirm:
- `/influence` prompt has Phase 1 (discover), Phase 2 (enrich), Phase 3 (output)
- Enriched fields listed in the output format

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: finalize influence chain Perplexity enrichment"
```

---

## Deferred (from spec, not in this plan)

- **Enhanced Lineage Arc** — larger photos, connection labels on arrows. Deferred to follow-up.
- **`direction` field extraction** — Perplexity's text describes direction but it's not structured. The agent can infer direction from context. Structured extraction deferred.

---

## Verification Checklist

### Build
- `npx tsc --noEmit` — TypeScript compiles
- All imports resolve correctly

### Manual Testing
1. **Run `/influence Flying Lotus`** — agent should:
   - Phase 1: check cache, run co-mention discovery
   - Phase 2: call `research_influence` 5-6 times (one per top connection)
   - Phase 3: output InfluenceChain with enriched data
2. **Check pull quotes** — if Perplexity found a direct quote, it appears as a styled blockquote
3. **Check sonic DNA chips** — violet-tinted tags showing transmitted musical qualities
4. **Check key works** — album→album timeline reference
5. **Check source cards** — clickable cards with title, snippet, date (not just text links)
6. **Verify source URLs are real** — click through 3-4 sources, confirm they load actual pages
7. **Check auto-expand** — top 3 connections should be expanded on load
8. **Backward compat** — previously cached connections (without enrichment) should still render correctly with the old simple expand view
9. **Tool call budget** — total should be 7-9 calls (2-3 discovery + 5-6 enrichment), within 25 cap
