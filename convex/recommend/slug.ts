"use node";

/**
 * Slug generation per v1-scope.md Key Decision #2 (revised to lazy check+retry).
 *
 * Base format: `{first-seed-artist-slug}-{4-char-hash}`
 * On collision: regenerate the 4-char hash up to 3 attempts.
 * Fallback: 8-char hash if all 3 attempts collide.
 * Emergency: 16-char hash after 8-char also collides (should never fire
 * except under pathological volume).
 *
 * The caller (main action) handles the collision check by querying
 * artifactsRecommend.by_slug between attempts.
 */

import { randomBytes } from "node:crypto";

const SLUG_PATTERN = /[^a-z0-9]+/g;

/**
 * Convert an artist name to a URL-safe slug base.
 * "billy woods" → "billy-woods"
 * "JPEGMAFIA" → "jpegmafia"
 * "clipping." → "clipping"
 * "$uicideboy$" → "uicideboy"
 * "MGMT" → "mgmt"
 */
export function artistNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(SLUG_PATTERN, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60); // keep slugs readable
}

/**
 * Generate a random lowercase alphanumeric hash of the given length.
 * 4 chars = 36^4 ≈ 1.7M combinations (collision-resistant up to low-thousands
 * of shared seed artists in the library).
 */
export function randomHash(length: number): string {
  // Generate more random bytes than we need and map to [0-9a-z]
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(length * 2);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return out;
}

/**
 * Build a slug from a seed artist name + random hash.
 * Examples:
 *   buildSlug("ANOHNI", 4) → "anohni-k3mf"
 *   buildSlug("billy woods", 8) → "billy-woods-a7x2p9qr"
 */
export function buildSlug(seedArtistName: string, hashLength: number = 4): string {
  const base = artistNameToSlug(seedArtistName) || "tour";
  return `${base}-${randomHash(hashLength)}`;
}
