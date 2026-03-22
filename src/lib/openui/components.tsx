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

// ── Runtime JSON parser for component props ─────────────────────
// The OpenUI Renderer bypasses Zod preprocessing — props arrive as raw strings.
// This helper safely parses JSON strings at render time.
function ensureArray<T>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === "string") {
    try { return JSON.parse(val) as T[]; } catch { return []; }
  }
  return [];
}

function ensureNumber(val: unknown, fallback = 0): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") { const n = parseFloat(val); return isNaN(n) ? fallback : n; }
  return fallback;
}

// ── Shared image component with broken-URL fallback ─────────────

function SafeImage({ src, alt, className }: { src?: string; alt?: string; className: string }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) return null;
  return <img src={src} alt={alt ?? ""} className={className} onError={() => setBroken(true)} />;
}

// ── Auto-fetch artist image from Spotify if missing ─────────────

function useAutoImage(name: string, existingUrl?: string): string | undefined {
  const [url, setUrl] = useState(existingUrl);
  useEffect(() => {
    if (existingUrl) { setUrl(existingUrl); return; }
    let cancelled = false;
    fetch(`/api/artwork?q=${encodeURIComponent(name)}&type=artist&source=spotify`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!cancelled && data?.results?.[0]?.image) setUrl(data.results[0].image);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [name, existingUrl]);
  return url;
}

// ── Crate Music Research Components ──────────────────────────────

export const ArtistCard = defineComponent({
  name: "ArtistCard",
  description:
    "Baseball-card style artist profile for DJs, producers, and music lovers. Includes hero image, real name, labels, key albums, collaborators, signature sound, influences, and a DJ talking point.",
  props: z.object({
    // Order MUST match the prompt signature: name, genres, activeYears, origin, imageUrl, realName, labels, keyAlbums, collaborators, knownFor, influences, influenced, djTalkingPoint, listenUrl
    name: z.string().describe("Artist/stage name"),
    genres: z.preprocess(jsonPreprocess, z.array(z.string())).describe("List of genres"),
    activeYears: z.string().optional().describe("e.g. 1974–2006"),
    origin: z.string().optional().describe("City/country of origin"),
    imageUrl: z.string().optional().describe("Artist photo URL"),
    realName: z.string().optional().describe("Birth/legal name e.g. James Dewitt Yancey"),
    labels: z.preprocess(jsonPreprocess, z.array(z.string()).optional()).describe("Record labels e.g. Stones Throw, MCA"),
    keyAlbums: z.preprocess(jsonPreprocess, z.array(z.object({
      title: z.string(),
      year: z.string().optional(),
    })).optional()).describe("Top 3-5 albums with year"),
    collaborators: z.preprocess(jsonPreprocess, z.array(z.string()).optional()).describe("Notable collaborators"),
    knownFor: z.string().optional().describe("Signature sound/style in one line e.g. Off-kilter swing, MPC chops, humanized drums"),
    influences: z.preprocess(jsonPreprocess, z.array(z.string()).optional()).describe("Key influences on this artist"),
    influenced: z.preprocess(jsonPreprocess, z.array(z.string()).optional()).describe("Artists this person influenced"),
    djTalkingPoint: z.string().optional().describe("One-liner fun fact or on-air talking point"),
    listenUrl: z.string().optional().describe("Spotify/streaming link"),
  }),
  component: ({ props }) => {
    const imageUrl = useAutoImage(props.name, props.imageUrl);
    const genres = ensureArray<string>(props.genres);
    const labels = ensureArray<string>(props.labels);
    const keyAlbums = ensureArray<{ title: string; year?: string }>(props.keyAlbums);
    const collaborators = ensureArray<string>(props.collaborators);
    const influences = ensureArray<string>(props.influences);
    const influenced = ensureArray<string>(props.influenced);

    return (
      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-zinc-900">
        {/* Hero banner */}
        <div className="relative h-36 w-full bg-gradient-to-br from-zinc-800 via-zinc-900 to-black">
          {imageUrl && (
            <img
              src={imageUrl}
              alt={props.name}
              className="absolute inset-0 h-full w-full object-cover opacity-40"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
          <div className="absolute bottom-0 left-0 flex items-end gap-3 p-4">
            {imageUrl && (
              <img
                src={imageUrl}
                alt={props.name}
                className="h-20 w-20 rounded-lg border-2 border-zinc-600 object-cover shadow-lg"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            )}
            <div className="pb-1">
              <h3 className="text-xl font-bold leading-tight text-white drop-shadow-md">{props.name}</h3>
              {props.realName && (
                <p className="text-xs text-zinc-400">{props.realName}</p>
              )}
              <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-400">
                {props.origin && <span>{props.origin}</span>}
                {props.origin && props.activeYears && <span className="text-zinc-600">|</span>}
                {props.activeYears && <span>{props.activeYears}</span>}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-4">
          {/* Genres */}
          <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
              <span key={g} className="rounded-full bg-zinc-800 px-2.5 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-zinc-700">
                {g}
              </span>
            ))}
          </div>

          {/* Signature sound */}
          {props.knownFor && (
            <div className="rounded-lg bg-zinc-800/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Known For</p>
              <p className="mt-0.5 text-sm text-zinc-200">{props.knownFor}</p>
            </div>
          )}

          {/* Stats row: labels + key albums side by side */}
          <div className="grid grid-cols-2 gap-3">
            {labels.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Labels</p>
                <p className="mt-0.5 text-xs text-zinc-300">{labels.join(" · ")}</p>
              </div>
            )}
            {keyAlbums.length > 0 && (
              <div className={labels.length === 0 ? "col-span-2" : ""}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Key Albums</p>
                <div className="mt-0.5 space-y-0.5">
                  {keyAlbums.slice(0, 5).map((a) => (
                    <p key={a.title} className="text-xs text-zinc-300">
                      {a.title}{a.year && <span className="ml-1 text-zinc-500">({a.year})</span>}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Collaborators */}
          {collaborators.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Collaborators</p>
              <p className="mt-0.5 text-xs text-zinc-300">{collaborators.join(" · ")}</p>
            </div>
          )}

          {/* Influence chain: who influenced them → who they influenced */}
          {(influences.length > 0 || influenced.length > 0) && (
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-zinc-800/40 p-3">
              {influences.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Influenced By</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {influences.slice(0, 6).map((a) => (
                      <span key={a} className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}
              {influenced.length > 0 && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Influenced</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {influenced.slice(0, 6).map((a) => (
                      <span key={a} className="rounded bg-zinc-700/60 px-1.5 py-0.5 text-[11px] text-zinc-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* DJ talking point */}
          {props.djTalkingPoint && (
            <div className="flex gap-2 rounded-lg border border-amber-900/30 bg-amber-950/20 px-3 py-2">
              <span className="mt-0.5 text-sm">🎙️</span>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-400/70">On-Air Talking Point</p>
                <p className="mt-0.5 text-sm text-zinc-200">{props.djTalkingPoint}</p>
              </div>
            </div>
          )}

          {/* Listen link — always show, auto-generate Spotify search URL if not provided */}
          {(() => {
            const url = props.listenUrl?.includes("spotify.com")
              ? props.listenUrl
              : `https://open.spotify.com/search/${encodeURIComponent(props.name)}`;
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-green-600/20 px-3 py-1 text-xs font-medium text-green-400 ring-1 ring-green-600/30 transition-colors hover:bg-green-600/30"
              >
                <span>▶</span> Listen on Spotify
              </a>
            );
          })()}
        </div>
      </div>
    );
  },
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
    url: z.string().optional().describe("Link to album on Bandcamp, Discogs, etc."),
  }),
  component: ({ props }) => {
    const titleEl = props.url ? (
      <a href={props.url} target="_blank" rel="noopener noreferrer" className="font-medium text-white hover:text-amber-400 transition-colors">
        {props.title}
      </a>
    ) : (
      <p className="font-medium text-white">{props.title}</p>
    );
    return (
      <div className="flex items-center gap-3 border-b border-zinc-800 py-2">
        <SafeImage src={props.imageUrl} className="h-10 w-10 shrink-0 rounded object-cover" />
        <div className="min-w-0 flex-1">
          {titleEl}
          <p className="text-xs text-zinc-500">
            {[props.year, props.label, props.format].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>
    );
  },
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
      const r = ref as { props?: { title?: string; year?: string; label?: string; format?: string; imageUrl?: string; url?: string } };
      return {
        title: r?.props?.title ?? "",
        year: r?.props?.year,
        label: r?.props?.label,
        format: r?.props?.format,
        imageUrl: r?.props?.imageUrl,
        url: r?.props?.url,
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
    url: z.string().optional().describe("Link to track on Bandcamp, Spotify, etc."),
  }),
  component: ({ props }) => (
    <div className="group flex items-center gap-2 border-b border-zinc-800 py-1.5">
      <PlayButton name={props.name} artist={props.artist} />
      <SafeImage src={props.imageUrl} className="h-8 w-8 shrink-0 rounded object-cover" />
      <div className="min-w-0 flex-1">
        {props.url ? (
          <a href={props.url} target="_blank" rel="noopener noreferrer" className="text-sm text-white hover:text-amber-400 transition-colors">{props.name}</a>
        ) : (
          <span className="text-sm text-white">{props.name}</span>
        )}
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

// ── Playlist cover art generator ─────────────────────────────────

function PlaylistCover({ title, trackSummary }: { title: string; trackSummary: string }) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const requested = useRef(false);

  useEffect(() => {
    if (requested.current || !title || !trackSummary) return;
    requested.current = true;
    setLoading(true);

    fetch("/api/generate-infographic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "playlist_cover",
        title,
        data: trackSummary,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.imageDataUrl) setCoverUrl(data.imageDataUrl);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [title, trackSummary]);

  if (error) return null;

  return (
    <div className="relative mb-3 aspect-square w-full max-w-[280px] overflow-hidden rounded-lg bg-zinc-800">
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-zinc-600 border-t-violet-400" />
            <span className="text-[10px] text-zinc-500">Generating cover art...</span>
          </div>
        </div>
      )}
      {coverUrl && (
        <img
          src={coverUrl}
          alt={`${title} playlist cover`}
          className="h-full w-full object-cover"
        />
      )}
    </div>
  );
}

export const TrackList = defineComponent({
  name: "TrackList",
  description: "A playlist or track listing with playable tracks and AI-generated cover art. Uses TrackItem children.",
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

    // Build a summary string for the cover art generator
    const trackSummary = trackData
      .slice(0, 10)
      .map((t) => `${t.artist} - ${t.name}`)
      .join(", ");

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">{props.title}</h2>
          <AutoSavePlaylist title={props.title} tracks={trackData} />
        </div>
        <PlaylistCover title={props.title} trackSummary={trackSummary} />
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
    const genres = ensureArray<string>(props.genres);
    const topInfluences = ensureArray<{ name: string; weight: number }>(props.topInfluences);
    const influenceCount = ensureNumber(props.influenceCount);

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
              {genres.map((g) => (
                <span
                  key={g}
                  className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs text-zinc-300"
                >
                  {g}
                </span>
              ))}
            </div>
            {influenceCount > 0 && (
              <p className="mt-1 text-xs text-zinc-500">
                {influenceCount} connections mapped
              </p>
            )}
          </div>
        </div>

        {topInfluences.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-zinc-700 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Top Influences
            </p>
            {topInfluences.map((inf) => {
              const w = ensureNumber(inf.weight);
              return (
              <div key={inf.name} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-xs text-zinc-300">{inf.name}</span>
                <div className="h-1.5 flex-1 rounded-full bg-zinc-700">
                  <div
                    className={`h-1.5 rounded-full ${weightColor(w)}`}
                    style={{ width: `${Math.round(w * 100)}%` }}
                  />
                </div>
                <span className="w-8 shrink-0 text-right text-[10px] text-zinc-500">
                  {w.toFixed(1)}
                </span>
              </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
});

// ── Influence grouping ──────────────────────────────────────────
type ParsedConnection = {
  name: string; weight: number; relationship: string;
  context: string; sources: unknown; imageUrl?: string;
  pullQuote?: string; pullQuoteAttribution?: string;
  sonicElements?: string[]; keyWorks?: string;
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
  for (const key of Object.keys(groups) as GroupKey[]) {
    groups[key].sort((a, b) => ensureNumber(b.weight) - ensureNumber(a.weight));
  }
  return groups;
}

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
            {/* Pull quote */}
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

function ArcNode({ name, imageUrl: initialUrl }: { name: string; imageUrl?: string }) {
  const imageUrl = useAutoImage(name, initialUrl);
  const [broken, setBroken] = useState(false);
  const showImage = imageUrl && !broken;
  return (
    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full bg-zinc-700">
      {showImage ? (
        <img src={imageUrl} alt={name} className="h-7 w-7 rounded-full object-cover" onError={() => setBroken(true)} />
      ) : (
        <span className="text-[9px] font-medium text-zinc-400">{name.charAt(0)}</span>
      )}
    </div>
  );
}

function buildLineageArc(
  artist: string,
  groups: Record<GroupKey, ParsedConnection[]>,
): Array<{ name: string; imageUrl?: string; isCentral?: boolean }> {
  const roots = groups.roots.slice(0, 2);
  const legacy = groups.legacy.slice(0, 2);
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

export const InfluenceChain = defineComponent({
  name: "InfluenceChain",
  description:
    "Narrative influence timeline — groups connections into Roots/Built With/Legacy tabs with a lineage arc header and auto-generated summary.",
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
              snippet: z.string().optional().describe("Text excerpt from the source"),
              date: z.string().optional().describe("Publication date"),
            }),
          ),
        ).describe("Citation sources for this connection"),
        imageUrl: z.string().optional().describe("Connected artist image URL"),
        pullQuote: z.string().optional().describe("Direct quote from artist or journalist about this influence"),
        pullQuoteAttribution: z.string().optional().describe("Quote attribution (e.g. 'Flying Lotus, Pitchfork, 2012')"),
        sonicElements: z.preprocess(jsonPreprocess, z.array(z.string())).optional().describe("Sonic/stylistic elements transmitted"),
        keyWorks: z.string().optional().describe("Album-to-album influence (e.g. 'Mothership Connection (1975) → Cosmogramma (2010)')"),
      }),
    )).describe("List of influence connections"),
    summary: z.string().optional().describe("Optional narrative summary, auto-generated if omitted"),
  }),
  component: ({ props }) => {
    const [toggledIds, setToggledIds] = useState<Set<string>>(new Set());
    const [activeTab, setActiveTab] = useState<GroupKey>("roots");
    const [fetchedImages, setFetchedImages] = useState<Record<string, string>>({});

    // Runtime parse
    const rawConnections = ensureArray<ParsedConnection>(props.connections);

    // Auto-fetch missing images from Spotify via artwork API
    useEffect(() => {
      const missing = rawConnections.filter(c => !c.imageUrl);
      if (missing.length === 0) return;
      let cancelled = false;
      const fetchImages = async () => {
        const results: Record<string, string> = {};
        // Fetch in parallel, max 10 at a time
        const batch = missing.slice(0, 10);
        await Promise.allSettled(
          batch.map(async (conn) => {
            try {
              const res = await fetch(
                `/api/artwork?q=${encodeURIComponent(conn.name)}&type=artist&source=spotify`,
              );
              if (!res.ok) return;
              const data = await res.json();
              const img = data.results?.[0]?.image;
              if (img && !cancelled) results[conn.name] = img;
            } catch { /* skip */ }
          }),
        );
        if (!cancelled) setFetchedImages(prev => ({ ...prev, ...results }));
      };
      fetchImages();
      return () => { cancelled = true; };
    }, [rawConnections.map(c => c.name).join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

    // Merge fetched images into connections
    const connections = rawConnections.map(c =>
      c.imageUrl ? c : { ...c, imageUrl: fetchedImages[c.name] },
    );

    const groups = groupConnections(connections);
    const arc = buildLineageArc(props.artist, groups);
    // Defensive: if parser mis-splits JSON and leaks a URL into summary, ignore it
    const rawSummary = typeof props.summary === "string" ? props.summary : "";
    const summary = (rawSummary && !rawSummary.startsWith("http"))
      ? rawSummary
      : autoSummary(props.artist, groups);

    // Determine available tabs (non-empty groups)
    const availableTabs = (["roots", "built", "legacy"] as GroupKey[]).filter(k => groups[k].length > 0);
    const useTabs = availableTabs.length > 1;
    const currentTab = useTabs && availableTabs.includes(activeTab) ? activeTab : availableTabs[0] ?? "roots";
    const currentConnections = groups[currentTab];

    const dotColor = (w: number) =>
      w > 0.7 ? "bg-green-500" : w >= 0.5 ? "bg-yellow-500" : "bg-zinc-500";

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        {/* Header with arc */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-white">{props.artist} — Influence Chain</h2>

          {/* Lineage arc */}
          {arc.length >= 3 && (
            <div className="mt-3 flex items-center justify-center gap-2 overflow-x-auto py-2">
              {arc.map((node, i) => (
                <div key={`arc-${node.name}-${i}`} className="flex items-center gap-2">
                  <div className="flex flex-col items-center gap-0.5">
                    {node.isCentral ? (
                      <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-violet-600 ring-2 ring-violet-400">
                        <span className="text-[10px] font-bold text-white">{node.name.charAt(0)}</span>
                      </div>
                    ) : (
                      <ArcNode name={node.name} imageUrl={node.imageUrl} />
                    )}
                    <span className={`max-w-[60px] truncate text-center text-[9px] ${
                      node.isCentral ? "font-bold text-white" : "text-zinc-400"
                    }`}>
                      {node.name}
                    </span>
                  </div>
                  {i < arc.length - 1 && (
                    <span className="text-xs text-zinc-600">→</span>
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
                      : "border-b border-zinc-700 text-zinc-500 hover:text-zinc-400"
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
          <div className="absolute left-0 top-0 bottom-0 w-px bg-zinc-700" />

          <div className="space-y-3">
            {currentConnections.map((conn, i) => (
              <ConnectionNode
                key={`${currentTab}-${conn.name}-${i}`}
                conn={conn}
                id={`${currentTab}-${conn.name}-${i}`}
                isExpanded={i < 3
                  ? !toggledIds.has(`${currentTab}-${conn.name}-${i}`)
                  : toggledIds.has(`${currentTab}-${conn.name}-${i}`)
                }
                onToggle={(id) => setToggledIds(prev => {
                  const next = new Set(prev);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  return next;
                })}
                dotColor={dotColor}
              />
            ))}
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
  component: ({ props }) => {
    const genres = ensureArray<string>(props.genres);
    const influences = ensureArray<{ name: string; weight: number; imageUrl?: string }>(props.influences);
    const sources = ensureArray<{ name: string; url: string; snippet: string }>(props.sources);

    return (
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
              {genres.map((g) => (
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
        {influences.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {influences.map((inf) => {
              const w = ensureNumber(inf.weight);
              return (
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
                      w > 0.7
                        ? "bg-green-500/20 text-green-400"
                        : w >= 0.5
                          ? "bg-yellow-500/20 text-yellow-400"
                          : "bg-zinc-500/20 text-zinc-400"
                    }`}
                  >
                    {w.toFixed(1)}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {/* Sources */}
        {sources.length > 0 && (
          <div className="mt-3 space-y-1.5 border-t border-zinc-700 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Sources</p>
            {sources.map((src) => (
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
    );
  },
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
  component: ({ props }) => {
    const path = ensureArray<{ artist: string; imageUrl?: string }>(props.path);
    const hops = ensureArray<{
      from: string; to: string; relationship: string; weight: number; evidence: string;
    }>(props.hops);

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <h2 className="mb-4 text-lg font-bold text-white">
          {props.fromArtist} → {props.toArtist}
        </h2>

        {/* Horizontal path chain */}
        <div className="flex items-center gap-1 overflow-x-auto pb-2">
          {path.map((node, i) => (
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
              {i < path.length - 1 && (
                <span className="mx-1 text-zinc-600">→</span>
              )}
            </div>
          ))}
        </div>

        {/* Evidence cards */}
        {hops.length > 0 && (
          <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
              Evidence
            </p>
            {hops.map((hop, i) => {
              const w = ensureNumber(hop.weight);
              return (
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
                          w > 0.7
                            ? "bg-green-500"
                            : w >= 0.5
                              ? "bg-yellow-500"
                              : "bg-zinc-500"
                        }`}
                        style={{ width: `${Math.round(w * 100)}%` }}
                      />
                    </div>
                    <span className="w-8 shrink-0 text-right text-[10px] text-zinc-500">
                      {w.toFixed(2)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-zinc-400">{hop.evidence}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  },
});

// ── Spotify Connected Components ────────────────────────────────

export const SpotifyPlaylist = defineComponent({
  name: "SpotifyPlaylist",
  description:
    "Display a Spotify playlist with tracks, open-in-Spotify button, and artist stats. Use after read_playlist_tracks returns data.",
  props: z.object({
    name: z.string().describe("Playlist name"),
    trackCount: z.number().describe("Total number of tracks"),
    playlistId: z.string().describe("Spotify playlist ID"),
    playlistUrl: z.string().optional().describe("Spotify playlist URL"),
    tracks: z.preprocess(jsonPreprocess, z.array(z.object({
      position: z.number().optional(),
      name: z.string(),
      artist: z.string(),
      album: z.string().optional(),
      year: z.string().optional(),
      durationSec: z.number().optional(),
    }))).describe("Array of track objects from read_playlist_tracks"),
  }),
  component: ({ props }) => {
    const [expanded, setExpanded] = useState(false);
    const tracks = ensureArray<{
      position?: number;
      name: string;
      artist: string;
      album?: string;
      year?: string;
      durationSec?: number;
    }>(props.tracks);
    const spotifyUrl = props.playlistUrl || `https://open.spotify.com/playlist/${props.playlistId}`;
    const displayTracks = expanded ? tracks : tracks.slice(0, 10);

    function formatDuration(sec?: number): string {
      if (!sec) return "";
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      return `${m}:${s.toString().padStart(2, "0")}`;
    }

    const uniqueArtists = [...new Set(tracks.map((t) => t.artist))];

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-green-900/40 to-zinc-900 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-500/20">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-7 w-7 text-green-400">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold text-white truncate">{props.name}</h3>
              <p className="text-sm text-zinc-400">{props.trackCount} tracks · {uniqueArtists.length} artists</p>
            </div>
            <a
              href={spotifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-green-500 px-4 py-1.5 text-sm font-semibold text-black hover:bg-green-400 transition-colors shrink-0"
            >
              Open in Spotify
            </a>
          </div>
        </div>

        {/* Track list */}
        <div className="p-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs text-zinc-500">
                <th className="w-8 pb-2 pr-2">#</th>
                <th className="pb-2">Title</th>
                <th className="pb-2 hidden sm:table-cell">Album</th>
                <th className="pb-2 text-right w-16">Time</th>
              </tr>
            </thead>
            <tbody>
              {displayTracks.map((track, i) => (
                <tr key={i} className="group border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-2 pr-2 text-xs text-zinc-600">{track.position ?? i + 1}</td>
                  <td className="py-2">
                    <p className="text-sm text-white truncate">{track.name}</p>
                    <p className="text-xs text-zinc-500 truncate">{track.artist}</p>
                  </td>
                  <td className="py-2 hidden sm:table-cell">
                    <span className="text-xs text-zinc-600 truncate">
                      {[track.album, track.year].filter(Boolean).join(" · ")}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-zinc-500">
                    {formatDuration(track.durationSec)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {tracks.length > 10 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-3 w-full rounded-md border border-zinc-700 py-2 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-300 transition-colors"
            >
              {expanded ? "Show less" : `Show all ${tracks.length} tracks`}
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-3">
          <span className="text-xs text-zinc-600">
            Top artists: {uniqueArtists.slice(0, 5).join(", ")}{uniqueArtists.length > 5 ? ` +${uniqueArtists.length - 5} more` : ""}
          </span>
        </div>
      </div>
    );
  },
});

// ── Slack Message Preview Component ─────────────────────────────

export const SlackMessage = defineComponent({
  name: "SlackMessage",
  description:
    "Preview of a Slack message before sending. Shows formatted content as it will appear in Slack, with a send button. Use when showing the user what will be sent to Slack.",
  props: z.object({
    channel: z.string().describe("Channel name (e.g. #general) or user (e.g. @tarik)"),
    title: z.string().optional().describe("Message header"),
    sections: z.preprocess(jsonPreprocess, z.array(z.object({
      type: z.enum(["header", "text", "bullets", "divider", "quote"]),
      content: z.string().optional(),
      items: z.array(z.string()).optional(),
    }))).describe("Array of content sections: {type, content?, items?}"),
    status: z.enum(["preview", "sending", "sent", "error"]).optional().describe("Current send status"),
    permalink: z.string().optional().describe("Slack message permalink after sending"),
  }),
  component: ({ props }) => {
    const sections = ensureArray<{
      type: string;
      content?: string;
      items?: string[];
    }>(props.sections);
    const isDM = props.channel.startsWith("@");
    const statusColor = {
      preview: "border-purple-500/30",
      sending: "border-yellow-500/30",
      sent: "border-green-500/30",
      error: "border-red-500/30",
    }[props.status ?? "preview"];

    return (
      <div className={`rounded-lg border ${statusColor} bg-zinc-900 overflow-hidden`}>
        {/* Slack-style header bar */}
        <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5 bg-zinc-800/50">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 text-[#E01E5A]">
            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zm1.271 0a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zm0 1.271a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zm10.124 2.521a2.528 2.528 0 0 1 2.52-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.52V8.834zm-1.268 0a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zm-2.523 10.124a2.528 2.528 0 0 1 2.523 2.52A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.52h2.52zm0-1.268a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/>
          </svg>
          <span className="text-sm font-medium text-zinc-300">
            {isDM ? `DM to ${props.channel}` : props.channel}
          </span>
          {props.status === "sent" && props.permalink && (
            <a
              href={props.permalink}
              target="_blank"
              rel="noopener noreferrer"
              className="ml-auto text-xs text-cyan-400 hover:text-cyan-300"
            >
              View in Slack
            </a>
          )}
          {props.status === "sent" && !props.permalink && (
            <span className="ml-auto text-xs text-green-400">Sent</span>
          )}
          {props.status === "sending" && (
            <span className="ml-auto text-xs text-yellow-400 animate-pulse">Sending...</span>
          )}
        </div>

        {/* Message content preview */}
        <div className="p-4 space-y-3">
          {props.title && (
            <h3 className="text-base font-bold text-white">{props.title}</h3>
          )}

          {sections.map((section, i) => {
            switch (section.type) {
              case "header":
                return (
                  <p key={i} className="text-sm font-semibold text-white">
                    {section.content}
                  </p>
                );
              case "text":
                return (
                  <p key={i} className="text-sm text-zinc-300 leading-relaxed">
                    {section.content}
                  </p>
                );
              case "bullets":
                return (
                  <ul key={i} className="space-y-1 pl-4">
                    {(section.items ?? []).map((item, j) => (
                      <li key={j} className="text-sm text-zinc-300 list-disc">
                        {item}
                      </li>
                    ))}
                  </ul>
                );
              case "divider":
                return <hr key={i} className="border-zinc-700" />;
              case "quote":
                return (
                  <div key={i} className="border-l-2 border-zinc-600 pl-3">
                    <p className="text-sm text-zinc-400 italic">{section.content}</p>
                  </div>
                );
              default:
                return null;
            }
          })}
        </div>

        {/* Footer */}
        <div className="border-t border-zinc-800 px-4 py-2 flex items-center">
          <span className="text-[10px] text-zinc-600">via Crate — AI Music Research</span>
        </div>
      </div>
    );
  },
});
