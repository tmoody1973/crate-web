import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { recommendFromPerplexity } from "../perplexityRecommend";
import { PerplexityMalformedResponseError } from "../../../src/lib/perplexity-core";
import type { StructuredQuery } from "../types";

describe("recommendFromPerplexity", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.PERPLEXITY_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.PERPLEXITY_API_KEY;
  });

  function mockPerplexityResponse(
    picks: Array<Record<string, unknown>>,
    citations: string[] = [],
  ): Response {
    return new Response(
      JSON.stringify({
        choices: [{ message: { content: JSON.stringify(picks) } }],
        citations,
      }),
      { status: 200 },
    );
  }

  const moodTheme: StructuredQuery = {
    intent_type: "mood_theme",
    mood: { valence: -0.5, arousal: 0.3 },
    themes: ["climate", "grief"],
    raw_text: "sad about the climate",
  };

  it("returns parsed picks + citations", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse(
        [
          {
            name: "ANOHNI",
            album: "My Back Was a Bridge for You to Cross",
            year: 2023,
            quote_text: "A restless searching album",
            quote_publication: "Pitchfork",
            quote_url: "https://pitchfork.com/x",
          },
          {
            name: "Cassandra Jenkins",
            album: "An Overview on Phenomenal Nature",
            year: 2021,
          },
        ],
        ["https://pitchfork.com/x", "https://quietus.com/y"],
      ),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });

    expect(result.picks).toHaveLength(2);
    expect(result.picks[0]!.name).toBe("ANOHNI");
    expect(result.citations).toHaveLength(2);
  });

  it("flags isSparse when fewer than 8 picks", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse([
        { name: "A" },
        { name: "B" },
        { name: "C" },
      ]),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });
    expect(result.isSparse).toBe(true);
  });

  it("does NOT flag isSparse when 8+ picks", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse(
        Array.from({ length: 9 }, (_, i) => ({ name: `Artist ${i}` })),
      ),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });
    expect(result.isSparse).toBe(false);
  });

  it("flags isCitationless when zero http(s) citations", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse([{ name: "X" }], []),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });
    expect(result.isCitationless).toBe(true);
  });

  it("filters non-http citations from the result", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse(
        [{ name: "X" }],
        ["https://valid.com", "not-a-url", "ftp://weird.com"],
      ),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });
    expect(result.citations).toEqual(["https://valid.com"]);
  });

  it("throws PerplexityMalformedResponseError on non-array response", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse([]).constructor.prototype === Response.prototype
        ? new Response(
            JSON.stringify({
              choices: [{ message: { content: '{"not_an": "array"}' } }],
              citations: [],
            }),
            { status: 200 },
          )
        : new Response("err"),
    );

    await expect(
      recommendFromPerplexity({ structuredQuery: moodTheme }),
    ).rejects.toThrow(PerplexityMalformedResponseError);
  });

  it("throws PerplexityMalformedResponseError when content is not JSON", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [{ message: { content: "just prose, no JSON" } }],
          citations: [],
        }),
        { status: 200 },
      ),
    );

    await expect(
      recommendFromPerplexity({ structuredQuery: moodTheme }),
    ).rejects.toThrow(PerplexityMalformedResponseError);
  });

  it("routes to era_genre prompt builder for era_genre intent", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexityResponse([{ name: "Derrick May" }]));

    const eraQuery: StructuredQuery = {
      intent_type: "era_genre",
      era_hint: "90s Detroit",
      sonic_hints: ["techno"],
      raw_text: "90s Detroit techno",
    };

    const result = await recommendFromPerplexity({ structuredQuery: eraQuery });
    expect(result.picks).toHaveLength(1);

    // Verify the request body included era hint (via inspection)
    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("90s Detroit");
    expect(userMsg.content).toContain("techno");
  });

  it("injects wiki memory when keptArtistNames provided", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexityResponse([{ name: "X" }]));

    await recommendFromPerplexity({
      structuredQuery: moodTheme,
      keptArtistNames: ["ANOHNI", "Moor Mother"],
      passedArtistNames: ["Some Weird Pick"],
    });

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).toContain("User taste memory");
    expect(userMsg.content).toContain("ANOHNI");
    expect(userMsg.content).toContain("Moor Mother");
    expect(userMsg.content).toContain("Some Weird Pick");
  });

  it("omits wiki memory section when no kept/passed lists provided", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexityResponse([{ name: "X" }]));

    await recommendFromPerplexity({ structuredQuery: moodTheme });

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    const userMsg = body.messages.find((m: { role: string }) => m.role === "user");
    expect(userMsg.content).not.toContain("User taste memory");
  });

  it("injects Spotify seed artists into the user prompt as soft context", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexityResponse([{ name: "A" }]));

    await recommendFromPerplexity({
      structuredQuery: moodTheme,
      spotifySeedArtists: ["Burial", "Arca", "Caroline Polachek"],
    });

    const body = JSON.parse(
      (fetchSpy.mock.calls[0]![1] as RequestInit).body as string,
    ) as { messages: Array<{ role: string; content: string }> };
    const userMsg =
      body.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).toContain("Spotify listening");
    expect(userMsg).toContain("Burial, Arca, Caroline Polachek");
    // Must not be presented as a hard constraint
    expect(userMsg).toContain("NOT a constraint");
  });

  it("omits the Spotify block when no seeds are provided", async () => {
    fetchSpy.mockResolvedValueOnce(mockPerplexityResponse([{ name: "A" }]));
    await recommendFromPerplexity({ structuredQuery: moodTheme });
    const body = JSON.parse(
      (fetchSpy.mock.calls[0]![1] as RequestInit).body as string,
    ) as { messages: Array<{ role: string; content: string }> };
    const userMsg =
      body.messages.find((m) => m.role === "user")?.content ?? "";
    expect(userMsg).not.toContain("Spotify listening");
  });

  it("preserves artist name casing (billy woods, JPEGMAFIA)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockPerplexityResponse([
        { name: "billy woods" },
        { name: "JPEGMAFIA" },
        { name: "clipping." },
      ]),
    );

    const result = await recommendFromPerplexity({ structuredQuery: moodTheme });
    expect(result.picks.map((p) => p.name)).toEqual([
      "billy woods",
      "JPEGMAFIA",
      "clipping.",
    ]);
  });
});
