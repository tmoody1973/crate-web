import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("playlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const findByName = query({
  args: { userId: v.id("users"), name: v.string() },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("playlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    return all.find(
      (p) => p.name.toLowerCase() === args.name.toLowerCase(),
    ) ?? null;
  },
});

export const getTracks = query({
  args: { playlistId: v.id("playlists") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist", (q) => q.eq("playlistId", args.playlistId))
      .collect();
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("playlists", {
      userId: args.userId,
      name: args.name,
      description: args.description,
      trackCount: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const addTrack = mutation({
  args: {
    playlistId: v.id("playlists"),
    title: v.string(),
    artist: v.string(),
    album: v.optional(v.string()),
    year: v.optional(v.string()),
    source: v.union(v.literal("youtube"), v.literal("bandcamp"), v.literal("unknown")),
    sourceId: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error("Playlist not found");

    const position = playlist.trackCount;
    await ctx.db.insert("playlistTracks", {
      playlistId: args.playlistId,
      title: args.title,
      artist: args.artist,
      album: args.album,
      year: args.year,
      source: args.source,
      sourceId: args.sourceId,
      imageUrl: args.imageUrl,
      position,
      addedAt: Date.now(),
    });

    await ctx.db.patch(args.playlistId, {
      trackCount: position + 1,
      updatedAt: Date.now(),
    });
  },
});

export const addMultipleTracks = mutation({
  args: {
    playlistId: v.id("playlists"),
    tracks: v.array(
      v.object({
        title: v.string(),
        artist: v.string(),
        album: v.optional(v.string()),
        year: v.optional(v.string()),
        imageUrl: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const playlist = await ctx.db.get(args.playlistId);
    if (!playlist) throw new Error("Playlist not found");

    let position = playlist.trackCount;
    for (const track of args.tracks) {
      await ctx.db.insert("playlistTracks", {
        playlistId: args.playlistId,
        title: track.title,
        artist: track.artist,
        album: track.album,
        year: track.year,
        imageUrl: track.imageUrl,
        source: "unknown",
        position,
        addedAt: Date.now(),
      });
      position++;
    }

    await ctx.db.patch(args.playlistId, {
      trackCount: position,
      updatedAt: Date.now(),
    });
  },
});

export const removeTrack = mutation({
  args: { trackId: v.id("playlistTracks") },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId);
    if (!track) return;

    await ctx.db.delete(args.trackId);

    const playlist = await ctx.db.get(track.playlistId);
    if (playlist) {
      await ctx.db.patch(track.playlistId, {
        trackCount: Math.max(0, playlist.trackCount - 1),
        updatedAt: Date.now(),
      });
    }
  },
});

export const rename = mutation({
  args: { id: v.id("playlists"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name, updatedAt: Date.now() });
  },
});

export const remove = mutation({
  args: { id: v.id("playlists") },
  handler: async (ctx, args) => {
    const tracks = await ctx.db
      .query("playlistTracks")
      .withIndex("by_playlist", (q) => q.eq("playlistId", args.id))
      .collect();
    for (const track of tracks) {
      await ctx.db.delete(track._id);
    }
    await ctx.db.delete(args.id);
  },
});

export const removeAll = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const playlists = await ctx.db
      .query("playlists")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const pl of playlists) {
      const tracks = await ctx.db
        .query("playlistTracks")
        .withIndex("by_playlist", (q) => q.eq("playlistId", pl._id))
        .collect();
      for (const track of tracks) {
        await ctx.db.delete(track._id);
      }
      await ctx.db.delete(pl._id);
    }
  },
});
