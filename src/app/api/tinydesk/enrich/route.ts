import { NextRequest, NextResponse } from "next/server";
import catalogData from "../../../../../public/tinydesk/catalog.json";
import { toSlug } from "@/components/tinydesk/catalog-types";

interface CatalogEntry {
  artist: string;
  slug: string;
  genre: string[];
  youtubeId: string | null;
}

// Allow up to 30 seconds for video resolution
export const maxDuration = 30;

/**
 * POST /api/tinydesk/enrich
 * Body: { artist: string, connectionNames?: string[] }
 * Returns: { youtubeId: string | null, genre: string[], connectionVideos: Record<string, string> }
 *
 * Resolves YouTube video ID and genre for the main artist,
 * plus YouTube videos for each influence connection (server-side).
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    artist: string;
    connectionNames?: string[];
  };
  const { artist, connectionNames } = body;

  if (!artist) {
    return NextResponse.json({ error: "artist required" }, { status: 400 });
  }

  // Check catalog first — it has verified YouTube IDs
  const catalog = catalogData as CatalogEntry[];
  const slug = toSlug(artist);
  const catalogEntry = catalog.find((c) => c.slug === slug);

  const catalogYoutubeId = catalogEntry?.youtubeId ?? null;
  const catalogGenre = catalogEntry?.genre ?? [];

  // Resolve main artist video + genre + connection videos in parallel
  const [youtubeId, genre, connectionVideos] = await Promise.all([
    catalogYoutubeId
      ? Promise.resolve(catalogYoutubeId)
      : resolveYoutubeId(`${artist} tiny desk concert NPR`),
    catalogGenre.length > 0
      ? Promise.resolve(catalogGenre)
      : resolveGenre(artist),
    resolveConnectionVideos(connectionNames ?? []),
  ]);

  return NextResponse.json({ youtubeId, genre, connectionVideos });
}

async function resolveConnectionVideos(
  names: string[],
): Promise<Record<string, string>> {
  if (names.length === 0) return {};

  const results: Record<string, string> = {};

  // Resolve in parallel, max 10 at a time
  const batches: string[][] = [];
  for (let i = 0; i < names.length; i += 10) {
    batches.push(names.slice(i, i + 10));
  }

  for (const batch of batches) {
    await Promise.allSettled(
      batch.map(async (name) => {
        const videoId = await resolveYoutubeId(`${name} music`);
        if (videoId) results[name] = videoId;
      }),
    );
  }

  return results;
}

async function resolveYoutubeId(query: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;

  // Try YouTube Data API if key is available
  if (apiKey) {
    try {
      const url = new URL("https://www.googleapis.com/youtube/v3/search");
      url.searchParams.set("part", "snippet");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "video");
      url.searchParams.set("maxResults", "1");
      url.searchParams.set("key", apiKey);
      const res = await fetch(url.toString());
      if (res.ok) {
        const data = await res.json();
        const id = data.items?.[0]?.id?.videoId;
        if (id) return id;
      }
    } catch { /* fall through */ }
  }

  // Fallback: scrape YouTube search page for video ID
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const html = await res.text();
      const match = html.match(/"videoId":"([a-zA-Z0-9_-]{11})"/);
      if (match) return match[1];
    }
  } catch { /* give up */ }

  return null;
}

async function resolveGenre(artist: string): Promise<string[]> {
  const apiKey = process.env.LASTFM_API_KEY;
  if (!apiKey) return [];

  try {
    const url = new URL("https://ws.audioscrobbler.com/2.0/");
    url.searchParams.set("method", "artist.gettoptags");
    url.searchParams.set("artist", artist);
    url.searchParams.set("api_key", apiKey);
    url.searchParams.set("format", "json");
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    const tags: Array<{ name: string; count: number }> = data.toptags?.tag ?? [];

    const genreMap: Record<string, string> = {
      rnb: "R&B/Soul", "r&b": "R&B/Soul", soul: "R&B/Soul", "neo-soul": "R&B/Soul",
      rock: "Rock", "indie rock": "Rock", alternative: "Rock", punk: "Rock",
      latin: "Latin", reggaeton: "Latin", salsa: "Latin", cumbia: "Latin",
      pop: "Pop", "indie pop": "Pop", "synth-pop": "Pop",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", rap: "Hip-Hop",
      jazz: "Jazz", "smooth jazz": "Jazz", bebop: "Jazz", fusion: "Jazz",
      folk: "Folk", "singer-songwriter": "Folk", americana: "Folk", bluegrass: "Folk",
      classical: "Classical", orchestral: "Classical",
      world: "World", afrobeat: "World", afropop: "World",
      electronic: "Electronic/Dance", edm: "Electronic/Dance", dance: "Electronic/Dance",
      country: "Country",
      gospel: "Gospel",
      reggae: "Reggae", dub: "Reggae",
      blues: "Blues",
    };

    const matched = new Set<string>();
    for (const tag of tags.slice(0, 10)) {
      const genre = genreMap[tag.name.toLowerCase()];
      if (genre) matched.add(genre);
    }
    return [...matched].slice(0, 3);
  } catch {
    return [];
  }
}
