"use node";

/**
 * DIAGNOSTIC ONLY — delete before merging to main.
 *
 * Lets us invoke resolveYouTubeVideoId directly from the Convex CLI to see
 * whether the action can reach the YouTube Data API from Convex's servers.
 */

import { action } from "../_generated/server";
import { v } from "convex/values";
import { resolveYouTubeVideoId } from "./youtubeResolve";

export const diagYouTube = action({
  args: { artistName: v.string(), album: v.optional(v.string()) },
  handler: async (_ctx, { artistName, album }) => {
    return await resolveYouTubeVideoId({ artistName, album });
  },
});

export const diagPerplexityRaw = action({
  args: { query: v.string() },
  handler: async (_ctx, { query }) => {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) return { error: "no key" };
    const res = await fetch("https://api.perplexity.ai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sonar-pro",
        messages: [
          { role: "system", content: "Return a 1-sentence description of the artist with citations." },
          { role: "user", content: query },
        ],
        max_tokens: 500,
        search_domain_filter: [
          "pitchfork.com",
          "thequietus.com",
          "daily.bandcamp.com",
          "npr.org",
          "theguardian.com",
          "allmusic.com",
          "jazztimes.com",
          "wire.co.uk",
          "vulture.com",
          "clashmusic.com",
        ],
      }),
    });
    const status = res.status;
    const text = await res.text();
    return {
      status,
      bodyPrefix: text.slice(0, 2500),
    };
  },
});

export const diagYouTubeBatch = action({
  args: {
    artists: v.array(
      v.object({ name: v.string(), album: v.optional(v.string()) }),
    ),
  },
  handler: async (_ctx, { artists }) => {
    const results = await Promise.all(
      artists.map(async (a) => {
        const r = await resolveYouTubeVideoId({ artistName: a.name, album: a.album });
        return { name: a.name, videoId: r.videoId, failureReason: r.failureReason };
      }),
    );
    return {
      total: results.length,
      resolved: results.filter((r) => r.videoId).length,
      perArtist: results,
    };
  },
});
