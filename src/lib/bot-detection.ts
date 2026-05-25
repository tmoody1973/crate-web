/**
 * Guards for the public, unauthenticated /api/influence/receipt/generate route.
 * Generation costs paid Perplexity calls, so we reject requests that obviously
 * aren't a human exploring an artist:
 *   - known crawler / scraper / link-unfurler user-agents (and empty UAs)
 *   - artist strings that look like URL fuzzing rather than a real name
 *
 * These are best-effort cost guards, not security boundaries — the IP/global
 * rate limits in convex/receipt.ts remain the hard cap.
 */

const MAX_ARTIST_NAME_LENGTH = 80;

/**
 * Substrings that appear in the user-agent of automated clients we never want
 * to spend Perplexity budget on. Lowercased; matched as substrings.
 */
const BOT_UA_SIGNATURES: ReadonlyArray<string> = [
  "bot",
  "crawl",
  "spider",
  "slurp",
  "scrap",
  "fetch",
  "curl",
  "wget",
  "python-requests",
  "httpclient",
  "headless",
  "facebookexternalhit",
  "embedly",
  "quora link preview",
  "pinterest",
  "vkshare",
  "redditbot",
  "applebot",
  "whatsapp",
  "telegram",
  "discord",
  "slackbot",
  "twitterbot",
  "googlebot",
  "bingpreview",
  "gptbot",
  "claudebot",
  "ccbot",
  "perplexity",
  "anthropic",
  "ahrefs",
  "semrush",
  "dataforseo",
  "dotbot",
  "mj12bot",
  "petalbot",
];

/**
 * True when the user-agent is empty or matches a known automated client.
 * A missing UA is treated as a bot — real browsers always send one.
 */
export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent || userAgent.trim() === "") return true;
  const ua = userAgent.toLowerCase();
  return BOT_UA_SIGNATURES.some((sig) => ua.includes(sig));
}

/**
 * True when the string is plausibly a real artist name a human would type,
 * rather than fuzzed garbage. Requires at least one letter, rejects empties,
 * over-long inputs, and URL/path-injection characters.
 */
export function isPlausibleArtistName(name: string): boolean {
  const trimmed = name.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ARTIST_NAME_LENGTH) {
    return false;
  }
  if (!/\p{L}/u.test(trimmed)) return false; // no letters at all
  if (/[<>{}[\]\\^|`]/.test(trimmed)) return false; // markup injection
  if (/\.\./.test(trimmed)) return false; // path traversal (AC/DC's single slash is fine)
  if (/https?:\/\//i.test(trimmed)) return false; // pasted URL
  return true;
}
