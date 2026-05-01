/**
 * Types and helpers for the interactive influence graph.
 * Shared between InfluenceGraph component and the expand API endpoint.
 */

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
      expanded: true,
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
