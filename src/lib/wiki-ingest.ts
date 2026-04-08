/**
 * Wiki ingestion layer: extracts artist data from tool results for wiki persistence.
 *
 * Each qualifying tool server has a typed extractor that knows how to pull
 * artist name + substantive data from that tool's output format.
 */

// ── Types ────────────────────────────────────────────────

export interface WikiSection {
  heading: string;
  content: string;
  sources: Array<{
    tool: string;
    url?: string;
    fetchedAt: number;
  }>;
}

export interface ExtractedArtistData {
  artistName: string;
  section: WikiSection;
}

// ── Qualifying servers ───────────────────────────────────

const QUALIFYING_SERVERS = new Set([
  "spotify-connected",
  "whosampled",
  "bandcamp-web",
  "youtube-connected",
  "radio",
  "influencecache",
  "tinydesk",
  "images",
  "prep-research",
]);

/** Check if a tool server's output should trigger wiki ingestion. */
export function shouldIngest(serverName: string): boolean {
  return QUALIFYING_SERVERS.has(serverName);
}

// ── Per-tool extractors ──────────────────────────────────

function tryParseJson(content: string): unknown {
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function extractSpotifyConnected(toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  // search_spotify returns tracks/artists with name fields
  if (toolName === "search_spotify" && data.artists) {
    const artists = data.artists as Record<string, unknown>;
    const items = artists.items as Array<Record<string, unknown>> | undefined;
    if (!items?.length) return null;
    const artist = items[0];
    const name = artist.name as string;
    if (!name) return null;
    const genres = (artist.genres as string[]) ?? [];
    const popularity = artist.popularity as number | undefined;
    return {
      artistName: name,
      section: {
        heading: "Spotify Profile",
        content: [
          `Artist: ${name}`,
          genres.length ? `Genres: ${genres.join(", ")}` : null,
          popularity != null ? `Popularity: ${popularity}/100` : null,
        ].filter(Boolean).join("\n"),
        sources: [{ tool: "Spotify", fetchedAt: Date.now() }],
      },
    };
  }

  // get_spotify_library returns saved tracks, top artists
  if (toolName === "get_spotify_library" && data.type === "top_artists") {
    const items = data.items as Array<Record<string, unknown>> | undefined;
    if (!items?.length) return null;
    // Return the first artist for wiki purposes
    const artist = items[0];
    const name = artist.name as string;
    if (!name) return null;
    return {
      artistName: name,
      section: {
        heading: "Spotify Library",
        content: `Found in user's top artists on Spotify. Genres: ${((artist.genres as string[]) ?? []).join(", ")}`,
        sources: [{ tool: "Spotify", fetchedAt: Date.now() }],
      },
    };
  }

  return null;
}

function extractWhoSampled(_toolName: string, content: string): ExtractedArtistData | null {
  // WhoSampled returns text descriptions of sample relationships
  // Try to extract artist name from the content
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data) {
    // Plain text response — look for artist name patterns
    const artistMatch = content.match(/^(?:Samples|Sample connections|Sampling info) (?:for|by) (.+?)(?:\n|$)/i);
    if (artistMatch) {
      return {
        artistName: artistMatch[1].trim(),
        section: {
          heading: "Sample Connections",
          content: content.slice(0, 2000),
          sources: [{ tool: "WhoSampled", fetchedAt: Date.now() }],
        },
      };
    }
    return null;
  }

  const artist = (data.artist ?? data.name) as string | undefined;
  if (!artist) return null;

  return {
    artistName: artist,
    section: {
      heading: "Sample Connections",
      content: typeof data.samples === "string" ? data.samples : JSON.stringify(data, null, 2).slice(0, 2000),
      sources: [{ tool: "WhoSampled", fetchedAt: Date.now() }],
    },
  };
}

function extractBandcamp(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name) as string | undefined;
  const tags = data.tags as string[] | undefined;
  const relatedTags = data.related_tags as string[] | undefined;

  if (!artist) return null;

  return {
    artistName: artist,
    section: {
      heading: "Bandcamp Tags",
      content: [
        `Artist: ${artist}`,
        tags?.length ? `Tags: ${tags.join(", ")}` : null,
        relatedTags?.length ? `Related tags: ${relatedTags.join(", ")}` : null,
      ].filter(Boolean).join("\n"),
      sources: [{ tool: "Bandcamp", fetchedAt: Date.now() }],
    },
  };
}

function extractYouTubeConnected(toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  // youtube_search returns video results
  if (toolName === "youtube_search") {
    const items = data.items as Array<Record<string, unknown>> | undefined;
    if (!items?.length) return null;
    const snippet = items[0].snippet as Record<string, unknown> | undefined;
    const channelTitle = snippet?.channelTitle as string | undefined;
    if (!channelTitle) return null;
    return {
      artistName: channelTitle,
      section: {
        heading: "YouTube",
        content: `Found on YouTube: ${snippet?.title ?? ""}`,
        sources: [{ tool: "YouTube", fetchedAt: Date.now() }],
      },
    };
  }

  return null;
}

function extractRadio(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name) as string | undefined;
  if (!artist) return null;

  return {
    artistName: artist,
    section: {
      heading: "Radio Metadata",
      content: JSON.stringify(data, null, 2).slice(0, 1000),
      sources: [{ tool: "Radio", fetchedAt: Date.now() }],
    },
  };
}

function extractInfluenceCache(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name ?? data.query) as string | undefined;
  if (!artist) return null;

  const influences = data.influences as Array<Record<string, unknown>> | undefined;
  const influenceText = influences?.length
    ? influences.map((i) => `${i.name} (${i.relationship ?? "influenced by"})`).join(", ")
    : "";

  return {
    artistName: artist,
    section: {
      heading: "Influence Chain",
      content: [
        `Artist: ${artist}`,
        influenceText ? `Influences: ${influenceText}` : null,
      ].filter(Boolean).join("\n"),
      sources: [{ tool: "Influence Cache", fetchedAt: Date.now() }],
    },
  };
}

function extractTinyDesk(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name) as string | undefined;
  if (!artist) return null;

  return {
    artistName: artist,
    section: {
      heading: "Tiny Desk",
      content: JSON.stringify(data, null, 2).slice(0, 1000),
      sources: [{ tool: "Tiny Desk", fetchedAt: Date.now() }],
    },
  };
}

function extractImages(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name) as string | undefined;
  if (!artist) return null;

  return {
    artistName: artist,
    section: {
      heading: "Artist Images",
      content: `Image data available for ${artist}`,
      sources: [{ tool: "Images", fetchedAt: Date.now() }],
    },
  };
}

function extractPrepResearch(_toolName: string, content: string): ExtractedArtistData | null {
  const data = tryParseJson(content) as Record<string, unknown> | null;
  if (!data || data.error) return null;

  const artist = (data.artist ?? data.name ?? data.query) as string | undefined;
  if (!artist) return null;

  const summary = (data.summary ?? data.research ?? data.content) as string | undefined;

  return {
    artistName: artist,
    section: {
      heading: "Research Brief",
      content: (summary ?? JSON.stringify(data, null, 2)).slice(0, 2000),
      sources: [{ tool: "Prep Research", fetchedAt: Date.now() }],
    },
  };
}

// ── Main extractor ───────────────────────────────────────

const EXTRACTORS: Record<string, (toolName: string, content: string) => ExtractedArtistData | null> = {
  "spotify-connected": extractSpotifyConnected,
  "whosampled": extractWhoSampled,
  "bandcamp-web": extractBandcamp,
  "youtube-connected": extractYouTubeConnected,
  "radio": extractRadio,
  "influencecache": extractInfluenceCache,
  "tinydesk": extractTinyDesk,
  "images": extractImages,
  "prep-research": extractPrepResearch,
};

/**
 * Extract artist name + substantive data from a tool result.
 * Returns null if the result doesn't contain usable artist data.
 */
export function extractArtistData(
  serverName: string,
  toolName: string,
  resultContent: string,
): ExtractedArtistData | null {
  const extractor = EXTRACTORS[serverName];
  if (!extractor) return null;

  try {
    return extractor(toolName, resultContent);
  } catch {
    return null;
  }
}
