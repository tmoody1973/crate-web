/**
 * Web-compatible WhoSampled tools.
 * Thin CrateToolDef wrappers around crate-cli's exported handler functions.
 *
 * crate-cli exports the handlers but not the tool definitions (those are
 * internal `const` not `export const`). We recreate the tool definitions
 * here with matching names, descriptions, and zod schemas.
 *
 * Requires KERNEL_API_KEY — handlers call withBrowser({ stealth: true })
 * internally to bypass Cloudflare Turnstile.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

export function createWhoSampledTools(): CrateToolDef[] {
  return [
    {
      name: "search_whosampled",
      description:
        "Search WhoSampled for a track by artist and title. " +
        "Returns matching tracks with links to their sample detail pages. " +
        "Use this first to find the WhoSampled URL, then use get_track_samples for details.",
      inputSchema: {
        artist: z.string().max(200).describe("Artist name to search for"),
        track: z.string().max(200).describe("Track title to search for"),
      },
      handler: async (args: { artist: string; track: string }, _extra: unknown) => {
        const { searchWhoSampledHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return searchWhoSampledHandler(args);
      },
    },
    {
      name: "get_track_samples",
      description:
        "Get sample relationships for a specific track from its WhoSampled page. " +
        "Returns samples used by the track and tracks that sampled it, " +
        "with type (sample/interpolation/replay), year, and artist info.",
      inputSchema: {
        whosampled_url: z
          .string()
          .max(500)
          .describe("WhoSampled URL or path for the track (e.g., /Kanye-West/Stronger/)"),
      },
      handler: async (args: { whosampled_url: string }, _extra: unknown) => {
        const { getTrackSamplesHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return getTrackSamplesHandler(args);
      },
    },
    {
      name: "get_artist_connections",
      description:
        "Get an artist's sampling connections from WhoSampled. " +
        "Returns their most-sampled tracks, top sampling tracks, and overall sample counts.",
      inputSchema: {
        artist: z.string().max(200).describe("Artist name (will be slugified for URL lookup)"),
      },
      handler: async (args: { artist: string }, _extra: unknown) => {
        const { getArtistConnectionsHandler } = await import(
          "crate-cli/dist/servers/whosampled.js"
        );
        return getArtistConnectionsHandler(args);
      },
    },
  ];
}
