import { NextRequest, NextResponse } from "next/server";
import catalogData from "../../../../../public/tinydesk/catalog.json";
import { toSlug } from "@/components/tinydesk/catalog-types";

export const maxDuration = 30;

interface SaveRequest {
  artist: string;
  tagline: string;
  userId: string;
  connections: Array<{
    name: string;
    weight: number;
    relationship: string;
    context: string;
    sources?: Array<{ name?: string; url?: string }>;
    pullQuote?: string;
    sonicElements?: string[];
    keyWorks?: string;
  }>;
}

interface CatalogEntry {
  artist: string;
  slug: string;
  genre: string[];
  youtubeId: string | null;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as SaveRequest;
  const { artist, tagline, userId, connections } = body;

  if (!artist || !userId) {
    return NextResponse.json({ error: "artist and userId required" }, { status: 400 });
  }
  if (!connections || connections.length < 1) {
    return NextResponse.json({ error: "at least 1 connection required" }, { status: 400 });
  }

  const slug = toSlug(artist);
  const catalog = catalogData as CatalogEntry[];
  const catalogEntry = catalog.find((c) => c.slug === slug);

  const catalogYoutubeId = catalogEntry?.youtubeId ?? null;
  const catalogGenre = catalogEntry?.genre ?? [];

  const [mainVideoId, genre] = await Promise.all([
    catalogYoutubeId
      ? Promise.resolve(catalogYoutubeId)
      : resolveYoutubeId(`${artist} tiny desk concert NPR`),
    catalogGenre.length > 0
      ? Promise.resolve(catalogGenre)
      : resolveGenre(artist),
  ]);

  const connectionNames = connections.map((c) => c.name).filter(Boolean);
  const connectionVideos = await resolveConnectionVideos(connectionNames);

  const nodes = connections.map((c) => ({
    name: c.name,
    role: c.relationship,
    connection: c.context,
    strength: c.weight,
    source: c.sources?.[0]?.name ?? "",
    sourceUrl: c.sources?.[0]?.url ?? "",
    sourceQuote: c.pullQuote ?? "",
    sonicDna: c.sonicElements ?? [],
    keyWorks: c.keyWorks
      ? c.keyWorks.split("→").map((w: string) => {
          const m = w.trim().match(/^(.+?)\s*\((\d{4})\)$/);
          return m ? { title: m[1].trim(), year: m[2] } : { title: w.trim(), year: "" };
        })
      : [],
    videoId: connectionVideos[c.name] ?? "",
    videoTitle: connectionVideos[c.name] ? c.name : "",
  }));

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return NextResponse.json({ error: "CONVEX_URL not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(`${convexUrl}/api/mutation`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "tinydeskCompanions:create",
        args: {
          slug,
          artist,
          tagline: tagline.slice(0, 200),
          tinyDeskVideoId: mainVideoId ?? "",
          nodes: JSON.stringify(nodes),
          userId,
          genre: genre.length > 0 ? genre : undefined,
          isCommunitySubmitted: true,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Convex error: ${err}` }, { status: 500 });
    }

    return NextResponse.json({
      slug,
      artist,
      videoId: mainVideoId,
      genre,
      nodeCount: nodes.length,
      nodesWithVideo: nodes.filter((n) => n.videoId).length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Save failed: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 },
    );
  }
}

async function resolveConnectionVideos(names: string[]): Promise<Record<string, string>> {
  if (names.length === 0) return {};
  const results: Record<string, string> = {};
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
  try {
    const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36" },
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
      rock: "Rock", "indie rock": "Rock", alternative: "Rock",
      latin: "Latin", reggaeton: "Latin", salsa: "Latin",
      pop: "Pop", "indie pop": "Pop",
      "hip-hop": "Hip-Hop", "hip hop": "Hip-Hop", rap: "Hip-Hop",
      jazz: "Jazz", "smooth jazz": "Jazz", bebop: "Jazz", fusion: "Jazz",
      folk: "Folk", "singer-songwriter": "Folk", americana: "Folk", bluegrass: "Folk",
      classical: "Classical", orchestral: "Classical",
      world: "World", afrobeat: "World", afropop: "World",
      electronic: "Electronic/Dance", edm: "Electronic/Dance", dance: "Electronic/Dance",
      country: "Country", gospel: "Gospel", reggae: "Reggae", dub: "Reggae", blues: "Blues",
    };
    const matched = new Set<string>();
    for (const tag of tags.slice(0, 10)) {
      const genre = genreMap[tag.name.toLowerCase()];
      if (genre) matched.add(genre);
    }
    return [...matched].slice(0, 3);
  } catch { return []; }
}
