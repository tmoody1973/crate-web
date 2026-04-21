/**
 * Decomposes a StructuredQuery into 3-5 specific retrieval queries for
 * the Perplexity Search API. Pre-seeds the sonar-pro generation call
 * with curated music-criticism context, sidestepping sonar's weak
 * single-query retrieval on mood/emotional/activity intents.
 *
 * Design rule: each query mixes content types that DO exist on music
 * publications — album reviews, artist interviews, critic lists,
 * feature articles. Interviews matter especially for emotional/mood
 * queries where the artist's own framing of the work is higher-signal
 * than a third-party review.
 */

import type { StructuredQuery } from "./types";

const MAX_QUERIES = 5;

export function decomposeToQueries(q: StructuredQuery): string[] {
  const base = q.raw_text.trim();
  const theme = q.themes?.[0] ?? "";
  const sonic = q.sonic_hints?.join(" ") ?? "";
  const era = q.era_hint ?? "";
  const activity = q.activity_hint ?? "";
  const seed = q.artist_hints?.[0] ?? "";

  let queries: string[];

  switch (q.intent_type) {
    case "mood_theme":
      queries = [
        `${base} album reviews music criticism`,
        sonic ? `${sonic} artists interview feature` : `${base} artists interview`,
        theme ? `${theme} critically acclaimed albums` : `${base} critics recommend`,
        `${base} music publication feature`,
      ];
      break;

    case "emotional":
      queries = [
        `${base} albums music review`,
        `artists interview about ${theme || base}`,
        `music for ${theme || base} critics recommend`,
        `albums about ${theme || base} critical essay`,
      ];
      break;

    case "era_genre":
      queries = [
        `${era || base} essential albums retrospective`,
        `${era || base} ${sonic} pioneers interview`.trim(),
        `${era || base} genre history music publication`,
        `${base} critically acclaimed albums`,
      ];
      break;

    case "artist_similar":
      queries = [
        `${seed} influences interview feature`,
        `artists like ${seed} music criticism review`,
        `${seed} contemporaries album review`,
        `${seed} similar artists critics recommend`,
      ];
      break;

    case "activity":
      queries = [
        `albums for ${activity || base} music critics recommend`,
        `music for ${activity || base} review feature`,
        `${base} artists interview`,
      ];
      break;

    case "show_prep":
      queries = [
        `${base} artists feature music criticism`,
        `${base} albums reviewed critics`,
        `${base} essential music coverage`,
        `${base} artists interview deep cuts`,
      ];
      break;

    case "single_artist": {
      const artist = seed || base;
      queries = [
        `${artist} album reviews discography`,
        `${artist} interview career retrospective`,
        `${artist} critical essay music publication`,
        `${artist} albums critics essential`,
      ];
      break;
    }

    case "vague":
      queries = [
        `${base} music albums critics recommend`,
        `${base} musical artists critically acclaimed`,
      ];
      break;

    default:
      queries = [base];
  }

  return queries
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, MAX_QUERIES);
}
