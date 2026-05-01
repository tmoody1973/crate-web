"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { usePlayer } from "@/components/player/player-provider";
import { Id } from "../../../convex/_generated/dataModel";

function PlaylistTracks({ playlistId }: { playlistId: Id<"playlists"> }) {
  const tracks = useQuery(api.playlists.getTracks, { playlistId });
  const { play } = usePlayer();
  const [loadingTrack, setLoadingTrack] = useState<string | null>(null);

  const handlePlay = async (title: string, artist: string) => {
    const key = `${title}-${artist}`;
    setLoadingTrack(key);
    try {
      const res = await fetch(
        `/api/youtube?q=${encodeURIComponent(`${title} ${artist}`)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      play({
        title,
        artist,
        source: "youtube",
        sourceId: data.videoId,
        imageUrl: data.thumbnail,
      });
    } finally {
      setLoadingTrack(null);
    }
  };

  if (!tracks) return null;

  return (
    <div className="ml-5 space-y-0.5 py-1">
      {tracks.map((t) => {
        const key = `${t.title}-${t.artist}`;
        const isLoading = loadingTrack === key;
        return (
          <div
            key={t._id}
            className="group flex items-center gap-1.5 rounded px-1 py-0.5 text-[11px] text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300"
          >
            <button
              onClick={() => handlePlay(t.title, t.artist)}
              disabled={isLoading}
              className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:text-white disabled:opacity-50"
            >
              {isLoading ? (
                <span className="h-2 w-2 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
              ) : (
                <span className="text-[9px]">▶</span>
              )}
            </button>
            <span className="truncate">{t.title}</span>
            <span className="shrink-0 text-zinc-600">·</span>
            <span className="truncate text-zinc-600">{t.artist}</span>
          </div>
        );
      })}
    </div>
  );
}

export function PlaylistsSection() {
  const [expanded, setExpanded] = useState(true);
  const [expandedPlaylist, setExpandedPlaylist] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const playlists = useQuery(api.playlists.list, user ? { userId: user._id } : "skip");
  const createPlaylist = useMutation(api.playlists.create);
  const removePlaylist = useMutation(api.playlists.remove);
  const removeAll = useMutation(api.playlists.removeAll);

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    await createPlaylist({ userId: user._id, name: newName.trim() });
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        <span>Playlists</span>
        <div className="flex items-center gap-1">
          {expanded && playlists && playlists.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (user && confirm(`Delete all ${playlists.length} playlists?`)) {
                  removeAll({ userId: user._id });
                  setExpandedPlaylist(null);
                }
              }}
              className="cursor-pointer text-[10px] text-zinc-700 hover:text-red-400"
              title="Delete all playlists"
            >
              Clear
            </span>
          )}
          {expanded && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                setCreating(true);
              }}
              className="cursor-pointer text-zinc-600 hover:text-white"
              title="New playlist"
            >
              +
            </span>
          )}
          <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
        </div>
      </button>

      {expanded && (
        <div className="mt-1 space-y-0.5">
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="px-2 py-1"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  if (!newName.trim()) setCreating(false);
                }}
                placeholder="Playlist name..."
                className="w-full rounded bg-zinc-800 px-2 py-1 text-xs text-white placeholder-zinc-600 outline-none focus:ring-1 focus:ring-cyan-600"
              />
            </form>
          )}

          {playlists?.map((pl) => (
            <div key={pl._id}>
              <div
                className="group flex cursor-pointer items-center justify-between rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() =>
                  setExpandedPlaylist(
                    expandedPlaylist === pl._id ? null : pl._id,
                  )
                }
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className="text-[10px]">
                    {expandedPlaylist === pl._id ? "▼" : "►"}
                  </span>
                  <span className="truncate">{pl.name}</span>
                  <span className="shrink-0 text-[10px] text-zinc-600">
                    {pl.trackCount}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete "${pl.name}" and all its tracks?`)) {
                      removePlaylist({ id: pl._id });
                      if (expandedPlaylist === pl._id) setExpandedPlaylist(null);
                    }
                  }}
                  className="shrink-0 text-xs text-zinc-700 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  title="Delete playlist"
                >
                  ×
                </button>
              </div>
              {expandedPlaylist === pl._id && (
                <PlaylistTracks playlistId={pl._id} />
              )}
            </div>
          ))}

          {(!playlists || playlists.length === 0) && !creating && (
            <p className="px-2 text-[10px] text-zinc-600">No playlists yet</p>
          )}
        </div>
      )}
    </div>
  );
}
