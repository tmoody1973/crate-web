import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const url = new URL(req.url);

  // Auth0 sends error params instead of code when authorization fails
  const auth0Error = url.searchParams.get("error");
  const auth0ErrorDesc = url.searchParams.get("error_description");
  if (auth0Error) {
    console.error(`[auth0/callback] Auth0 error: ${auth0Error} — ${auth0ErrorDesc}`);
    return NextResponse.redirect(
      new URL(`/w?auth0_error=${encodeURIComponent(auth0Error)}&auth0_error_desc=${encodeURIComponent(auth0ErrorDesc || "")}`, url.origin),
    );
  }

  const code = url.searchParams.get("code");
  const nonce = url.searchParams.get("state");

  if (!code || !nonce) {
    console.error("[auth0/callback] Missing code or state. Params:", Object.fromEntries(url.searchParams));
    return NextResponse.redirect(new URL("/w?auth0_error=missing_params", url.origin));
  }

  // Verify CSRF nonce against signed cookie
  const cookies = req.headers.get("cookie") ?? "";
  const stateCookie = cookies.split(";").find((c) => c.trim().startsWith("auth0_state="));
  if (!stateCookie) {
    return NextResponse.redirect(new URL("/w?auth0_error=no_state_cookie", url.origin));
  }

  const signedState = stateCookie.split("=").slice(1).join("=").trim();
  const [payloadB64, signature] = signedState.split(".");
  const statePayload = Buffer.from(payloadB64, "base64").toString();

  // Verify HMAC signature
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(process.env.AUTH0_CLIENT_SECRET!.slice(0, 32).padEnd(32, "0")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const valid = await globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    Buffer.from(signature, "hex"),
    encoder.encode(statePayload),
  );
  if (!valid) {
    return NextResponse.redirect(new URL("/w?auth0_error=invalid_signature", url.origin));
  }

  let state: { service: string; clerkId: string; nonce: string };
  try {
    state = JSON.parse(statePayload);
  } catch {
    return NextResponse.redirect(new URL("/w?auth0_error=invalid_state", url.origin));
  }

  // Verify nonce matches
  if (state.nonce !== nonce) {
    return NextResponse.redirect(new URL("/w?auth0_error=nonce_mismatch", url.origin));
  }

  // Exchange code for tokens via Auth0
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const clientSecret = process.env.AUTH0_CLIENT_SECRET;
  const callbackUrl = process.env.AUTH0_CALLBACK_URL || `${url.origin}/api/auth0/callback`;

  try {
    const tokenRes = await fetch(`https://${domain}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
    });

    if (!tokenRes.ok) {
      const detail = await tokenRes.text().catch(() => "");
      console.error("[auth0/callback] Token exchange failed:", detail);
      return NextResponse.redirect(new URL(`/w?auth0_error=token_exchange&service=${state.service}`, url.origin));
    }

    // Token is now stored in Auth0's Token Vault — we don't store it ourselves
    // The connection is now active for this user

    return NextResponse.redirect(new URL(`/w?auth0_connected=${state.service}`, url.origin));
  } catch (err) {
    console.error("[auth0/callback] Error:", err);
    return NextResponse.redirect(new URL("/w?auth0_error=unknown", url.origin));
  }
}
