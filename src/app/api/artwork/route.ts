import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight album artwork lookup via iTunes Search API.
 * Free, no auth required, returns clean artwork URLs up to 600x600.
 *
 * Usage: GET /api/artwork?artist=Miles+Davis&album=Kind+of+Blue
 *    or: GET /api/artwork?q=Miles+Davis+Kind+of+Blue
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const artist = searchParams.get("artist");
  const album = searchParams.get("album");
  const q = searchParams.get("q");

  const term = q || [artist, album].filter(Boolean).join(" ");
  if (!term) {
    return NextResponse.json({ error: "artist/album or q param required" }, { status: 400 });
  }

  const url = `https://itunes.apple.com/search?${new URLSearchParams({
    term,
    entity: "album",
    limit: "1",
  })}`;

  const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h
  if (!res.ok) {
    return NextResponse.json({ error: "iTunes API error" }, { status: 502 });
  }

  const data = await res.json();
  const result = data.results?.[0];

  if (!result) {
    return NextResponse.json({ artworkUrl: null });
  }

  // iTunes returns 100x100 by default, swap to 600x600 for quality
  const artworkUrl = (result.artworkUrl100 as string)?.replace("100x100bb", "600x600bb") ?? null;

  return NextResponse.json({
    artworkUrl,
    artist: result.artistName,
    album: result.collectionName,
    year: result.releaseDate?.slice(0, 4),
  });
}
