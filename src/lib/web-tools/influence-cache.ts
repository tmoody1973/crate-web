/**
 * Web-specific influence cache tool handlers.
 * Uses Convex (via ConvexHttpClient) instead of SQLite for persistence.
 * Replaces crate-cli's influencecache server tools.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

// ── Tool result helpers ───────────────────────────────────────────

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
}

// ── Handlers ──────────────────────────────────────────────────────

export function createInfluenceCacheTools(
  convexUrl: string,
  userId: Id<"users">,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  const cacheInfluenceHandler = async (args: {
    from_artist: string;
    to_artist: string;
    relationship: string;
    weight: number;
    context?: string;
    source_type?: string;
    source_url?: string;
    source_name?: string;
    snippet?: string;
    from_genres?: string;
    to_genres?: string;
    from_image_url?: string;
    to_image_url?: string;
  }) => {
    try {
      const edgeId = await convex.mutation(api.influence.cacheEdge, {
        userId,
        fromName: args.from_artist,
        toName: args.to_artist,
        relationship: args.relationship,
        weight: args.weight,
        context: args.context,
        source: args.source_type
          ? {
              sourceType: args.source_type,
              sourceUrl: args.source_url,
              sourceName: args.source_name,
              snippet: args.snippet,
            }
          : undefined,
        fromGenres: args.from_genres,
        toGenres: args.to_genres,
        fromImageUrl: args.from_image_url,
        toImageUrl: args.to_image_url,
      });
      return toolResult({
        status: "cached",
        edgeId,
        from: args.from_artist,
        to: args.to_artist,
        relationship: args.relationship,
        weight: args.weight,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const cacheBatchInfluencesHandler = async (args: {
    edges: Array<{
      from_artist: string;
      to_artist: string;
      relationship: string;
      weight: number;
      context?: string;
      source_type?: string;
      source_url?: string;
      source_name?: string;
      snippet?: string;
    }>;
  }) => {
    try {
      const edgeIds = await convex.mutation(api.influence.cacheBatchEdges, {
        userId,
        edges: args.edges.map((e) => ({
          fromName: e.from_artist,
          toName: e.to_artist,
          relationship: e.relationship,
          weight: e.weight,
          context: e.context,
          source: e.source_type
            ? {
                sourceType: e.source_type,
                sourceUrl: e.source_url,
                sourceName: e.source_name,
                snippet: e.snippet,
              }
            : undefined,
        })),
      });
      return toolResult({
        status: "cached",
        count: edgeIds.length,
        edgeIds,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const lookupInfluencesHandler = async (args: {
    artist: string;
    direction?: "outgoing" | "incoming" | "both";
    relationship?: string;
    min_weight?: number;
  }) => {
    try {
      const result = await convex.query(api.influence.lookupInfluences, {
        userId,
        artist: args.artist,
        direction: args.direction,
        relationship: args.relationship,
        minWeight: args.min_weight,
      });
      return toolResult(result);
    } catch (error) {
      return toolError(error);
    }
  };

  const findCachedPathHandler = async (args: {
    from_artist: string;
    to_artist: string;
    max_depth?: number;
  }) => {
    try {
      const result = await convex.query(api.influence.findPath, {
        userId,
        fromArtist: args.from_artist,
        toArtist: args.to_artist,
        maxDepth: args.max_depth,
      });
      return toolResult(result);
    } catch (error) {
      return toolError(error);
    }
  };

  const searchCachedArtistsHandler = async (args: { query: string }) => {
    try {
      const results = await convex.query(api.influence.searchArtists, {
        userId,
        query: args.query,
      });
      return toolResult({ artists: results, count: results.length });
    } catch (error) {
      return toolError(error);
    }
  };

  const graphStatsHandler = async () => {
    try {
      const stats = await convex.query(api.influence.graphStats, { userId });
      return toolResult(stats);
    } catch (error) {
      return toolError(error);
    }
  };

  const removeEdgeHandler = async (args: { edge_id: string }) => {
    try {
      await convex.mutation(api.influence.removeEdge, {
        edgeId: args.edge_id as Id<"influenceEdges">,
      });
      return toolResult({ status: "removed", edgeId: args.edge_id });
    } catch (error) {
      return toolError(error);
    }
  };

  return [
    {
      name: "cache_influence",
      description:
        "Cache a discovered influence relationship between two artists. Upserts — keeps the higher weight if the edge already exists. Optionally attach a source citation.",
      inputSchema: {
        from_artist: z.string().describe("Source artist name (the influencer)"),
        to_artist: z.string().describe("Target artist name (the influenced)"),
        relationship: z
          .enum(["influenced", "co_mention", "collaboration", "sample", "similar", "bridge"])
          .describe("Type of relationship"),
        weight: z.number().min(0).max(1).describe("Confidence weight 0-1"),
        context: z.string().optional().describe("Brief explanation of the connection"),
        source_type: z
          .enum(["review", "lastfm", "musicbrainz", "genius", "wikipedia", "web_search"])
          .optional()
          .describe("Type of source that revealed this connection"),
        source_url: z.string().optional().describe("URL of the source"),
        source_name: z.string().optional().describe("Name of the source (e.g. publication name)"),
        snippet: z.string().optional().describe("Relevant excerpt from the source"),
        from_genres: z.string().optional().describe("Genres of the source artist"),
        to_genres: z.string().optional().describe("Genres of the target artist"),
        from_image_url: z.string().optional().describe("Image URL for the source artist"),
        to_image_url: z.string().optional().describe("Image URL for the target artist"),
      },
      handler: cacheInfluenceHandler,
    },
    {
      name: "cache_batch_influences",
      description:
        "Cache multiple influence relationships at once. More efficient than calling cache_influence repeatedly. Each edge is upserted independently.",
      inputSchema: {
        edges: z
          .array(
            z.object({
              from_artist: z.string().describe("Source artist name"),
              to_artist: z.string().describe("Target artist name"),
              relationship: z.string().describe("Relationship type"),
              weight: z.number().describe("Confidence weight 0-1"),
              context: z.string().optional().describe("Connection context"),
              source_type: z.string().optional().describe("Source type"),
              source_url: z.string().optional().describe("Source URL"),
              source_name: z.string().optional().describe("Source name"),
              snippet: z.string().optional().describe("Source snippet"),
            }),
          )
          .describe("Array of influence edges to cache"),
      },
      handler: cacheBatchInfluencesHandler,
    },
    {
      name: "lookup_influences",
      description:
        "Look up cached influence connections for an artist. Returns all known connections with weights, relationships, and source citations. Check this BEFORE running expensive research — the answer may already be cached.",
      inputSchema: {
        artist: z.string().describe("Artist name to look up"),
        direction: z
          .enum(["outgoing", "incoming", "both"])
          .optional()
          .describe("Filter by direction (default: both)"),
        relationship: z.string().optional().describe("Filter by relationship type"),
        min_weight: z.number().optional().describe("Minimum weight threshold (default: 0)"),
      },
      handler: lookupInfluencesHandler,
    },
    {
      name: "find_cached_path",
      description:
        "Find the shortest path between two artists in the cached influence graph using BFS. Useful for answering 'how are X and Y connected?' questions.",
      inputSchema: {
        from_artist: z.string().describe("Starting artist"),
        to_artist: z.string().describe("Target artist"),
        max_depth: z.number().optional().describe("Maximum path length (default: 4)"),
      },
      handler: findCachedPathHandler,
    },
    {
      name: "search_cached_artists",
      description:
        "Search for artists in the influence cache by name. Fuzzy substring match.",
      inputSchema: {
        query: z.string().describe("Search query (artist name or partial name)"),
      },
      handler: searchCachedArtistsHandler,
    },
    {
      name: "influence_graph_stats",
      description:
        "Get statistics about the user's influence graph: total artists, edges, and relationship type breakdown.",
      inputSchema: {},
      handler: graphStatsHandler,
    },
    {
      name: "remove_cached_edge",
      description:
        "Remove a specific influence edge from the cache. Also removes all associated sources.",
      inputSchema: {
        edge_id: z.string().describe("Edge ID to remove"),
      },
      handler: removeEdgeHandler,
    },
  ];
}
