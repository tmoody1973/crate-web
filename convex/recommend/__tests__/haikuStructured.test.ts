import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";
import {
  parseJSONFromResponse,
  HaikuMalformedJSONError,
  HaikuRefusalError,
  HaikuTimeoutError,
  AnthropicRateLimitError,
  AnthropicUpstreamError,
  haikuStructured,
} from "../haikuStructured";

describe("parseJSONFromResponse", () => {
  it("parses pure JSON objects", () => {
    expect(parseJSONFromResponse('{"foo": 1}')).toEqual({ foo: 1 });
  });

  it("parses pure JSON arrays", () => {
    expect(parseJSONFromResponse('[1, 2, 3]')).toEqual([1, 2, 3]);
  });

  it("trims whitespace before parsing", () => {
    expect(parseJSONFromResponse('  \n  {"foo": 1}\n  ')).toEqual({ foo: 1 });
  });

  it("extracts JSON from preamble (brace-slice fallback)", () => {
    const raw = 'Sure, here is the JSON:\n\n{"foo": "bar"}\n\nLet me know if you need anything else.';
    expect(parseJSONFromResponse(raw)).toEqual({ foo: "bar" });
  });

  it("extracts arrays from preamble", () => {
    const raw = 'Here is the list:\n[1, 2, 3]\nDone.';
    expect(parseJSONFromResponse(raw)).toEqual([1, 2, 3]);
  });

  it("throws HaikuMalformedJSONError on no JSON found", () => {
    expect(() => parseJSONFromResponse("just plain prose no json")).toThrow(
      HaikuMalformedJSONError,
    );
  });

  it("throws HaikuMalformedJSONError on broken braces", () => {
    expect(() => parseJSONFromResponse('{"foo": "unterminated string')).toThrow(
      HaikuMalformedJSONError,
    );
  });

  it("handles nested JSON objects correctly", () => {
    const raw = '{"outer": {"inner": [1, 2, {"deep": true}]}}';
    expect(parseJSONFromResponse(raw)).toEqual({
      outer: { inner: [1, 2, { deep: true }] },
    });
  });

  it("prefers earlier-appearing delimiter when both object and array present", () => {
    // Object appears first — should parse as object
    const raw = '{"key": "value"} then later [1, 2]';
    expect(parseJSONFromResponse(raw)).toEqual({ key: "value" });
  });
});

// ─── haikuStructured (integration with mocked fetch) ─────────────────────────

const TestSchema = z.object({
  intent_type: z.enum(["mood_theme", "era_genre", "vague"]),
  raw_text: z.string(),
});

describe("haikuStructured", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Require the env var so the helper doesn't bail early
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ANTHROPIC_API_KEY;
  });

  function mockAnthropicResponse(body: object, status = 200): Response {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }

  it("returns the parsed schema-validated response on success", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [
          {
            type: "text",
            text: '{"intent_type": "mood_theme", "raw_text": "sad climate music"}',
          },
        ],
        stop_reason: "end_turn",
      }),
    );

    const result = await haikuStructured({
      systemPrompt: "You are a classifier.",
      userContent: "sad climate music",
      schema: TestSchema,
    });

    expect(result).toEqual({ intent_type: "mood_theme", raw_text: "sad climate music" });
  });

  it("throws HaikuMalformedJSONError when schema validation fails", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"intent_type": "invalid_type", "raw_text": "x"}' }],
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [{ type: "text", text: '{"intent_type": "invalid_type", "raw_text": "x"}' }],
      }),
    );

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
      }),
    ).rejects.toThrow(HaikuMalformedJSONError);
  });

  it("retries once on malformed JSON and succeeds on the second attempt", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [{ type: "text", text: "not valid json at all" }],
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [
          {
            type: "text",
            text: '{"intent_type": "mood_theme", "raw_text": "retry worked"}',
          },
        ],
      }),
    );

    const result = await haikuStructured({
      systemPrompt: "x",
      userContent: "y",
      schema: TestSchema,
    });

    expect(result.intent_type).toBe("mood_theme");
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("throws HaikuRefusalError when model returns no text block", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({
        content: [],
        stop_reason: "refusal",
      }),
    );

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
      }),
    ).rejects.toThrow(HaikuRefusalError);
  });

  it("does NOT retry on HaikuRefusalError (refusal is explicit, respect it)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockAnthropicResponse({ content: [], stop_reason: "refusal" }),
    );

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
        maxRetries: 3,
      }),
    ).rejects.toThrow(HaikuRefusalError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws AnthropicRateLimitError on 429 (after retry exhausted)", async () => {
    fetchSpy.mockResolvedValue(mockAnthropicResponse({ error: "rate limited" }, 429));

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
        maxRetries: 0, // no retry so test is fast
      }),
    ).rejects.toThrow(AnthropicRateLimitError);
  });

  it("throws AnthropicUpstreamError on 5xx", async () => {
    fetchSpy.mockResolvedValue(mockAnthropicResponse({}, 503));

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
        maxRetries: 0,
      }),
    ).rejects.toThrow(AnthropicUpstreamError);
  });

  it("throws error if ANTHROPIC_API_KEY is missing", async () => {
    delete process.env.ANTHROPIC_API_KEY;

    await expect(
      haikuStructured({
        systemPrompt: "x",
        userContent: "y",
        schema: TestSchema,
      }),
    ).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
