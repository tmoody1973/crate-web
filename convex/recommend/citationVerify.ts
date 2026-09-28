"use node";

/**
 * Two-step citation verification per v1-scope.md anti-criterion "No fabricated
 * provenance quotes":
 *
 *   1. URL check (HEAD): status < 400, not redirecting to a paywall domain,
 *      not blocked by Cloudflare challenge.
 *   2. Quote-on-page check (GET): fetch the page HTML, normalize whitespace,
 *      and verify the first 30 characters of the quote appear in the page
 *      text (case-insensitive). Catches the Perplexity hallucination mode
 *      where the URL loads but the quote was never actually on the page.
 *
 * Both run in parallel with a combined 3s budget. If either fails the quote
 * is dropped and the artist card renders with "No verified source found".
 *
 * Results are cached 24h in the `citationCache` Convex table, keyed by
 * (url, quote_prefix). Look-up + write are done by the caller (see
 * convex/recommend/index.ts) because this file is marked "use node" and
 * doesn't have a Convex ctx.
 */

import { createHash } from "node:crypto";
import { urlToBareHost, SEED_PAYWALL_DOMAINS } from "../../src/lib/paywall-domains";

const USER_AGENT = "Crate/1.0 (+https://digcrate.app; verify-citations)";
const HEAD_TIMEOUT_MS = 2000;
const GET_TIMEOUT_MS = 3000;
const QUOTE_PREFIX_LENGTH = 30;

export type VerifyResult = {
  verified: boolean;
  failureReason?:
    | "paywall"
    | "url_unreachable"
    | "url_4xx"
    | "url_5xx"
    | "cloudflare_challenge"
    | "quote_not_found"
    | "fetch_error";
};

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Verify a citation URL + expected quote. Runs HEAD + GET in parallel within
 * a 3s budget. Returns { verified, failureReason }. Does NOT throw — always
 * resolves so callers can make per-citation decisions without blowing up the
 * whole tour.
 *
 * `extraPaywallDomains` lets the caller inject runtime-editable paywall
 * domains from the `paywallDomains` Convex table on top of the static seed.
 */
export async function verifyCitation(args: {
  url: string;
  quote: string;
  extraPaywallDomains?: ReadonlyArray<string>;
}): Promise<VerifyResult> {
  const { url, quote, extraPaywallDomains = [] } = args;

  // Pre-check: bare hostname against paywall allowlist (synchronous, no fetch needed)
  const host = urlToBareHost(url);
  if (host === null) {
    return { verified: false, failureReason: "url_unreachable" };
  }
  const paywallSet = new Set([...SEED_PAYWALL_DOMAINS, ...extraPaywallDomains]);
  if (paywallSet.has(host)) {
    return { verified: false, failureReason: "paywall" };
  }

  // Run HEAD check and GET+quote check in parallel. If HEAD fails, short-
  // circuit — no point reading a page that isn't reachable.
  const [headResult, quoteResult] = await Promise.all([
    checkUrl(url, paywallSet),
    checkQuoteOnPage(url, quote),
  ]);

  if (!headResult.verified) return headResult;
  if (!quoteResult.verified) return quoteResult;
  return { verified: true };
}

/**
 * Cache-key generator for the citation cache (v1-scope.md decision #4).
 * Uses SHA-256 of "url|quote_prefix" truncated to 32 chars.
 */
export function buildCacheKey(url: string, quote: string): string {
  const prefix = normalizeQuoteForMatch(quote).slice(0, QUOTE_PREFIX_LENGTH);
  const raw = `${url}|${prefix}`;
  return createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

/**
 * Extract the normalized quote prefix used for the on-page substring match.
 * Exported so callers can store it in the cache record for later audit.
 */
export function quotePrefix(quote: string): string {
  return normalizeQuoteForMatch(quote).slice(0, QUOTE_PREFIX_LENGTH);
}

// ── Internals ───────────────────────────────────────────────────────────────

/**
 * HEAD check on the URL. Fails on 4xx/5xx, paywall redirect, or Cloudflare
 * bot challenge.
 */
async function checkUrl(
  url: string,
  paywallSet: Set<string>,
): Promise<VerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEAD_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    // Post-redirect final URL may land on a paywall
    const finalHost = urlToBareHost(response.url);
    if (finalHost && paywallSet.has(finalHost)) {
      return { verified: false, failureReason: "paywall" };
    }

    // Cloudflare bot challenge signal (heuristic)
    const cfMitigated = response.headers.get("cf-mitigated");
    if (cfMitigated === "challenge") {
      return { verified: false, failureReason: "cloudflare_challenge" };
    }

    if (response.status >= 500) {
      return { verified: false, failureReason: "url_5xx" };
    }
    if (response.status >= 400) {
      return { verified: false, failureReason: "url_4xx" };
    }

    return { verified: true };
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      return { verified: false, failureReason: "url_unreachable" };
    }
    return { verified: false, failureReason: "fetch_error" };
  }
}

/**
 * GET the page and verify the first 30 chars of the quote appear in the page
 * text (whitespace-normalized, case-insensitive).
 */
async function checkQuoteOnPage(
  url: string,
  quote: string,
): Promise<VerifyResult> {
  const prefix = normalizeQuoteForMatch(quote).slice(0, QUOTE_PREFIX_LENGTH);
  if (prefix.length < 10) {
    // Quote is too short to match meaningfully; treat as unverified.
    return { verified: false, failureReason: "quote_not_found" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GET_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT },
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!response.ok) {
      return {
        verified: false,
        failureReason: response.status >= 500 ? "url_5xx" : "url_4xx",
      };
    }

    const html = await response.text();
    const pageText = normalizeQuoteForMatch(stripHtmlTags(html));
    if (pageText.includes(prefix)) {
      return { verified: true };
    }
    return { verified: false, failureReason: "quote_not_found" };
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === "AbortError") {
      return { verified: false, failureReason: "url_unreachable" };
    }
    return { verified: false, failureReason: "fetch_error" };
  }
}

/**
 * Strip HTML tags without a full parser. Good enough for substring-match —
 * we're looking for a short quote prefix in the visible text.
 */
function stripHtmlTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * Normalize text for substring matching: lowercase, collapse whitespace,
 * strip common quote-wrapping punctuation. Applied to both the quote and
 * the page text so the comparison is symmetric.
 */
function normalizeQuoteForMatch(text: string): string {
  return text
    .toLowerCase()
    .replace(/[\u201C\u201D\u2018\u2019"']/g, "") // smart and straight quotes
    .replace(/\s+/g, " ")
    .trim();
}
