/**
 * Wiki ingestion layer: extracts artist data from tool results for wiki persistence.
 *
 * Strategy: capture the FULL tool result content and extract the artist name.
 * The Haiku synthesis step merges, deduplicates, and structures everything.
 * Extractors only need to: (1) find the artist name, (2) pass content through.
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
  // Web tool servers
  "spotify-connected",
  "whosampled",
  "bandcamp-web",
  "youtube-connected",
  "radio",
  "influencecache",
  "tinydesk",
  "images",
  "prep-research",
  // crate-cli servers (used by /influence and general research)
  "influence",
  "websearch",
  "genius",
  "lastfm",
  "discogs",
  "musicbrainz",
  "itunes",
]);

/** Check if a tool server's output should trigger wiki ingestion. */
export function shouldIngest(serverName: string): boolean {
  return QUALIFYING_SERVERS.has(serverName);
}

// ── Helpers ──────────────────────────────────────────────

function tryParseJson(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>;
    return null;
  } catch {
    return null;
  }
}

/** Tool display names for source attribution. */
const TOOL_DISPLAY: Record<string, string> = {
  "spotify-connected": "Spotify",
  "whosampled": "WhoSampled",
  "bandcamp-web": "Bandcamp",
  "youtube-connected": "YouTube",
  "radio": "Radio",
  "influencecache": "Influence Data",
  "tinydesk": "Tiny Desk",
  "images": "Images",
  "prep-research": "Research",
  "influence": "Influence Research",
  "websearch": "Web Search",
  "genius": "Genius",
  "lastfm": "Last.fm",
  "discogs": "Discogs",
  "musicbrainz": "MusicBrainz",
  "itunes": "iTunes",
};

/** Section headings by server. */
const SECTION_HEADINGS: Record<string, string> = {
  "spotify-connected": "Spotify Profile",
  "whosampled": "Sample Connections",
  "bandcamp-web": "Bandcamp Tags",
  "youtube-connected": "YouTube",
  "radio": "Radio Metadata",
  "influencecache": "Influence Chain",
  "tinydesk": "Tiny Desk",
  "images": "Artist Images",
  "prep-research": "Research Brief",
  "influence": "Influence Research",
  "websearch": "Web Research",
  "genius": "Genius Lyrics & Bio",
  "lastfm": "Last.fm Profile",
  "discogs": "Discography",
  "musicbrainz": "MusicBrainz",
  "itunes": "iTunes Catalog",
};

/**
 * Try to extract an artist name from structured JSON data.
 * Searches common field patterns across all tool outputs.
 */
function findArtistName(data: Record<string, unknown>, toolName: string): string | null {
  // Direct artist name fields
  for (const key of ["artist", "name", "from_artist", "to_artist", "query", "artist_name", "artistName"]) {
    if (typeof data[key] === "string" && data[key]) {
      return data[key] as string;
    }
  }

  // Spotify search results
  if (data.artists && typeof data.artists === "object") {
    const artists = data.artists as Record<string, unknown>;
    const items = artists.items as Array<Record<string, unknown>> | undefined;
    if (items?.[0]?.name) return items[0].name as string;
  }

  // Spotify top artists
  if (data.type === "top_artists" && Array.isArray(data.items)) {
    const items = data.items as Array<Record<string, unknown>>;
    if (items[0]?.name) return items[0].name as string;
  }

  // YouTube search results
  if (Array.isArray(data.items)) {
    const items = data.items as Array<Record<string, unknown>>;
    const snippet = items[0]?.snippet as Record<string, unknown> | undefined;
    if (snippet?.channelTitle) return snippet.channelTitle as string;
  }

  // Influence cache edge — prefer from_artist (the subject being researched)
  if (data.from_artist) return data.from_artist as string;

  // Try extracting from tool name patterns
  if (toolName.includes("search") && data.results && Array.isArray(data.results)) {
    const first = (data.results as Array<Record<string, unknown>>)[0];
    if (first?.artist) return first.artist as string;
    if (first?.name) return first.name as string;
  }

  return null;
}

/**
 * Try to extract an artist name from plain text content.
 * Falls back to pattern matching on common output formats.
 */
function findArtistNameFromText(content: string): string | null {
  // "Samples for Artist Name" or "Influence chain for Artist Name"
  const forPattern = content.match(/(?:samples|influence|connections|info|research|profile)\s+(?:for|by|on|about)\s+(.+?)(?:\n|$|\.)/i);
  if (forPattern) return forPattern[1].trim();

  // "Artist: Name" at start of content
  const artistLabel = content.match(/^artist:\s*(.+?)$/im);
  if (artistLabel) return artistLabel[1].trim();

  return null;
}

// ── Main extractor ───────────────────────────────────────

/**
 * Extract artist name + full content from a tool result.
 * Captures the complete tool output — Haiku synthesis cleans it up later.
 */
export function extractArtistData(
  serverName: string,
  toolName: string,
  resultContent: string,
): ExtractedArtistData | null {
  if (!resultContent || resultContent.length < 10) return null;

  const displayName = TOOL_DISPLAY[serverName] ?? serverName;
  const heading = SECTION_HEADINGS[serverName] ?? serverName;

  // Try JSON first
  const data = tryParseJson(resultContent);

  if (data) {
    // Skip error responses
    if (data.error) return null;

    // Skip empty results (no useful data to ingest)
    if (Array.isArray(data.connections) && data.connections.length === 0 && data.cached === false) return null;
    if (Array.isArray(data.items) && data.items.length === 0) return null;
    if (data.message && typeof data.message === "string" && /no\s+(results|data|matches)/i.test(data.message)) return null;

    const artistName = findArtistName(data, toolName);
    if (!artistName) return null;

    // Pass the FULL content through — Haiku synthesis will structure it
    // Truncate at 3000 chars to keep wiki pages manageable
    const content = resultContent.length > 3000
      ? resultContent.slice(0, 3000) + "\n... (truncated)"
      : resultContent;

    return {
      artistName,
      section: {
        heading,
        content,
        sources: [{ tool: displayName, fetchedAt: Date.now() }],
      },
    };
  }

  // Plain text response (e.g., WhoSampled scrape results)
  const artistName = findArtistNameFromText(resultContent);
  if (!artistName) return null;

  const content = resultContent.length > 3000
    ? resultContent.slice(0, 3000) + "\n... (truncated)"
    : resultContent;

  return {
    artistName,
    section: {
      heading,
      content,
      sources: [{ tool: displayName, fetchedAt: Date.now() }],
    },
  };
}
