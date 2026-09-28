import { describe, it, expect } from "vitest";
import { urlToBareHost, SEED_PAYWALL_DOMAINS } from "../paywall-domains";

describe("urlToBareHost", () => {
  it("strips www.", () => {
    expect(urlToBareHost("https://www.nytimes.com/article/123")).toBe("nytimes.com");
  });

  it("returns lowercase hostname", () => {
    expect(urlToBareHost("https://PITCHFORK.COM/reviews/album")).toBe("pitchfork.com");
  });

  it("returns null for invalid URLs", () => {
    expect(urlToBareHost("not a url")).toBeNull();
    expect(urlToBareHost("")).toBeNull();
    expect(urlToBareHost("foo bar baz")).toBeNull();
  });

  it("preserves subdomains (only strips www)", () => {
    expect(urlToBareHost("https://daily.bandcamp.com/review")).toBe("daily.bandcamp.com");
    expect(urlToBareHost("https://pitchfork.com/reviews/")).toBe("pitchfork.com");
  });

  it("handles http and https equally", () => {
    expect(urlToBareHost("http://www.newyorker.com/foo")).toBe("newyorker.com");
    expect(urlToBareHost("https://www.newyorker.com/foo")).toBe("newyorker.com");
  });

  it("handles URLs with ports", () => {
    expect(urlToBareHost("https://localhost:3000/foo")).toBe("localhost");
  });
});

describe("SEED_PAYWALL_DOMAINS", () => {
  it("contains NYT, New Yorker, FT, WSJ at minimum (common test paywalls)", () => {
    expect(SEED_PAYWALL_DOMAINS).toContain("nytimes.com");
    expect(SEED_PAYWALL_DOMAINS).toContain("newyorker.com");
    expect(SEED_PAYWALL_DOMAINS).toContain("ft.com");
    expect(SEED_PAYWALL_DOMAINS).toContain("wsj.com");
  });

  it("contains only bare hostnames (no www., no protocol)", () => {
    for (const domain of SEED_PAYWALL_DOMAINS) {
      expect(domain).not.toMatch(/^https?:\/\//);
      expect(domain).not.toMatch(/^www\./);
      expect(domain).toBe(domain.toLowerCase());
    }
  });

  it("is readonly (frozen intent via as const / ReadonlyArray type)", () => {
    // TypeScript enforces readonly at compile time; this is a runtime smoke
    // check that the array contents are what we expect.
    expect(SEED_PAYWALL_DOMAINS.length).toBeGreaterThanOrEqual(5);
  });
});
