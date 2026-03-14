/**
 * Resolves a user's API keys from Convex, including org fallbacks and embedded keys.
 * Used by the /api/chat route for key resolution.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import { decrypt } from "@/lib/encryption";

/** Map user-facing key names to env var names expected by CrateAgent servers. */
export const KEY_ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  discogs_key: "DISCOGS_KEY",
  discogs_secret: "DISCOGS_SECRET",
  lastfm: "LASTFM_API_KEY",
  genius: "GENIUS_ACCESS_TOKEN",
  tumblr_key: "TUMBLR_CONSUMER_KEY",
  tumblr_secret: "TUMBLR_CONSUMER_SECRET",
  kernel: "KERNEL_API_KEY",
  mem0: "MEM0_API_KEY",
  tavily: "TAVILY_API_KEY",
  exa: "EXA_API_KEY",
  ticketmaster: "TICKETMASTER_API_KEY",
  spotify_client_id: "SPOTIFY_CLIENT_ID",
  spotify_client_secret: "SPOTIFY_CLIENT_SECRET",
  fanart_api_key: "FANART_API_KEY",
  gemini_api_key: "GEMINI_API_KEY",
};

/** Embedded Tier 1 keys from Vercel env vars (shared across all users). */
export function getEmbeddedKeys(): Record<string, string> {
  const embedded: Record<string, string> = {};
  if (process.env.EMBEDDED_TICKETMASTER_KEY)
    embedded.TICKETMASTER_API_KEY = process.env.EMBEDDED_TICKETMASTER_KEY;
  if (process.env.EMBEDDED_LASTFM_KEY)
    embedded.LASTFM_API_KEY = process.env.EMBEDDED_LASTFM_KEY;
  if (process.env.EMBEDDED_DISCOGS_KEY)
    embedded.DISCOGS_KEY = process.env.EMBEDDED_DISCOGS_KEY;
  if (process.env.EMBEDDED_DISCOGS_SECRET)
    embedded.DISCOGS_SECRET = process.env.EMBEDDED_DISCOGS_SECRET;
  if (process.env.EMBEDDED_TAVILY_KEY)
    embedded.TAVILY_API_KEY = process.env.EMBEDDED_TAVILY_KEY;
  if (process.env.EMBEDDED_EXA_KEY)
    embedded.EXA_API_KEY = process.env.EMBEDDED_EXA_KEY;
  if (process.env.EMBEDDED_KERNEL_KEY)
    embedded.KERNEL_API_KEY = process.env.EMBEDDED_KERNEL_KEY;
  if (process.env.EMBEDDED_SPOTIFY_CLIENT_ID)
    embedded.SPOTIFY_CLIENT_ID = process.env.EMBEDDED_SPOTIFY_CLIENT_ID;
  if (process.env.EMBEDDED_SPOTIFY_SECRET)
    embedded.SPOTIFY_CLIENT_SECRET = process.env.EMBEDDED_SPOTIFY_SECRET;
  if (process.env.EMBEDDED_FANART_KEY)
    embedded.FANART_API_KEY = process.env.EMBEDDED_FANART_KEY;
  if (process.env.GEMINI_API_KEY)
    embedded.GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  return embedded;
}

export interface ResolvedKeys {
  /** Raw decrypted key names (user-facing names like "anthropic", "discogs_key") */
  rawKeys: Record<string, string>;
  /** Keys mapped to env var names (like "ANTHROPIC_API_KEY") */
  userEnvKeys: Record<string, string>;
  /** Embedded platform keys */
  embeddedKeys: Record<string, string>;
  /** Whether user has an Anthropic key */
  hasAnthropic: boolean;
  /** Whether user has an OpenRouter key */
  hasOpenRouter: boolean;
  /** The Convex user record */
  user: {
    _id: string;
    email?: string;
    encryptedKeys?: string;
    [key: string]: unknown;
  };
}

/**
 * Resolve all API keys for a user: personal keys, org fallbacks, and embedded keys.
 * Throws if user is not found.
 */
export async function resolveUserKeys(clerkId: string): Promise<ResolvedKeys> {
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    throw new Error("User not found");
  }

  // Decrypt user's personal API keys
  let rawKeys: Record<string, string> = {};
  if (user.encryptedKeys) {
    rawKeys = JSON.parse(decrypt(Buffer.from(new Uint8Array(user.encryptedKeys))));
  }

  // Check for org shared keys (fallback for team members)
  const emailDomain = user.email?.split("@")[1] ?? "";
  if (emailDomain) {
    const orgRecord = await convex.query(api.orgKeys.getByDomain, { domain: emailDomain });
    if (orgRecord?.encryptedKeys) {
      const orgRawKeys: Record<string, string> = JSON.parse(
        decrypt(Buffer.from(new Uint8Array(orgRecord.encryptedKeys))),
      );
      // Org keys fill gaps — user's own keys take priority
      for (const [key, value] of Object.entries(orgRawKeys)) {
        if (!rawKeys[key]) {
          rawKeys[key] = value;
        }
      }
    }
  }

  // Map user key names to env var names
  const userEnvKeys: Record<string, string> = {};
  for (const [userKey, envVar] of Object.entries(KEY_ENV_MAP)) {
    if (rawKeys[userKey]) {
      userEnvKeys[envVar] = rawKeys[userKey];
    }
  }

  const embeddedKeys = getEmbeddedKeys();

  return {
    rawKeys,
    userEnvKeys,
    embeddedKeys,
    hasAnthropic: !!rawKeys.anthropic,
    hasOpenRouter: !!rawKeys.openrouter,
    user: user as ResolvedKeys["user"],
  };
}
