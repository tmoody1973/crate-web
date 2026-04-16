/**
 * Wiki ingestion layer: extracts artist data from tool results for wiki persistence.
 *
 * Strategy: extract artist name AND convert to readable text at ingestion time.
 * The content field should NEVER contain raw JSON — always human-readable text.
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
  "influence",
  "websearch",
  "genius",
  "lastfm",
  "discogs",
  "musicbrainz",
  "itunes",
]);

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

const TOOL_DISPLAY: Record<string, string> = {
  "spotify-connected": "Spotify", "whosampled": "WhoSampled", "bandcamp-web": "Bandcamp",
  "youtube-connected": "YouTube", "radio": "Radio", "influencecache": "Influence Data",
  "tinydesk": "Tiny Desk", "images": "Images", "prep-research": "Research",
  "influence": "Influence Research", "websearch": "Web Search", "genius": "Genius",
  "lastfm": "Last.fm", "discogs": "Discogs", "musicbrainz": "MusicBrainz", "itunes": "iTunes",
};

const SECTION_HEADINGS: Record<string, string> = {
  "spotify-connected": "Spotify Profile", "whosampled": "Sample Connections",
  "bandcamp-web": "Bandcamp Tags", "youtube-connected": "YouTube",
  "radio": "Radio Metadata", "influencecache": "Influence Chain",
  "tinydesk": "Tiny Desk", "images": "Artist Images", "prep-research": "Research Brief",
  "influence": "Influence Research", "websearch": "Web Research",
  "genius": "Genius Lyrics & Bio", "lastfm": "Last.fm Profile",
  "discogs": "Discography", "musicbrainz": "MusicBrainz", "itunes": "iTunes Catalog",
};

// ── Artist name extraction ───────────────────────────────

function findArtistName(data: Record<string, unknown>): string | null {
  // Direct artist name fields (most common)
  for (const key of ["artist", "name", "from_artist", "to_artist", "query", "artist_name", "artistName"]) {
    if (typeof data[key] === "string" && data[key]) return data[key] as string;
  }

  // Spotify nested artists.items
  if (data.artists && typeof data.artists === "object") {
    const items = (data.artists as Record<string, unknown>).items as Array<Record<string, unknown>> | undefined;
    if (items?.[0]?.name) return items[0].name as string;
  }

  // Spotify top_artists / library (check BEFORE generic items)
  if (data.type === "top_artists" && Array.isArray(data.items)) {
    const items = data.items as Array<Record<string, unknown>>;
    if (items[0]?.name) return items[0].name as string;
  }

  // Generic items array (YouTube, search results)
  if (Array.isArray(data.items) && (data.items as Array<Record<string, unknown>>).length > 0) {
    const first = (data.items as Array<Record<string, unknown>>)[0];
    // YouTube snippet pattern
    const snippet = first?.snippet as Record<string, unknown> | undefined;
    if (snippet?.channelTitle) return snippet.channelTitle as string;
    // Generic item with name
    if (first?.name && typeof first.name === "string") return first.name as string;
  }

  return null;
}

function findArtistNameFromText(content: string): string | null {
  // "Influence chain for Sampa The Great" or "Samples for Khruangbin"
  const forPattern = content.match(/(?:samples?|influence\s*(?:chain)?|connections|info|research|profile)\s+(?:for|by|on|about)\s+(.+?)(?:\n|$|\.)/i);
  if (forPattern) return forPattern[1].trim();
  const artistLabel = content.match(/^artist:\s*(.+?)$/im);
  if (artistLabel) return artistLabel[1].trim();
  return null;
}

// ── JSON → readable text conversion ──────────────────────
// The content field must NEVER contain raw JSON. Convert at ingestion time.

function jsonToReadable(data: Record<string, unknown>): string {
  const lines: string[] = [];

  // Influence chain with connections
  if (Array.isArray(data.connections) && data.connections.length > 0) {
    for (const conn of data.connections as Array<Record<string, unknown>>) {
      const artist = conn.artist ?? conn.name ?? "Unknown";
      const rel = conn.relationship ?? "connected to";
      const ctx = conn.context ? String(conn.context) : "";
      lines.push(`${rel}: ${artist}`);
      if (ctx) lines.push(ctx);
      const sources = conn.sources as Array<Record<string, unknown>> | undefined;
      if (sources?.[0]) {
        const src = sources[0];
        const snippet = src.snippet ? `"${String(src.snippet).slice(0, 200)}"` : "";
        const name = src.name ?? src.source ?? "";
        if (snippet || name) lines.push(`— ${name}${snippet ? `: ${snippet}` : ""}`);
      }
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  // Reviews
  if (Array.isArray(data.reviews) && data.reviews.length > 0) {
    if (data.album) lines.push(`Album: ${data.album}`);
    for (const review of (data.reviews as Array<Record<string, unknown>>).slice(0, 4)) {
      const source = review.source ?? review.title ?? "";
      const snippet = String(review.snippet ?? "").slice(0, 400);
      if (source) lines.push(`${source}:`);
      if (snippet) lines.push(snippet);
      lines.push("");
    }
    return lines.join("\n").trim();
  }

  // Spotify search/library data
  if (data.artists && typeof data.artists === "object") {
    const items = (data.artists as Record<string, unknown>).items as Array<Record<string, unknown>> | undefined;
    if (items?.length) {
      const a = items[0];
      if (a.name) lines.push(`Artist: ${a.name}`);
      if (Array.isArray(a.genres) && a.genres.length) lines.push(`Genres: ${(a.genres as string[]).join(", ")}`);
      if (a.popularity != null) lines.push(`Spotify popularity: ${a.popularity}/100`);
      if (a.followers && typeof a.followers === "object") {
        const total = (a.followers as Record<string, unknown>).total;
        if (total) lines.push(`Followers: ${Number(total).toLocaleString()}`);
      }
      return lines.join("\n");
    }
  }

  // Bandcamp tags (strings) — check before Last.fm tags (objects)
  if (Array.isArray(data.tags) && data.tags.length > 0 && typeof data.tags[0] === "string") {
    const tags = data.tags as string[];
    const related = (data.related_tags as string[]) ?? [];
    if (tags.length) lines.push(`Tags: ${tags.join(", ")}`);
    if (related.length) lines.push(`Related tags: ${related.join(", ")}`);
    return lines.join("\n");
  }

  // Genius bio/lyrics
  if (typeof data.bio === "string") {
    lines.push(data.bio.slice(0, 1500));
    return lines.join("\n");
  }
  if (typeof data.description === "string") {
    lines.push(data.description.slice(0, 1500));
    return lines.join("\n");
  }

  // Last.fm profile
  if (data.listeners || data.playcount || typeof data.bio === "object") {
    if (data.listeners) lines.push(`Listeners: ${Number(data.listeners).toLocaleString()}`);
    if (data.playcount) lines.push(`Play count: ${Number(data.playcount).toLocaleString()}`);
    const bio = data.bio as Record<string, unknown> | undefined;
    if (bio?.summary) lines.push(String(bio.summary).slice(0, 800));
    if (Array.isArray(data.tags)) {
      const tagNames = (data.tags as Array<Record<string, unknown> | string>)
        .map(t => typeof t === "string" ? t : (t as Record<string, unknown>).name)
        .filter(Boolean);
      if (tagNames.length) lines.push(`Tags: ${tagNames.join(", ")}`);
    }
    if (lines.length) return lines.join("\n");
  }

  // Discogs
  if (data.releases || data.tracklist || data.labels || (data.genres && data.styles)) {
    if (data.title) lines.push(`${data.title}`);
    if (data.year) lines.push(`Year: ${data.year}`);
    if (Array.isArray(data.genres)) lines.push(`Genres: ${(data.genres as string[]).join(", ")}`);
    if (Array.isArray(data.styles)) lines.push(`Styles: ${(data.styles as string[]).join(", ")}`);
    if (typeof data.profile === "string") lines.push(data.profile.slice(0, 800));
    if (lines.length) return lines.join("\n");
  }

  // Items array (Spotify library, search results)
  if (Array.isArray(data.items) && data.items.length > 0) {
    for (const item of (data.items as Array<Record<string, unknown>>).slice(0, 5)) {
      const parts: string[] = [];
      if (item.name) parts.push(String(item.name));
      if (Array.isArray(item.genres)) parts.push(`(${(item.genres as string[]).join(", ")})`);
      if (item.popularity != null) parts.push(`popularity: ${item.popularity}`);
      if (parts.length) lines.push(parts.join(" "));
    }
    if (lines.length) return lines.join("\n");
  }

  // Generic: extract all meaningful string/number fields
  for (const [key, val] of Object.entries(data)) {
    if (key === "full_text" || key === "artistId" || key === "cached") continue;
    if (typeof val === "string" && val.length > 5) {
      lines.push(`${key}: ${val.slice(0, 500)}`);
    } else if (typeof val === "number" && key !== "fetchedAt" && key !== "createdAt") {
      lines.push(`${key}: ${val}`);
    } else if (Array.isArray(val) && val.length > 0 && typeof val[0] === "string") {
      lines.push(`${key}: ${val.join(", ")}`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "[No readable content extracted]";
}

// ── Main extractor ───────────────────────────────────────

export function extractArtistData(
  serverName: string,
  toolName: string,
  resultContent: string,
): ExtractedArtistData | null {
  if (!resultContent || resultContent.length < 10) return null;

  const displayName = TOOL_DISPLAY[serverName] ?? serverName;
  const heading = SECTION_HEADINGS[serverName] ?? serverName;

  const data = tryParseJson(resultContent);

  if (data) {
    if (data.error) return null;
    if (Array.isArray(data.connections) && data.connections.length === 0 && data.cached === false) return null;
    if (Array.isArray(data.items) && data.items.length === 0) return null;
    if (data.message && typeof data.message === "string" && /no\s+(results|data|matches)/i.test(data.message)) return null;

    const artistName = findArtistName(data);
    if (!artistName) return null;

    // Convert JSON to readable text — NEVER store raw JSON
    const content = jsonToReadable(data);
    if (content === "[No readable content extracted]") return null;

    return {
      artistName,
      section: {
        heading,
        content: content.slice(0, 3000),
        sources: [{ tool: displayName, fetchedAt: Date.now() }],
      },
    };
  }

  // Plain text — pass through directly
  const artistName = findArtistNameFromText(resultContent);
  if (!artistName) return null;

  return {
    artistName,
    section: {
      heading,
      content: resultContent.slice(0, 3000),
      sources: [{ tool: displayName, fetchedAt: Date.now() }],
    },
  };
}
