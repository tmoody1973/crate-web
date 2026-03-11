"use client";

import { defineComponent } from "@openuidev/react-lang";
import { z } from "zod";

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
  }),
  component: ({ props }) => (
    <div className="flex items-center justify-between border-b border-zinc-800 py-2">
      <div>
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
  component: ({ props, renderNode }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="mb-2 text-lg font-bold text-white">
        {props.artist} — Discography
      </h2>
      <div>{renderNode(props.albums)}</div>
    </div>
  ),
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

export const TrackList = defineComponent({
  name: "TrackList",
  description: "A playlist or track listing.",
  props: z.object({
    title: z.string().describe("Playlist or list title"),
    tracks: z.array(
      z.object({
        name: z.string(),
        artist: z.string(),
        album: z.string().optional(),
        year: z.string().optional(),
      }),
    ).describe("List of tracks"),
  }),
  component: ({ props }) => (
    <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
      <h2 className="mb-2 text-lg font-bold text-white">{props.title}</h2>
      <div className="space-y-1">
        {props.tracks.map((t, i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-zinc-800 py-1.5"
          >
            <div>
              <span className="text-sm text-white">{t.name}</span>
              <span className="ml-2 text-xs text-zinc-500">{t.artist}</span>
            </div>
            {(t.album || t.year) && (
              <span className="text-xs text-zinc-600">
                {[t.album, t.year].filter(Boolean).join(" · ")}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  ),
});
