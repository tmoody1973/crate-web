/**
 * Anonymous creator-id cookie for the Influence Receipt sprint.
 *
 * Stamped on every PostHog event from /i/[slug] so the gate metric
 * "unique non-Tarik views per posted receipt" can be computed by
 * filtering out Tarik's known creator_id values at query time.
 *
 * Privacy: anonymous, random, no PII. 1-year cookie. SameSite=Lax.
 * Used per the "Receipt Truth" gated validation sprint design doc.
 */

const COOKIE_NAME = "crate_creator_id";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const ID_LENGTH = 16;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

function randomId(): string {
  let id = "";
  for (let i = 0; i < ID_LENGTH; i++) {
    id += ID_ALPHABET[Math.floor(Math.random() * ID_ALPHABET.length)];
  }
  return id;
}

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(
    new RegExp("(?:^|; )" + name + "=([^;]*)"),
  );
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string, maxAgeSeconds: number): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=${encodeURIComponent(value)}; max-age=${maxAgeSeconds}; path=/; SameSite=Lax`;
}

/**
 * Read the existing creator id from cookie, or generate one and persist it.
 * Returns null on the server (where document is undefined) — callers should
 * only invoke this from useEffect or other client-only paths.
 */
export function getOrCreateCreatorId(): string | null {
  if (typeof document === "undefined") return null;
  const existing = readCookie(COOKIE_NAME);
  if (existing && existing.length === ID_LENGTH) return existing;
  const fresh = randomId();
  writeCookie(COOKIE_NAME, fresh, COOKIE_MAX_AGE_SECONDS);
  return fresh;
}
