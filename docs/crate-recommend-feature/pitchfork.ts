// convex/ingestion/publications/pitchfork.ts
//
// Reference adapter. Pattern:
//   - `discover` pulls URLs from RSS (delta) or sitemap (backfill)
//   - `parse` runs against the fetched HTML
//
// Pitchfork's DOM changes over time. Selectors below reflect the structure
// as of the last confirmation — re-verify against a current review if parsing
// starts failing systematically (symptom: `body` comes back empty or
// `primary_artist_name` is the album title).

import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { XMLParser } from "fast-xml-parser";
import type { DiscoveredReview, ParsedReview, PublicationAdapter } from "./types";

const RSS_URL = "https://pitchfork.com/rss/reviews/albums/";
const SITEMAP_INDEX = "https://pitchfork.com/sitemap.xml";

const USER_AGENT = "Crate/1.0 (+https://crate.app; music-lover research tool)";

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Fetch ${url} failed: ${res.status}`);
  return res.text();
}

function parseRssFeed(xml: string): DiscoveredReview[] {
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });
  const parsed = parser.parse(xml);
  const items = parsed?.rss?.channel?.item ?? [];
  const arr = Array.isArray(items) ? items : [items];

  return arr
    .filter((item: any) => item?.link)
    .map((item: any) => ({
      url: String(item.link),
      published_at_estimate: item.pubDate ? new Date(item.pubDate).getTime() : undefined,
      title_hint: typeof item.title === "string" ? item.title : undefined,
    }));
}

async function collectReviewSitemapUrls(): Promise<string[]> {
  // Pitchfork's sitemap index lists multiple review sitemaps by year.
  const indexXml = await fetchText(SITEMAP_INDEX);
  const parser = new XMLParser();
  const idx = parser.parse(indexXml);
  const sitemaps = idx?.sitemapindex?.sitemap ?? [];
  const urls = (Array.isArray(sitemaps) ? sitemaps : [sitemaps])
    .map((s: any) => String(s.loc))
    .filter((u: string) => u.includes("review") || u.includes("album"));

  const allReviewUrls: string[] = [];
  for (const sitemapUrl of urls) {
    const sm = await fetchText(sitemapUrl);
    const parsed = parser.parse(sm);
    const entries = parsed?.urlset?.url ?? [];
    const arr = Array.isArray(entries) ? entries : [entries];
    for (const entry of arr) {
      if (entry?.loc && String(entry.loc).includes("/reviews/albums/")) {
        allReviewUrls.push(String(entry.loc));
      }
    }
  }
  return allReviewUrls;
}

function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.search = "";
  let path = u.pathname.replace(/\/+$/, "");
  return `${u.origin}${path}`;
}

function hashBody(body: string): string {
  const normalized = body.replace(/\s+/g, " ").trim().toLowerCase();
  return createHash("sha256").update(normalized).digest("hex");
}

function splitArtistFromTitle(h1: string): { artist: string; album: string } {
  // Pitchfork headline convention: "Artist: Album" — sometimes "Artist: EP Title"
  // Fall back to the whole string as artist if no colon found.
  const colonIdx = h1.indexOf(":");
  if (colonIdx === -1) return { artist: h1.trim(), album: "" };
  return {
    artist: h1.slice(0, colonIdx).trim(),
    album: h1.slice(colonIdx + 1).trim(),
  };
}

export const pitchforkAdapter: PublicationAdapter = {
  slug: "pitchfork",
  displayName: "Pitchfork",
  baseUrl: "https://pitchfork.com",
  minFetchIntervalMs: 1500,

  async discover({ since, limit }) {
    if (since) {
      // Delta mode
      const xml = await fetchText(RSS_URL);
      let items = parseRssFeed(xml).filter(
        (r) => !r.published_at_estimate || r.published_at_estimate > since,
      );
      if (limit) items = items.slice(0, limit);
      return items;
    } else {
      // Backfill mode
      const urls = await collectReviewSitemapUrls();
      const out: DiscoveredReview[] = urls.map((u) => ({ url: u }));
      return limit ? out.slice(0, limit) : out;
    }
  },

  parse(html, url) {
    const $ = cheerio.load(html);

    // Title/artist — headline is typically "Artist: Album".
    // If Pitchfork markup changes, update the selector list here.
    const h1 = $("h1").first().text().trim();
    const { artist, album } = splitArtistFromTitle(h1);

    // Byline
    const author =
      $('[class*="BylineName"]').first().text().trim() ||
      $('[class*="byline"] a').first().text().trim() ||
      undefined;

    // Published time
    const timeAttr = $("time[datetime]").first().attr("datetime");
    const published_at = timeAttr ? new Date(timeAttr).getTime() : Date.now();

    // Body — several container classes have been used historically. Take the
    // first one that yields substantial text. Strip script/style defensively.
    $("script, style, noscript").remove();
    const bodyCandidates = [
      '[class*="body__container"]',
      '[class*="ReviewBody"]',
      '[class*="review__content"]',
      "article",
    ];
    let body = "";
    for (const sel of bodyCandidates) {
      const text = $(sel).first().text().trim();
      if (text.length > 400) {
        body = text;
        break;
      }
    }
    if (!body) throw new Error(`No review body found at ${url}`);

    return {
      url,
      canonical_url: normalizeUrl(url),
      published_at,
      title: album || h1,
      primary_artist_name: artist,
      author,
      body,
      body_hash: hashBody(body),
    };
  },
};
