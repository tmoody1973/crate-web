/**
 * Generic Perplexity Sonar call. Used by:
 *   - `perplexity-discover.ts` (influence discovery for /i/ and /api/influence/expand)
 *   - `convex/recommend/perplexityRecommend.ts` (tour generation for /recommend)
 *
 * Handles the HTTP call, retry on transient failures, named error classes,
 * and response cleanup (code-fence stripping). Does NOT do JSON parsing or
 * schema validation — callers do that because the expected shape varies.
 *
 * Lives in `src/lib/` (not `convex/`) so the Vercel /i/ page/API routes can
 * import it directly without going through Convex actions. Convex actions can
 * also import it — the file uses only fetch (no Node-specific APIs).
 */

const PERPLEXITY_API_URL = "https://api.perplexity.ai/chat/completions";

// ── Named exceptions (per eng review Section 2 error map) ─────────────────────

export class PerplexityError extends Error {}

export class PerplexityTimeoutError extends PerplexityError {
  constructor(message: string) {
    super(message);
    this.name = "PerplexityTimeoutError";
  }
}

export class PerplexityRateLimitError extends PerplexityError {
  constructor(message: string) {
    super(message);
    this.name = "PerplexityRateLimitError";
  }
}

export class PerplexityAuthError extends PerplexityError {
  constructor(message: string) {
    super(message);
    this.name = "PerplexityAuthError";
  }
}

export class PerplexityUpstreamError extends PerplexityError {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "PerplexityUpstreamError";
    this.status = status;
  }
}

export class PerplexityMalformedResponseError extends PerplexityError {
  readonly raw?: string;
  constructor(message: string, raw?: string) {
    super(message);
    this.name = "PerplexityMalformedResponseError";
    this.raw = raw;
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type CallPerplexityArgs = {
  systemPrompt: string;
  userPrompt: string;
  model: "sonar" | "sonar-pro";
  /** Default 1200 for sonar, 600 for sonar-pro. */
  maxTokens?: number;
  /** Default 0.2 (low randomness for JSON responses). */
  temperature?: number;
  /** Default 15_000 ms — Perplexity can be slow. */
  timeoutMs?: number;
  /** Default 1 (retry once on timeout or 5xx). */
  maxRetries?: number;
  /**
   * Optional allow-list of bare hostnames the model may cite from. Maps to
   * Perplexity's `search_domain_filter` parameter. Use this when the caller
   * needs to constrain sources (e.g. /recommend limits to music publications
   * so it doesn't cite YouTube/Spotify playlist pages as "reviews").
   */
  searchDomainFilter?: ReadonlyArray<string>;
};

export type CallPerplexityResult = {
  /** Cleaned message content (code fences stripped). Callers parse further. */
  content: string;
  /** Citation URLs the model drew from. May be empty. */
  citations: string[];
};

// ── Core call ────────────────────────────────────────────────────────────────

/**
 * Call Perplexity and return cleaned content + citations.
 *
 * Retry strategy:
 *   - PerplexityTimeoutError: retried (model was slow, try again)
 *   - PerplexityUpstreamError (5xx): retried
 *   - PerplexityRateLimitError: retried with exponential backoff (2s, 4s)
 *   - PerplexityAuthError: NOT retried — 401/402 means a config problem
 *   - PerplexityMalformedResponseError: NOT retried — rare, likely schema drift
 *
 * Throws the last error if retry budget is exhausted.
 */
export async function callPerplexity(
  args: CallPerplexityArgs,
): Promise<CallPerplexityResult> {
  const {
    systemPrompt,
    userPrompt,
    model,
    maxTokens = model === "sonar-pro" ? 600 : 1200,
    temperature = 0.2,
    timeoutMs = 15_000,
    maxRetries = 1,
    searchDomainFilter,
  } = args;

  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) {
    throw new Error("PERPLEXITY_API_KEY not configured");
  }

  let lastError: Error = new Error("Unreachable");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await singleCall({
        apiKey,
        model,
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
        timeoutMs,
        searchDomainFilter,
      });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Non-retriable
      if (
        lastError instanceof PerplexityAuthError ||
        lastError instanceof PerplexityMalformedResponseError
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        if (lastError instanceof PerplexityRateLimitError) {
          await sleep(2000 * Math.pow(2, attempt));
        }
        continue;
      }
      throw lastError;
    }
  }

  throw lastError;
}

// ── Internals ────────────────────────────────────────────────────────────────

async function singleCall(opts: {
  apiKey: string;
  model: "sonar" | "sonar-pro";
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
  searchDomainFilter?: ReadonlyArray<string>;
}): Promise<CallPerplexityResult> {
  const {
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    maxTokens,
    temperature,
    timeoutMs,
    searchDomainFilter,
  } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    max_tokens: maxTokens,
    temperature,
  };
  if (searchDomainFilter && searchDomainFilter.length > 0) {
    body.search_domain_filter = [...searchDomainFilter];
  }

  let response: Response;
  try {
    response = await fetch(PERPLEXITY_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      throw new PerplexityTimeoutError(`Perplexity timed out after ${timeoutMs}ms`);
    }
    throw e;
  }
  clearTimeout(timer);

  if (response.status === 401 || response.status === 402) {
    throw new PerplexityAuthError(
      `Perplexity auth error: ${response.status}`,
    );
  }
  if (response.status === 429) {
    throw new PerplexityRateLimitError("Perplexity rate limit exceeded");
  }
  if (response.status >= 500) {
    throw new PerplexityUpstreamError(
      `Perplexity upstream error: ${response.status}`,
      response.status,
    );
  }
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new PerplexityUpstreamError(
      `Perplexity error ${response.status}: ${text.slice(0, 200)}`,
      response.status,
    );
  }

  let data: {
    choices?: Array<{ message?: { content?: string } }>;
    citations?: string[];
  };
  try {
    data = (await response.json()) as typeof data;
  } catch (e) {
    throw new PerplexityMalformedResponseError(
      `Perplexity returned invalid JSON envelope: ${String(e)}`,
    );
  }

  const rawContent = data?.choices?.[0]?.message?.content ?? "";
  const citations = Array.isArray(data?.citations) ? data.citations : [];

  const cleaned = stripCodeFences(rawContent).trim();
  return { content: cleaned, citations };
}

/**
 * Strip markdown code fences from a model response. Perplexity sometimes
 * wraps JSON in ```json ... ``` blocks despite system prompts asking for pure
 * JSON. Exported for testing.
 */
export function stripCodeFences(raw: string): string {
  return raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
