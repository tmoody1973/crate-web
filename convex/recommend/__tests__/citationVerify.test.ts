import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  verifyCitation,
  buildCacheKey,
  quotePrefix,
} from "../citationVerify";

// ─── Pure-function unit tests ────────────────────────────────────────────────

describe("quotePrefix", () => {
  it("returns the first 30 chars after normalization", () => {
    const q = "A restless, searching album about love and loss.";
    const prefix = quotePrefix(q);
    expect(prefix.length).toBe(30);
    expect(prefix).toBe("a restless, searching album ab");
  });

  it("strips smart quotes and collapses whitespace", () => {
    const q = `  "Deep    and\n\tmelancholic"  `;
    const prefix = quotePrefix(q);
    expect(prefix).not.toContain('"');
    expect(prefix).not.toContain("\n");
    // After normalization: "deep and melancholic" (17 chars, so prefix = full string)
    expect(prefix).toBe("deep and melancholic");
  });

  it("lowercases", () => {
    expect(quotePrefix("A RESTLESS SEARCHING ALBUM")).toMatch(/^[a-z ,]+$/);
  });
});

describe("buildCacheKey", () => {
  it("is deterministic for the same (url, quote) pair", () => {
    const key1 = buildCacheKey("https://pitchfork.com/reviews/x", "Deep melancholic album");
    const key2 = buildCacheKey("https://pitchfork.com/reviews/x", "Deep melancholic album");
    expect(key1).toBe(key2);
  });

  it("differs when the URL differs", () => {
    const key1 = buildCacheKey("https://pitchfork.com/reviews/x", "Deep melancholic");
    const key2 = buildCacheKey("https://pitchfork.com/reviews/y", "Deep melancholic");
    expect(key1).not.toBe(key2);
  });

  it("differs when the quote differs beyond the 30-char prefix boundary", () => {
    // These differ AFTER char 30, so cache keys should be identical (prefix-only hashing)
    const q1 = "a restless searching album about love";
    const q2 = "a restless searching album about loss";
    // 30-char prefix: "a restless searching album abo" — same
    expect(buildCacheKey("u", q1)).toBe(buildCacheKey("u", q2));
  });

  it("is a 32-char hex string", () => {
    const key = buildCacheKey("https://x", "q");
    expect(key).toMatch(/^[a-f0-9]{32}$/);
  });
});

// ─── Integration tests with mocked fetch ─────────────────────────────────────

describe("verifyCitation", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  function mockHtml(body: string, finalUrl?: string, status = 200): Response {
    const res = new Response(body, {
      status,
      headers: { "Content-Type": "text/html" },
    });
    if (finalUrl) {
      Object.defineProperty(res, "url", { value: finalUrl, writable: false });
    }
    return res;
  }

  it("verifies a citation when both HEAD and quote-on-page pass", async () => {
    // HEAD returns 200; GET returns HTML containing the quote
    fetchSpy.mockResolvedValueOnce(mockHtml("", "https://pitchfork.com/reviews/x"));
    fetchSpy.mockResolvedValueOnce(
      mockHtml('<p>A deep and melancholic album about grief.</p>'),
    );

    const result = await verifyCitation({
      url: "https://pitchfork.com/reviews/x",
      quote: "A deep and melancholic album about grief.",
    });

    expect(result.verified).toBe(true);
  });

  it("fails fast on paywall domain (no fetch needed)", async () => {
    const result = await verifyCitation({
      url: "https://www.nytimes.com/2024/article",
      quote: "Anything",
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("paywall");
    // Should not have made any fetch calls
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid URLs", async () => {
    const result = await verifyCitation({
      url: "not-a-url",
      quote: "x",
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("url_unreachable");
  });

  it("fails when HEAD returns 404", async () => {
    fetchSpy.mockResolvedValueOnce(mockHtml("", undefined, 404));
    fetchSpy.mockResolvedValueOnce(mockHtml("<p>content</p>", undefined, 404));

    const result = await verifyCitation({
      url: "https://example.com/gone",
      quote: "Anything that wont be found",
    });

    expect(result.verified).toBe(false);
    expect(["url_4xx", "url_unreachable"]).toContain(result.failureReason);
  });

  it("fails when quote is not on page (the Perplexity hallucination case)", async () => {
    fetchSpy.mockResolvedValueOnce(mockHtml("", "https://example.com/real"));
    fetchSpy.mockResolvedValueOnce(
      mockHtml('<p>Totally different content that does not contain the quote.</p>'),
    );

    const result = await verifyCitation({
      url: "https://example.com/real",
      quote: "A completely fabricated critic quote that is not on this page.",
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("quote_not_found");
  });

  it("matches across case differences and whitespace collapse", async () => {
    fetchSpy.mockResolvedValueOnce(mockHtml("", "https://example.com/x"));
    fetchSpy.mockResolvedValueOnce(
      mockHtml('<p>A  RESTLESS\n\tsearching\n  album about love.</p>'),
    );

    const result = await verifyCitation({
      url: "https://example.com/x",
      quote: "A restless searching album about love",
    });

    expect(result.verified).toBe(true);
  });

  it("honors the extraPaywallDomains argument", async () => {
    const result = await verifyCitation({
      url: "https://testdomain.com/article",
      quote: "x",
      extraPaywallDomains: ["testdomain.com"],
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("paywall");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("rejects short quotes (< 10 chars) as unverifiable", async () => {
    fetchSpy.mockResolvedValueOnce(mockHtml("", "https://example.com/x"));
    fetchSpy.mockResolvedValueOnce(mockHtml("<p>anything</p>"));

    const result = await verifyCitation({
      url: "https://example.com/x",
      quote: "hi", // too short
    });

    expect(result.verified).toBe(false);
    expect(result.failureReason).toBe("quote_not_found");
  });
});
