import { describe, it, expect } from "vitest";
import { isBotUserAgent, isPlausibleArtistName } from "../bot-detection";

describe("isBotUserAgent", () => {
  it("treats empty or missing user-agents as bots", () => {
    expect(isBotUserAgent(null)).toBe(true);
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent("   ")).toBe(true);
  });

  it("flags known crawlers, scrapers, and link-unfurlers", () => {
    const bots = [
      "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      "facebookexternalhit/1.1",
      "Twitterbot/1.0",
      "Slackbot-LinkExpanding 1.0",
      "Discordbot/2.0",
      "GPTBot/1.0",
      "ClaudeBot/1.0",
      "PerplexityBot/1.0",
      "WhatsApp/2.0",
      "curl/8.4.0",
      "python-requests/2.31.0",
    ];
    for (const ua of bots) {
      expect(isBotUserAgent(ua)).toBe(true);
    }
  });

  it("allows real browser user-agents", () => {
    const browsers = [
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Gecko/20100101 Firefox/121.0",
    ];
    for (const ua of browsers) {
      expect(isBotUserAgent(ua)).toBe(false);
    }
  });
});

describe("isPlausibleArtistName", () => {
  it("accepts normal artist names", () => {
    expect(isPlausibleArtistName("Kendrick Lamar")).toBe(true);
    expect(isPlausibleArtistName("billy woods")).toBe(true);
    expect(isPlausibleArtistName("Sigur Rós")).toBe(true);
    expect(isPlausibleArtistName("JPEGMAFIA")).toBe(true);
    expect(isPlausibleArtistName("A$AP Rocky")).toBe(true);
  });

  it("rejects empty, whitespace, and over-long input", () => {
    expect(isPlausibleArtistName("")).toBe(false);
    expect(isPlausibleArtistName("   ")).toBe(false);
    expect(isPlausibleArtistName("a".repeat(81))).toBe(false);
  });

  it("rejects letterless and injection-shaped input", () => {
    expect(isPlausibleArtistName("12345")).toBe(false);
    expect(isPlausibleArtistName("../../etc/passwd")).toBe(false);
    expect(isPlausibleArtistName("<script>")).toBe(false);
    expect(isPlausibleArtistName("https://evil.example.com")).toBe(false);
  });
});
