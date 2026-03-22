import { auth } from "@clerk/nextjs/server";
import { SERVICE_CONFIG, type TokenVaultService } from "@/lib/auth0-token-vault";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const url = new URL(req.url);
  const service = url.searchParams.get("service") as TokenVaultService | null;

  if (!service || !SERVICE_CONFIG[service]) {
    return Response.json({ error: "Invalid service" }, { status: 400 });
  }

  const config = SERVICE_CONFIG[service];
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const callbackUrl = process.env.AUTH0_CALLBACK_URL || `${url.origin}/api/auth0/callback`;

  // Generate CSRF nonce and store state in a signed cookie (not in the URL)
  const crypto = await import("crypto");
  const nonce = crypto.randomBytes(16).toString("hex");

  // Capture return URL so we don't create a new session on callback
  const referer = req.headers.get("referer");
  const returnTo = referer ? new URL(referer).pathname : "/w";

  // Store service + clerkId + returnTo keyed by nonce in a short-lived signed cookie
  const statePayload = JSON.stringify({ service, clerkId, nonce, returnTo });
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.AUTH0_CLIENT_SECRET!.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = Buffer.from(
    await globalThis.crypto.subtle.sign("HMAC", key, encoder.encode(statePayload)),
  ).toString("hex");
  const signedState = `${Buffer.from(statePayload).toString("base64")}.${signature}`;

  // Redirect to Auth0 authorization endpoint
  const authUrl = new URL(`https://${domain}/authorize`);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId!);
  authUrl.searchParams.set("redirect_uri", callbackUrl);
  authUrl.searchParams.set("scope", config.scopes.join(" "));
  authUrl.searchParams.set("connection", config.connection);
  authUrl.searchParams.set("state", nonce); // Only nonce in URL, not user data

  // Response.redirect() creates an immutable response, so build manually
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      "Set-Cookie": `auth0_state=${signedState}; HttpOnly; Secure; SameSite=Lax; Path=/api/auth0; Max-Age=600`,
    },
  });
}
