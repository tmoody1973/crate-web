/**
 * Shared Perplexity Sonar discovery for influence connections.
 * Extracted from /api/influence/expand so both auth'd and public endpoints can use it.
 */

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

export async function discoverWithPerplexity(
  artist: string,
  model: "sonar" | "sonar-pro",
): Promise<PerplexityDiscoveryResult> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured");

  const systemPrompt =
    "You are a music research assistant. Respond ONLY with valid JSON — no markdown, no extra text.";

  const userPrompt =
    model === "sonar-pro"
      ? `Provide deep context about the musical artist "${artist}":
Return a JSON object with these fields:
{
  "pullQuote": "a memorable quote about ${artist}'s influence or sound (with attribution in pullQuoteAttribution)",
  "pullQuoteAttribution": "who said it / source",
  "sonicElements": ["array", "of", "3-5", "defining", "sonic", "elements"],
  "keyWorks": "2-3 essential albums or tracks that define their influence",
  "context": "2-3 sentence description of their musical significance"
}`
      : `List the top 6-8 musical influence connections for the artist "${artist}".
Return a JSON array where each item has:
{
  "name": "artist name",
  "weight": 0.0-1.0,
  "relationship": "one of: influenced by, influenced, collaboration, similar, sample, inspired by, mentored, shaped",
  "context": "one sentence explaining the connection"
}
Only include well-documented connections. Weight should reflect strength of influence.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: model === "sonar-pro" ? 600 : 1200,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent: string = data?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = data?.citations ?? [];

  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[perplexity-discover] Failed to parse response:", cleaned.slice(0, 500), err);
    return { connections: [], citations, enrichment: null };
  }

  const connections: PerplexityConnection[] = Array.isArray(parsed) ? parsed : [];
  const enrichment =
    !Array.isArray(parsed) && typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;

  return { connections, citations, enrichment };
}
