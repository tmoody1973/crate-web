/**
 * Types for the Influence Receipt — public, zero-login influence chain pages.
 */

export interface ReceiptInfluence {
  name: string;
  slug: string;
  relationship: string;
  weight: number;
  context?: string;
  sources?: Array<{ name: string; url: string }>;
  subInfluences?: ReceiptInfluence[];
}

export interface ReceiptData {
  artist: string;
  slug: string;
  tier: "full" | "partial" | "unknown";
  influences: ReceiptInfluence[];
  sonicDna?: string[];
  generatedAt: number;
}

/**
 * Determine quality tier based on influence count.
 */
export function getReceiptTier(
  influenceCount: number,
): ReceiptData["tier"] {
  if (influenceCount >= 3) return "full";
  if (influenceCount >= 1) return "partial";
  return "unknown";
}

/**
 * Generate a URL-safe slug from an artist name.
 * "Kendrick Lamar" → "kendrick-lamar"
 */
export function artistToSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Extract a readable source name from a citation URL.
 */
export function sourceNameFromUrl(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const names: Record<string, string> = {
      "en.wikipedia.org": "Wikipedia",
      "genius.com": "Genius",
      "allmusic.com": "AllMusic",
      "last.fm": "Last.fm",
      "pitchfork.com": "Pitchfork",
      "rollingstone.com": "Rolling Stone",
      "discogs.com": "Discogs",
      "musicbrainz.org": "MusicBrainz",
      "rateyourmusic.com": "RateYourMusic",
      "billboard.com": "Billboard",
      "nme.com": "NME",
      "theguardian.com": "The Guardian",
      "nytimes.com": "NY Times",
      "bbc.co.uk": "BBC",
      "npr.org": "NPR",
    };
    return names[hostname] ?? hostname.replace(/\.com$|\.org$|\.net$/, "");
  } catch {
    return "Source";
  }
}

/**
 * Known ambiguous artist names with disambiguators.
 */
export const DISAMBIGUATIONS: Record<string, string> = {
  common: "common-rapper",
  genesis: "genesis-band",
  bush: "bush-band",
  america: "america-band",
  heart: "heart-band",
  boston: "boston-band",
  kansas: "kansas-band",
  chicago: "chicago-band",
  bread: "bread-band",
  cream: "cream-band",
  poison: "poison-band",
  rush: "rush-band",
  triumph: "triumph-band",
  journey: "journey-band",
  foreigner: "foreigner-band",
  survivor: "survivor-band",
  tesla: "tesla-band",
  warrant: "warrant-band",
  extreme: "extreme-band",
  live: "live-band",
};
