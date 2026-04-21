"use node";

/**
 * Voyage-3 embedding helper. One call per prompt — returns a 1024-dim vector
 * for storage in `artifactsRecommend.promptEmbedding` (used by the similarity
 * cache tuning data, per v1-scope.md Cherry-pick #8a).
 *
 * Per eng review Section 1 Issue 1: Voyage-3 is the locked embedding model
 * (1024 dimensions). Same model will also be used for the corpus-review
 * embeddings when/if Approach C lands, so no migration cost at C.
 *
 * Uses direct fetch (no SDK) for parity with haikuStructured / perplexity-core
 * and easy test mocking.
 */

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const DEFAULT_MODEL = "voyage-3";
const EXPECTED_DIMENSIONS = 1024;

// ── Named exceptions ─────────────────────────────────────────────────────────

export class VoyageError extends Error {}

export class VoyageUnavailableError extends VoyageError {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "VoyageUnavailableError";
  }
}

export class VoyageRateLimitError extends VoyageError {
  constructor(message: string) {
    super(message);
    this.name = "VoyageRateLimitError";
  }
}

export class VoyageDimensionError extends VoyageError {
  constructor(readonly returnedDim: number, readonly expectedDim: number) {
    super(`Voyage returned ${returnedDim}-dim vector, expected ${expectedDim}`);
    this.name = "VoyageDimensionError";
  }
}

export class VoyageEmptyVectorError extends VoyageError {
  constructor() {
    super("Voyage returned an empty embedding array");
    this.name = "VoyageEmptyVectorError";
  }
}

export class VoyageTimeoutError extends VoyageError {
  constructor(timeoutMs: number) {
    super(`Voyage timed out after ${timeoutMs}ms`);
    this.name = "VoyageTimeoutError";
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

export type EmbedArgs = {
  /** Text to embed. */
  text: string;
  /** "query" for search prompts, "document" for corpus items. Default "query". */
  inputType?: "query" | "document";
  /** Override the default voyage-3 model. */
  modelOverride?: string;
  /** Timeout per attempt in ms. Default 5000. */
  timeoutMs?: number;
  /** Retry budget on transient failures. Default 1. */
  maxRetries?: number;
};

export type EmbedResult = {
  embedding: number[];
  model: string;
};

/**
 * Embed a single text and return its 1024-dim vector.
 *
 * Retry strategy:
 *   - VoyageUnavailableError (5xx): retried with exponential backoff
 *   - VoyageRateLimitError: retried with longer backoff
 *   - VoyageTimeoutError: retried once
 *   - VoyageDimensionError: NOT retried (config problem)
 *   - VoyageEmptyVectorError: NOT retried (model returning nothing)
 */
export async function embedText(args: EmbedArgs): Promise<EmbedResult> {
  const {
    text,
    inputType = "query",
    modelOverride,
    timeoutMs = 5000,
    maxRetries = 1,
  } = args;

  if (!text || text.trim().length === 0) {
    throw new VoyageEmptyVectorError();
  }

  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("VOYAGE_API_KEY not configured");
  }

  const model = modelOverride ?? DEFAULT_MODEL;
  let lastError: Error = new Error("Unreachable");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await singleEmbedCall({
        apiKey,
        model,
        text,
        inputType,
        timeoutMs,
      });
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));

      // Non-retriable errors
      if (
        lastError instanceof VoyageDimensionError ||
        lastError instanceof VoyageEmptyVectorError
      ) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        if (lastError instanceof VoyageRateLimitError) {
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

async function singleEmbedCall(opts: {
  apiKey: string;
  model: string;
  text: string;
  inputType: "query" | "document";
  timeoutMs: number;
}): Promise<EmbedResult> {
  const { apiKey, model, text, inputType, timeoutMs } = opts;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        input: [text],
        model,
        input_type: inputType,
      }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      throw new VoyageTimeoutError(timeoutMs);
    }
    throw e;
  }
  clearTimeout(timer);

  if (response.status === 429) {
    throw new VoyageRateLimitError("Voyage rate limit exceeded");
  }
  if (response.status >= 500) {
    throw new VoyageUnavailableError(
      `Voyage upstream error: ${response.status}`,
      response.status,
    );
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new VoyageUnavailableError(
      `Voyage error ${response.status}: ${body.slice(0, 200)}`,
      response.status,
    );
  }

  const data = (await response.json()) as {
    data?: Array<{ embedding?: number[]; index?: number }>;
  };

  const first = data.data?.[0];
  if (!first || !Array.isArray(first.embedding) || first.embedding.length === 0) {
    throw new VoyageEmptyVectorError();
  }

  if (first.embedding.length !== EXPECTED_DIMENSIONS) {
    throw new VoyageDimensionError(first.embedding.length, EXPECTED_DIMENSIONS);
  }

  return { embedding: first.embedding, model };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
