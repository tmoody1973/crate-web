/**
 * Web-specific image/artwork tool handlers for Spotify and fanart.tv.
 * Provides high-quality artwork search for influence mapping features.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

// ── Spotify token cache ──────────────────────────────────────────

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(
  clientId: string,
  clientSecret: string,
): Promise<string> {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    throw new Error(`Spotify auth failed: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  // Expire 60s early to avoid edge-case failures
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

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

// ── Spotify search result types ──────────────────────────────────

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyAlbumItem {
  name: string;
  images: SpotifyImage[];
  artists: Array<{ name: string }>;
  external_urls: { spotify: string };
  release_date?: string;
}

interface SpotifyArtistItem {
  name: string;
  images: SpotifyImage[];
  external_urls: { spotify: string };
  genres?: string[];
}

interface SpotifySearchResponse {
  albums?: { items: SpotifyAlbumItem[] };
  artists?: { items: SpotifyArtistItem[] };
}

// ── fanart.tv response types ─────────────────────────────────────

interface FanartImage {
  id: string;
  url: string;
  likes: string;
}

interface FanartResponse {
  artistbackground?: FanartImage[];
  hdmusiclogo?: FanartImage[];
  albumcover?: FanartImage[];
  [key: string]: unknown;
}

// ── Pick best image from Spotify images array ────────────────────

function pickBestImage(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  // Prefer 640x640, fall back to largest
  const preferred = images.find(
    (img) => img.width === 640 && img.height === 640,
  );
  if (preferred) return preferred.url;
  // Sort by size descending, pick largest
  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0),
  );
  return sorted[0]?.url ?? null;
}

// ── Handlers ──────────────────────────────────────────────────────

export function createImageTools(
  spotifyClientId: string,
  spotifyClientSecret: string,
  fanartApiKey?: string,
): CrateToolDef[] {
  const searchSpotifyArtworkHandler = async (args: {
    query: string;
    type?: "album" | "artist";
  }) => {
    try {
      const token = await getSpotifyToken(spotifyClientId, spotifyClientSecret);
      const searchType = args.type ?? "album";

      const params = new URLSearchParams({
        type: searchType,
        q: args.query,
        limit: "3",
      });

      const res = await fetch(
        `https://api.spotify.com/v1/search?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (!res.ok) {
        throw new Error(`Spotify search failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as SpotifySearchResponse;

      if (searchType === "album") {
        const items = data.albums?.items ?? [];
        const results = items.map((item) => ({
          name: item.name,
          artist: item.artists.map((a) => a.name).join(", "),
          image: pickBestImage(item.images),
          spotify_url: item.external_urls.spotify,
          release_date: item.release_date ?? null,
        }));
        return toolResult({ type: "album", results });
      }

      const items = data.artists?.items ?? [];
      const results = items.map((item) => ({
        name: item.name,
        image: pickBestImage(item.images),
        spotify_url: item.external_urls.spotify,
        genres: item.genres ?? [],
      }));
      return toolResult({ type: "artist", results });
    } catch (error) {
      return toolError(error);
    }
  };

  const getFanartImagesHandler = async (args: { mbid: string }) => {
    try {
      const res = await fetch(
        `https://webservice.fanart.tv/v3/music/${args.mbid}?api_key=${fanartApiKey}`,
      );

      if (!res.ok) {
        throw new Error(`fanart.tv request failed: ${res.status} ${res.statusText}`);
      }

      const data = (await res.json()) as FanartResponse;

      return toolResult({
        artistbackground: (data.artistbackground ?? []).map((img) => ({
          id: img.id,
          url: img.url,
          likes: img.likes,
        })),
        hdmusiclogo: (data.hdmusiclogo ?? []).map((img) => ({
          id: img.id,
          url: img.url,
          likes: img.likes,
        })),
        albumcover: (data.albumcover ?? []).map((img) => ({
          id: img.id,
          url: img.url,
          likes: img.likes,
        })),
      });
    } catch (error) {
      return toolError(error);
    }
  };

  const tools: CrateToolDef[] = [
    {
      name: "search_spotify_artwork",
      description:
        "Search Spotify for album or artist artwork. Returns up to 3 results with high-resolution images, names, and Spotify URLs.",
      inputSchema: {
        query: z.string().describe("Search query (artist name, album name, or both)"),
        type: z
          .enum(["album", "artist"])
          .optional()
          .describe("Type of search (default: album)"),
      },
      handler: searchSpotifyArtworkHandler,
    },
  ];

  if (fanartApiKey) {
    tools.push({
      name: "get_fanart_images",
      description:
        "Fetch artist artwork from fanart.tv using a MusicBrainz ID. Returns backgrounds, HD logos, and album covers.",
      inputSchema: {
        mbid: z.string().describe("MusicBrainz artist ID (UUID format)"),
      },
      handler: getFanartImagesHandler,
    });
  }

  return tools;
}
