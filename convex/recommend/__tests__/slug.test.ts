import { describe, it, expect } from "vitest";
import { artistNameToSlug, randomHash, buildSlug } from "../slug";

describe("artistNameToSlug", () => {
  it("lowercases and hyphenates standard names", () => {
    expect(artistNameToSlug("Arthur Russell")).toBe("arthur-russell");
  });

  it("preserves lowercase artist names (billy woods)", () => {
    expect(artistNameToSlug("billy woods")).toBe("billy-woods");
  });

  it("strips trailing periods (clipping.)", () => {
    expect(artistNameToSlug("clipping.")).toBe("clipping");
  });

  it("strips dollar signs ($uicideboy$)", () => {
    expect(artistNameToSlug("$uicideboy$")).toBe("uicideboy");
  });

  it("handles all-caps acronyms (MGMT)", () => {
    expect(artistNameToSlug("MGMT")).toBe("mgmt");
  });

  it("collapses consecutive special chars to single hyphen", () => {
    expect(artistNameToSlug("!!!")).toBe("");
    expect(artistNameToSlug("The Who: Live at Leeds!")).toBe("the-who-live-at-leeds");
  });

  it("strips leading and trailing hyphens", () => {
    expect(artistNameToSlug("- Test -")).toBe("test");
  });

  it("truncates to 60 chars", () => {
    const long = "a".repeat(100);
    expect(artistNameToSlug(long).length).toBeLessThanOrEqual(60);
  });

  it("returns empty string for punctuation-only input", () => {
    expect(artistNameToSlug("!!!")).toBe("");
    expect(artistNameToSlug("???")).toBe("");
  });
});

describe("randomHash", () => {
  it("returns a string of the requested length", () => {
    expect(randomHash(4).length).toBe(4);
    expect(randomHash(8).length).toBe(8);
    expect(randomHash(16).length).toBe(16);
  });

  it("returns lowercase alphanumeric chars only", () => {
    const hash = randomHash(32);
    expect(hash).toMatch(/^[a-z0-9]+$/);
  });

  it("returns different values on successive calls (with high probability)", () => {
    const hashes = new Set();
    for (let i = 0; i < 100; i++) hashes.add(randomHash(8));
    // 8-char alphanumeric has 36^8 ≈ 2.8T combinations. 100 draws colliding
    // is astronomically unlikely — we expect 100 distinct values.
    expect(hashes.size).toBe(100);
  });
});

describe("buildSlug", () => {
  it("combines artist slug + hash with a hyphen", () => {
    const slug = buildSlug("ANOHNI", 4);
    expect(slug).toMatch(/^anohni-[a-z0-9]{4}$/);
  });

  it("uses 4 chars by default", () => {
    const slug = buildSlug("Bon Iver");
    expect(slug).toMatch(/^bon-iver-[a-z0-9]{4}$/);
  });

  it("supports longer hashes for collision fallback", () => {
    const slug = buildSlug("X", 8);
    expect(slug).toMatch(/^x-[a-z0-9]{8}$/);
  });

  it("falls back to 'tour' prefix for unslug-able names", () => {
    const slug = buildSlug("!!!", 4);
    expect(slug).toMatch(/^tour-[a-z0-9]{4}$/);
  });

  it("preserves punctuation-stripped lowercase (billy woods)", () => {
    const slug = buildSlug("billy woods", 4);
    expect(slug).toMatch(/^billy-woods-[a-z0-9]{4}$/);
  });
});
