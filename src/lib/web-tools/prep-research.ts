/**
 * Perplexity Sonar-powered track research tool for show prep.
 * One API call per track returns synthesized context with citations —
 * replaces 5+ separate API calls (MusicBrainz, Discogs, Genius, etc.).
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createPrepResearchTools(
  perplexityKey: string,
): CrateToolDef[] {
  const researchTrackHandler = async (args: {
    artist: string;
    track: string;
    station?: string;
  }) => {
    const { artist, track, station } = args;

    const stationContext = station
      ? `The DJ is on ${station} in Milwaukee. Include any Milwaukee or local connection.`
      : "";

    const prompt = [
      `Research this song for a radio DJ's show prep: "${track}" by ${artist}.`,
      ``,
      `Return a concise research brief with these sections:`,
      `- **Origin**: How this track came to be (2-3 sentences — recording story, inspiration, studio)`,
      `- **Production**: Producer, key instruments, notable sonic elements`,
      `- **Connections**: Genre lineage, samples used or sampled by, influence chain`,
      `- **Hook**: The one detail a listener can't easily Google — the story behind the song`,
      `- **Why Now**: Why this track matters right now (recent event, anniversary, cultural moment)`,
      `- **Label**: Record label and release year`,
      `- **Pronunciation**: Any non-obvious artist/track name pronunciations`,
      stationContext,
      ``,
      `Be specific and factual. Cite sources. If you're uncertain about a detail, say so.`,
    ].filter(Boolean).join("\n");

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${perplexityKey}`,
        },
        body: JSON.stringify({
          model: "sonar",
          messages: [
            {
              role: "system",
              content: "You are a music research assistant. Return concise, factual research briefs for radio DJs. Include citations.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({
          error: `Perplexity API error: ${res.status}`,
          detail,
        });
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content ?? "";
      const citations = data.citations ?? [];

      return toolResult({
        artist,
        track,
        research: content,
        sources: citations,
      });
    } catch (err) {
      return toolResult({
        error: err instanceof Error ? err.message : "Research failed",
        artist,
        track,
      });
    }
  };

  return [
    {
      name: "research_track",
      description:
        "Research a track for radio show prep using Perplexity Sonar. Returns origin story, production details, genre connections, and DJ-ready context in a single call. Use this instead of multiple search/metadata tools for show prep.",
      inputSchema: {
        artist: z.string().describe("Artist name"),
        track: z.string().describe("Track title"),
        station: z
          .string()
          .optional()
          .describe("Radio station name (e.g. HYFIN, 88Nine, Rhythm Lab) for local context"),
      },
      handler: researchTrackHandler,
    },
  ];
}
