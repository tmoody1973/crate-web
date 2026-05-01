import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  embedText,
  VoyageUnavailableError,
  VoyageRateLimitError,
  VoyageDimensionError,
  VoyageEmptyVectorError,
} from "../voyageEmbed";

describe("embedText", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.VOYAGE_API_KEY = "test-voyage-key";
    fetchSpy = vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    fetchSpy.mockRestore();
    delete process.env.VOYAGE_API_KEY;
  });

  function mockVoyage(embedding: number[], status = 200): Response {
    return new Response(
      JSON.stringify({
        data: [{ embedding, index: 0 }],
        usage: { total_tokens: 5 },
      }),
      { status },
    );
  }

  it("returns a 1024-dim embedding on happy path", async () => {
    const embedding = Array.from({ length: 1024 }, (_, i) => i / 1024);
    fetchSpy.mockResolvedValueOnce(mockVoyage(embedding));

    const result = await embedText({ text: "sad about the climate" });
    expect(result.embedding).toHaveLength(1024);
    expect(result.model).toBe("voyage-3");
  });

  it("sends input_type=query by default", async () => {
    const embedding = Array.from({ length: 1024 }, () => 0.5);
    fetchSpy.mockResolvedValueOnce(mockVoyage(embedding));

    await embedText({ text: "x" });

    const [, init] = fetchSpy.mock.calls[0]!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.input_type).toBe("query");
    expect(body.model).toBe("voyage-3");
  });

  it("throws VoyageEmptyVectorError on empty text", async () => {
    await expect(embedText({ text: "" })).rejects.toThrow(VoyageEmptyVectorError);
    await expect(embedText({ text: "   " })).rejects.toThrow(VoyageEmptyVectorError);
    // fetch should NOT have been called
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("throws VoyageDimensionError when Voyage returns wrong dim", async () => {
    const wrongDim = Array.from({ length: 512 }, () => 0.1);
    fetchSpy.mockResolvedValueOnce(mockVoyage(wrongDim));

    await expect(embedText({ text: "x" })).rejects.toThrow(VoyageDimensionError);
  });

  it("throws VoyageEmptyVectorError when Voyage returns empty embedding", async () => {
    fetchSpy.mockResolvedValueOnce(mockVoyage([]));

    await expect(embedText({ text: "x" })).rejects.toThrow(VoyageEmptyVectorError);
  });

  it("throws VoyageRateLimitError on 429 (no retry)", async () => {
    fetchSpy.mockResolvedValue(mockVoyage([], 429));

    await expect(
      embedText({ text: "x", maxRetries: 0 }),
    ).rejects.toThrow(VoyageRateLimitError);
  });

  it("throws VoyageUnavailableError on 5xx", async () => {
    fetchSpy.mockResolvedValue(mockVoyage([], 503));

    await expect(
      embedText({ text: "x", maxRetries: 0 }),
    ).rejects.toThrow(VoyageUnavailableError);
  });

  it("retries on 5xx and succeeds on second attempt", async () => {
    const goodEmbedding = Array.from({ length: 1024 }, () => 0.5);
    fetchSpy.mockResolvedValueOnce(mockVoyage([], 503));
    fetchSpy.mockResolvedValueOnce(mockVoyage(goodEmbedding));

    const result = await embedText({ text: "x" });
    expect(result.embedding).toHaveLength(1024);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry on dimension mismatch (config problem)", async () => {
    const wrongDim = Array.from({ length: 999 }, () => 0);
    fetchSpy.mockResolvedValue(mockVoyage(wrongDim));

    await expect(
      embedText({ text: "x", maxRetries: 3 }),
    ).rejects.toThrow(VoyageDimensionError);
    expect(fetchSpy).toHaveBeenCalledTimes(1); // no retry
  });

  it("throws when VOYAGE_API_KEY missing", async () => {
    delete process.env.VOYAGE_API_KEY;

    await expect(embedText({ text: "x" })).rejects.toThrow(/VOYAGE_API_KEY/);
  });
});
