"use client";

import { useState, useEffect, useRef } from "react";
import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { usePlayer } from "@/components/player/player-provider";

// ── JSON string preprocessor for OpenUI Lang ────────────────────
// OpenUI Lang passes complex props as JSON strings from positional args.
// This preprocessor auto-parses them so Zod can validate the actual structure.
function jsonPreprocess(val: unknown): unknown {
  if (typeof val === "string") {
    try {
      return JSON.parse(val);
    } catch {
      return val;
    }
  }
  return val;
}

// ── Shared image component with broken-URL fallback ─────────────

function SafeImage({ src, alt, className }: { src?: string; alt?: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return <img src={src} alt={alt ?? ""} className={className} onError={() => setBroken(true)} />;
}

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
        <SafeImage src={props.imageUrl} alt={props.name} className="h-16 w-16 rounded-full object-cover" />
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
      <SafeImage src={props.imageUrl} className="h-10 w-10 shrink-0 rounded object-cover" />
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
      <SafeImage src={props.imageUrl} className="h-8 w-8 shrink-0 rounded object-cover" />
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

// ── Show Prep Components ────────────────────────────────────────

export const TrackContextCard = defineComponent({
  name: "TrackContextCard",
  description:
    "Show prep context card for a single track — origin story, production notes, talk break suggestions, local tie-in, and audience relevance.",
  props: z.object({
    artist: z.string().describe("Artist name"),
    title: z.string().describe("Track title"),
    originStory: z.string().describe("2-3 sentence backstory of how this track came to be"),
    productionNotes: z.string().describe("Key production details — studio, producer, notable instruments"),
    connections: z.string().describe("Influences, samples, collaborations, genre lineage"),
    influenceChain: z.string().optional().describe("Musical lineage chain, e.g. 'Thai funk > Khruangbin > modern psych-soul'"),
    lesserKnownFact: z.string().describe("Detail listeners can't easily Google"),
    whyItMatters: z.string().describe("One sentence: why should the listener care about this right now?"),
    audienceRelevance: z.enum(["high", "medium", "low"]).describe("How well this track fits the station's audience"),
    localTieIn: z.string().optional().describe("Milwaukee-specific connection — upcoming shows, local artist tie-in"),
    pronunciationGuide: z.string().optional().describe("Pronunciation help for unfamiliar names"),
    imageUrl: z.string().optional().describe("Album art URL"),
  }),
  component: ({ props }) => {
    const [expanded, setExpanded] = useState(false);
    const relevanceColor = {
      high: "bg-green-500/20 text-green-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-zinc-500/20 text-zinc-400",
    }[props.audienceRelevance];

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-start gap-3">
          <SafeImage src={props.imageUrl} className="h-16 w-16 shrink-0 rounded object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PlayButton name={props.title} artist={props.artist} />
              <h3 className="font-bold text-white">{props.artist} — {props.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${relevanceColor}`}>
                {props.audienceRelevance}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-cyan-400">{props.whyItMatters}</p>
            {props.pronunciationGuide && (
              <p className="mt-0.5 text-xs italic text-zinc-500">{props.pronunciationGuide}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          {expanded ? "Hide details" : "Origin / Production / Connections"}
        </button>

        {expanded && (
          <div className="mt-2 space-y-3 border-t border-zinc-700 pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Origin Story</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.originStory}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Production Notes</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.productionNotes}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Connections</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.connections}</p>
            </div>
            {props.influenceChain && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Influence Chain</p>
                <p className="mt-0.5 text-sm text-zinc-300">{props.influenceChain}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Lesser-Known Fact</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.lesserKnownFact}</p>
            </div>
            {props.localTieIn && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Milwaukee Connection</p>
                <p className="mt-0.5 text-sm text-cyan-400/80">{props.localTieIn}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
});

export const TalkBreakCard = defineComponent({
  name: "TalkBreakCard",
  description:
    "Talk break card with short/medium/long variants. Type badge shows intro, back-announce, transition, or feature.",
  props: z.object({
    type: z.enum(["intro", "back-announce", "transition", "feature"]).describe("Break type"),
    beforeTrack: z.string().describe("Track playing before this break"),
    afterTrack: z.string().describe("Track playing after this break"),
    shortVersion: z.string().describe("10-15 second version — quick hook"),
    mediumVersion: z.string().describe("30-60 second version — fuller context"),
    longVersion: z.string().describe("60-120 second version — deep backstory"),
    keyPhrases: z.string().describe("Comma-separated key phrases to emphasize on air"),
    timingCue: z.string().optional().describe("e.g. 'Hit this before the vocal at 0:08'"),
    pronunciationGuide: z.string().optional().describe("Pronunciation help for names"),
  }),
  component: ({ props }) => {
    const [tab, setTab] = useState<"short" | "medium" | "long">("medium");
    const [copied, setCopied] = useState(false);

    const typeBadge = {
      intro: "bg-blue-500/20 text-blue-400",
      "back-announce": "bg-green-500/20 text-green-400",
      transition: "bg-purple-500/20 text-purple-400",
      feature: "bg-amber-500/20 text-amber-400",
    }[props.type];

    const content = { short: props.shortVersion, medium: props.mediumVersion, long: props.longVersion }[tab];

    const handleCopy = async () => {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge}`}>
              {props.type}
            </span>
            <span className="text-xs text-zinc-500">
              {props.beforeTrack} → {props.afterTrack}
            </span>
          </div>
          <button onClick={handleCopy} className="text-[10px] text-zinc-500 hover:text-white">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-2 flex gap-1">
          {(["short", "medium", "long"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 text-[10px] ${tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {t === "short" ? "15s" : t === "medium" ? "60s" : "120s"}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-zinc-300">{content}</p>

        {props.keyPhrases && (
          <div className="mt-2 flex flex-wrap gap-1">
            {props.keyPhrases.split(",").map((phrase) => (
              <span key={phrase.trim()} className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {phrase.trim()}
              </span>
            ))}
          </div>
        )}

        {props.timingCue && (
          <p className="mt-1 text-[10px] text-amber-400/70">{props.timingCue}</p>
        )}
        {props.pronunciationGuide && (
          <p className="mt-0.5 text-[10px] italic text-zinc-500">{props.pronunciationGuide}</p>
        )}
      </div>
    );
  },
});

export const SocialPostCard = defineComponent({
  name: "SocialPostCard",
  description:
    "Social media copy card with platform tabs (Instagram, X, Bluesky). Copy button per platform. Station-specific hashtags.",
  props: z.object({
    trackOrTopic: z.string().describe("Track name or topic this post is about"),
    instagram: z.string().describe("Instagram post copy"),
    twitter: z.string().describe("X/Twitter post copy"),
    bluesky: z.string().describe("Bluesky post copy"),
    hashtags: z.string().describe("Comma-separated hashtags"),
  }),
  component: ({ props }) => {
    const [tab, setTab] = useState<"instagram" | "twitter" | "bluesky">("instagram");
    const [copied, setCopied] = useState(false);

    const content = { instagram: props.instagram, twitter: props.twitter, bluesky: props.bluesky }[tab];

    const handleCopy = async () => {
      const hashtagStr = props.hashtags.split(",").map((h) => h.trim()).join(" ");
      await navigator.clipboard.writeText(`${content}\n\n${hashtagStr}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">{props.trackOrTopic}</span>
          <button onClick={handleCopy} className="text-[10px] text-zinc-500 hover:text-white">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-1.5 flex gap-1">
          {(["instagram", "twitter", "bluesky"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`rounded px-2 py-0.5 text-[10px] ${tab === p ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {p === "twitter" ? "X" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-zinc-300">{content}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {props.hashtags.split(",").map((tag) => (
            <span key={tag.trim()} className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-400">
              {tag.trim()}
            </span>
          ))}
        </div>
      </div>
    );
  },
});

export const InterviewPrepCard = defineComponent({
  name: "InterviewPrepCard",
  description:
    "Interview preparation card with warm-up, deep-dive, and local questions. Flags overasked questions to avoid.",
  props: z.object({
    guestName: z.string().describe("Guest artist or interviewee name"),
    warmUpQuestions: z.string().describe("Easy personality-revealing openers, one per line"),
    deepDiveQuestions: z.string().describe("Questions about craft, process, specific tracks, one per line"),
    localQuestions: z.string().describe("Milwaukee connection angles, one per line"),
    avoidQuestions: z.string().describe("Common overasked questions to skip, one per line"),
  }),
  component: ({ props }) => {
    const [section, setSection] = useState<"warmup" | "deep" | "local" | "avoid">("warmup");

    const renderQuestions = (text: string, color: string) => (
      <ul className="mt-2 space-y-1.5">
        {text.split("\n").filter(Boolean).map((q, i) => (
          <li key={i} className={`text-sm ${color}`}>{q.replace(/^[-•]\s*/, "")}</li>
        ))}
      </ul>
    );

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="font-bold text-white">Interview Prep: {props.guestName}</h3>

        <div className="mt-2 flex gap-1">
          {([
            ["warmup", "Warm-up"],
            ["deep", "Deep Dive"],
            ["local", "Milwaukee"],
            ["avoid", "Avoid"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                section === key
                  ? key === "avoid" ? "bg-red-900/30 text-red-400" : "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === "warmup" && renderQuestions(props.warmUpQuestions, "text-zinc-300")}
        {section === "deep" && renderQuestions(props.deepDiveQuestions, "text-zinc-300")}
        {section === "local" && renderQuestions(props.localQuestions, "text-cyan-400/80")}
        {section === "avoid" && renderQuestions(props.avoidQuestions, "text-red-400/70")}
      </div>
    );
  },
});

export const ShowPrepPackage = defineComponent({
  name: "ShowPrepPackage",
  description:
    "Top-level show prep container. Station badge, date, DJ name, shift. Children are TrackContextCards, TalkBreakCards, SocialPostCards, and optionally InterviewPrepCards.",
  props: z.object({
    station: z.string().describe("Station name: 88Nine, HYFIN, or Rhythm Lab"),
    date: z.string().describe("Show date, e.g. 'Wednesday, March 12'"),
    dj: z.string().describe("DJ name"),
    shift: z.string().describe("Shift: morning, midday, afternoon, evening, overnight"),
    tracks: z.array(TrackContextCard.ref).describe("Track context cards"),
    talkBreaks: z.array(TalkBreakCard.ref).describe("Talk break cards"),
    socialPosts: z.array(SocialPostCard.ref).describe("Social media post cards"),
    interviewPreps: z.array(InterviewPrepCard.ref).optional().describe("Interview prep cards (if guest mentioned)"),
    events: z.array(ConcertEvent.ref).optional().describe("Local concert/event cards"),
  }),
  component: ({ props, renderNode }) => {
    const stationColor: Record<string, string> = {
      "88Nine": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "HYFIN": "bg-amber-500/20 text-amber-400 border-amber-500/30",
      "Rhythm Lab": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    const colorClass = stationColor[props.station] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

    return (
      <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold ${colorClass}`}>
              {props.station}
            </span>
            <span className="ml-3 text-sm text-zinc-400">{props.shift} shift</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-white">{props.dj}</p>
            <p className="text-xs text-zinc-500">{props.date}</p>
          </div>
        </div>

        {props.tracks && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Track Context</h2>
            <div className="space-y-3">{renderNode(props.tracks)}</div>
          </div>
        )}

        {props.talkBreaks && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Talk Breaks</h2>
            <div className="space-y-3">{renderNode(props.talkBreaks)}</div>
          </div>
        )}

        {props.socialPosts && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Social Copy</h2>
            <div className="space-y-2">{renderNode(props.socialPosts)}</div>
          </div>
        )}

        {props.events && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Local Events</h2>
            <div className="space-y-2">{renderNode(props.events)}</div>
          </div>
        )}

        {props.interviewPreps && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Interview Prep</h2>
            <div className="space-y-3">{renderNode(props.interviewPreps)}</div>
          </div>
        )}
      </div>
    );
  },
});

// ── Influence Mapping Components (Workstream 4) ─────────────────

export const ReviewSourceCard = defineComponent({
  name: "ReviewSourceCard",
  description:
    "Displays a single review source with linked URL, publication badge, snippet, and extracted artist mentions.",
  props: z.object({
    publication: z.string().describe("Publication name, e.g. Pitchfork"),
    title: z.string().describe("Review/article title"),
    url: z.string().describe("Link to the review"),
    author: z.string().optional().describe("Author name"),
    date: z.string().optional().describe("Publication date"),
    snippet: z.string().describe("Excerpt from the review"),
    artistsMentioned: z.array(z.string()).describe("Artists mentioned in this review"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {props.publication}
      </span>
      <a
        href={props.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1 block text-sm font-semibold text-cyan-400 hover:underline"
      >
        {props.title}
      </a>
      {(props.author || props.date) && (
        <p className="mt-0.5 text-xs text-zinc-500">
          {[props.author, props.date].filter(Boolean).join(" · ")}
        </p>
      )}
      <p className="mt-2 text-sm text-zinc-300">{props.snippet}</p>
      {props.artistsMentioned.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {props.artistsMentioned.map((a) => (
            <span
              key={a}
              className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  ),
});

export const ArtistProfileCard = defineComponent({
  name: "ArtistProfileCard",
  description:
    "Enhanced artist card with influence summary — connection count and top influences with weight bars.",
  props: z.object({
    name: z.string().describe("Artist name"),
    genres: z.preprocess(jsonPreprocess, z.array(z.string())).describe("List of genres"),
    origin: z.string().optional().describe("City/country of origin"),
    activeYears: z.string().optional().describe("e.g. 1959–1991"),
    imageUrl: z.string().optional().describe("Artist photo URL"),
    influenceCount: z.preprocess(jsonPreprocess, z.number().optional()).describe("Total number of mapped influence connections"),
    topInfluences: z.preprocess(jsonPreprocess,
      z.array(
        z.object({
          name: z.string().describe("Influence artist name"),
          weight: z.number().describe("Influence weight 0–1"),
        }),
      ).optional(),
    ).describe("Top influences with weight scores"),
  }),
  component: ({ props }) => {
    const weightColor = (w: number) =>
      w > 0.7 ? "bg-green-500" : w >= 0.5 ? "bg-yellow-500" : "bg-zinc-500";

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-start gap-3">
          <SafeImage
            src={props.imageUrl}
            alt={props.name}
            className="h-16 w-16 rounded-full object-cover"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-white">{props.name}</h3>
            {props.origin && <p className="text-sm text-zinc-400">{props.origin}</p>}
            {props.activeYears && <p className="text-xs text-zinc-500">{props.activeYears}</p>}
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
            {props.influenceCount != null && (
              <p className="mt-1 text-xs text-zinc-500">
                {props.influenceCount} connections mapped
              </p>
            )}
          </div>
        </div>

        {props.topInfluences && props.topInfluences.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-zinc-700 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Top Influences
            </p>
            {props.topInfluences.map((inf) => (
              <div key={inf.name} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-xs text-zinc-300">{inf.name}</span>
                <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
                  <div
                    className={`h-1.5 rounded-full ${weightColor(inf.weight)}`}
                    style={{ width: `${Math.round(inf.weight * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] text-zinc-500">
                  {inf.weight.toFixed(1)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  },
});

export const InfluenceChain = defineComponent({
  name: "InfluenceChain",
  description:
    "Vertical timeline of influence connections for an artist — weight-colored dots, relationship tags, sources, and expandable detail per node.",
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
  }),
  component: ({ props }) => {
    const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

    const dotColor = (w: number) =>
      w > 0.7 ? "bg-green-500" : w >= 0.5 ? "bg-yellow-500" : "bg-zinc-500";

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <h2 className="mb-4 text-lg font-bold text-white">{props.artist} — Influence Chain</h2>

        <div className="relative ml-5">
          {/* Vertical connecting line */}
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-700" />

          <div className="space-y-4">
            {props.connections.map((conn, i) => {
              const isExpanded = expandedIndex === i;

              return (
                <div key={`${conn.name}-${i}`} className="relative pl-6">
                  {/* Weight-colored dot */}
                  <div
                    className={`absolute left-[-4px] top-2 h-2.5 w-2.5 rounded-full ${dotColor(conn.weight)} ring-2 ring-zinc-900`}
                  />

                  <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3">
                    <div className="flex items-center gap-2">
                      <SafeImage
                        src={conn.imageUrl}
                        alt={conn.name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-white">{conn.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                            {conn.relationship}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                              conn.weight > 0.7
                                ? "bg-green-500/20 text-green-400"
                                : conn.weight >= 0.5
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : "bg-zinc-500/20 text-zinc-400"
                            }`}
                          >
                            {conn.weight.toFixed(2)}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => setExpandedIndex(isExpanded ? null : i)}
                        className="shrink-0 text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        {isExpanded ? "Less" : "More"}
                      </button>
                    </div>

                    {isExpanded && (
                      <div className="mt-2 space-y-2 border-t border-zinc-700 pt-2">
                        <p className="text-sm text-zinc-300">{conn.context}</p>
                        {conn.sources.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {conn.sources.map((src) => (
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

export const InfluenceCard = defineComponent({
  name: "InfluenceCard",
  description:
    "Compact influence card — central artist with radial influence chips and source citations.",
  props: z.object({
    artist: z.string().describe("Central artist name"),
    genres: z.preprocess(jsonPreprocess, z.array(z.string())).describe("Artist genres"),
    imageUrl: z.string().optional().describe("Central artist image URL"),
    influences: z.preprocess(jsonPreprocess, z.array(
      z.object({
        name: z.string().describe("Influence name"),
        weight: z.number().describe("Influence weight 0–1"),
        imageUrl: z.string().optional().describe("Influence artist image URL"),
      }),
    )).describe("Influence connections"),
    sources: z.preprocess(jsonPreprocess, z.array(
      z.object({
        name: z.string().describe("Source name"),
        url: z.string().describe("Source URL"),
        snippet: z.string().describe("Brief excerpt from the source"),
      }),
    )).describe("Citation sources"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      {/* Central artist */}
      <div className="flex items-center gap-3">
        <SafeImage
          src={props.imageUrl}
          alt={props.artist}
          className="h-14 w-14 rounded-full object-cover"
        />
        <div>
          <h3 className="text-lg font-bold text-white">{props.artist}</h3>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {props.genres.map((g) => (
              <span
                key={g}
                className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300"
              >
                {g}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Influence chips */}
      {props.influences.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.influences.map((inf) => (
            <div
              key={inf.name}
              className="flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/50 py-1 pl-1 pr-2.5"
            >
              <SafeImage
                src={inf.imageUrl}
                alt={inf.name}
                className="h-6 w-6 rounded-full object-cover"
              />
              <span className="text-xs text-zinc-300">{inf.name}</span>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${
                  inf.weight > 0.7
                    ? "bg-green-500/20 text-green-400"
                    : inf.weight >= 0.5
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-zinc-500/20 text-zinc-400"
                }`}
              >
                {inf.weight.toFixed(1)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Sources */}
      {props.sources.length > 0 && (
        <div className="mt-3 space-y-1.5 border-t border-zinc-700 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sources</p>
          {props.sources.map((src) => (
            <div key={src.url} className="text-xs">
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-400 hover:underline"
              >
                {src.name}
              </a>
              <p className="mt-0.5 text-zinc-400">{src.snippet}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  ),
});

export const InfluencePathTrace = defineComponent({
  name: "InfluencePathTrace",
  description:
    "Horizontal chain showing the shortest influence path between two artists, with evidence cards for each hop.",
  props: z.object({
    fromArtist: z.string().describe("Starting artist"),
    toArtist: z.string().describe("Ending artist"),
    path: z.preprocess(jsonPreprocess, z.array(
      z.object({
        artist: z.string().describe("Artist name at this node"),
        imageUrl: z.string().optional().describe("Artist image URL"),
      }),
    )).describe("Ordered list of artists in the path"),
    hops: z.preprocess(jsonPreprocess, z.array(
      z.object({
        from: z.string().describe("Source artist"),
        to: z.string().describe("Target artist"),
        relationship: z.string().describe("Relationship type"),
        weight: z.number().describe("Connection weight 0–1"),
        evidence: z.string().describe("Evidence text for this hop"),
      }),
    )).describe("Evidence for each hop in the path"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="mb-4 text-lg font-bold text-white">
        {props.fromArtist} → {props.toArtist}
      </h2>

      {/* Horizontal path chain */}
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {props.path.map((node, i) => (
          <div key={`${node.artist}-${i}`} className="flex items-center gap-1">
            <div className="flex flex-col items-center gap-1">
              <SafeImage
                src={node.imageUrl}
                alt={node.artist}
                className="h-10 w-10 rounded-full object-cover"
              />
              <span className="max-w-[80px] truncate text-center text-[10px] text-zinc-300">
                {node.artist}
              </span>
            </div>
            {i < props.path.length - 1 && (
              <span className="mx-1 text-zinc-600">→</span>
            )}
          </div>
        ))}
      </div>

      {/* Evidence cards */}
      {props.hops.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Evidence
          </p>
          {props.hops.map((hop, i) => (
            <div
              key={`${hop.from}-${hop.to}-${i}`}
              className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-white">
                  {hop.from} → {hop.to}
                </span>
                <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-[10px] text-zinc-300">
                  {hop.relationship}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
                  <div
                    className={`h-1.5 rounded-full ${
                      hop.weight > 0.7
                        ? "bg-green-500"
                        : hop.weight >= 0.5
                          ? "bg-yellow-500"
                          : "bg-zinc-500"
                    }`}
                    style={{ width: `${Math.round(hop.weight * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] text-zinc-500">
                  {hop.weight.toFixed(2)}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-zinc-400">{hop.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  ),
});
