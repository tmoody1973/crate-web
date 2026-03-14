/**
 * Web-compatible play_radio tool.
 * Replaces crate-cli's mpv-based play_radio with a version that returns
 * stream URL + station metadata for the browser audio player.
 *
 * search_radio, browse_radio, get_radio_tags from crate-cli work fine
 * on the web (pure HTTP calls) — only play_radio needs replacement.
 */

import { z } from "zod";

const RADIO_API_MIRRORS = [
  "https://de1.api.radio-browser.info",
  "https://nl1.api.radio-browser.info",
  "https://fr1.api.radio-browser.info",
];

interface RadioStation {
  name: string;
  url: string;
  url_resolved: string;
  tags: string;
  country: string;
  codec: string;
  bitrate: number;
  votes: number;
  favicon: string;
}

async function radioFetch(path: string): Promise<RadioStation[]> {
  for (const mirror of RADIO_API_MIRRORS) {
    try {
      const res = await fetch(`${mirror}${path}`, {
        headers: { "User-Agent": "Crate/1.0.0" },
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return (await res.json()) as RadioStation[];
    } catch {
      continue;
    }
  }
  throw new Error("All radio-browser.info mirrors failed.");
}

interface PlayRadioArgs {
  url?: string;
  name?: string;
}

async function handlePlayRadio(args: PlayRadioArgs): Promise<{
  status: string;
  station: string;
  stream_url: string;
  tags?: string;
  country?: string;
  codec?: string;
  bitrate?: number;
  favicon?: string;
}> {
  if (!args.url && !args.name) {
    throw new Error("Provide either a stream URL or a station name to play.");
  }

  let streamUrl: string;
  let stationName: string;
  let tags: string | undefined;
  let country: string | undefined;
  let codec: string | undefined;
  let bitrate: number | undefined;
  let favicon: string | undefined;

  if (args.url) {
    const parsed = new URL(args.url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Stream URL must use HTTP or HTTPS.");
    }
    streamUrl = args.url;
    stationName = args.name ?? "Radio";
  } else {
    const params = new URLSearchParams({
      name: args.name!,
      limit: "1",
      order: "votes",
      reverse: "true",
      hidebroken: "true",
    });
    const stations = await radioFetch(`/json/stations/search?${params}`);
    if (stations.length === 0) {
      throw new Error(`No radio station found matching "${args.name}".`);
    }
    const station = stations[0];
    streamUrl = station.url_resolved || station.url;
    const parsed = new URL(streamUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      throw new Error("Station stream URL must use HTTP or HTTPS.");
    }
    stationName = station.name?.trim() || args.name!;
    tags = station.tags;
    country = station.country;
    codec = station.codec;
    bitrate = station.bitrate;
    favicon = station.favicon;
  }

  return {
    status: "streaming",
    station: stationName,
    stream_url: streamUrl,
    ...(tags && { tags }),
    ...(country && { country }),
    ...(codec && { codec }),
    ...(bitrate && { bitrate }),
    ...(favicon && { favicon }),
  };
}

/**
 * Creates the web play_radio tool definition compatible with the agentic loop.
 * Returns an array with a single tool that replaces crate-cli's mpv-based play_radio.
 */
export function createRadioTools() {
  return [
    {
      name: "play_radio",
      description:
        "Stream a live radio station in the browser audio player. " +
        "Provide a stream URL directly, or a station name to search and play the best match. " +
        "The station will play in the persistent player bar at the bottom of the screen.",
      inputSchema: {
        url: z.string().max(500).optional().describe("Direct stream URL to play"),
        name: z.string().max(200).optional().describe("Station name to search and play (e.g. 'KEXP', 'NTS Radio')"),
      },
      handler: async (args: Record<string, unknown>) => {
        try {
          const result = await handlePlayRadio(args as PlayRadioArgs);
          return { content: [{ type: "text", text: JSON.stringify(result) }] };
        } catch (err) {
          return {
            content: [
              {
                type: "text",
                text: `Error: ${err instanceof Error ? err.message : String(err)}`,
              },
            ],
            isError: true,
          };
        }
      },
    },
  ];
}
