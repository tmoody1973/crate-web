import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classifyIntent } from "../intentClassify";
import { HaikuMalformedJSONError } from "../haikuStructured";

describe("classifyIntent", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ANTHROPIC_API_KEY;
  });

  function mockClassifier(response: object): Response {
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(response) }],
      }),
      { status: 200 },
    );
  }

  it("classifies a mood_theme prompt", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({
        intent_type: "mood_theme",
        mood: { valence: -0.6, arousal: 0.3 },
        themes: ["climate", "grief"],
        raw_text: "feeling down about the climate",
      }),
    );

    const result = await classifyIntent("feeling down about the climate");
    expect(result.intent_type).toBe("mood_theme");
    expect(result.mood?.valence).toBe(-0.6);
    expect(result.themes).toEqual(["climate", "grief"]);
    expect(result.raw_text).toBe("feeling down about the climate");
  });

  it("classifies an era_genre prompt", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({
        intent_type: "era_genre",
        era_hint: "90s Detroit",
        sonic_hints: ["techno", "underground"],
        raw_text: "90s Detroit techno",
      }),
    );

    const result = await classifyIntent("90s Detroit techno");
    expect(result.intent_type).toBe("era_genre");
    expect(result.era_hint).toBe("90s Detroit");
  });

  it("classifies an artist_similar prompt", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({
        intent_type: "artist_similar",
        artist_hints: ["Fela Kuti"],
        raw_text: "if you love Fela Kuti",
      }),
    );

    const result = await classifyIntent("if you love Fela Kuti");
    expect(result.intent_type).toBe("artist_similar");
    expect(result.artist_hints).toContain("Fela Kuti");
  });

  it("classifies a vague prompt with no hints", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({
        intent_type: "vague",
        raw_text: "good music",
      }),
    );

    const result = await classifyIntent("good music");
    expect(result.intent_type).toBe("vague");
    expect(result.mood).toBeUndefined();
    expect(result.themes).toBeUndefined();
  });

  it("classifies an emotional prompt", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({
        intent_type: "emotional",
        mood: { valence: -0.7, arousal: 0.4 },
        raw_text: "I just broke up",
      }),
    );

    const result = await classifyIntent("I just broke up");
    expect(result.intent_type).toBe("emotional");
  });

  it("throws HaikuMalformedJSONError on invalid intent_type after retry exhaustion", async () => {
    // Must mock TWICE with fresh Response objects — Response bodies are
    // single-read streams. The helper retries once on validation failure.
    const bad = { intent_type: "not_a_real_intent", raw_text: "x" };
    fetchSpy.mockResolvedValueOnce(mockClassifier(bad));
    fetchSpy.mockResolvedValueOnce(mockClassifier(bad));

    await expect(classifyIntent("x")).rejects.toThrow(HaikuMalformedJSONError);
  });

  it("requires raw_text in the response", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({ intent_type: "mood_theme" }),
    );
    fetchSpy.mockResolvedValueOnce(
      mockClassifier({ intent_type: "mood_theme" }),
    );

    await expect(classifyIntent("anything")).rejects.toThrow(HaikuMalformedJSONError);
  });

  it("validates mood.valence is in range [-1, 1]", async () => {
    const outOfRange = {
      intent_type: "mood_theme",
      mood: { valence: 5, arousal: 0.5 },
      raw_text: "x",
    };
    fetchSpy.mockResolvedValueOnce(mockClassifier(outOfRange));
    fetchSpy.mockResolvedValueOnce(mockClassifier(outOfRange));

    await expect(classifyIntent("x")).rejects.toThrow(HaikuMalformedJSONError);
  });
});
