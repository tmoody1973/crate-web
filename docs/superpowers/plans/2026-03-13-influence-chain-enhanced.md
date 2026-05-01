# Enhanced InfluenceChain Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enhance InfluenceChain to group connections by direction (Roots/Built With/Legacy), add a lineage arc header, auto-generated summary, and tabbed navigation — all component-side with zero prompt token impact.

**Architecture:** Replace the flat-list render in the existing InfluenceChain component with a tabbed layout. Grouping, arc extraction, and summary generation all happen at render time using the existing `relationship` field. One optional `summary` prop added to Zod schema.

**Tech Stack:** React (useState), Tailwind CSS, Zod, existing `ensureArray`/`ensureNumber`/`SafeImage` helpers from the same file.

**Spec:** `docs/superpowers/specs/2026-03-13-influence-chain-enhanced-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/openui/components.tsx` | Modify (lines 1093-1212) | InfluenceChain component — replace render with grouped tabs + lineage arc |
| `src/lib/openui/prompt.ts` | Modify (line 80) | Add `summary?` to InfluenceChain signature |

No new files. No test files (OpenUI components are visual — verified via manual testing and TypeScript compilation).

---

### Task 1: Add grouping constants and helper functions

**Files:**
- Modify: `src/lib/openui/components.tsx` (insert above InfluenceChain, after line ~1091)

- [ ] **Step 1: Add relationship grouping constants and types**

Insert these constants just above the `export const InfluenceChain = defineComponent({` line:

```typescript
// ── Influence grouping ──────────────────────────────────────────
type ParsedConnection = {
  name: string; weight: number; relationship: string;
  context: string; sources: unknown; imageUrl?: string;
};

const ROOTS_RELS = new Set(["influenced by", "family lineage", "inspired by"]);
const LEGACY_RELS = new Set(["influenced", "shaped", "mentored"]);

type GroupKey = "roots" | "built" | "legacy";

function classifyRelationship(rel: string): GroupKey {
  const norm = rel.toLowerCase().trim();
  if (ROOTS_RELS.has(norm)) return "roots";
  if (LEGACY_RELS.has(norm)) return "legacy";
  return "built";
}

const GROUP_META: Record<GroupKey, { label: string; color: string; activeBg: string; borderColor: string }> = {
  roots:  { label: "Roots",      color: "text-green-400",  activeBg: "border-green-500", borderColor: "border-green-500/20" },
  built:  { label: "Built With", color: "text-yellow-400", activeBg: "border-yellow-500", borderColor: "border-yellow-500/20" },
  legacy: { label: "Legacy",     color: "text-cyan-400",   activeBg: "border-cyan-500", borderColor: "border-cyan-500/20" },
};

function groupConnections(conns: ParsedConnection[]): Record<GroupKey, ParsedConnection[]> {
  const groups: Record<GroupKey, ParsedConnection[]> = { roots: [], built: [], legacy: [] };
  for (const c of conns) {
    groups[classifyRelationship(c.relationship)].push(c);
  }
  // Sort each group by weight descending
  for (const key of Object.keys(groups) as GroupKey[]) {
    groups[key].sort((a, b) => ensureNumber(b.weight) - ensureNumber(a.weight));
  }
  return groups;
}

function buildLineageArc(
  artist: string,
  groups: Record<GroupKey, ParsedConnection[]>,
): Array<{ name: string; imageUrl?: string; isCentral?: boolean }> {
  const roots = groups.roots.slice(0, 2);
  const legacy = groups.legacy.slice(0, 2);
  // Need at least 1 root or 1 legacy to show arc (min 3 nodes with central)
  if (roots.length === 0 && legacy.length === 0) return [];
  return [
    ...roots.reverse().map(c => ({ name: c.name, imageUrl: c.imageUrl })),
    { name: artist, isCentral: true },
    ...legacy.map(c => ({ name: c.name, imageUrl: c.imageUrl })),
  ];
}

function autoSummary(artist: string, groups: Record<GroupKey, ParsedConnection[]>): string {
  const r = groups.roots.length;
  const b = groups.built.length;
  const l = groups.legacy.length;
  const parts: string[] = [];
  if (r > 0) parts.push(`${r} influence${r > 1 ? "s" : ""} shaped ${artist}'s sound`);
  if (b > 0) parts.push(`${b} collaboration${b > 1 ? "s" : ""}`);
  if (l > 0) parts.push(`${l} artist${l > 1 ? "s" : ""} carrying the lineage forward`);
  return parts.join(", ") + ".";
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: add influence grouping helpers (constants, classify, arc, summary)"
```

---

### Task 2: Rewrite InfluenceChain component with tabs and lineage arc

**Files:**
- Modify: `src/lib/openui/components.tsx` (lines 1093-1212 — full component replacement)

- [ ] **Step 1: Update Zod schema to add optional summary prop**

Replace the existing props schema (lines 1097-1115) with:

```typescript
  props: z.object({
    artist: z.string().describe("Central artist name"),
    connections: z.preprocess(jsonPreprocess, z.array(
      z.object({
        name: z.string().describe("Connected artist name"),
        weight: z.number().describe("Influence weight 0–1"),
        relationship: z.string().describe("e.g. 'influenced by', 'collaborated with'"),
        context: z.string().describe("Brief explanation of the connection"),
        sources: z.preprocess(jsonPreprocess,
          z.array(
            z.object({
              name: z.string().describe("Source name"),
              url: z.string().describe("Source URL"),
            }),
          ),
        ).describe("Citation sources for this connection"),
        imageUrl: z.string().optional().describe("Connected artist image URL"),
      }),
    )).describe("List of influence connections"),
    summary: z.string().optional().describe("Optional narrative summary — auto-generated if omitted"),
  }),
```

- [ ] **Step 2: Replace the component render function**

Replace everything from `component: ({ props }) => {` through the closing `});` (lines 1117-1212) with:

```tsx
  component: ({ props }) => {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<GroupKey>("roots");

    // Runtime parse
    const connections = ensureArray<ParsedConnection>(props.connections);
    const groups = groupConnections(connections);
    const arc = buildLineageArc(props.artist, groups);
    const summary = (typeof props.summary === "string" && props.summary)
      ? props.summary
      : autoSummary(props.artist, groups);

    // Determine available tabs (non-empty groups)
    const availableTabs = (["roots", "built", "legacy"] as GroupKey[]).filter(k => groups[k].length > 0);
    // If only one group, skip tabs
    const useTabs = availableTabs.length > 1;
    // Ensure activeTab is valid
    const currentTab = useTabs && availableTabs.includes(activeTab) ? activeTab : availableTabs[0] ?? "roots";
    const currentConnections = groups[currentTab];

    const dotColor = (w: number) =>
      w > 0.7 ? "bg-green-500" : w >= 0.5 ? "bg-yellow-500" : "bg-zinc-500";

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        {/* Header card with arc */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">{props.artist} — Influence Chain</h2>

          {/* Lineage arc */}
          {arc.length >= 3 && (
            <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto py-2">
              {arc.map((node, i) => (
                <div key={`arc-${node.name}-${i}`} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    {node.isCentral ? (
                      <div className="h-9 w-9 rounded-full bg-violet-600 ring-2 ring-violet-400 flex items-center justify-center overflow-hidden">
                        <SafeImage src={undefined} alt={node.name} className="h-9 w-9 rounded-full object-cover" />
                      </div>
                    ) : (
                      <SafeImage src={node.imageUrl} alt={node.name} className="h-7 w-7 rounded-full object-cover" />
                    )}
                    <span className={`max-w-[60px] truncate text-center text-[9px] ${
                      node.isCentral ? "font-bold text-white" : "text-zinc-400"
                    }`}>
                      {node.name}
                    </span>
                  </div>
                  {i < arc.length - 1 && (
                    <span className="text-zinc-600 text-xs">→</span>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Summary */}
          <p className="mt-2 border-l-2 border-violet-500 pl-3 text-sm italic text-zinc-400">
            {summary}
          </p>
        </div>

        {/* Tabs */}
        {useTabs && (
          <div className="mb-3 flex" role="tablist">
            {availableTabs.map((key) => {
              const meta = GROUP_META[key];
              const isActive = key === currentTab;
              return (
                <button
                  key={key}
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 py-2 text-center text-xs font-medium transition-colors ${
                    isActive
                      ? `${meta.color} border-b-2 ${meta.activeBg} bg-zinc-800/50`
                      : "text-zinc-500 border-b border-zinc-700 hover:text-zinc-400"
                  }`}
                >
                  {meta.label} ({groups[key].length})
                </button>
              );
            })}
          </div>
        )}

        {/* Connection list */}
        <div className="relative ml-3" role={useTabs ? "tabpanel" : undefined}>
          <div className={`absolute left-0 top-0 bottom-0 w-px ${
            useTabs ? GROUP_META[currentTab].borderColor.replace("border-", "bg-").replace("/20", "/30") : "bg-zinc-700"
          }`} />

          <div className="space-y-3">
            {currentConnections.map((conn, i) => {
              const id = `${currentTab}-${conn.name}-${i}`;
              const isExpanded = expandedId === id;
              const weight = ensureNumber(conn.weight);
              const sources = ensureArray<{ name: string; url: string }>(conn.sources);

              return (
                <div key={id} className="relative pl-5">
                  <div
                    className={`absolute left-[-3px] top-2 h-2 w-2 rounded-full ${dotColor(weight)} ring-2 ring-zinc-900`}
                  />

                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                    <div className="flex items-center gap-2">
                      <SafeImage
                        src={conn.imageUrl}
                        alt={conn.name}
                        className="h-9 w-9 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-white">{conn.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                            {conn.relationship}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              weight > 0.7
                                ? "bg-green-500/20 text-green-400"
                                : weight >= 0.5
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                            }`}
                          >
                            {weight.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : id)}
                        className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        {isExpanded ? "Less" : "More"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 border-t border-zinc-700 pt-2">
                        <p className="text-sm text-zinc-300">{conn.context}</p>
                        {sources.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {sources.map((src) => (
                              <a
                                key={src.url}
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[10px] text-cyan-400 hover:underline"
                              >
                                {src.name}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 4: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: rewrite InfluenceChain with tabs, lineage arc, auto-summary"
```

---

### Task 3: Update prompt signature

**Files:**
- Modify: `src/lib/openui/prompt.ts` (line 80)

- [ ] **Step 1: Add summary param to InfluenceChain signature**

Change line 80 from:
```
**InfluenceChain(artist, connections)**
```
to:
```
**InfluenceChain(artist, connections, summary?)**
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/openui/prompt.ts
git commit -m "docs: add optional summary param to InfluenceChain prompt signature"
```

---

### Task 4: Build verification and deploy

- [ ] **Step 1: Full TypeScript check**

Run: `npx tsc --noEmit`
Expected: Clean — no errors

- [ ] **Step 2: Push and deploy**

```bash
git push
npx vercel --prod
```
Expected: Successful deployment

- [ ] **Step 3: Manual verification**

Test `/influence Ezra Collective` (or any cached artist) and verify:
1. Header shows artist name + lineage arc with avatars
2. Summary line appears below arc
3. Tabs render for Roots/Built With/Legacy with counts
4. Clicking tabs switches connection list
5. Expand/collapse still works on individual connections
6. Fallback: if all connections are same type, tabs hidden, flat list shown
