/**
 * Perplexity Search API wrapper — `POST /search` for multi-query retrieval
 * that returns ranked web results with extracted snippets, no LLM in the
 * loop. Separate from `perplexity-core.ts` (chat/completions + sonar
 * generation). Used by /recommend before the sonar-pro call to pre-seed
 * curated music-criticism context for mood/emotional/activity queries
 * that don't retrieve well under sonar's single-query retrieval.
 *
 * Docs: https://docs.perplexity.ai/guides/search-api
 */

const PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search";

export type PerplexitySearchHit = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
  last_updated?: string;
};

export type PerplexitySearchArgs = {
  /** Up to 5 queries per API docs. Multi-query aggregates ranked results. */
  queries: string[];
  /** Default 5, max 20. Per-query results Perplexity returns. */
  maxResults?: number;
  /** Content extraction budget per page. 512 = snippets, 4096 = fuller text. */
  maxTokensPerPage?: number;
  /** Allowlist or denylist (use "-" prefix for denylist entries). Max 20. */
  searchDomainFilter?: ReadonlyArray<string>;
  /** Default 8000. Abort on slow responses. */
  timeoutMs?: number;
};

export async function perplexitySearch(
  args: PerplexitySearchArgs,
): Promise<PerplexitySearchHit[]> {
  const {
    queries,
    maxResults = 5,
    maxTokensPerPage = 512,
    searchDomainFilter,
    timeoutMs = 8_000,
  } = args;

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured");
  if (queries.length === 0) return [];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    query: queries.slice(0, 5),
    max_results: maxResults,
    max_tokens_per_page: maxTokensPerPage,
  };
  if (searchDomainFilter && searchDomainFilter.length > 0) {
    body.search_domain_filter = [...searchDomainFilter];
  }

  try {
    const response = await fetch(PERPLEXITY_SEARCH_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Perplexity Search API ${response.status}: ${text.slice(0, 200)}`,
      );
    }

    const json = (await response.json()) as { results?: PerplexitySearchHit[] };
    return json.results ?? [];
  } catch (err) {
    clearTimeout(timer);
    if ((err as Error).name === "AbortError") {
      throw new Error(`Perplexity Search API timed out after ${timeoutMs}ms`);
    }
    throw err;
  }
}
