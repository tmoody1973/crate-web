import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  callPerplexity,
  stripCodeFences,
  PerplexityTimeoutError,
  PerplexityRateLimitError,
  PerplexityAuthError,
  PerplexityUpstreamError,
  PerplexityMalformedResponseError,
} from "../perplexity-core";

describe("stripCodeFences", () => {
  it("strips ```json fences (with surrounding whitespace)", () => {
    // The `\s*` in each regex consumes adjacent whitespace — leading newline
    // gone after the opening fence, trailing whitespace gone after close.
    const result = stripCodeFences('```json\n{"a": 1}\n```');
    expect(result.trim()).toBe('{"a": 1}');
    expect(result).not.toContain("```");
  });

  it("strips bare ``` fences", () => {
    const result = stripCodeFences('```\n[1, 2]\n```');
    expect(result.trim()).toBe('[1, 2]');
    expect(result).not.toContain("```");
  });

  it("passes through content with no fences", () => {
    expect(stripCodeFences('{"plain": true}')).toBe('{"plain": true}');
  });

  it("strips only leading/trailing fences, not embedded ones", () => {
    const input = '```json\n{"key": "value"}\n```';
    const result = stripCodeFences(input);
    expect(result).not.toMatch(/^```/);
    expect(result).not.toMatch(/```\s*$/);
  });
});

describe("callPerplexity", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.PERPLEXITY_API_KEY;
  });

  function mockPerplexity(
    content: string,
    opts: { citations?: string[]; status?: number } = {},
  ): Response {
    const { citations = [], status = 200 } = opts;
    return new Response(
      JSON.stringify({
        choices: [{ message: { content } }],
        citations,
      }),
      { status, headers: { "Content-Type": "application/json" } },
    );
  }

  it("returns cleaned content + citations on happy path", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexity('{"foo": "bar"}', {
        citations: ["https://pitchfork.com/a", "https://quietus.com/b"],
      }),
    );

    const result = await callPerplexity({
      systemPrompt: "sys",
      userPrompt: "user",
      model: "sonar",
    });

    expect(result.content).toBe('{"foo": "bar"}');
    expect(result.citations).toEqual([
      "https://pitchfork.com/a",
      "https://quietus.com/b",
    ]);
  });

  it("strips code fences from content", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexity('```json\n{"wrapped": true}\n```'),
    );

    const result = await callPerplexity({
      systemPrompt: "sys",
      userPrompt: "user",
      model: "sonar",
    });

    expect(result.content).toContain('{"wrapped": true}');
    expect(result.content).not.toContain("```");
  });

  it("throws PerplexityAuthError on 401 and does NOT retry", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexity("", { status: 401 }));

    await expect(
      callPerplexity({
        systemPrompt: "x",
        userPrompt: "y",
        model: "sonar",
        maxRetries: 3,
      }),
    ).rejects.toThrow(PerplexityAuthError);
    // No retry on auth errors
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("throws PerplexityRateLimitError on 429 (after retry exhausted)", async () => {
    fetchSpy.mockResolvedValue(mockPerplexity("", { status: 429 }));

    await expect(
      callPerplexity({
        systemPrompt: "x",
        userPrompt: "y",
        model: "sonar",
        maxRetries: 0,
      }),
    ).rejects.toThrow(PerplexityRateLimitError);
  });

  it("throws PerplexityUpstreamError on 5xx", async () => {
    fetchSpy.mockResolvedValue(mockPerplexity("", { status: 503 }));

    await expect(
      callPerplexity({
        systemPrompt: "x",
        userPrompt: "y",
        model: "sonar",
        maxRetries: 0,
      }),
    ).rejects.toThrow(PerplexityUpstreamError);
  });

  it("throws PerplexityMalformedResponseError on non-JSON envelope", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response("<html>not JSON</html>", {
        status: 200,
        headers: { "Content-Type": "text/html" },
      }),
    );

    await expect(
      callPerplexity({
        systemPrompt: "x",
        userPrompt: "y",
        model: "sonar",
        maxRetries: 0,
      }),
    ).rejects.toThrow(PerplexityMalformedResponseError);
  });

  it("returns empty citations when response omits citations field", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ choices: [{ message: { content: "ok" } }] }),
        { status: 200 },
      ),
    );

    const result = await callPerplexity({
      systemPrompt: "x",
      userPrompt: "y",
      model: "sonar",
    });

    expect(result.citations).toEqual([]);
  });

  it("throws if PERPLEXITY_API_KEY missing", async () => {
    delete process.env.PERPLEXITY_API_KEY;

    await expect(
      callPerplexity({
        systemPrompt: "x",
        userPrompt: "y",
        model: "sonar",
      }),
    ).rejects.toThrow(/PERPLEXITY_API_KEY/);
  });

  it("retries on 5xx and succeeds on the second attempt", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexity("", { status: 503 }));
    fetchSpy.mockResolvedValueOnce(mockPerplexity('{"ok": true}'));

    const result = await callPerplexity({
      systemPrompt: "x",
      userPrompt: "y",
      model: "sonar",
    });

    expect(result.content).toBe('{"ok": true}');
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
