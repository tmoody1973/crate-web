import { describe, it, expect } from "vitest";
import { shouldIngest, extractArtistData } from "../wiki-ingest";

// ── shouldIngest ─────────────────────────────────────────

describe("shouldIngest", () => {
  it("returns true for qualifying web tool servers", () => {
    expect(shouldIngest("spotify-connected")).toBe(true);
    expect(shouldIngest("whosampled")).toBe(true);
    expect(shouldIngest("bandcamp-web")).toBe(true);
    expect(shouldIngest("influencecache")).toBe(true);
    expect(shouldIngest("prep-research")).toBe(true);
  });

  it("returns true for qualifying crate-cli servers", () => {
    expect(shouldIngest("influence")).toBe(true);
    expect(shouldIngest("genius")).toBe(true);
    expect(shouldIngest("lastfm")).toBe(true);
    expect(shouldIngest("discogs")).toBe(true);
    expect(shouldIngest("websearch")).toBe(true);
    expect(shouldIngest("musicbrainz")).toBe(true);
  });

  it("returns false for non-qualifying servers", () => {
    expect(shouldIngest("slack")).toBe(false);
    expect(shouldIngest("google-docs")).toBe(false);
    expect(shouldIngest("tumblr-connected")).toBe(false);
    expect(shouldIngest("telegraph")).toBe(false);
    expect(shouldIngest("browser")).toBe(false);
  });

  it("returns false for unknown servers", () => {
    expect(shouldIngest("")).toBe(false);
    expect(shouldIngest("unknown-server")).toBe(false);
  });
});

// ── extractArtistData: influence chain ───────────────────

describe("extractArtistData — influence chain", () => {
  it("extracts readable text from influence connections", () => {
    const content = JSON.stringify({
      artist: "Khruangbin",
      cached: true,
      connections: [
        {
          artist: "Lee Perry",
          relationship: "influenced",
          context: "Dub and reggae pioneer",
          sources: [{ name: "AllMusic", snippet: "Lee Perry shaped dub" }],
        },
      ],
    });
    const result = extractArtistData("influencecache", "get_influence", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Khruangbin");
    expect(result!.section.heading).toBe("Influence Chain");
    expect(result!.section.content).toContain("Lee Perry");
    expect(result!.section.content).toContain("influenced");
    expect(result!.section.content).not.toContain('"artist"'); // No raw JSON
  });

  it("skips empty connections with cached=false", () => {
    const content = JSON.stringify({
      artist: "Nobody",
      cached: false,
      connections: [],
    });
    const result = extractArtistData("influencecache", "get_influence", content);
    expect(result).toBeNull();
  });

  it("extracts from_artist for influence cache edges", () => {
    const content = JSON.stringify({
      from_artist: "Thundercat",
      to_artist: "Khruangbin",
      relationship: "influenced by bass-forward funk and jazz fusion experimentation",
      context: "Thundercat's virtuosic bass playing and jazz fusion approach directly shaped Khruangbin's groove-heavy style",
      cached: true,
    });
    const result = extractArtistData("influencecache", "cache_influence", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Thundercat");
  });
});

// ── extractArtistData: Spotify ───────────────────────────

describe("extractArtistData — Spotify", () => {
  it("extracts from Spotify search results", () => {
    const content = JSON.stringify({
      artists: {
        items: [
          { name: "Erykah Badu", genres: ["neo soul", "r&b"], popularity: 72, followers: { total: 2500000 } },
        ],
      },
    });
    const result = extractArtistData("spotify-connected", "search_spotify", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Erykah Badu");
    expect(result!.section.content).toContain("neo soul");
    expect(result!.section.content).toContain("72/100");
    expect(result!.section.sources[0].tool).toBe("Spotify");
  });

  it("extracts from top_artists library data", () => {
    const content = JSON.stringify({
      type: "top_artists",
      items: [{ name: "J Dilla", genres: ["hip hop", "instrumental"] }],
    });
    const result = extractArtistData("spotify-connected", "get_spotify_library", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("J Dilla");
  });

  it("returns null for empty items", () => {
    const content = JSON.stringify({ artists: { items: [] } });
    const result = extractArtistData("spotify-connected", "search_spotify", content);
    expect(result).toBeNull();
  });
});

// ── extractArtistData: reviews/genius ────────────────────

describe("extractArtistData — Genius/reviews", () => {
  it("extracts readable text from reviews", () => {
    const content = JSON.stringify({
      artist: "DOMi & JD BECK",
      album: "NOT TiGHT",
      review_count: 3,
      reviews: [
        { source: "Pitchfork", snippet: "Zoomer jazz prodigies sculpt rhythmic architecture" },
        { source: "NME", snippet: "A frenetic debut" },
      ],
    });
    const result = extractArtistData("genius", "search_genius", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("DOMi & JD BECK");
    expect(result!.section.content).toContain("Pitchfork");
    expect(result!.section.content).toContain("Zoomer jazz");
    expect(result!.section.content).not.toContain('"review_count"'); // No raw JSON
  });
});

// ── extractArtistData: Last.fm ───────────────────────────

describe("extractArtistData — Last.fm", () => {
  it("extracts listeners, playcount, bio summary", () => {
    const content = JSON.stringify({
      name: "Fela Kuti",
      listeners: 450000,
      playcount: 12000000,
      bio: { summary: "Nigerian multi-instrumentalist and pioneer of Afrobeat." },
      tags: [{ name: "afrobeat" }, { name: "funk" }],
    });
    const result = extractArtistData("lastfm", "get_artist_info", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Fela Kuti");
    expect(result!.section.content).toContain("450,000");
    expect(result!.section.content).toContain("Afrobeat");
    expect(result!.section.sources[0].tool).toBe("Last.fm");
  });
});

// ── extractArtistData: Bandcamp ──────────────────────────

describe("extractArtistData — Bandcamp", () => {
  it("extracts tags from Bandcamp data", () => {
    const content = JSON.stringify({
      artist: "Mulatu Astatke",
      tags: ["ethio-jazz", "jazz", "world"],
      related_tags: ["afrobeat", "funk"],
    });
    const result = extractArtistData("bandcamp-web", "bandcamp_tags", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Mulatu Astatke");
    expect(result!.section.content).toContain("ethio-jazz");
    expect(result!.section.content).toContain("afrobeat");
  });
});

// ── extractArtistData: Discogs ───────────────────────────

describe("extractArtistData — Discogs", () => {
  it("extracts discography data", () => {
    const content = JSON.stringify({
      name: "MF DOOM",
      title: "MM..FOOD",
      year: 2004,
      genres: ["Hip Hop"],
      styles: ["Abstract", "Experimental"],
      profile: "British-born American rapper and producer.",
    });
    const result = extractArtistData("discogs", "search_discogs", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("MF DOOM");
    expect(result!.section.content).toContain("Hip Hop");
    expect(result!.section.content).toContain("2004");
  });
});

// ── extractArtistData: edge cases ────────────────────────

describe("extractArtistData — edge cases", () => {
  it("returns null for error responses", () => {
    const content = JSON.stringify({ error: "API rate limited" });
    const result = extractArtistData("spotify-connected", "search_spotify", content);
    expect(result).toBeNull();
  });

  it("returns null for empty/short content", () => {
    expect(extractArtistData("genius", "search", "")).toBeNull();
    expect(extractArtistData("genius", "search", "hi")).toBeNull();
  });

  it("non-qualifying servers are blocked by shouldIngest, not extractArtistData", () => {
    // extractArtistData doesn't check shouldIngest — that's the caller's job
    // shouldIngest blocks slack, so extractArtistData is never called for it
    expect(shouldIngest("slack")).toBe(false);
    // But if called directly, it would still try to extract (that's OK)
    const content = JSON.stringify({ artist: "Test", description: "Some long description text here" });
    const result = extractArtistData("slack", "send_message", content);
    // Result is non-null because the data has valid artist + content
    expect(result?.artistName).toBe("Test");
  });

  it("handles plain text content with artist name pattern", () => {
    const content = "Influence chain for Sampa The Great\nInfluenced by Lauryn Hill and Fela Kuti";
    const result = extractArtistData("influence", "get_influence", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("Sampa The Great");
    expect(result!.section.content).toContain("Lauryn Hill");
  });

  it("truncates very long content to 3000 chars", () => {
    const longContent = JSON.stringify({
      artist: "Test Artist",
      description: "x".repeat(5000),
    });
    const result = extractArtistData("genius", "search", longContent);
    expect(result).not.toBeNull();
    expect(result!.section.content.length).toBeLessThanOrEqual(3000);
  });

  it("handles special characters in artist names", () => {
    const content = JSON.stringify({ artist: "DOMi & JD BECK", cached: true, connections: [{ artist: "Thundercat", relationship: "influenced", context: "Jazz fusion" }] });
    const result = extractArtistData("influencecache", "get_influence", content);
    expect(result).not.toBeNull();
    expect(result!.artistName).toBe("DOMi & JD BECK");
  });
});

// ── slugify (tested via extractArtistData behavior) ──────

describe("extractArtistData — slug generation via wiki section", () => {
  it("produces consistent sections for the same artist", () => {
    const content1 = JSON.stringify({ artist: "Khruangbin", genres: ["funk"] });
    const content2 = JSON.stringify({ name: "Khruangbin", tags: ["psychedelic"] });
    const r1 = extractArtistData("spotify-connected", "search", content1);
    const r2 = extractArtistData("bandcamp-web", "tags", content2);
    expect(r1!.artistName).toBe("Khruangbin");
    expect(r2!.artistName).toBe("Khruangbin");
  });
});
