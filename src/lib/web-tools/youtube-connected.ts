/**
 * YouTube tools powered by Auth0 Token Vault (Google connection).
 * Search videos, read playlists, read liked videos — requires user to connect Google via OAuth.
 */

import { getTokenVaultToken } from "@/lib/auth0-token-vault";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const YT_BASE = "https://www.googleapis.com/youtube/v3";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createYouTubeConnectedTools(auth0UserId?: string): CrateToolDef[] {
  return [
    {
      name: "search_youtube",
      description:
        "Search YouTube for music videos, live performances, interviews, and documentaries. Use this to find video content for artists in influence chains.",
      inputSchema: {
        query: z.string().describe("Search query (e.g. 'Miles Davis live performance', 'Nina Simone documentary')"),
        limit: z.number().optional().describe("Number of results to return (default 5, max 10)"),
      },
      handler: async (args: { query: string; limit?: number }) => {
        const token = await getTokenVaultToken("google", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Google not connected. Ask the user to connect Google in Settings.",
            action: "connect_google",
          });
        }

        const limit = Math.min(args.limit ?? 5, 10);

        try {
          const url = `${YT_BASE}/search?part=snippet&q=${encodeURIComponent(args.query)}&type=video&maxResults=${limit}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `YouTube API error: ${res.status}`, detail });
          }

          const data = await res.json();

          return toolResult({
            query: args.query,
            results: (data.items ?? []).map((item: {
              id: { videoId: string };
              snippet: {
                title: string;
                channelTitle: string;
                thumbnails: { medium?: { url: string }; default?: { url: string } };
                publishedAt: string;
                description: string;
              };
            }) => ({
              videoId: item.id.videoId,
              title: item.snippet.title,
              channelTitle: item.snippet.channelTitle,
              thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
              publishedAt: item.snippet.publishedAt,
              description: item.snippet.description,
            })),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "YouTube search failed" });
        }
      },
    },
    {
      name: "read_youtube_playlists",
      description:
        "Read the user's YouTube playlists. Requires Google connection with YouTube scope.",
      inputSchema: {
        limit: z.number().optional().describe("Number of playlists to return (default 20, max 50)"),
      },
      handler: async (args: { limit?: number }) => {
        const token = await getTokenVaultToken("google", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Google not connected. Ask the user to connect Google in Settings.",
            action: "connect_google",
          });
        }

        const limit = Math.min(args.limit ?? 20, 50);

        try {
          const url = `${YT_BASE}/playlists?part=snippet,contentDetails&mine=true&maxResults=${limit}`;
          const res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            return toolResult({ error: `YouTube API error: ${res.status}`, detail });
          }

          const data = await res.json();

          return toolResult({
            playlists: (data.items ?? []).map((item: {
              id: string;
              snippet: {
                title: string;
                description: string;
                thumbnails: { medium?: { url: string }; default?: { url: string } };
              };
              contentDetails: { itemCount: number };
            }) => ({
              playlistId: item.id,
              title: item.snippet.title,
              description: item.snippet.description,
              itemCount: item.contentDetails.itemCount,
              thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
            })),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Failed to read YouTube playlists" });
        }
      },
    },
    {
      name: "read_youtube_liked",
      description:
        "Read the user's liked YouTube videos. Shows what music videos and performances the user has liked.",
      inputSchema: {
        limit: z.number().optional().describe("Number of liked videos to return (default 20, max 50)"),
      },
      handler: async (args: { limit?: number }) => {
        const token = await getTokenVaultToken("google", auth0UserId);
        if (!token) {
          return toolResult({
            error: "Google not connected. Ask the user to connect Google in Settings.",
            action: "connect_google",
          });
        }

        const limit = Math.min(args.limit ?? 20, 50);

        try {
          // Step 1: Get the liked videos playlist ID from the user's channel
          const channelRes = await fetch(`${YT_BASE}/channels?part=contentDetails&mine=true`, {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (!channelRes.ok) {
            const detail = await channelRes.text().catch(() => "");
            return toolResult({ error: `YouTube API error (channels): ${channelRes.status}`, detail });
          }

          const channelData = await channelRes.json();
          const likesPlaylistId = channelData.items?.[0]?.contentDetails?.relatedPlaylists?.likes;

          if (!likesPlaylistId) {
            return toolResult({ error: "Could not find liked videos playlist for this account." });
          }

          // Step 2: Fetch items from the liked videos playlist
          const itemsRes = await fetch(
            `${YT_BASE}/playlistItems?part=snippet&playlistId=${likesPlaylistId}&maxResults=${limit}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          if (!itemsRes.ok) {
            const detail = await itemsRes.text().catch(() => "");
            return toolResult({ error: `YouTube API error (playlistItems): ${itemsRes.status}`, detail });
          }

          const itemsData = await itemsRes.json();

          return toolResult({
            likedVideos: (itemsData.items ?? []).map((item: {
              snippet: {
                resourceId: { videoId: string };
                title: string;
                videoOwnerChannelTitle: string;
                thumbnails: { medium?: { url: string }; default?: { url: string } };
                publishedAt: string;
              };
            }) => ({
              videoId: item.snippet.resourceId.videoId,
              title: item.snippet.title,
              channelTitle: item.snippet.videoOwnerChannelTitle,
              thumbnailUrl: item.snippet.thumbnails?.medium?.url ?? item.snippet.thumbnails?.default?.url,
              publishedAt: item.snippet.publishedAt,
            })),
          });
        } catch (err) {
          return toolResult({ error: err instanceof Error ? err.message : "Failed to read liked YouTube videos" });
        }
      },
    },
  ];
}
