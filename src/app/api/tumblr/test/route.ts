import { auth } from "@clerk/nextjs/server";
import { getTokenVaultToken, isTokenVaultConfigured } from "@/lib/auth0-token-vault";

/**
 * Debug endpoint — test Tumblr Token Vault connection.
 * Returns token status and a sample API call result.
 */
export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({ error: "Token Vault not configured" }, { status: 503 });
  }

  // Read Auth0 user ID from per-service cookie
  const cookies = req.headers.get("cookie") ?? "";
  const perService = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id_tumblr="));
  let auth0UserId: string | undefined;
  if (perService) {
    const raw = perService.split("=").slice(1).join("=").trim();
    auth0UserId = raw ? decodeURIComponent(raw) : undefined;
  }
  if (!auth0UserId) {
    const global = cookies.split(";").find((c) => c.trim().startsWith("auth0_user_id="));
    if (global) {
      const raw = global.split("=").slice(1).join("=").trim();
      auth0UserId = raw ? decodeURIComponent(raw) : undefined;
    }
  }

  if (!auth0UserId) {
    return Response.json({ error: "No auth0_user_id_tumblr cookie found", cookies: cookies.split(";").map(c => c.trim().split("=")[0]) }, { status: 400 });
  }

  const token = await getTokenVaultToken("tumblr", auth0UserId);
  if (!token) {
    return Response.json({ error: "No Tumblr token found in Token Vault", auth0UserId }, { status: 404 });
  }

  // Test: call Tumblr tagged endpoint
  try {
    const res = await fetch(`https://api.tumblr.com/v2/tagged?tag=jazz`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const data = await res.json();
    return Response.json({
      status: "connected",
      auth0UserId,
      tokenPrefix: token.slice(0, 10) + "...",
      tumblrApiStatus: res.status,
      postCount: Array.isArray(data.response) ? data.response.length : 0,
      firstPost: Array.isArray(data.response) && data.response[0] ? {
        type: data.response[0].type,
        blog_name: data.response[0].blog_name,
        summary: data.response[0].summary?.slice(0, 100),
      } : null,
      rawMeta: data.meta,
    });
  } catch (err) {
    return Response.json({
      status: "error",
      auth0UserId,
      error: err instanceof Error ? err.message : "Unknown error",
    }, { status: 500 });
  }
}
