/**
 * Auth0 Token Vault client for Crate.
 * Provides OAuth tokens for connected services (Spotify, Slack, Google).
 * Uses Auth0 Management API to retrieve IdP access tokens from user identities.
 */

type TokenVaultService = "spotify" | "slack" | "google" | "tumblr";

const SERVICE_CONFIG: Record<TokenVaultService, { connection: string; scopes: string[] }> = {
  spotify: {
    connection: "spotify",
    scopes: [
      "user-library-read",
      "user-top-read",
      "playlist-read-private",
      "playlist-modify-public",
      "playlist-modify-private",
      "streaming",
      "user-read-playback-state",
      "user-modify-playback-state",
      "user-read-email",
      "user-read-private",
    ],
  },
  slack: {
    connection: "slack-v2",
    scopes: [
      "chat:write",
      "chat:write.public",
      "channels:read",
      "groups:read",
      "users:read",
      "im:write",
    ],
  },
  google: {
    connection: "google-oauth2",
    scopes: [
      "https://www.googleapis.com/auth/documents",
      "https://www.googleapis.com/auth/drive.file",
      "https://www.googleapis.com/auth/youtube.readonly",
      "https://www.googleapis.com/auth/youtube",
    ],
  },
  tumblr: {
    connection: "tumblr-custom",
    scopes: ["basic", "write", "offline_access"],
  },
};

// Cache Management API token (expires every 24h, we refresh every 23h)
let mgmtTokenCache: { token: string; expiresAt: number } | null = null;

/**
 * Get a Management API access token using client_credentials grant.
 */
async function getManagementToken(): Promise<string | null> {
  if (mgmtTokenCache && Date.now() < mgmtTokenCache.expiresAt) {
    return mgmtTokenCache.token;
  }

  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;

  try {
    const res = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: clientId,
        client_secret: clientSecret,
        audience: `https://${domain}/api/v2/`,
      }),
    });

    if (!res.ok) {
      console.error("[token-vault] Failed to get management token:", await res.text().catch(() => ""));
      return null;
    }

    const data = await res.json();
    mgmtTokenCache = {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in - 3600) * 1000, // refresh 1h early
    };
    return data.access_token;
  } catch (err) {
    console.error("[token-vault] Management token error:", err);
    return null;
  }
}

/**
 * Get a user's IdP access token via the Auth0 Management API.
 * Looks up the user's identities array for the matching connection.
 */
export async function getTokenVaultToken(
  service: TokenVaultService,
  auth0UserId?: string,
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

  if (!auth0UserId) {
    console.warn("[token-vault] No Auth0 user ID provided — cookie may not be set. User needs to reconnect.");
    return null;
  }

  try {
    console.log(`[token-vault] Fetching ${service} token for Auth0 user: ${auth0UserId}`);
    const mgmtToken = await getManagementToken();
    if (!mgmtToken) {
      console.error("[token-vault] Failed to get Management API token — check API authorization in Auth0 Dashboard");
      return null;
    }

    const res = await fetch(
      `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}?fields=identities&include_fields=true`,
      {
        headers: { Authorization: `Bearer ${mgmtToken}` },
      },
    );

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[token-vault] Failed to get user identities: ${res.status}`, detail);
      return null;
    }

    const user = await res.json();
    const identity = (user.identities ?? []).find(
      (id: { connection: string }) => id.connection === config.connection,
    );

    if (!identity?.access_token) {
      console.warn(`[token-vault] No ${service} token found in user identities`);
      return null;
    }

    return identity.access_token;
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
