import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  redactPrompt,
  fallbackRedact,
  RedactionTooLongError,
} from "../promptRedact";

describe("redactPrompt", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ANTHROPIC_API_KEY;
  });

  function mockRedactionResponse(redacted: string): Response {
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify({ redacted }) }],
      }),
      { status: 200 },
    );
  }

  it("returns the redacted summary on happy path", async () => {
    fetchSpy.mockResolvedValueOnce(mockRedactionResponse("songs for ecological grief"));

    const result = await redactPrompt("I'm feeling down about the climate");
    expect(result).toBe("songs for ecological grief");
  });

  it("accepts a 4-word redaction (minimum)", async () => {
    fetchSpy.mockResolvedValueOnce(mockRedactionResponse("music for road trips"));
    expect(await redactPrompt("x")).toBe("music for road trips");
  });

  it("accepts an 8-word redaction (at the upper sweet-spot)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockRedactionResponse("modern artists inspired by the Fela Kuti sound"),
    );
    expect(await redactPrompt("x")).toBe("modern artists inspired by the Fela Kuti sound");
  });

  it("throws RedactionTooLongError when model returns more than 10 words", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockRedactionResponse(
        "this is a redacted summary that is way too long for our limit of ten words",
      ),
    );

    await expect(redactPrompt("x")).rejects.toThrow(RedactionTooLongError);
  });

  it("allows up to 10 words (slight grace above the 8-word target)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockRedactionResponse("one two three four five six seven eight nine ten"),
    );
    expect(await redactPrompt("x")).toBe(
      "one two three four five six seven eight nine ten",
    );
  });

  it("handles redactions with multi-space whitespace", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockRedactionResponse("   songs    for   climate grief   "),
    );
    // Word count is 4 after collapsing whitespace, so this passes.
    const result = await redactPrompt("x");
    expect(result.trim().split(/\s+/).length).toBe(4);
  });
});

describe("fallbackRedact", () => {
  it("returns input unchanged when short", () => {
    expect(fallbackRedact("short prompt")).toBe("short prompt");
  });

  it("collapses whitespace", () => {
    expect(fallbackRedact("  some   prompt\n\twith\nwhitespace  ")).toBe(
      "some prompt with whitespace",
    );
  });

  it("truncates to 50 chars with ellipsis when longer", () => {
    const long =
      "This is a very long prompt that definitely exceeds the fifty character limit we impose on fallback redactions.";
    const result = fallbackRedact(long);
    expect(result.length).toBeLessThanOrEqual(51); // 50 + ellipsis
    expect(result.endsWith("…")).toBe(true);
  });

  it("handles exactly 50 characters (no truncation needed)", () => {
    const exactly50 = "a".repeat(50);
    expect(fallbackRedact(exactly50)).toBe(exactly50);
  });

  it("handles empty string", () => {
    expect(fallbackRedact("")).toBe("");
  });

  it("handles whitespace-only input", () => {
    expect(fallbackRedact("   \n\t  ")).toBe("");
  });
});
