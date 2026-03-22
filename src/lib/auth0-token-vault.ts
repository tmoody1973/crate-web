/**
 * Auth0 Token Vault client for Crate.
 * Provides OAuth tokens for connected services (Spotify, Slack, Google).
 * Tokens are managed by Auth0 — Crate never stores raw OAuth credentials.
 */

type TokenVaultService = "spotify" | "slack" | "google";

const SERVICE_CONFIG: Record<TokenVaultService, { connection: string; scopes: string[] }> = {
  spotify: {
    connection: "spotify",
    scopes: [
      "user-library-read",
      "user-top-read",
      "playlist-read-private",
      "playlist-modify-public",
      "playlist-modify-private",
    ],
  },
  slack: {
    connection: "sign-in-with-slack",
    scopes: ["chat:write", "channels:read"],
  },
  google: {
    connection: "google-oauth2",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
    ],
  },
};

/**
 * Exchange a user's Auth0 access token for a third-party service token via Token Vault.
 * Returns the OAuth token for the requested service, or null if not connected.
 */
export async function getTokenVaultToken(
  service: TokenVaultService,
): Promise<string | null> {
  const config = SERVICE_CONFIG[service];
  if (!config) return null;

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  if (!domain || !clientId || !clientSecret) {
    console.warn("[token-vault] Auth0 credentials not configured");
    return null;
  }

  try {
    console.warn(`[token-vault] Token Vault exchange not yet implemented for ${service}. Returning null.`);
    return null;
  } catch (err) {
    console.error(`[token-vault] Failed to get ${service} token:`, err);
    return null;
  }
}

/** Check if Token Vault is configured (Auth0 env vars present). */
export function isTokenVaultConfigured(): boolean {
  return !!(
    process.env.AUTH0_DOMAIN &&
    process.env.AUTH0_CLIENT_ID &&
    process.env.AUTH0_CLIENT_SECRET
  );
}

export { type TokenVaultService, SERVICE_CONFIG };
