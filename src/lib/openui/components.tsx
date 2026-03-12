"use client";

import { useState, useEffect, useRef } from "react";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { usePlayer } from "@/components/player/player-provider";

// ── Crate Music Research Components ──────────────────────────────

export const ArtistCard = defineComponent({
  name: "ArtistCard",
  description:
    "Displays an artist with key metadata: name, genres, active years, origin.",
  props: z.object({
    name: z.string().describe("Artist name"),
    genres: z.array(z.string()).describe("List of genres"),
    activeYears: z.string().optional().describe("e.g. 1959–1991"),
    origin: z.string().optional().describe("City/country of origin"),
    imageUrl: z.string().optional().describe("Artist photo URL"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <div className="flex items-start gap-3">
        {props.imageUrl && (
          <img
            src={props.imageUrl}
            alt={props.name}
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <div>
          <h3 className="text-lg font-bold text-white">{props.name}</h3>
          {props.origin && (
            <p className="text-sm text-zinc-400">{props.origin}</p>
          )}
          {props.activeYears && (
            <p className="text-xs text-zinc-500">{props.activeYears}</p>
          )}
          <div className="mt-1 flex flex-wrap gap-1">
            {props.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  ),
});

export const ConcertEvent = defineComponent({
  name: "ConcertEvent",
  description: "A single concert/event entry with date, venue, and ticket info.",
  props: z.object({
    artist: z.string().describe("Performing artist or event name"),
    date: z.string().describe("Date string e.g. March 15, 2026"),
    time: z.string().optional().describe("e.g. 8:00 PM"),
    venue: z.string().describe("Venue name"),
    city: z.string().optional().describe("City"),
    priceRange: z.string().optional().describe("e.g. $45–$120"),
    status: z.string().optional().describe("e.g. On Sale, Sold Out"),
    ticketUrl: z.string().optional().describe("Link to buy tickets"),
  }),
  component: ({ props }) => (
    <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div>
        <p className="font-semibold text-white">{props.artist}</p>
        <p className="text-sm text-zinc-400">
          {props.venue}
          {props.city ? ` — ${props.city}` : ""}
        </p>
        <p className="text-xs text-zinc-500">
          {props.date}
          {props.time ? ` at ${props.time}` : ""}
        </p>
      </div>
      <div className="text-right">
        {props.priceRange && (
          <p className="text-sm text-zinc-300">{props.priceRange}</p>
        )}
        {props.status && (
          <span
            className={`text-xs ${props.status.toLowerCase().includes("sold") ? "text-red-400" : "text-green-400"}`}
          >
            {props.status}
          </span>
        )}
        {props.ticketUrl && (
          <a
            href={props.ticketUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block text-xs text-cyan-400 hover:underline"
          >
            Tickets
          </a>
        )}
      </div>
    </div>
  ),
});

export const ConcertList = defineComponent({
  name: "ConcertList",
  description:
    "A list of upcoming concerts/events, grouped by date or artist.",
  props: z.object({
    title: z.string().describe("Section title, e.g. 'Milwaukee Concerts This Week'"),
    events: z.array(ConcertEvent.ref).describe("List of concert events"),
  }),
  component: ({ props, renderNode }) => (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="text-lg font-bold text-white">{props.title}</h2>
      <div className="space-y-2">{renderNode(props.events)}</div>
    </div>
  ),
});

export const AlbumEntry = defineComponent({
  name: "AlbumEntry",
  description: "A single album with title, year, and optional label info.",
  props: z.object({
    title: z.string().describe("Album title"),
    year: z.string().optional().describe("Release year"),
    label: z.string().optional().describe("Record label"),
    format: z.string().optional().describe("e.g. LP, CD, Digital"),
    imageUrl: z.string().optional().describe("Album cover art URL"),
  }),
  component: ({ props }) => (
    <div className="flex items-center gap-3 border-b border-zinc-800 py-2">
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt=""
          className="h-10 w-10 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="font-medium text-white">{props.title}</p>
        <p className="text-xs text-zinc-500">
          {[props.year, props.label, props.format].filter(Boolean).join(" · ")}
        </p>
      </div>
    </div>
  ),
});

export const AlbumGrid = defineComponent({
  name: "AlbumGrid",
  description: "A discography grid showing an artist's albums.",
  props: z.object({
    artist: z.string().describe("Artist name"),
    albums: z.array(AlbumEntry.ref).describe("List of albums"),
  }),
  component: ({ props, renderNode }) => {
    const albumData = (props.albums ?? []).map((ref: unknown) => {
      const r = ref as { props?: { title?: string; year?: string; label?: string; format?: string; imageUrl?: string } };
      return {
        title: r?.props?.title ?? "",
        year: r?.props?.year,
        label: r?.props?.label,
        format: r?.props?.format,
        imageUrl: r?.props?.imageUrl,
      };
    });

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">
            {props.artist} — Discography
          </h2>
          <SaveToCollectionButton artist={props.artist} albums={albumData} />
        </div>
        <div>{renderNode(props.albums)}</div>
      </div>
    );
  },
});

export const SampleConnection = defineComponent({
  name: "SampleConnection",
  description:
    "Shows a sampling relationship: which track sampled which, with year and element.",
  props: z.object({
    originalTrack: z.string().describe("Original track that was sampled"),
    originalArtist: z.string().describe("Original artist"),
    sampledBy: z.string().describe("Track that used the sample"),
    sampledByArtist: z.string().describe("Artist who sampled it"),
    year: z.string().optional().describe("Year of the sample usage"),
    element: z.string().optional().describe("What was sampled, e.g. 'drum break', 'bass line'"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="text-zinc-300">
          {props.originalArtist} — {props.originalTrack}
        </span>
        <span className="text-zinc-600">→</span>
        <span className="text-white">
          {props.sampledByArtist} — {props.sampledBy}
        </span>
      </div>
      <div className="mt-1 flex gap-2 text-xs text-zinc-500">
        {props.year && <span>{props.year}</span>}
        {props.element && <span>· {props.element}</span>}
      </div>
    </div>
  ),
});

export const SampleTree = defineComponent({
  name: "SampleTree",
  description:
    "A collection of sampling connections showing how tracks are related through samples.",
  props: z.object({
    title: z.string().describe("e.g. 'Amen Break Sample Tree'"),
    connections: z.array(SampleConnection.ref).describe("List of sample connections"),
  }),
  component: ({ props, renderNode }) => (
    <div className="space-y-2 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="text-lg font-bold text-white">{props.title}</h2>
      <div className="space-y-2">{renderNode(props.connections)}</div>
    </div>
  ),
});

function SaveToCollectionButton({
  artist,
  albums,
}: {
  artist: string;
  albums: Array<{ title: string; year?: string; label?: string; format?: string; imageUrl?: string }>;
}) {
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const addMultiple = useMutation(api.collection.addMultiple);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || saving) return;
    setSaving(true);
    try {
      await addMultiple({
        userId: user._id,
        items: albums.map((a) => ({
          title: a.title,
          artist,
          label: a.label,
          year: a.year,
          format: a.format,
          imageUrl: a.imageUrl,
        })),
      });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return <span className="text-xs text-green-500">✓ Added</span>;
  }

  return (
    <button
      onClick={handleSave}
      disabled={saving || !user}
      className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400 transition hover:bg-zinc-700 hover:text-white disabled:opacity-50"
    >
      {saving ? "Adding..." : "Add to Collection"}
    </button>
  );
}

function PlayButton({ name, artist }: { name: string; artist: string }) {
  const { play } = usePlayer();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const handlePlay = async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch(
        `/api/youtube?q=${encodeURIComponent(`${name} ${artist}`)}`,
      );
      if (!res.ok) {
        setError(true);
        return;
      }
      const data = await res.json();
      play({
        title: name,
        artist,
        source: "youtube",
        sourceId: data.videoId,
        imageUrl: data.thumbnail,
      });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handlePlay}
      disabled={loading}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition disabled:opacity-50 ${
        error
          ? "text-red-400 hover:bg-red-900/30"
          : "text-zinc-500 hover:bg-zinc-700 hover:text-white"
      }`}
      title={error ? "Playback unavailable" : `Play ${name}`}
    >
      {loading ? (
        <span className="h-3 w-3 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
      ) : error ? (
        <span className="text-[10px]">!</span>
      ) : (
        <span className="text-xs">▶</span>
      )}
    </button>
  );
}

export const TrackItem = defineComponent({
  name: "TrackItem",
  description: "A single track in a playlist with play button.",
  props: z.object({
    name: z.string().describe("Track name"),
    artist: z.string().describe("Artist name"),
    album: z.string().optional().describe("Album name"),
    year: z.string().optional().describe("Release year"),
    imageUrl: z.string().optional().describe("Album art or thumbnail URL"),
  }),
  component: ({ props }) => (
    <div className="group flex items-center gap-2 border-b border-zinc-800 py-1.5">
      <PlayButton name={props.name} artist={props.artist} />
      {props.imageUrl && (
        <img
          src={props.imageUrl}
          alt=""
          className="h-8 w-8 shrink-0 rounded object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <span className="text-sm text-white">{props.name}</span>
        <span className="ml-2 text-xs text-zinc-500">{props.artist}</span>
      </div>
      {(props.album || props.year) && (
        <span className="shrink-0 text-xs text-zinc-600">
          {[props.album, props.year].filter(Boolean).join(" · ")}
        </span>
      )}
    </div>
  ),
});

function AutoSavePlaylist({
  title,
  tracks,
}: {
  title: string;
  tracks: Array<{ name: string; artist: string; album?: string; year?: string; imageUrl?: string }>;
}) {
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  // Check if playlist already exists — prevents duplicate creation on re-renders
  const existing = useQuery(
    api.playlists.findByName,
    user ? { userId: user._id, name: title } : "skip",
  );
  const createPlaylist = useMutation(api.playlists.create);
  const addTracks = useMutation(api.playlists.addMultipleTracks);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    // Wait for queries to resolve (existing is undefined while loading, null if not found)
    if (status !== "idle" || !user || tracks.length === 0 || existing === undefined) return;

    // Already exists — skip creating
    if (existing !== null) {
      setStatus("saved");
      return;
    }

    setStatus("saving");

    (async () => {
      try {
        const playlistId = await createPlaylist({
          userId: user._id,
          name: title,
        });
        await addTracks({
          playlistId,
          tracks: tracks.map((t) => ({
            title: t.name,
            artist: t.artist,
            album: t.album,
            year: t.year,
            imageUrl: t.imageUrl,
          })),
        });
        setStatus("saved");
      } catch {
        setStatus("error");
      }
    })();
  }, [user, tracks, title, status, existing, createPlaylist, addTracks]);

  if (status === "saving") {
    return <span className="text-xs text-zinc-500">Saving...</span>;
  }
  if (status === "saved") {
    return <span className="text-xs text-green-500">Saved to Playlists</span>;
  }
  if (status === "error") {
    return (
      <button
        onClick={() => setStatus("idle")}
        className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 transition hover:bg-zinc-700 hover:text-white"
      >
        Retry Save
      </button>
    );
  }
  return null;
}

function AddToExistingPlaylist({
  playlistName,
  tracks,
}: {
  playlistName: string;
  tracks: Array<{ name: string; artist: string; album?: string; year?: string; imageUrl?: string }>;
}) {
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const playlist = useQuery(
    api.playlists.findByName,
    user ? { userId: user._id, name: playlistName } : "skip",
  );
  const addTracks = useMutation(api.playlists.addMultipleTracks);
  const [status, setStatus] = useState<"pending" | "saving" | "saved" | "error" | "not_found">("pending");
  const savedRef = useRef(false);

  useEffect(() => {
    if (savedRef.current || !user || !playlist || tracks.length === 0 || status !== "pending") return;
    savedRef.current = true;
    setStatus("saving");

    (async () => {
      try {
        await addTracks({
          playlistId: playlist._id,
          tracks: tracks.map((t) => ({
            title: t.name,
            artist: t.artist,
            album: t.album,
            year: t.year,
            imageUrl: t.imageUrl,
          })),
        });
        setStatus("saved");
      } catch {
        setStatus("error");
        savedRef.current = false;
      }
    })();
  }, [user, playlist, tracks, status, addTracks]);

  // playlist query resolved to null — not found
  useEffect(() => {
    if (playlist === null && status === "pending") {
      setStatus("not_found");
    }
  }, [playlist, status]);

  if (status === "saving") return <span className="text-xs text-zinc-500">Adding to {playlistName}...</span>;
  if (status === "saved") return <span className="text-xs text-green-500">Added to {playlistName}</span>;
  if (status === "not_found") return <span className="text-xs text-yellow-400">Playlist &quot;{playlistName}&quot; not found</span>;
  if (status === "error") {
    return (
      <button onClick={() => setStatus("pending")} className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-red-400 hover:bg-zinc-700 hover:text-white">
        Retry
      </button>
    );
  }
  return null;
}

export const AddToPlaylist = defineComponent({
  name: "AddToPlaylist",
  description: "Adds tracks to an existing playlist by name. Use when user asks to add songs to a specific playlist.",
  props: z.object({
    playlistName: z.string().describe("Name of existing playlist to add to"),
    tracks: z.array(TrackItem.ref).describe("Tracks to add"),
  }),
  component: ({ props, renderNode }) => {
    const trackData = (props.tracks ?? []).map((ref: unknown) => {
      const r = ref as { props?: { name?: string; artist?: string; album?: string; year?: string; imageUrl?: string } };
      return {
        name: r?.props?.name ?? "",
        artist: r?.props?.artist ?? "",
        album: r?.props?.album,
        year: r?.props?.year,
        imageUrl: r?.props?.imageUrl,
      };
    });

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Adding to {props.playlistName}</h2>
          <AddToExistingPlaylist playlistName={props.playlistName} tracks={trackData} />
        </div>
        <div className="space-y-1">{renderNode(props.tracks)}</div>
      </div>
    );
  },
});

export const TrackList = defineComponent({
  name: "TrackList",
  description: "A playlist or track listing with playable tracks. Uses TrackItem children.",
  props: z.object({
    title: z.string().describe("Playlist or list title"),
    tracks: z.array(TrackItem.ref).describe("List of TrackItem references"),
  }),
  component: ({ props, renderNode }) => {
    // Extract track data from children for the save button
    const trackData = (props.tracks ?? []).map((ref: unknown) => {
      const r = ref as { props?: { name?: string; artist?: string; album?: string; year?: string; imageUrl?: string } };
      return {
        name: r?.props?.name ?? "",
        artist: r?.props?.artist ?? "",
        album: r?.props?.album,
        year: r?.props?.year,
        imageUrl: r?.props?.imageUrl,
      };
    });

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{props.title}</h2>
          <AutoSavePlaylist title={props.title} tracks={trackData} />
        </div>
        <div className="space-y-1">{renderNode(props.tracks)}</div>
      </div>
    );
  },
});
