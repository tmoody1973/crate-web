"use node";

/**
 * YouTube video id resolver for /recommend tour artists.
 *
 * Given an artist name (+ optional album), calls YouTube Data API v3 to find
 * the first relevant video id. We store it in `artifactsRecommend.artists[].youtubeTrackId`
 * so the tour page can embed an inline player instead of falling back to a
 * link-out to youtube.com/results.
 *
 * Quota budget: `search.list` costs 100 units per call; daily free tier is
 * 10,000 units. 10 artists × 10 tours/day = ~100 searches/day = 10k units,
 * right at the ceiling. In practice we cap failures silently and skip any
 * artists we can't resolve. If the quota runs out mid-day, everyone after
 * that just falls back to link-out — the tour still renders, just without
 * inline players.
 *
 * This is intentionally simple: one short fetch per artist, 2s timeout,
 * no retries. The pipeline doesn't need perfect YouTube data to succeed.
 */

const YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search";
const YOUTUBE_TIMEOUT_MS = 2500;

export type YouTubeResolveResult = {
  videoId: string | null;
  failureReason?: "no_key" | "quota" | "no_match" | "network" | "timeout" | "forbidden";
};

/**
 * Search YouTube for a single artist+album combo. Returns the first video id
 * or null if nothing matches / call fails. Never throws — failures are
 * surfaced via `failureReason` for logging but not the error channel.
 */
export async function resolveYouTubeVideoId(args: {
  artistName: string;
  album?: string;
}): Promise<YouTubeResolveResult> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return { videoId: null, failureReason: "no_key" };

  const query = args.album
    ? `${args.artistName} ${args.album}`
    : `${args.artistName} full album`;

  const url = new URL(YOUTUBE_SEARCH_URL);
  url.searchParams.set("part", "snippet");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "video");
  url.searchParams.set("maxResults", "1");
  url.searchParams.set("safeSearch", "moderate");
  url.searchParams.set("videoEmbeddable", "true");
  url.searchParams.set("key", apiKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), YOUTUBE_TIMEOUT_MS);
  try {
    const res = await fetch(url.toString(), { signal: controller.signal });
    if (!res.ok) {
      if (res.status === 403) {
        // Could be quota exhausted or invalid key — both result in the same
        // user-visible behavior (no inline embed for this artist).
        return { videoId: null, failureReason: "forbidden" };
      }
      return { videoId: null, failureReason: "network" };
    }
    const data = (await res.json()) as {
      items?: Array<{ id?: { videoId?: string } }>;
      error?: { code?: number };
    };
    if (data.error?.code === 403) {
      return { videoId: null, failureReason: "quota" };
    }
    const videoId = data.items?.[0]?.id?.videoId;
    if (!videoId) return { videoId: null, failureReason: "no_match" };
    return { videoId };
  } catch (e) {
    if ((e as Error).name === "AbortError") {
      return { videoId: null, failureReason: "timeout" };
    }
    return { videoId: null, failureReason: "network" };
  } finally {
    clearTimeout(timer);
  }
}
