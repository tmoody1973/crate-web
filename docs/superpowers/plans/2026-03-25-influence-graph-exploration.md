# Influence Graph Exploration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an interactive force-directed graph tab to InfluenceChain with node expansion, batch Perplexity enrichment, and a server-side expand endpoint.

**Architecture:** New `influence-graph.tsx` component uses `react-force-graph-2d` for canvas rendering, dynamically imported with `ssr: false`. InfluenceChain gets a List/Graph toggle. A new `POST /api/influence/expand` endpoint handles client-side node expansion with Convex cache + Perplexity discovery. A `research_influences_batch` tool in `prep-research.ts` replaces per-connection fan-out.

**Tech Stack:** react-force-graph-2d, Convex (influenceEdges/influenceArtists), Perplexity Sonar API, Next.js App Router API routes, Clerk auth, Zod

**Spec:** `docs/superpowers/specs/2026-03-25-influence-graph-exploration.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/openui/influence-graph.tsx` | CREATE | Force-directed graph component with expansion, detail panel, breadcrumb |
| `src/lib/openui/influence-graph-types.ts` | CREATE | GraphNode, GraphLink types + seed/conversion helpers |
| `src/lib/openui/components.tsx` | MODIFY | Add List/Graph toggle to InfluenceChain, dynamic import |
| `src/lib/web-tools/prep-research.ts` | MODIFY | Add `research_influences_batch` tool |
| `src/app/api/influence/expand/route.ts` | CREATE | Node expansion endpoint (Convex cache + Perplexity) |
| `src/lib/chat-utils.ts` | MODIFY | Update `/influence` prompt for batch tool |
| `package.json` | MODIFY | Add react-force-graph-2d dependency |

---

### Task 1: Install dependency and create types

**Files:**
- Modify: `package.json`
- Create: `src/lib/openui/influence-graph-types.ts`

- [ ] **Step 1: Install react-force-graph-2d**

```bash
npm install react-force-graph-2d
```

- [ ] **Step 2: Verify it installed**

```bash
node -e "require('react-force-graph-2d')" && echo "OK"
```

Expected: OK (no errors)

- [ ] **Step 3: Create the types file**

Create `src/lib/openui/influence-graph-types.ts`:

```typescript
/**
 * Types and helpers for the interactive influence graph.
 * Shared between InfluenceGraph component and the expand API endpoint.
 */

// Re-export ParsedConnection from components for seeding
export type { } from "./components"; // types are inline, so define locally

export interface GraphNode {
  id: string;           // artist name normalized lowercase
  name: string;         // display name
  group: "roots" | "built" | "legacy" | "central";
  weight: number;       // influence weight 0-1, controls node size
  imageUrl?: string;
  context?: string;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  sonicElements?: string[];
  keyWorks?: string;
  sources?: Array<{ name: string; url: string; snippet?: string }>;
  relationship?: string;
  expanded: boolean;
  loading: boolean;
}

export interface GraphLink {
  source: string;       // from node id
  target: string;       // to node id
  relationship: string;
  weight: number;       // controls line thickness
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

export interface ExpandResponse {
  connections: Array<{
    name: string;
    weight: number;
    relationship: string;
    context?: string;
    pullQuote?: string;
    pullQuoteAttribution?: string;
    sonicElements?: string[];
    keyWorks?: string;
    sources?: Array<{ name: string; url: string; snippet?: string }>;
    imageUrl?: string;
  }>;
  fromCache: boolean;
  enriched: boolean;
}

// Color map matching existing InfluenceChain tab colors
export const GROUP_COLORS: Record<GraphNode["group"], string> = {
  roots: "#4ade80",   // green
  built: "#facc15",   // yellow
  legacy: "#22d3ee",  // cyan
  central: "#7c3aed", // violet
};

/**
 * Classify a relationship string into a group.
 * Mirrors classifyRelationship() in components.tsx.
 */
const ROOTS_RELS = new Set(["influenced by", "family lineage", "inspired by"]);
const LEGACY_RELS = new Set(["influenced", "shaped", "mentored"]);

export function classifyGroup(rel: string): GraphNode["group"] {
  const norm = rel.toLowerCase().trim();
  if (ROOTS_RELS.has(norm)) return "roots";
  if (LEGACY_RELS.has(norm)) return "legacy";
  return "built";
}

/**
 * Convert InfluenceChain's ParsedConnection[] into initial GraphData.
 * The central artist becomes the "central" node; connections become typed nodes.
 */
export function seedGraphData(
  artist: string,
  connections: Array<{
    name: string;
    weight: number;
    relationship: string;
    context?: string;
    pullQuote?: string;
    pullQuoteAttribution?: string;
    sonicElements?: string[];
    keyWorks?: string;
    sources?: unknown;
    imageUrl?: string;
  }>,
): GraphData {
  const centralId = artist.toLowerCase();
  const nodes: GraphNode[] = [
    {
      id: centralId,
      name: artist,
      group: "central",
      weight: 1,
      expanded: true, // central node is always "expanded"
      loading: false,
    },
  ];
  const links: GraphLink[] = [];
  const seen = new Set<string>([centralId]);

  for (const conn of connections) {
    const nodeId = conn.name.toLowerCase();
    if (seen.has(nodeId)) continue;
    seen.add(nodeId);

    const group = classifyGroup(conn.relationship);
    nodes.push({
      id: nodeId,
      name: conn.name,
      group,
      weight: typeof conn.weight === "number" ? conn.weight : 0.5,
      imageUrl: conn.imageUrl,
      context: conn.context,
      pullQuote: conn.pullQuote,
      pullQuoteAttribution: conn.pullQuoteAttribution,
      sonicElements: Array.isArray(conn.sonicElements) ? conn.sonicElements : undefined,
      keyWorks: conn.keyWorks,
      sources: Array.isArray(conn.sources)
        ? (conn.sources as Array<{ name: string; url: string; snippet?: string }>)
        : undefined,
      relationship: conn.relationship,
      expanded: false,
      loading: false,
    });

    links.push({
      source: centralId,
      target: nodeId,
      relationship: conn.relationship,
      weight: typeof conn.weight === "number" ? conn.weight : 0.5,
    });
  }

  return { nodes, links };
}
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/lib/openui/influence-graph-types.ts
git commit -m "feat: add react-force-graph-2d and influence graph types"
```

---

### Task 2: Add `research_influences_batch` tool

**Files:**
- Modify: `src/lib/web-tools/prep-research.ts:225-253`

- [ ] **Step 1: Add the batch handler above the return statement**

In `src/lib/web-tools/prep-research.ts`, insert the following BEFORE line 227 (`return [`):

```typescript
  /**
   * Batch enrichment: fires parallel Perplexity calls for multiple connections.
   * Reduces agent tool calls from 5 to 1 for the enrichment phase.
   */
  const researchInfluencesBatchHandler = async (args: {
    artist: string;
    connections: string[];
  }) => {
    const { artist, connections } = args;
    const maxConnections = Math.min(connections.length, 6);
    const batch = connections.slice(0, maxConnections);

    const results = await Promise.allSettled(
      batch.map(async (connName) => {
        const result = await researchInfluenceHandler({
          fromArtist: artist,
          toArtist: connName,
        });
        // Extract the text content from the tool result
        const text = result.content[0]?.text ?? "{}";
        try {
          return { connection: connName, ...JSON.parse(text) };
        } catch {
          return { connection: connName, error: "Parse failed" };
        }
      }),
    );

    const enriched = results.map((r, i) => {
      if (r.status === "fulfilled") return r.value;
      return { connection: batch[i], error: String(r.reason) };
    });

    return toolResult({
      artist,
      enriched,
      count: enriched.filter((e) => !e.error).length,
      total: batch.length,
    });
  };
```

- [ ] **Step 2: Add the tool definition to the returned array**

In the `return [` array (after the `research_influence` entry), add:

```typescript
    {
      name: "research_influences_batch",
      description:
        "Batch-research multiple influence connections in parallel using Perplexity Sonar Pro. Accepts an artist and an array of connection names (max 6). Returns enriched context for all connections in a single tool response. Use this instead of calling research_influence multiple times.",
      inputSchema: {
        artist: z.string().describe("Central artist name"),
        connections: z
          .array(z.string())
          .max(6)
          .describe("Array of connected artist names to enrich"),
      },
      handler: researchInfluencesBatchHandler,
    },
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/lib/web-tools/prep-research.ts
git commit -m "feat: add research_influences_batch tool for parallel Perplexity enrichment"
```

---

### Task 3: Create `/api/influence/expand` endpoint

**Files:**
- Create: `src/app/api/influence/expand/route.ts`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p src/app/api/influence/expand
```

- [ ] **Step 2: Create the route file**

Create `src/app/api/influence/expand/route.ts`:

```typescript
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

export const maxDuration = 30;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Simple in-memory rate limiter (resets on redeploy)
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(userId: string, maxPerHour: number): boolean {
  const now = Date.now();
  const entry = rateLimits.get(userId);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + 3600_000 });
    return true;
  }
  if (entry.count >= maxPerHour) return false;
  entry.count++;
  return true;
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { artist?: string; tier?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const artist = body.artist?.trim();
  const tier = body.tier === "pro" ? "pro" : "free";

  if (!artist) {
    return Response.json({ error: "artist is required" }, { status: 400 });
  }

  // Rate limit: free=10/hr, pro=60/hr
  const maxPerHour = tier === "pro" ? 60 : 10;
  if (!checkRateLimit(clerkId, maxPerHour)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again later.", connections: [], fromCache: true, enriched: false },
      { status: 429 },
    );
  }

  // Look up Convex user by Clerk ID
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  const userId = user._id as Id<"users">;

  // Check Convex cache first
  const cached = await convex.query(api.influence.lookupInfluences, {
    userId,
    artist,
    direction: "both",
  });

  const cachedConnections = (cached.connections ?? []).map((c: {
    name: string;
    weight: number;
    relationship: string;
    context?: string;
    sources?: Array<{ sourceType: string; sourceUrl?: string; sourceName?: string; snippet?: string }>;
    imageUrl?: string;
  }) => ({
    name: c.name,
    weight: c.weight,
    relationship: c.relationship,
    context: c.context,
    sources: (c.sources ?? []).map((s) => ({
      name: s.sourceName ?? s.sourceType,
      url: s.sourceUrl ?? "",
      snippet: s.snippet ?? "",
    })),
    imageUrl: c.imageUrl,
  }));

  // If we have enough cached edges, return immediately
  if (cachedConnections.length >= 3) {
    return Response.json({
      connections: cachedConnections,
      fromCache: true,
      enriched: false,
    });
  }

  // Not enough cached — try Perplexity discovery
  const perplexityKey = process.env.PERPLEXITY_API_KEY;
  if (!perplexityKey) {
    // No Perplexity key — return whatever cache has
    return Response.json({
      connections: cachedConnections,
      fromCache: true,
      enriched: false,
    });
  }

  try {
    // Discovery call using sonar (cheap, fast)
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const discoveryRes = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${perplexityKey}`,
      },
      body: JSON.stringify({
        model: "sonar",
        messages: [
          {
            role: "system",
            content: "You are a music historian. Return a JSON array of musical connections.",
          },
          {
            role: "user",
            content: [
              `List the most important musical connections for ${artist}.`,
              `Return ONLY a JSON array of objects with these fields:`,
              `- name: connected artist name`,
              `- weight: influence strength 0-1`,
              `- relationship: "influenced by", "collaborated with", "influenced", or "mentored"`,
              `- context: one sentence explaining the connection`,
              `Return 6-10 connections. JSON only, no markdown.`,
            ].join("\n"),
          },
        ],
        max_tokens: 800,
        temperature: 0.1,
        web_search_options: { search_context_size: "medium" },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!discoveryRes.ok) {
      return Response.json({
        connections: cachedConnections,
        fromCache: true,
        enriched: false,
      });
    }

    const discoveryData = await discoveryRes.json();
    const rawContent = discoveryData.choices?.[0]?.message?.content ?? "";

    // Parse JSON from response (may be wrapped in ```json ... ```)
    const jsonMatch = rawContent.match(/\[[\s\S]*\]/);
    let discovered: Array<{
      name: string;
      weight: number;
      relationship: string;
      context?: string;
    }> = [];

    if (jsonMatch) {
      try {
        discovered = JSON.parse(jsonMatch[0]);
      } catch {
        // Failed to parse — return cached only
        return Response.json({
          connections: cachedConnections,
          fromCache: true,
          enriched: false,
        });
      }
    }

    // Extract source citations from Perplexity
    const citations: string[] = discoveryData.citations ?? [];
    const defaultSources = citations.slice(0, 3).map((url: string, i: number) => ({
      name: `Source ${i + 1}`,
      url,
      snippet: "",
    }));

    // Cache discovered edges to Convex
    if (discovered.length > 0) {
      try {
        await convex.mutation(api.influence.cacheBatchEdges, {
          userId,
          edges: discovered.map((d) => ({
            fromName: artist,
            toName: d.name,
            relationship: d.relationship,
            weight: d.weight ?? 0.5,
            context: d.context,
          })),
        });
      } catch {
        // Cache write failed — continue with results anyway
      }
    }

    // Merge cached + discovered (dedup by name)
    const allNames = new Set(cachedConnections.map((c: { name: string }) => c.name.toLowerCase()));
    const merged = [...cachedConnections];

    for (const d of discovered) {
      if (!allNames.has(d.name.toLowerCase())) {
        allNames.add(d.name.toLowerCase());
        merged.push({
          name: d.name,
          weight: d.weight ?? 0.5,
          relationship: d.relationship,
          context: d.context,
          sources: defaultSources,
          imageUrl: undefined,
        });
      }
    }

    // Pro tier: batch-enrich top 3 newly discovered connections
    let enriched = false;
    if (tier === "pro" && discovered.length > 0) {
      const toEnrich = discovered.slice(0, 3);
      try {
        const enrichResults = await Promise.allSettled(
          toEnrich.map(async (conn) => {
            const enrichController = new AbortController();
            const enrichTimeout = setTimeout(() => enrichController.abort(), 25000);
            const enrichRes = await fetch("https://api.perplexity.ai/chat/completions", {
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
                    content: "You are a music historian. Explain influence relationships with specific evidence.",
                  },
                  {
                    role: "user",
                    content: `Explain the musical connection between ${artist} and ${conn.name}. Include sonic elements, key works, and any direct quotes.`,
                  },
                ],
                max_tokens: 800,
                temperature: 0.2,
                web_search_options: { search_context_size: "high" },
              }),
              signal: enrichController.signal,
            });
            clearTimeout(enrichTimeout);
            if (!enrichRes.ok) return null;
            const enrichData = await enrichRes.json();
            const content = (enrichData.choices?.[0]?.message?.content ?? "")
              .replace(/\[\d+\]/g, "")
              .replace(/\s{2,}/g, " ")
              .trim();
            const enrichSources = (enrichData.citations ?? []).slice(0, 3).map((url: string, i: number) => ({
              name: `Source ${i + 1}`,
              url,
              snippet: "",
            }));
            return { name: conn.name, context: content, sources: enrichSources };
          }),
        );

        // Merge enrichment into results
        for (const r of enrichResults) {
          if (r.status !== "fulfilled" || !r.value) continue;
          const idx = merged.findIndex(
            (m) => m.name.toLowerCase() === r.value!.name.toLowerCase(),
          );
          if (idx >= 0) {
            merged[idx] = { ...merged[idx], context: r.value.context, sources: r.value.sources };
          }
        }
        enriched = true;
      } catch {
        // Enrichment failed — continue with discovery results
      }
    }

    return Response.json({
      connections: merged,
      fromCache: false,
      enriched,
    });
  } catch {
    // Perplexity call failed — return cached
    return Response.json({
      connections: cachedConnections,
      fromCache: true,
      enriched: false,
    });
  }
}
```

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add src/app/api/influence/expand/route.ts
git commit -m "feat: add /api/influence/expand endpoint with Convex cache + Perplexity discovery"
```

---

### Task 4: Create the InfluenceGraph component

**Files:**
- Create: `src/lib/openui/influence-graph.tsx`

- [ ] **Step 1: Create the graph component**

Create `src/lib/openui/influence-graph.tsx`:

```typescript
"use client";

/**
 * Interactive force-directed influence graph.
 * Renders connections as nodes with expansion on tap.
 * Desktop: graph + detail panel. Mobile: graph + bottom sheet.
 */

import { useState, useCallback, useRef, useEffect } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  type GraphNode,
  type GraphLink,
  type GraphData,
  type ExpandResponse,
  GROUP_COLORS,
  classifyGroup,
  seedGraphData,
} from "./influence-graph-types";

// ── Helpers ──────────────────────────────────────────────────────

function injectChatMessage(msg: string) {
  const input = document.querySelector<HTMLTextAreaElement>("textarea");
  if (input) {
    const nativeSet = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value",
    )?.set;
    nativeSet?.call(input, msg);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
}

// ── Props ────────────────────────────────────────────────────────

interface InfluenceGraphProps {
  artist: string;
  connections: Array<{
    name: string;
    weight: number;
    relationship: string;
    context?: string;
    pullQuote?: string;
    pullQuoteAttribution?: string;
    sonicElements?: string[];
    keyWorks?: string;
    sources?: unknown;
    imageUrl?: string;
  }>;
  isPro: boolean;
}

// ── Component ────────────────────────────────────────────────────

export default function InfluenceGraph({
  artist,
  connections,
  isPro,
}: InfluenceGraphProps) {
  const isMobile = useIsMobile();
  const graphRef = useRef<ForceGraphMethods | undefined>();
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 400, height: 300 });

  // Graph state
  const [graphData, setGraphData] = useState<GraphData>(() =>
    seedGraphData(artist, connections),
  );
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(
    () => new Set([artist.toLowerCase()]),
  );
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [breadcrumb, setBreadcrumb] = useState<string[]>([artist]);
  const [showBottomSheet, setShowBottomSheet] = useState(false);

  // Measure container
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setDimensions({ width, height: Math.max(height, 250) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Get selected node data
  const selectedData = graphData.nodes.find((n) => n.id === selectedNode);

  // Auto-fetch missing node images from /api/artwork (batch, max 10)
  useEffect(() => {
    const missing = graphData.nodes.filter((n) => !n.imageUrl && n.group !== "central");
    if (missing.length === 0) return;
    let cancelled = false;
    const fetchImages = async () => {
      const batch = missing.slice(0, 10);
      const results = await Promise.allSettled(
        batch.map(async (node) => {
          const res = await fetch(`/api/artwork?q=${encodeURIComponent(node.name)}&type=artist&source=spotify`);
          if (!res.ok) return null;
          const data = await res.json();
          return { id: node.id, url: data.results?.[0]?.image };
        }),
      );
      if (cancelled) return;
      setGraphData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) => {
          const match = results.find(
            (r) => r.status === "fulfilled" && r.value?.id === n.id && r.value?.url,
          );
          if (match && match.status === "fulfilled" && match.value?.url) {
            return { ...n, imageUrl: match.value.url };
          }
          return n;
        }),
      }));
    };
    fetchImages();
    return () => { cancelled = true; };
  }, [graphData.nodes.map((n) => `${n.id}:${n.imageUrl ?? ""}`).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Node expansion ──────────────────────────────────────────

  const expandNode = useCallback(
    async (nodeId: string, nodeName: string) => {
      if (expandedNodes.has(nodeId) || loadingNodes.has(nodeId)) return;

      setLoadingNodes((prev) => new Set([...prev, nodeId]));

      try {
        const res = await fetch("/api/influence/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artist: nodeName,
            tier: isPro ? "pro" : "free",
          }),
        });

        if (!res.ok) {
          setExpandedNodes((prev) => new Set([...prev, nodeId]));
          setLoadingNodes((prev) => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
          return;
        }

        const data: ExpandResponse = await res.json();

        setGraphData((prev) => {
          const existingIds = new Set(prev.nodes.map((n) => n.id));
          const newNodes: GraphNode[] = [];
          const newLinks: GraphLink[] = [];

          for (const conn of data.connections) {
            const connId = conn.name.toLowerCase();
            if (existingIds.has(connId)) {
              // Node already exists — just add a link if not present
              const linkExists = prev.links.some(
                (l) =>
                  (typeof l.source === "string" ? l.source : (l.source as GraphNode).id) === nodeId &&
                  (typeof l.target === "string" ? l.target : (l.target as GraphNode).id) === connId,
              );
              if (!linkExists) {
                newLinks.push({
                  source: nodeId,
                  target: connId,
                  relationship: conn.relationship,
                  weight: conn.weight,
                });
              }
              continue;
            }

            existingIds.add(connId);
            newNodes.push({
              id: connId,
              name: conn.name,
              group: classifyGroup(conn.relationship),
              weight: conn.weight,
              imageUrl: conn.imageUrl,
              context: conn.context,
              pullQuote: conn.pullQuote,
              pullQuoteAttribution: conn.pullQuoteAttribution,
              sonicElements: conn.sonicElements,
              keyWorks: conn.keyWorks,
              sources: conn.sources,
              relationship: conn.relationship,
              expanded: false,
              loading: false,
            });
            newLinks.push({
              source: nodeId,
              target: connId,
              relationship: conn.relationship,
              weight: conn.weight,
            });
          }

          // Cap at 60 nodes
          const totalNodes = prev.nodes.length + newNodes.length;
          const nodesToAdd = totalNodes > 60 ? newNodes.slice(0, 60 - prev.nodes.length) : newNodes;
          const addedIds = new Set(nodesToAdd.map((n) => n.id));
          const linksToAdd = newLinks.filter(
            (l) =>
              typeof l.target === "string"
                ? addedIds.has(l.target) || existingIds.has(l.target)
                : true,
          );

          return {
            nodes: [...prev.nodes, ...nodesToAdd],
            links: [...prev.links, ...linksToAdd],
          };
        });
      } catch {
        // Network error — mark as expanded with no results
      } finally {
        setExpandedNodes((prev) => new Set([...prev, nodeId]));
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }
    },
    [expandedNodes, loadingNodes, isPro],
  );

  // ── Node click handler ──────────────────────────────────────

  const handleNodeClick = useCallback(
    (node: GraphNode) => {
      setSelectedNode(node.id);
      if (isMobile) setShowBottomSheet(true);

      // Auto-expand if not yet expanded
      if (!expandedNodes.has(node.id) && !loadingNodes.has(node.id)) {
        expandNode(node.id, node.name);
      }
    },
    [expandedNodes, loadingNodes, expandNode, isMobile],
  );

  // ── Refocus (Explore) ──────────────────────────────────────

  const refocus = useCallback(
    (nodeName: string) => {
      setBreadcrumb((prev) => [...prev, nodeName]);
      setSelectedNode(null);
      setShowBottomSheet(false);

      // Center camera on node
      const node = graphData.nodes.find((n) => n.name === nodeName);
      if (node && graphRef.current) {
        graphRef.current.centerAt(
          (node as unknown as { x: number }).x,
          (node as unknown as { y: number }).y,
          500,
        );
        graphRef.current.zoom(2, 500);
      }

      // Expand if needed
      const nodeId = nodeName.toLowerCase();
      if (!expandedNodes.has(nodeId)) {
        expandNode(nodeId, nodeName);
      }
    },
    [graphData.nodes, expandedNodes, expandNode],
  );

  const goBack = useCallback(() => {
    if (breadcrumb.length <= 1) return;
    const newBreadcrumb = breadcrumb.slice(0, -1);
    setBreadcrumb(newBreadcrumb);
    const prevArtist = newBreadcrumb[newBreadcrumb.length - 1];
    setSelectedNode(null);
    setShowBottomSheet(false);

    const node = graphData.nodes.find(
      (n) => n.name.toLowerCase() === prevArtist.toLowerCase(),
    );
    if (node && graphRef.current) {
      graphRef.current.centerAt(
        (node as unknown as { x: number }).x,
        (node as unknown as { y: number }).y,
        500,
      );
      graphRef.current.zoom(1.5, 500);
    }
  }, [breadcrumb, graphData.nodes]);

  // ── Canvas node renderer ────────────────────────────────────

  const currentFocus = breadcrumb[breadcrumb.length - 1].toLowerCase();

  // Force continuous redraws while loading nodes exist (for pulse animation)
  useEffect(() => {
    if (loadingNodes.size === 0) return;
    const interval = setInterval(() => {
      graphRef.current?.d3ReheatSimulation();
    }, 100);
    return () => clearInterval(interval);
  }, [loadingNodes.size]);

  const paintNode = useCallback(
    (node: GraphNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = (node as unknown as { x: number }).x;
      const y = (node as unknown as { y: number }).y;
      const isCentral = node.group === "central" || node.id === currentFocus;
      const isSelected = node.id === selectedNode;
      const isLoading = loadingNodes.has(node.id);
      const color = GROUP_COLORS[node.group] ?? GROUP_COLORS.built;
      const baseRadius = isCentral ? 12 : 6 + node.weight * 6;
      const radius = isMobile ? Math.max(baseRadius, 22) : baseRadius;
      const fontSize = Math.max((isCentral ? 12 : 10) / globalScale, 2);

      // Determine opacity based on breadcrumb depth
      const isConnectedToCurrent = graphData.links.some(
        (l) =>
          ((typeof l.source === "string" ? l.source : (l.source as GraphNode).id) === currentFocus &&
            (typeof l.target === "string" ? l.target : (l.target as GraphNode).id) === node.id) ||
          ((typeof l.target === "string" ? l.target : (l.target as GraphNode).id) === currentFocus &&
            (typeof l.source === "string" ? l.source : (l.source as GraphNode).id) === node.id),
      );
      const alpha = node.id === currentFocus || isConnectedToCurrent ? 1 : 0.2;

      ctx.globalAlpha = alpha;

      // Loading pulse
      if (isLoading) {
        const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300);
        ctx.globalAlpha = alpha * (0.5 + pulse * 0.5);
      }

      // Selection glow
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = color + "30";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Node circle
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = isCentral ? color : "#1a1a2e";
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isCentral ? 2 : 1.5;
      ctx.stroke();

      // Label
      ctx.globalAlpha = alpha;
      ctx.font = `${isCentral ? "bold " : ""}${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.fillStyle = isCentral ? "#fff" : color;
      ctx.fillText(node.name, x, y + radius + fontSize + 2);

      ctx.globalAlpha = 1;
    },
    [selectedNode, loadingNodes, currentFocus, isMobile, graphData.links],
  );

  // ── Link renderer ──────────────────────────────────────────

  const paintLink = useCallback(
    (link: GraphLink, ctx: CanvasRenderingContext2D) => {
      const source = link.source as unknown as { x: number; y: number };
      const target = link.target as unknown as { x: number; y: number };
      if (!source?.x || !target?.x) return;

      ctx.beginPath();
      ctx.moveTo(source.x, source.y);
      ctx.lineTo(target.x, target.y);
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 0.5 + link.weight * 1.5;
      ctx.globalAlpha = 0.3 + link.weight * 0.3;
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
    [],
  );

  // ── Detail Panel (desktop) / Bottom Sheet (mobile) ─────────

  const DetailContent = selectedData ? (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold"
          style={{
            backgroundColor: GROUP_COLORS[selectedData.group] + "20",
            color: GROUP_COLORS[selectedData.group],
            border: `1.5px solid ${GROUP_COLORS[selectedData.group]}`,
          }}
        >
          {selectedData.name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-bold text-white">{selectedData.name}</div>
          <div
            className="text-[10px]"
            style={{ color: GROUP_COLORS[selectedData.group] }}
          >
            {selectedData.relationship ?? selectedData.group} · {selectedData.weight.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Context */}
      {selectedData.context && (
        <p className="border-l-2 pl-2 text-[11px] leading-relaxed text-zinc-400"
          style={{ borderColor: GROUP_COLORS[selectedData.group] + "60" }}
        >
          {selectedData.context}
        </p>
      )}

      {/* Pull quote */}
      {selectedData.pullQuote && (
        <div className="rounded bg-zinc-800 p-2 text-[10px] italic text-zinc-300">
          &ldquo;{selectedData.pullQuote}&rdquo;
          {selectedData.pullQuoteAttribution && (
            <div className="mt-1 text-[9px] not-italic text-zinc-500">
              — {selectedData.pullQuoteAttribution}
            </div>
          )}
        </div>
      )}

      {/* Sonic elements */}
      {selectedData.sonicElements && selectedData.sonicElements.length > 0 && (
        <div>
          <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            Sonic Elements
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedData.sonicElements.map((el) => (
              <span
                key={el}
                className="rounded-full px-2 py-0.5 text-[9px]"
                style={{
                  backgroundColor: GROUP_COLORS[selectedData.group] + "15",
                  border: `1px solid ${GROUP_COLORS[selectedData.group]}30`,
                  color: GROUP_COLORS[selectedData.group],
                }}
              >
                {el}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Key works */}
      {selectedData.keyWorks && (
        <div>
          <div className="mb-0.5 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            Key Works
          </div>
          <div className="text-[10px] text-zinc-300">{selectedData.keyWorks}</div>
        </div>
      )}

      {/* Sources */}
      {selectedData.sources && selectedData.sources.length > 0 && (
        <div>
          <div className="mb-1 text-[9px] font-medium uppercase tracking-wider text-zinc-500">
            Sources
          </div>
          {selectedData.sources.map((src) => (
            <a
              key={src.url}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-[10px] text-cyan-400 hover:underline"
            >
              {src.name}
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 border-t border-zinc-800 pt-2">
        <button
          onClick={() => refocus(selectedData.name)}
          className="flex-1 rounded border border-violet-700 bg-violet-900/20 py-1.5 text-center text-[10px] text-violet-300 hover:bg-violet-900/40 transition-colors"
        >
          Explore {selectedData.name} →
        </button>
        <button
          onClick={() => injectChatMessage(`/artist ${selectedData.name}`)}
          className="flex-1 rounded border border-zinc-700 bg-zinc-800/50 py-1.5 text-center text-[10px] text-zinc-300 hover:bg-zinc-700/50 transition-colors"
        >
          Deep Dive
        </button>
      </div>
    </div>
  ) : null;

  // ── Render ─────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Top bar: breadcrumb + stats */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {breadcrumb.length > 1 && (
            <button
              onClick={goBack}
              className="text-violet-400 hover:text-violet-300 transition-colors"
            >
              ← Back
            </button>
          )}
          {breadcrumb.map((name, i) => (
            <span key={`${name}-${i}`}>
              {i > 0 && <span className="mx-1 text-zinc-600">→</span>}
              <span className={i === breadcrumb.length - 1 ? "text-white font-medium" : "text-zinc-500"}>
                {name}
              </span>
            </span>
          ))}
        </div>
        <div className="text-[10px] text-zinc-600">
          {graphData.nodes.length}n · {graphData.links.length}e
        </div>
      </div>

      {/* Main area */}
      <div className={`flex ${isMobile ? "flex-col" : ""}`} style={{ minHeight: isMobile ? 300 : 340 }}>
        {/* Graph canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative"
          style={{ minHeight: isMobile ? 300 : 340, background: "#09090b" }}
          aria-label={`${artist} influence graph with ${graphData.nodes.length} nodes and ${graphData.links.length} connections`}
        >
          <ForceGraph2D
            ref={graphRef as React.MutableRefObject<ForceGraphMethods | undefined>}
            graphData={graphData as { nodes: object[]; links: object[] }}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#09090b"
            nodeCanvasObject={paintNode as unknown as (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => void}
            linkCanvasObject={paintLink as (link: object, ctx: CanvasRenderingContext2D, globalScale: number) => void}
            onNodeClick={handleNodeClick as (node: object) => void}
            cooldownTicks={50}
            d3VelocityDecay={0.3}
            enableZoomInteraction={true}
            enablePanInteraction={true}
          />

          {/* Node count warning */}
          {graphData.nodes.length > 50 && (
            <div className="absolute top-2 left-2 rounded bg-zinc-800/90 px-2 py-1 text-[9px] text-zinc-400">
              Graph is getting large — zoom or reset
            </div>
          )}
        </div>

        {/* Desktop detail panel */}
        {!isMobile && selectedData && (
          <div className="w-[240px] border-l border-zinc-800 bg-zinc-900 p-3 overflow-y-auto"
            style={{ maxHeight: 340 }}
          >
            {DetailContent}
          </div>
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && showBottomSheet && selectedData && (
        <div className="border-t border-zinc-800 bg-zinc-900 p-3 max-h-[40vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-2">
            <div className="text-[10px] text-zinc-500">Connection Details</div>
            <button
              onClick={() => setShowBottomSheet(false)}
              className="text-zinc-500 hover:text-zinc-300 text-xs"
            >
              ✕
            </button>
          </div>
          {DetailContent}
        </div>
      )}

      {/* Action bar */}
      <div className="flex gap-2 border-t border-zinc-800 px-3 py-2">
        <button
          onClick={() => {
            setBreadcrumb([artist]);
            setSelectedNode(null);
            setShowBottomSheet(false);
            graphRef.current?.zoomToFit(400);
          }}
          className="rounded border border-violet-800/40 px-2 py-1 text-[10px] text-violet-400 hover:bg-violet-900/20 transition-colors"
        >
          ⟳ Reset
        </button>
        <button
          onClick={() => injectChatMessage(`Save the ${artist} influence chain as a Spotify playlist`)}
          className="rounded border border-green-800/40 px-2 py-1 text-[10px] text-green-400 hover:bg-green-900/20 transition-colors"
        >
          ▶ Export Playlist
        </button>
        <button
          onClick={() => injectChatMessage(`Send ${artist} influence chain to Slack`)}
          className="rounded border border-cyan-800/40 px-2 py-1 text-[10px] text-cyan-400 hover:bg-cyan-900/20 transition-colors"
        >
          # Slack
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/openui/influence-graph.tsx
git commit -m "feat: add InfluenceGraph component with force-directed layout and node expansion"
```

---

### Task 5: Add List/Graph toggle to InfluenceChain

**Files:**
- Modify: `src/lib/openui/components.tsx:1594-1820`

- [ ] **Step 1: Add dynamic import at top of file**

Near the top of `src/lib/openui/components.tsx` (after the existing imports around line 10), add:

```typescript
import dynamic from "next/dynamic";

const InfluenceGraph = dynamic(() => import("./influence-graph"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[340px] bg-zinc-900 text-zinc-500 text-sm">
      Loading graph...
    </div>
  ),
});
```

- [ ] **Step 2: Add view toggle state and render logic**

In the `InfluenceChain` component function (around line 1594), add a `viewMode` state and wrap the existing list content conditionally. The implementer must read the full InfluenceChain component and add the toggle. Key insertion points: add `viewMode` state alongside existing `useState` calls, add the toggle UI after the hero banner, and wrap the existing tabs/connections/action bar in a `viewMode === "list"` conditional.

Add this state after line 1597 (`const [fetchedImages, setFetchedImages] = useState...`):

```typescript
    const [viewMode, setViewMode] = useState<"list" | "graph">("list");
```

Then, inside the returned JSX, immediately after the hero banner `</div>` (after the header section with artist name and connection count around line 1721), add the toggle:

```typescript
          {/* List / Graph toggle */}
          <div className="flex items-center gap-2 mb-3">
            <div className="flex bg-zinc-800 rounded overflow-hidden border border-zinc-700">
              <button
                onClick={() => setViewMode("list")}
                className={`px-3 py-1 text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                List
              </button>
              <button
                onClick={() => setViewMode("graph")}
                className={`px-3 py-1 text-xs transition-colors ${
                  viewMode === "graph"
                    ? "bg-violet-600 text-white"
                    : "text-zinc-400 hover:text-zinc-300"
                }`}
              >
                Graph
              </button>
            </div>
          </div>
```

Then wrap the existing tabs + connection list + action buttons in a conditional:

```typescript
          {viewMode === "list" ? (
            <>
              {/* EXISTING: tabs, connection list, action buttons — keep all existing code here */}
            </>
          ) : (
            <InfluenceGraph
              artist={props.artist}
              connections={connections}
              isPro={false} // TODO: pass from user context
            />
          )}
```

Note: The implementer should read the full InfluenceChain component and wrap the existing content (tabs, connection list, action bar) inside the `viewMode === "list"` branch. Do NOT rewrite the existing list code — just wrap it.

- [ ] **Step 3: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 4: Test manually**

Run `npm run dev`, navigate to the app, run `/influence Massive Attack`. Verify:
1. List/Graph toggle appears above the tabs
2. "List" mode shows existing Roots/Built/Legacy tabs (unchanged)
3. "Graph" mode shows the force-directed graph with nodes
4. Clicking a node in graph mode shows the detail panel (desktop) or bottom sheet (mobile)

- [ ] **Step 5: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: add List/Graph view toggle to InfluenceChain component"
```

---

### Task 6: Update `/influence` prompt for batch tool

**Files:**
- Modify: `src/lib/chat-utils.ts`

- [ ] **Step 1: Update the /influence case**

The `/influence` prompt was already partially updated earlier in this session. Replace the Phase 2 section to reference `research_influences_batch` instead of individual calls. In `src/lib/chat-utils.ts`, in the `case "influence":` block, change the enrichment phase:

Find this text:
```
`PHASE 2 — ENRICH (max 3 tool calls total, NOT per-connection):`,
`Call research_influence for the TOP 3 connections only.`,
`For the remaining connections (4-10), use the data you already have from Phase 1.`,
`DO NOT call research_influence for every single connection — you will run out of turns.`,
```

Replace with:
```
`PHASE 2 — ENRICH (1 tool call):`,
`Call research_influences_batch("${arg}", [top 3-5 connection names])`,
`This fires parallel Perplexity calls and returns all results in one tool response.`,
`DO NOT call research_influence individually — use the batch tool instead.`,
```

Also verify that the prompt already contains the budget awareness rule: "If you've used 30+ tool calls, STOP researching and OUTPUT NOW with the data you have." If not present, add it to the RULES section at the bottom of the `/influence` prompt.

- [ ] **Step 2: Verify build**

```bash
npx next build 2>&1 | tail -5
```

Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/lib/chat-utils.ts
git commit -m "feat: update /influence prompt to use research_influences_batch tool"
```

---

### Task 7: Smoke test and verify end-to-end

**Files:** None (testing only)

- [ ] **Step 1: Run full build**

```bash
npx next build
```

Expected: Build succeeds with no errors

- [ ] **Step 2: Start dev server and test `/influence`**

```bash
npm run dev
```

Test the following in the app:
1. Run `/influence Massive Attack` — verify InfluenceChain renders with List/Graph toggle
2. Click "Graph" — verify force-directed graph appears with nodes
3. Click a node — verify detail panel (desktop) or bottom sheet (mobile) appears
4. Click "Explore →" — verify graph refocuses with breadcrumb
5. Click "← Back" — verify breadcrumb pops and view returns
6. Click "Deep Dive" — verify chat input gets `/artist [name]` injected
7. Run `/influence Nellee Hooper` — verify connections appear (not empty)

- [ ] **Step 3: Test the expand endpoint directly**

```bash
curl -X POST http://localhost:3000/api/influence/expand \
  -H "Content-Type: application/json" \
  -d '{"artist":"Bjork","tier":"free"}'
```

Expected: Returns JSON with `connections` array (may be empty if no Convex user for curl, but should not error)

- [ ] **Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address smoke test findings"
```
