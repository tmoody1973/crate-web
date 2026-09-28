import { auth } from "@clerk/nextjs/server";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const cookies = req.headers.get("cookie") ?? "";
  const auth0UserIdCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("auth0_user_id="));
  const auth0ConnectedCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("auth0_connected="));

  const auth0UserIdRaw = auth0UserIdCookie
    ? auth0UserIdCookie.split("=").slice(1).join("=").trim()
    : null;
  const auth0UserId = auth0UserIdRaw ? decodeURIComponent(auth0UserIdRaw) : null;
  const auth0Connected = auth0ConnectedCookie
    ? auth0ConnectedCookie.split("=").slice(1).join("=").trim()
    : null;

  // Try management token
  let mgmtTokenStatus = "not attempted";
  let userIdentities = null;

  if (auth0UserId) {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;

    try {
      const tokenRes = await fetch(`https://${domain}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: clientId,
          client_secret: clientSecret,
          audience: `https://${domain}/api/v2/`,
        }),
      });

      if (!tokenRes.ok) {
        mgmtTokenStatus = `failed: ${tokenRes.status} ${await tokenRes.text().catch(() => "")}`;
      } else {
        const tokenData = await tokenRes.json();
        mgmtTokenStatus = "success";

        // Try fetching user identities
        const userRes = await fetch(
          `https://${domain}/api/v2/users/${encodeURIComponent(auth0UserId)}?fields=identities&include_fields=true`,
          { headers: { Authorization: `Bearer ${tokenData.access_token}` } },
        );

        if (!userRes.ok) {
          userIdentities = `failed: ${userRes.status} ${await userRes.text().catch(() => "")}`;
        } else {
          const userData = await userRes.json();
          // Redact access tokens but show structure
          userIdentities = (userData.identities ?? []).map((id: Record<string, unknown>) => ({
            provider: id.provider,
            connection: id.connection,
            user_id: id.user_id,
            hasAccessToken: !!id.access_token,
            hasRefreshToken: !!id.refresh_token,
          }));
        }
      }
    } catch (err) {
      mgmtTokenStatus = `error: ${err instanceof Error ? err.message : "unknown"}`;
    }
  }

  return Response.json({
    clerkId,
    auth0UserId,
    auth0Connected,
    mgmtTokenStatus,
    userIdentities,
  });
}
