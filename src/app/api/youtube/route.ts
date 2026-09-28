import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const YT_API_BASE = "https://www.googleapis.com/youtube/v3";

/**
 * GET /api/youtube?q=track+artist
 * Returns the top YouTube video result for a search query.
 * Uses the YouTube Data API v3 with a server-side key.
 */
export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = req.nextUrl.searchParams.get("q");
  if (!query) {
    return NextResponse.json({ error: "q parameter required" }, { status: 400 });
  }

  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "YouTube API key not configured" },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoCategoryId: "10", // Music category
    maxResults: "1",
    key: apiKey,
  });

  const res = await fetch(`${YT_API_BASE}/search?${params}`);
  if (!res.ok) {
    return NextResponse.json(
      { error: "YouTube search failed" },
      { status: 502 },
    );
  }

  const data = await res.json();
  const item = data.items?.[0];
  if (!item) {
    return NextResponse.json({ error: "No results found" }, { status: 404 });
  }

  return NextResponse.json({
    videoId: item.id.videoId,
    title: item.snippet.title,
    channel: item.snippet.channelTitle,
    thumbnail: item.snippet.thumbnails?.default?.url,
  });
}
