/**
 * Spotify tools powered by Auth0 Token Vault.
 * Read user's library, export playlists — requires user to connect Spotify via OAuth.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createSpotifyConnectedTools(auth0UserId?: string): CrateToolDef[] {
  const readLibraryHandler = async (args: {
    type: string;
    limit?: number;
  }) => {
    const token = await getTokenVaultToken("spotify", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Spotify not connected. Ask the user to connect Spotify in Settings.",
        action: "connect_spotify",
      });
    }

    const limit = args.limit ?? 20;
    let endpoint: string;

    switch (args.type) {
      case "saved_tracks":
        endpoint = `https://api.spotify.com/v1/me/tracks?limit=${limit}`;
        break;
      case "top_artists":
        endpoint = `https://api.spotify.com/v1/me/top/artists?limit=${limit}&time_range=medium_term`;
        break;
      case "playlists":
        endpoint = `https://api.spotify.com/v1/me/playlists?limit=${limit}`;
        break;
      default:
        return toolResult({ error: "Invalid type. Use: saved_tracks, top_artists, or playlists" });
    }

    try {
      const res = await fetch(endpoint, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({ error: `Spotify API error: ${res.status}`, detail });
      }

      const data = await res.json();

      if (args.type === "saved_tracks") {
        return toolResult({
          type: "saved_tracks",
          total: data.total,
          tracks: data.items.map((item: { track: { name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string } } }) => ({
            name: item.track.name,
            artist: item.track.artists.map((a: { name: string }) => a.name).join(", "),
            album: item.track.album.name,
            year: item.track.album.release_date?.slice(0, 4),
          })),
        });
      }

      if (args.type === "top_artists") {
        return toolResult({
          type: "top_artists",
          artists: data.items.map((a: { name: string; genres: string[]; images: Array<{ url: string }> }) => ({
            name: a.name,
            genres: a.genres,
            imageUrl: a.images?.[0]?.url,
          })),
        });
      }

      // playlists
      return toolResult({
        type: "playlists",
        playlists: data.items.map((p: { name: string; tracks: { total: number }; id: string }) => ({
          name: p.name,
          trackCount: p.tracks.total,
          playlistId: p.id,
          spotifyUrl: `https://open.spotify.com/playlist/${p.id}`,
        })),
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Spotify request failed" });
    }
  };

  const exportPlaylistHandler = async (args: {
    name: string;
    description: string;
    trackQueries: string[];
  }) => {
    const token = await getTokenVaultToken("spotify", auth0UserId);
    if (!token) {
      return toolResult({
        error: "Spotify not connected. Ask the user to connect Spotify in Settings.",
        action: "connect_spotify",
      });
    }

    try {
      // Step 1: Get user ID
      const meRes = await fetch("https://api.spotify.com/v1/me", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!meRes.ok) return toolResult({ error: "Failed to get Spotify user info" });
      const me = await meRes.json();

      // Step 2: Create playlist
      const createRes = await fetch(`https://api.spotify.com/v1/users/${me.id}/playlists`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          public: true,
        }),
      });
      if (!createRes.ok) return toolResult({ error: "Failed to create Spotify playlist" });
      const playlist = await createRes.json();

      // Step 3: Search for each track and collect URIs
      const trackUris: string[] = [];
      const notFound: string[] = [];

      for (const query of args.trackQueries) {
        try {
          const searchRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=1`,
            { headers: { Authorization: `Bearer ${token}` } },
          );
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const track = searchData.tracks?.items?.[0];
            if (track) {
              trackUris.push(track.uri);
            } else {
              notFound.push(query);
            }
          }
        } catch {
          notFound.push(query);
        }
      }

      // Step 4: Add tracks to playlist (max 100 per request)
      if (trackUris.length > 0) {
        for (let i = 0; i < trackUris.length; i += 100) {
          const batch = trackUris.slice(i, i + 100);
          await fetch(`https://api.spotify.com/v1/playlists/${playlist.id}/tracks`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ uris: batch }),
          });
        }
      }

      return toolResult({
        success: true,
        playlistUrl: playlist.external_urls.spotify,
        playlistName: args.name,
        tracksAdded: trackUris.length,
        tracksNotFound: notFound,
        message: `Playlist "${args.name}" created with ${trackUris.length} tracks!${notFound.length > 0 ? ` ${notFound.length} tracks not found on Spotify.` : ""}`,
      });
    } catch (err) {
      return toolResult({ error: err instanceof Error ? err.message : "Playlist export failed" });
    }
  };

  return [
    {
      name: "read_spotify_library",
      description:
        "Read the user's Spotify library — saved tracks, top artists, or playlists. When type=playlists, returns playlistId for each playlist — pass that to read_playlist_tracks to get the actual songs.",
      inputSchema: {
        type: z.enum(["saved_tracks", "top_artists", "playlists"]).describe("What to read from the library"),
        limit: z.number().optional().describe("Number of items to return (default 20, max 50)"),
      },
      handler: readLibraryHandler,
    },
    {
      name: "read_playlist_tracks",
      description:
        "Read tracks from a Spotify playlist. Pass the playlistId returned by read_spotify_library (type=playlists). Automatically chains: read_spotify_library → get playlistId → read_playlist_tracks. Never ask the user for a playlist ID.",
      inputSchema: {
        playlistId: z.string().describe("Spotify playlist ID (from read_spotify_library results)"),
        limit: z.number().optional().describe("Number of tracks to return (default 50, max 100)"),
        offset: z.number().optional().describe("Offset for pagination (default 0)"),
      },
      handler: async (args: { playlistId: string; limit?: number; offset?: number }) => {
        const token = await getTokenVaultToken("spotify", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Spotify not connected. Ask the user to connect Spotify in Settings.",
            action: "connect_spotify",
          });
        }

        const limit = Math.min(args.limit ?? 50, 100);
        const offset = args.offset ?? 0;

        try {
          const res = await fetch(
            `https://api.spotify.com/v1/playlists/${args.playlistId}/tracks?limit=${limit}&offset=${offset}&fields=total,items(track(name,artists(name),album(name,release_date),duration_ms,uri))`,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `Spotify API error: ${res.status}`, detail });
          }

          const data = await res.json();
          return toolResult({
            playlistId: args.playlistId,
            total: data.total,
            offset,
            returned: data.items?.length ?? 0,
            tracks: (data.items ?? []).map((item: { track: { name: string; artists: Array<{ name: string }>; album: { name: string; release_date: string }; duration_ms: number; uri: string } }, i: number) => ({
              position: offset + i + 1,
              name: item.track.name,
              artist: item.track.artists.map((a: { name: string }) => a.name).join(", "),
              album: item.track.album.name,
              year: item.track.album.release_date?.slice(0, 4),
              durationSec: Math.round(item.track.duration_ms / 1000),
            })),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Failed to read playlist tracks" });
        }
      },
    },
    {
      name: "export_to_spotify",
      description:
        "Create a playlist in the user's Spotify account. Pass track queries as 'Artist Name Track Title' strings — the tool searches Spotify to find the right track. Requires Spotify connection.",
      inputSchema: {
        name: z.string().describe("Playlist name (e.g. 'Ezra Collective: The Influence Chain')"),
        description: z.string().describe("Playlist description"),
        trackQueries: z.array(z.string()).describe("Array of 'Artist - Track' strings to search for on Spotify"),
      },
      handler: exportPlaylistHandler,
    },
  ];
}
