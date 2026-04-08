import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/tinydesk/enrich
 * Body: { artist: string }
 * Returns: { youtubeId: string | null, genre: string[] }
 *
 * Resolves YouTube video ID and genre for a Tiny Desk companion save.
 */
export async function POST(req: NextRequest) {
  const { artist } = (await req.json()) as { artist: string };
  if (!artist) {
    return NextResponse.json({ error: "artist required" }, { status: 400 });
  }

  const [youtubeId, genre] = await Promise.all([
    resolveYoutubeId(artist),
    resolveGenre(artist),
  ]);

  return NextResponse.json({ youtubeId, genre });
}

async function resolveYoutubeId(artist: string): Promise<string | null> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const query = `${artist} tiny desk concert NPR`;

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
      headers: { "User-Agent": "Mozilla/5.0" },
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
  // Use Last.fm top tags for genre detection
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

    // Map Last.fm tags to our genre categories
    const genreMap: Record<string, string> = {
      "rnb": "R&B/Soul", "r&b": "R&B/Soul", "soul": "R&B/Soul", "neo-soul": "R&B/Soul",
      "rock": "Rock", "indie rock": "Rock", "alternative": "Rock", "punk": "Rock", "grunge": "Rock",
      "latin": "Latin", "reggaeton": "Latin", "salsa": "Latin", "cumbia": "Latin", "bossa nova": "Latin",
      "pop": "Pop", "indie pop": "Pop", "synth-pop": "Pop",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", "rap": "Hip-Hop",
      "jazz": "Jazz", "smooth jazz": "Jazz", "bebop": "Jazz", "fusion": "Jazz",
      "folk": "Folk", "singer-songwriter": "Folk", "americana": "Folk", "bluegrass": "Folk",
      "classical": "Classical", "orchestral": "Classical", "contemporary classical": "Classical",
      "world": "World", "afrobeat": "World", "afropop": "World", "k-pop": "World",
      "electronic": "Electronic/Dance", "edm": "Electronic/Dance", "dance": "Electronic/Dance", "house": "Electronic/Dance", "techno": "Electronic/Dance",
      "country": "Country",
      "gospel": "Gospel",
      "reggae": "Reggae", "dub": "Reggae",
      "blues": "Blues",
    };

    const matched = new Set<string>();
    for (const tag of tags.slice(0, 10)) {
      const normalized = tag.name.toLowerCase();
      const genre = genreMap[normalized];
      if (genre) matched.add(genre);
    }
    return [...matched].slice(0, 3);
  } catch {
    return [];
  }
}
