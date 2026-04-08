import { NextRequest, NextResponse } from "next/server";
import catalogData from "../../../../../public/tinydesk/catalog.json";
import { toSlug } from "@/components/tinydesk/catalog-types";
import { resolveYoutubeId, resolveGenre, resolveConnectionVideos } from "@/lib/tinydesk-enrichment";

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

