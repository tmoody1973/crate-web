import { auth } from "@clerk/nextjs/server";
import { getTokenVaultToken, isTokenVaultConfigured } from "@/lib/auth0-token-vault";

/**
 * Returns the user's Spotify access token from Auth0 Token Vault.
 * Used by the Web Playback SDK on the client side.
 */
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({ error: "Token Vault not configured" }, { status: 503 });
  }

  // Read Auth0 user ID from per-service cookie
  const cookies = req.headers.get("cookie") ?? "";
  const perService = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id_spotify="));
  let auth0UserId: string | undefined;
  if (perService) {
    const raw = perService.split("=").slice(1).join("=").trim();
    auth0UserId = raw ? decodeURIComponent(raw) : undefined;
  }
  if (!auth0UserId) {
    // Fall back to global cookie
    const global = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id="));
    if (global) {
      const raw = global.split("=").slice(1).join("=").trim();
      auth0UserId = raw ? decodeURIComponent(raw) : undefined;
    }
  }

  const token = await getTokenVaultToken("spotify", auth0UserId);
  if (!token) {
    return Response.json(
      { error: "Spotify not connected. Connect Spotify in Settings." },
      { status: 404 },
    );
  }

  return Response.json({ access_token: token });
}
