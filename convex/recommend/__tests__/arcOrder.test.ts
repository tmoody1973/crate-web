import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  orderArc,
  fallbackArcOrder,
  ArcOrderCountMismatchError,
} from "../arcOrder";

describe("orderArc", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.ANTHROPIC_API_KEY = "test-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.ANTHROPIC_API_KEY;
  });

  function mockArcResponse(artists: Array<{ name: string; arcPosition: number; reason?: string }>): Response {
    return new Response(
      JSON.stringify({
        content: [{ type: "text", text: JSON.stringify(artists) }],
      }),
      { status: 200 },
    );
  }

  it("reorders artists into arc positions", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockArcResponse([
        { name: "ANOHNI", arcPosition: 0, reason: "anchoring entry" },
        { name: "Moor Mother", arcPosition: 1, reason: "build" },
        { name: "Grouper", arcPosition: 2, reason: "turn inward" },
      ]),
    );

    const result = await orderArc({
      artistNames: ["Moor Mother", "ANOHNI", "Grouper"],
      queryContext: "sad about the climate",
    });

    expect(result).toHaveLength(3);
    expect(result[0]!.name).toBe("ANOHNI");
    expect(result[0]!.arcPosition).toBe(0);
    expect(result[0]!.reason).toBe("anchoring entry");
  });

  it("throws ArcOrderCountMismatchError when LLM drops artists", async () => {
    // Input has 3 artists but LLM only returns 2
    fetchSpy.mockResolvedValueOnce(
      mockArcResponse([
        { name: "ANOHNI", arcPosition: 0 },
        { name: "Moor Mother", arcPosition: 1 },
      ]),
    );

    await expect(
      orderArc({
        artistNames: ["ANOHNI", "Moor Mother", "Grouper"],
        queryContext: "test",
      }),
    ).rejects.toThrow(ArcOrderCountMismatchError);
  });

  it("throws ArcOrderCountMismatchError when LLM adds artists", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockArcResponse([
        { name: "A", arcPosition: 0 },
        { name: "B", arcPosition: 1 },
        { name: "C", arcPosition: 2 },
        { name: "D", arcPosition: 3 }, // extra
      ]),
    );

    await expect(
      orderArc({
        artistNames: ["A", "B", "C"],
        queryContext: "test",
      }),
    ).rejects.toThrow(ArcOrderCountMismatchError);
  });

  it("passes reason through when provided", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockArcResponse([
        { name: "X", arcPosition: 0, reason: "anchors the mood" },
      ]),
    );
    const result = await orderArc({
      artistNames: ["X"],
      queryContext: "y",
    });
    expect(result[0]!.reason).toBe("anchors the mood");
  });

  it("handles missing reason gracefully (schema allows optional)", async () => {
    fetchSpy.mockResolvedValueOnce(
      mockArcResponse([{ name: "X", arcPosition: 0 }]),
    );
    const result = await orderArc({
      artistNames: ["X"],
      queryContext: "y",
    });
    expect(result[0]!.reason).toBeUndefined();
  });
});

describe("fallbackArcOrder", () => {
  it("preserves input order and assigns arcPosition by index", () => {
    const result = fallbackArcOrder(["A", "B", "C", "D"]);
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      name: "A",
      arcPosition: 0,
      reason: "fallback order",
    });
    expect(result[3]).toEqual({
      name: "D",
      arcPosition: 3,
      reason: "fallback order",
    });
  });

  it("returns empty array for empty input", () => {
    expect(fallbackArcOrder([])).toEqual([]);
  });

  it("handles a single artist", () => {
    const result = fallbackArcOrder(["solo"]);
    expect(result).toEqual([
      { name: "solo", arcPosition: 0, reason: "fallback order" },
    ]);
  });
});
