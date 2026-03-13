import { NextRequest, NextResponse } from "next/server";

// ── Spotify token cache (module-level, survives across requests) ──

let cachedToken: string | null = null;
let tokenExpiresAt = 0;

async function getSpotifyToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) return null;

  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = data.access_token;
  tokenExpiresAt = now + (data.expires_in - 60) * 1000;
  return cachedToken;
}

// ── Spotify image picker ─────────────────────────────────────────

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

function pickBestImage(images: SpotifyImage[]): string | null {
  if (images.length === 0) return null;
  const preferred = images.find((img) => img.width === 640 && img.height === 640);
  if (preferred) return preferred.url;
  const sorted = [...images].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? null;
}

// ── Spotify search ───────────────────────────────────────────────

async function searchSpotify(
  query: string,
  type: "album" | "artist",
): Promise<Record<string, unknown>[] | null> {
  const token = await getSpotifyToken();
  if (!token) return null;

  const params = new URLSearchParams({ type, q: query, limit: "3" });
  const res = await fetch(`https://api.spotify.com/v1/search?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) return null;

  const data = await res.json();

  if (type === "album") {
    const items = data.albums?.items ?? [];
    return items.map((item: Record<string, unknown>) => ({
      name: item.name,
      artist: (item.artists as Array<{ name: string }>)?.map((a) => a.name).join(", "),
      image: pickBestImage((item.images as SpotifyImage[]) ?? []),
      spotify_url: (item.external_urls as Record<string, string>)?.spotify,
      release_date: item.release_date ?? null,
    }));
  }

  const items = data.artists?.items ?? [];
  return items.map((item: Record<string, unknown>) => ({
    name: item.name,
    image: pickBestImage((item.images as SpotifyImage[]) ?? []),
    spotify_url: (item.external_urls as Record<string, string>)?.spotify,
    genres: item.genres ?? [],
  }));
}

/**
 * Artwork lookup via iTunes Search API + optional Spotify proxy.
 *
 * iTunes (default):
 *   GET /api/artwork?artist=Miles+Davis&album=Kind+of+Blue
 *   GET /api/artwork?q=Miles+Davis+Kind+of+Blue
 *
 * Spotify:
 *   GET /api/artwork?q=Miles+Davis&type=artist&source=spotify
 *   GET /api/artwork?q=Kind+of+Blue&type=album&source=spotify
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const artist = searchParams.get("artist");
  const album = searchParams.get("album");
  const q = searchParams.get("q");
  const source = searchParams.get("source");
  const type = (searchParams.get("type") as "album" | "artist") ?? "album";

  const term = q || [artist, album].filter(Boolean).join(" ");
  if (!term) {
    return NextResponse.json({ error: "artist/album or q param required" }, { status: 400 });
  }

  // ── Spotify source ──────────────────────────────────────────────
  if (source === "spotify") {
    const results = await searchSpotify(term, type);
    if (results === null) {
      return NextResponse.json(
        { error: "Spotify credentials not configured or API error" },
        { status: 502 },
      );
    }
    return NextResponse.json({ source: "spotify", type, results });
  }

  // ── iTunes (default) ────────────────────────────────────────────
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
