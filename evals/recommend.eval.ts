/**
 * /recommend tour-quality eval suite (opt-in).
 *
 * This file is NOT run by `vitest run` (no `*.test.ts` suffix). To run it:
 *
 *   bunx vitest run evals/recommend.eval.ts --no-coverage
 *
 * Each case fires the real Perplexity call and asserts structural properties
 * about the response (count, citation coverage, no fabricated URLs). That
 * means it requires PERPLEXITY_API_KEY and spends real tokens — run it when
 * you're debugging tour quality, not in CI.
 *
 * Add new cases here when you find a prompt that produces a degenerate tour.
 * Keep each case small: 1–2 assertions max. The point is regression detection,
 * not exhaustive coverage.
 */

import { describe, it, expect, beforeAll } from "vitest";
import { recommendFromPerplexity } from "../convex/recommend/perplexityRecommend";
import type { StructuredQuery } from "../convex/recommend/types";

const runIfKey = process.env.PERPLEXITY_API_KEY ? describe : describe.skip;

runIfKey("/recommend tour-quality eval", () => {
  beforeAll(() => {
    if (!process.env.PERPLEXITY_API_KEY) {
      throw new Error(
        "PERPLEXITY_API_KEY is required to run this eval suite.",
      );
    }
  });

  const CASES: Array<{
    label: string;
    query: StructuredQuery;
    minPicks: number;
    minCited: number;
  }> = [
    {
      label: "mood_theme: climate grief",
      query: {
        intent_type: "mood_theme",
        mood: { valence: -0.6, arousal: 0.3 },
        themes: ["climate", "grief", "environmental anxiety"],
        raw_text: "sad about the climate but I still want to dance",
      },
      minPicks: 8,
      minCited: 3,
    },
    {
      label: "era_genre: 90s Detroit techno",
      query: {
        intent_type: "era_genre",
        era_hint: "1990s Detroit techno",
        sonic_hints: ["techno", "machine funk", "minimal"],
        raw_text: "prep me for a 90s Detroit techno DJ set",
      },
      minPicks: 8,
      minCited: 3,
    },
    {
      label: "artist_similar: Arthur Russell",
      query: {
        intent_type: "artist_similar",
        artist_hints: ["Arthur Russell"],
        raw_text: "new artists influenced by Arthur Russell",
      },
      minPicks: 8,
      minCited: 3,
    },
  ];

  for (const c of CASES) {
    it(c.label, async () => {
      const result = await recommendFromPerplexity({ structuredQuery: c.query });
      expect(result.picks.length).toBeGreaterThanOrEqual(c.minPicks);

      const cited = result.picks.filter(
        (p) => typeof p.quote_url === "string" && /^https?:/.test(p.quote_url),
      );
      expect(cited.length).toBeGreaterThanOrEqual(c.minCited);

      // No picks with a URL but no publication (malformed source attribution)
      const mismatched = result.picks.filter(
        (p) => p.quote_url && !p.quote_publication,
      );
      expect(mismatched).toHaveLength(0);
    }, 60_000);
  }
});
