/**
 * Influence-discovery caller for Perplexity Sonar. Used by:
 *   - /api/influence/expand (authenticated expand of an artist's influences)
 *   - /i/[slug] (zero-login Influence Receipt page)
 *
 * Public API (discoverWithPerplexity, PerplexityConnection,
 * PerplexityDiscoveryResult) is unchanged from the pre-refactor version so
 * existing callers continue to work. Internally, the fetch + retry logic now
 * lives in `src/lib/perplexity-core.ts` — the atomic refactor described in
 * v1-scope.md Key Decision #7.
 *
 * This file contains ONLY the influence-discovery prompt construction and
 * JSON parsing. Tour-generation prompts live in
 * `convex/recommend/perplexityRecommend.ts`.
 */

import { callPerplexity } from "./perplexity-core";

export interface PerplexityConnection {
  name: string;
  weight: number;
  relationship: string;
  context?: string;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  sonicElements?: string[];
  keyWorks?: string;
}

export interface PerplexityDiscoveryResult {
  connections: PerplexityConnection[];
  citations: string[];
  enrichment: Record<string, unknown> | null;
}

const SYSTEM_PROMPT =
  "You are a music research assistant. Respond ONLY with valid JSON — no markdown, no extra text.";

function buildInfluenceUserPrompt(artist: string, model: "sonar" | "sonar-pro"): string {
  if (model === "sonar-pro") {
    return `Provide deep context about the musical artist "${artist}":
Return a JSON object with these fields:
{
  "pullQuote": "a memorable quote about ${artist}'s influence or sound (with attribution in pullQuoteAttribution)",
  "pullQuoteAttribution": "who said it / source",
  "sonicElements": ["array", "of", "3-5", "defining", "sonic", "elements"],
  "keyWorks": "2-3 essential albums or tracks that define their influence",
  "context": "2-3 sentence description of their musical significance"
}`;
  }
  return `List the top 6-8 musical influence connections for the artist "${artist}".
Return a JSON array where each item has:
{
  "name": "artist name",
  "weight": 0.0-1.0,
  "relationship": "one of: influenced by, influenced, collaboration, similar, sample, inspired by, mentored, shaped",
  "context": "one sentence explaining the connection"
}
Only include well-documented connections. Weight should reflect strength of influence.`;
}

export async function discoverWithPerplexity(
  artist: string,
  model: "sonar" | "sonar-pro",
): Promise<PerplexityDiscoveryResult> {
  const { content, citations } = await callPerplexity({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: buildInfluenceUserPrompt(artist, model),
    model,
  });

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (err) {
    console.error(
      "[perplexity-discover] Failed to parse response:",
      content.slice(0, 500),
      err,
    );
    return { connections: [], citations, enrichment: null };
  }

  const connections: PerplexityConnection[] = Array.isArray(parsed) ? parsed : [];
  const enrichment =
    !Array.isArray(parsed) && typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;

  return { connections, citations, enrichment };
}
