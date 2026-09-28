/**
 * Initial paywall-domain allowlist for citation verification.
 *
 * Any citation URL that (a) resolves to one of these bare hostnames or (b)
 * redirects to one is treated as paywalled and its quote is dropped from the
 * tour (per v1-scope.md anti-criterion: "No fabricated provenance quotes").
 *
 * Admins can extend this at runtime via the `paywallDomains` Convex table.
 * Runtime additions take effect without a deploy.
 *
 * Maintenance note: keep bare hostnames (no www., no protocol). Runtime check
 * strips both from the inbound URL before comparing.
 */
export const SEED_PAYWALL_DOMAINS: ReadonlyArray<string> = [
  "nytimes.com",
  "newyorker.com",
  "ft.com",
  "wsj.com",
  "theatlantic.com",
  "vanityfair.com",
  "newyork.com", // nymag.com's subsidiary short link
  "nymag.com",
  "washingtonpost.com",
  "bloomberg.com",
  "economist.com",
];

/**
 * Normalize a URL to its bare hostname for paywall lookup.
 * Returns null on invalid URLs so callers can skip silently.
 */
export function urlToBareHost(url: string): string | null {
  try {
    const u = new URL(url);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}
