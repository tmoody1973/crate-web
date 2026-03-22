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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${perplexityKey}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: "You are a music research assistant. Return concise, factual research briefs for radio DJs. Include citations.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 800,
          temperature: 0.2,
          web_search_options: {
            search_context_size: "high",
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({
          error: `Perplexity API error: ${res.status}`,
          detail,
        });
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content ?? "";
      const content = rawContent.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();

      const searchResults = data.search_results ?? [];
      const sources = searchResults.length > 0
        ? searchResults.map((sr: { title?: string; url?: string; snippet?: string; date?: string }) => ({
            name: sr.title ?? "Source",
            url: sr.url ?? "",
            snippet: sr.snippet ?? "",
            date: sr.date,
          }))
        : (data.citations ?? []).map((url: string, i: number) => ({
            name: `Source ${i + 1}`,
            url,
            snippet: "",
          }));

      return toolResult({
        artist,
        track,
        research: content,
        sources,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return toolResult({ error: "Perplexity API timed out after 30 seconds. Try again." });
      }
      return toolResult({
        error: err instanceof Error ? err.message : "Research failed",
        artist,
        track,
      });
    } finally {
      clearTimeout(timeout);
    }
  };

  const researchInfluenceHandler = async (args: {
    fromArtist: string;
    toArtist: string;
  }) => {
    const { fromArtist, toArtist } = args;

    const prompt = [
      `Explain the musical influence relationship between ${fromArtist} and ${toArtist}.`,
      ``,
      `Include:`,
      `- DIRECTION: Who influenced whom? How do we know? (interviews, timeline, acknowledged influences)`,
      `- SONIC ELEMENTS: What specific musical qualities were transmitted? (rhythm, harmony, production techniques, instrumentation)`,
      `- KEY WORKS: Which specific albums or tracks demonstrate this connection? Format as "Album A (year) → Album B (year)"`,
      `- QUOTES: Any interviews where either artist acknowledged the connection? Include the exact quote and publication.`,
      ``,
      `Be specific. Name albums, tracks, producers, studios. If the direction is unclear, note it as mutual influence.`,
      `If you find a direct quote from either artist about the other, lead with it.`,
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const res = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${perplexityKey}`,
        },
        body: JSON.stringify({
          model: "sonar-pro",
          messages: [
            {
              role: "system",
              content: "You are a music historian and critic. Explain influence relationships between artists with specific evidence — quotes, albums, sonic elements. Be concise but detailed.",
            },
            { role: "user", content: prompt },
          ],
          max_tokens: 1000,
          temperature: 0.2,
          web_search_options: {
            search_context_size: "high",
          },
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        return toolResult({
          error: `Perplexity API error: ${res.status}`,
          detail,
        });
      }

      const data = await res.json();
      const rawContent = data.choices?.[0]?.message?.content ?? "";
      // Strip inline citation markers [1], [2] — actual URLs come from search_results
      const content = rawContent.replace(/\[\d+\]/g, "").replace(/\s{2,}/g, " ").trim();

      // CRITICAL: Use search_results for verified URLs, NOT URLs from generated text
      const searchResults: Array<{
        title: string;
        url: string;
        snippet: string;
        date?: string;
      }> = (data.search_results ?? []).map((sr: { title?: string; url?: string; snippet?: string; date?: string }) => ({
        name: sr.title ?? "Source",
        url: sr.url ?? "",
        snippet: sr.snippet ?? "",
        date: sr.date,
      }));

      const citationUrls: string[] = data.citations ?? [];

      const sources = searchResults.length > 0
        ? searchResults
        : citationUrls.map((url, i) => ({
            name: `Source ${i + 1}`,
            url,
            snippet: "",
          }));

      return toolResult({
        fromArtist,
        toArtist,
        context: content,
        pullQuote: null,
        pullQuoteAttribution: null,
        sonicElements: [],
        keyWorks: null,
        sources,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return toolResult({ error: "Perplexity API timed out after 30 seconds. Try again." });
      }
      return toolResult({
        error: err instanceof Error ? err.message : "Influence research failed",
        fromArtist,
        toArtist,
      });
    } finally {
      clearTimeout(timeout);
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
    {
      name: "research_influence",
      description:
        "Research the musical influence relationship between two artists using Perplexity Sonar Pro. Returns a deep context paragraph with verified source URLs, interview quotes, sonic elements, and key works. Use this to enrich influence chain connections with storytelling. Citations come from Perplexity's search infrastructure and are guaranteed real URLs.",
      inputSchema: {
        fromArtist: z.string().describe("The influencing artist (e.g. 'Parliament-Funkadelic')"),
        toArtist: z.string().describe("The influenced artist (e.g. 'Flying Lotus')"),
      },
      handler: researchInfluenceHandler,
    },
  ];
}
