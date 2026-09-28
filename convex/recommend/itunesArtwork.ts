/**
 * iTunes Search API — fetch album cover art by artist + album. Free,
 * unauthenticated, cached 24h at the Apple CDN edge. Used server-side
 * in the tour generation pipeline so each pick arrives with artwork
 * pre-attached (no client layout shift, no per-card fetch).
 *
 * Docs: https://developer.apple.com/library/archive/documentation/AudioVideo/Conceptual/iTuneSearchAPI/
 */

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const FETCH_TIMEOUT_MS = 3_000;

export type ItunesArtwork = {
  artworkUrl: string;
  artist?: string;
  album?: string;
  year?: number;
};

type ItunesResult = {
  artworkUrl100?: string;
  artistName?: string;
  collectionName?: string;
  releaseDate?: string;
};

async function itunesSearch(term: string, entity: "album"): Promise<ItunesResult | null> {
  if (!term) return null;
  const params = new URLSearchParams({ term, entity, limit: "1" });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${ITUNES_SEARCH_URL}?${params.toString()}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as { results?: ItunesResult[] };
    return data.results?.[0] ?? null;
  } catch {
    clearTimeout(timer);
    return null;
  }
}

/**
 * Look up album artwork. Tries the specific artist+album first; on miss,
 * falls back to the artist's most recent album cover (iTunes doesn't
 * surface standalone artist portraits for music entities, so a recent
 * album cover is the closest decorative match). Returns 600x600 URL, or
 * null if both lookups fail. Swallows all errors — artwork is decorative.
 */
export async function lookupAlbumArtwork(
  artist: string,
  album: string | undefined,
): Promise<ItunesArtwork | null> {
  const bestMatch = await itunesSearch([artist, album].filter(Boolean).join(" "), "album");
  const fallback = bestMatch ? null : await itunesSearch(artist, "album");
  const hit = bestMatch ?? fallback;
  const url = hit?.artworkUrl100?.replace("100x100bb", "600x600bb");
  if (!url) return null;
  return {
    artworkUrl: url,
    artist: hit?.artistName,
    album: hit?.collectionName,
    year: hit?.releaseDate ? Number(hit.releaseDate.slice(0, 4)) : undefined,
  };
}
