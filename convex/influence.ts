import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// getOrCreateArtist - upsert artist by userId + nameLower
export const getOrCreateArtist = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    genres: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nameLower = args.name.toLowerCase().trim();
    const existing = await ctx.db
      .query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
      .first();
    if (existing) {
      // Update image/genres if provided and missing
      if ((args.imageUrl && !existing.imageUrl) || (args.genres && !existing.genres)) {
        await ctx.db.patch(existing._id, {
          ...(args.imageUrl && !existing.imageUrl ? { imageUrl: args.imageUrl } : {}),
          ...(args.genres && !existing.genres ? { genres: args.genres } : {}),
        });
      }
      return existing._id;
    }
    return await ctx.db.insert("influenceArtists", {
      userId: args.userId,
      name: args.name,
      nameLower,
      genres: args.genres,
      imageUrl: args.imageUrl,
      createdAt: Date.now(),
    });
  },
});

// cacheEdge - upsert edge between two artists (keep max weight)
export const cacheEdge = mutation({
  args: {
    userId: v.id("users"),
    fromName: v.string(),
    toName: v.string(),
    relationship: v.string(),
    weight: v.number(),
    context: v.optional(v.string()),
    source: v.optional(v.object({
      sourceType: v.string(),
      sourceUrl: v.optional(v.string()),
      sourceName: v.optional(v.string()),
      snippet: v.optional(v.string()),
    })),
    fromGenres: v.optional(v.string()),
    toGenres: v.optional(v.string()),
    fromImageUrl: v.optional(v.string()),
    toImageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Get or create both artists
    // (inline the getOrCreateArtist logic to avoid action overhead)
    const getOrCreate = async (name: string, genres?: string, imageUrl?: string) => {
      const nameLower = name.toLowerCase().trim();
      const existing = await ctx.db
        .query("influenceArtists")
        .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
        .first();
      if (existing) {
        if ((imageUrl && !existing.imageUrl) || (genres && !existing.genres)) {
          await ctx.db.patch(existing._id, {
            ...(imageUrl && !existing.imageUrl ? { imageUrl } : {}),
            ...(genres && !existing.genres ? { genres } : {}),
          });
        }
        return existing._id;
      }
      return await ctx.db.insert("influenceArtists", {
        userId: args.userId, name, nameLower, genres, imageUrl, createdAt: Date.now(),
      });
    };

    const fromId = await getOrCreate(args.fromName, args.fromGenres, args.fromImageUrl);
    const toId = await getOrCreate(args.toName, args.toGenres, args.toImageUrl);

    // Check for existing edge
    const existingEdge = await ctx.db
      .query("influenceEdges")
      .withIndex("by_from", (q) => q.eq("userId", args.userId).eq("fromArtistId", fromId))
      .filter((q) => q.eq(q.field("toArtistId"), toId))
      .first();

    const now = Date.now();

    if (existingEdge) {
      // Always increment mentionCount
      const currentMentionCount = existingEdge.mentionCount ?? 1;
      await ctx.db.patch(existingEdge._id, {
        mentionCount: currentMentionCount + 1,
        // only update weight if new weight is higher
        ...(args.weight > existingEdge.weight ? {
          weight: args.weight,
          relationship: args.relationship,
          context: args.context ?? existingEdge.context,
        } : {}),
        updatedAt: now,
      });
      // Add source if provided
      if (args.source) {
        await ctx.db.insert("influenceEdgeSources", {
          edgeId: existingEdge._id,
          ...args.source,
          discoveredAt: now,
        });
      }
      return existingEdge._id;
    }

    // Create new edge
    const edgeId = await ctx.db.insert("influenceEdges", {
      userId: args.userId,
      fromArtistId: fromId,
      toArtistId: toId,
      relationship: args.relationship,
      weight: args.weight,
      mentionCount: 1,
      context: args.context,
      createdAt: now,
      updatedAt: now,
    });

    if (args.source) {
      await ctx.db.insert("influenceEdgeSources", {
        edgeId,
        ...args.source,
        discoveredAt: now,
      });
    }

    return edgeId;
  },
});

// cacheBatchEdges - batch upsert
export const cacheBatchEdges = mutation({
  args: {
    userId: v.id("users"),
    edges: v.array(v.object({
      fromName: v.string(),
      toName: v.string(),
      relationship: v.string(),
      weight: v.number(),
      context: v.optional(v.string()),
      source: v.optional(v.object({
        sourceType: v.string(),
        sourceUrl: v.optional(v.string()),
        sourceName: v.optional(v.string()),
        snippet: v.optional(v.string()),
      })),
    })),
  },
  handler: async (ctx, args) => {
    // Process edges inline (same getOrCreate logic)
    const getOrCreate = async (name: string) => {
      const nameLower = name.toLowerCase().trim();
      const existing = await ctx.db
        .query("influenceArtists")
        .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
        .first();
      if (existing) return existing._id;
      return await ctx.db.insert("influenceArtists", {
        userId: args.userId, name, nameLower, createdAt: Date.now(),
      });
    };

    const results = [];
    for (const edge of args.edges) {
      const fromId = await getOrCreate(edge.fromName);
      const toId = await getOrCreate(edge.toName);
      const now = Date.now();

      const existing = await ctx.db
        .query("influenceEdges")
        .withIndex("by_from", (q) => q.eq("userId", args.userId).eq("fromArtistId", fromId))
        .filter((q) => q.eq(q.field("toArtistId"), toId))
        .first();

      if (existing) {
        const currentMentionCount = existing.mentionCount ?? 1;
        await ctx.db.patch(existing._id, {
          mentionCount: currentMentionCount + 1,
          ...(edge.weight > existing.weight ? {
            weight: edge.weight,
            relationship: edge.relationship,
            context: edge.context ?? existing.context,
          } : {}),
          updatedAt: now,
        });
        if (edge.source) {
          await ctx.db.insert("influenceEdgeSources", { edgeId: existing._id, ...edge.source, discoveredAt: now });
        }
        results.push(existing._id);
      } else {
        const edgeId = await ctx.db.insert("influenceEdges", {
          userId: args.userId, fromArtistId: fromId, toArtistId: toId,
          relationship: edge.relationship, weight: edge.weight, mentionCount: 1,
          context: edge.context, createdAt: now, updatedAt: now,
        });
        if (edge.source) {
          await ctx.db.insert("influenceEdgeSources", { edgeId, ...edge.source, discoveredAt: now });
        }
        results.push(edgeId);
      }
    }
    return results;
  },
});

// lookupInfluences - query connections for an artist
export const lookupInfluences = query({
  args: {
    userId: v.id("users"),
    artist: v.string(),
    direction: v.optional(v.union(v.literal("outgoing"), v.literal("incoming"), v.literal("both"))),
    relationship: v.optional(v.string()),
    minWeight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const nameLower = args.artist.toLowerCase().trim();
    const artistRecord = await ctx.db
      .query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
      .first();
    if (!artistRecord) return { artist: args.artist, connections: [], cached: false };

    const direction = args.direction ?? "both";
    const minWeight = args.minWeight ?? 0;
    const connections: Array<{
      direction: "outgoing" | "incoming";
      artist: string;
      genres?: string;
      imageUrl?: string;
      relationship: string;
      weight: number;
      mentionCount: number;
      context?: string;
      sources: Array<{ type: string; url?: string; name?: string; snippet?: string }>;
      sourceCount: number;
    }> = [];

    if (direction === "outgoing" || direction === "both") {
      const outgoing = await ctx.db
        .query("influenceEdges")
        .withIndex("by_from", (q) => q.eq("userId", args.userId).eq("fromArtistId", artistRecord._id))
        .collect();
      for (const edge of outgoing) {
        if (edge.weight < minWeight) continue;
        if (args.relationship && edge.relationship !== args.relationship) continue;
        const target = await ctx.db.get(edge.toArtistId);
        if (!target) continue;
        const sources = await ctx.db.query("influenceEdgeSources").withIndex("by_edge", (q) => q.eq("edgeId", edge._id)).collect();
        connections.push({
          direction: "outgoing" as const,
          artist: target.name,
          genres: target.genres,
          imageUrl: target.imageUrl,
          relationship: edge.relationship,
          weight: edge.weight,
          mentionCount: edge.mentionCount ?? 1,
          context: edge.context,
          sources: sources.map((s) => ({ type: s.sourceType, url: s.sourceUrl, name: s.sourceName, snippet: s.snippet })),
          sourceCount: sources.length,
        });
      }
    }

    if (direction === "incoming" || direction === "both") {
      const incoming = await ctx.db
        .query("influenceEdges")
        .withIndex("by_to", (q) => q.eq("userId", args.userId).eq("toArtistId", artistRecord._id))
        .collect();
      for (const edge of incoming) {
        if (edge.weight < minWeight) continue;
        if (args.relationship && edge.relationship !== args.relationship) continue;
        const source = await ctx.db.get(edge.fromArtistId);
        if (!source) continue;
        const sources = await ctx.db.query("influenceEdgeSources").withIndex("by_edge", (q) => q.eq("edgeId", edge._id)).collect();
        connections.push({
          direction: "incoming" as const,
          artist: source.name,
          genres: source.genres,
          imageUrl: source.imageUrl,
          relationship: edge.relationship,
          weight: edge.weight,
          mentionCount: edge.mentionCount ?? 1,
          context: edge.context,
          sources: sources.map((s) => ({ type: s.sourceType, url: s.sourceUrl, name: s.sourceName, snippet: s.snippet })),
          sourceCount: sources.length,
        });
      }
    }

    // Sort by weight descending
    connections.sort((a, b) => b.weight - a.weight);

    return {
      artist: args.artist,
      artistId: artistRecord._id,
      genres: artistRecord.genres,
      imageUrl: artistRecord.imageUrl,
      connections,
      cached: true,
    };
  },
});

// findPath - BFS pathfinding between two artists (JS-side, max depth)
export const findPath = query({
  args: {
    userId: v.id("users"),
    fromArtist: v.string(),
    toArtist: v.string(),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxDepth = args.maxDepth ?? 4;
    const fromLower = args.fromArtist.toLowerCase().trim();
    const toLower = args.toArtist.toLowerCase().trim();

    const fromRecord = await ctx.db.query("influenceArtists").withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", fromLower)).first();
    const toRecord = await ctx.db.query("influenceArtists").withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", toLower)).first();

    if (!fromRecord || !toRecord) return { found: false, path: [], hops: [] };
    if (fromRecord._id === toRecord._id) return { found: true, path: [fromRecord.name], hops: [] };

    // BFS
    type QueueItem = { artistId: string; path: string[]; hops: Array<{ from: string; to: string; relationship: string; weight: number; context?: string }> };
    const queue: QueueItem[] = [{ artistId: fromRecord._id, path: [fromRecord.name], hops: [] }];
    const visited = new Set<string>([fromRecord._id]);

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current.path.length > maxDepth) continue;

      const edges = await ctx.db.query("influenceEdges")
        .withIndex("by_from", (q) => q.eq("userId", args.userId).eq("fromArtistId", current.artistId as any))
        .collect();

      // Also check incoming edges
      const incomingEdges = await ctx.db.query("influenceEdges")
        .withIndex("by_to", (q) => q.eq("userId", args.userId).eq("toArtistId", current.artistId as any))
        .collect();

      const allEdges = [
        ...edges.map((e) => ({ neighborId: e.toArtistId, ...e })),
        ...incomingEdges.map((e) => ({ neighborId: e.fromArtistId, ...e })),
      ];

      for (const edge of allEdges) {
        if (visited.has(edge.neighborId)) continue;
        visited.add(edge.neighborId);

        const neighbor = await ctx.db.get(edge.neighborId);
        if (!neighbor) continue;

        const newPath = [...current.path, neighbor.name];
        const fromName = current.path[current.path.length - 1]!;
        const newHops = [...current.hops, {
          from: fromName,
          to: neighbor.name,
          relationship: edge.relationship,
          weight: edge.weight,
          context: edge.context,
        }];

        if (edge.neighborId === toRecord._id) {
          return { found: true, path: newPath, hops: newHops };
        }

        queue.push({ artistId: edge.neighborId, path: newPath, hops: newHops });
      }
    }

    return { found: false, path: [], hops: [] };
  },
});

// searchArtists - fuzzy search cached artists
export const searchArtists = query({
  args: {
    userId: v.id("users"),
    query: v.string(),
  },
  handler: async (ctx, args) => {
    const queryLower = args.query.toLowerCase().trim();
    // Get all user's artists and filter (no full-text search index on this table)
    const allArtists = await ctx.db.query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId))
      .collect();

    return allArtists
      .filter((a) => a.nameLower.includes(queryLower))
      .slice(0, 20)
      .map((a) => ({ id: a._id, name: a.name, genres: a.genres, imageUrl: a.imageUrl }));
  },
});

// graphStats - total artists, edges, sources
export const graphStats = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const artists = await ctx.db.query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId))
      .collect();
    const edges = await ctx.db.query("influenceEdges")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const relationshipCounts: Record<string, number> = {};
    for (const e of edges) {
      relationshipCounts[e.relationship] = (relationshipCounts[e.relationship] ?? 0) + 1;
    }

    return {
      totalArtists: artists.length,
      totalEdges: edges.length,
      relationships: relationshipCounts,
    };
  },
});

// removeEdge - delete edge and its sources
export const removeEdge = mutation({
  args: { edgeId: v.id("influenceEdges") },
  handler: async (ctx, args) => {
    const sources = await ctx.db.query("influenceEdgeSources")
      .withIndex("by_edge", (q) => q.eq("edgeId", args.edgeId))
      .collect();
    for (const source of sources) {
      await ctx.db.delete(source._id);
    }
    await ctx.db.delete(args.edgeId);
    return { deleted: true };
  },
});

// findPathDijkstra - Dijkstra's shortest path with paper's distance transform: d_ij = 1/(mentionCount + 1)
export const findPathDijkstra = query({
  args: {
    userId: v.id("users"),
    fromArtist: v.string(),
    toArtist: v.string(),
    maxDepth: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const maxDepth = args.maxDepth ?? 6;
    const fromLower = args.fromArtist.toLowerCase().trim();
    const toLower = args.toArtist.toLowerCase().trim();

    const fromRecord = await ctx.db.query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", fromLower)).first();
    const toRecord = await ctx.db.query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", toLower)).first();

    if (!fromRecord || !toRecord) return { found: false as const, path: [] as string[], hops: [] as Array<{ from: string; to: string; relationship: string; weight: number; mentionCount: number; context?: string; distance: number }>, totalDistance: 0 };
    if (fromRecord._id === toRecord._id) return { found: true as const, path: [fromRecord.name], hops: [] as Array<{ from: string; to: string; relationship: string; weight: number; mentionCount: number; context?: string; distance: number }>, totalDistance: 0 };

    // Dijkstra with distance = 1/(mentionCount + 1)
    const dist = new Map<string, number>();
    const prev = new Map<string, { artistId: string; edge: { relationship: string; weight: number; mentionCount: number; context?: string } }>();
    const visited = new Set<string>();

    // Priority queue (simple array-based for small graphs)
    const pq: Array<{ artistId: string; distance: number }> = [];

    dist.set(fromRecord._id, 0);
    pq.push({ artistId: fromRecord._id, distance: 0 });

    while (pq.length > 0) {
      // Find min distance
      pq.sort((a, b) => a.distance - b.distance);
      const current = pq.shift()!;

      if (visited.has(current.artistId)) continue;
      visited.add(current.artistId);

      if (current.artistId === toRecord._id) break;
      if (visited.size > maxDepth * 50) break; // Safety limit

      // Get outgoing edges
      const outgoing = await ctx.db.query("influenceEdges")
        .withIndex("by_from", (q) => q.eq("userId", args.userId).eq("fromArtistId", current.artistId as any))
        .collect();
      const incoming = await ctx.db.query("influenceEdges")
        .withIndex("by_to", (q) => q.eq("userId", args.userId).eq("toArtistId", current.artistId as any))
        .collect();

      const allEdges = [
        ...outgoing.map((e) => ({ neighborId: e.toArtistId, mentionCount: e.mentionCount ?? 1, relationship: e.relationship, weight: e.weight, context: e.context })),
        ...incoming.map((e) => ({ neighborId: e.fromArtistId, mentionCount: e.mentionCount ?? 1, relationship: e.relationship, weight: e.weight, context: e.context })),
      ];

      for (const edge of allEdges) {
        if (visited.has(edge.neighborId)) continue;
        // Paper's distance transform: d = 1/(mentionCount + 1)
        const edgeDistance = 1 / (edge.mentionCount + 1);
        const newDist = current.distance + edgeDistance;
        const currentDist = dist.get(edge.neighborId) ?? Infinity;

        if (newDist < currentDist) {
          dist.set(edge.neighborId, newDist);
          prev.set(edge.neighborId, {
            artistId: current.artistId,
            edge: { relationship: edge.relationship, weight: edge.weight, mentionCount: edge.mentionCount, context: edge.context },
          });
          pq.push({ artistId: edge.neighborId, distance: newDist });
        }
      }
    }

    // Reconstruct path
    if (!prev.has(toRecord._id)) return { found: false as const, path: [] as string[], hops: [] as Array<{ from: string; to: string; relationship: string; weight: number; mentionCount: number; context?: string; distance: number }>, totalDistance: 0 };

    const pathIds: string[] = [toRecord._id];
    const hops: Array<{ from: string; to: string; relationship: string; weight: number; mentionCount: number; context?: string; distance: number }> = [];

    let currentId: string = toRecord._id;
    while (prev.has(currentId)) {
      const { artistId, edge } = prev.get(currentId)!;
      pathIds.unshift(artistId);
      const fromArtist = await ctx.db.get(artistId as any);
      const toArtist = await ctx.db.get(currentId as any);
      hops.unshift({
        from: (fromArtist as any)?.name ?? "Unknown",
        to: (toArtist as any)?.name ?? "Unknown",
        relationship: edge.relationship,
        weight: edge.weight,
        mentionCount: edge.mentionCount,
        context: edge.context,
        distance: 1 / (edge.mentionCount + 1),
      });
      currentId = artistId;
    }

    // Get artist names for path
    const pathNames: string[] = [];
    for (const id of pathIds) {
      const artist = await ctx.db.get(id as any);
      pathNames.push((artist as any)?.name ?? "Unknown");
    }

    return {
      found: true as const,
      path: pathNames,
      hops,
      totalDistance: dist.get(toRecord._id) ?? 0,
    };
  },
});

// upsertTagProfile - store Last.fm tag vector for an artist
export const upsertTagProfile = mutation({
  args: {
    userId: v.id("users"),
    artistName: v.string(),
    tags: v.string(), // JSON string of tag weights
  },
  handler: async (ctx, args) => {
    const nameLower = args.artistName.toLowerCase().trim();
    const artist = await ctx.db.query("influenceArtists")
      .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
      .first();
    if (!artist) return null;

    const existing = await ctx.db.query("artistTagProfiles")
      .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { tags: args.tags, fetchedAt: Date.now() });
      return existing._id;
    }

    return await ctx.db.insert("artistTagProfiles", {
      userId: args.userId,
      artistId: artist._id,
      tags: args.tags,
      fetchedAt: Date.now(),
    });
  },
});

// getTagSimilarity - cosine similarity between two artists' Last.fm tag vectors
export const getTagSimilarity = query({
  args: {
    userId: v.id("users"),
    artist1: v.string(),
    artist2: v.string(),
  },
  handler: async (ctx, args) => {
    const get = async (name: string) => {
      const nameLower = name.toLowerCase().trim();
      const artist = await ctx.db.query("influenceArtists")
        .withIndex("by_user_name", (q) => q.eq("userId", args.userId).eq("nameLower", nameLower))
        .first();
      if (!artist) return null;
      const profile = await ctx.db.query("artistTagProfiles")
        .withIndex("by_artist", (q) => q.eq("artistId", artist._id))
        .first();
      return profile;
    };

    const p1 = await get(args.artist1);
    const p2 = await get(args.artist2);

    if (!p1 || !p2) return { similarity: null, reason: !p1 ? `No tag profile for ${args.artist1}` : `No tag profile for ${args.artist2}` };

    const tags1: Record<string, number> = JSON.parse(p1.tags);
    const tags2: Record<string, number> = JSON.parse(p2.tags);

    // Cosine similarity
    const allTags = new Set([...Object.keys(tags1), ...Object.keys(tags2)]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;
    for (const tag of allTags) {
      const v1 = tags1[tag] ?? 0;
      const v2 = tags2[tag] ?? 0;
      dotProduct += v1 * v2;
      norm1 += v1 * v1;
      norm2 += v2 * v2;
    }

    const similarity = norm1 === 0 || norm2 === 0 ? 0 : dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

    // Find shared and unique tags
    const shared = [...allTags].filter((t) => (tags1[t] ?? 0) > 0 && (tags2[t] ?? 0) > 0);

    return { similarity: Math.round(similarity * 1000) / 1000, sharedTags: shared, artist1Tags: Object.keys(tags1).length, artist2Tags: Object.keys(tags2).length };
  },
});
