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

    // Extract Auth0 user ID from token response
    const tokenData = await tokenRes.json();
    let auth0UserId = "";

    // Decode the id_token to get the Auth0 user ID (sub claim)
    if (tokenData.id_token) {
      try {
        const payload = tokenData.id_token.split(".")[1];
        const decoded = JSON.parse(Buffer.from(payload, "base64").toString());
        auth0UserId = decoded.sub || "";
      } catch {
        console.warn("[auth0/callback] Failed to decode id_token");
      }
    }

    // Fallback: use access_token to call /userinfo
    if (!auth0UserId && tokenData.access_token) {
      try {
        const userinfoRes = await fetch(`https://${domain}/userinfo`, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userinfoRes.ok) {
          const userinfo = await userinfoRes.json();
          auth0UserId = userinfo.sub || "";
        }
      } catch {
        console.warn("[auth0/callback] Failed to get userinfo");
      }
    }

    // Track connected services in a persistent cookie
    const existingCookie = (req.headers.get("cookie") ?? "")
      .split(";")
      .find((c) => c.trim().startsWith("auth0_connected="));
    const existing = existingCookie
      ? existingCookie.split("=").slice(1).join("=").trim().split(",")
      : [];
    if (!existing.includes(state.service)) existing.push(state.service);
    const connectedValue = existing.filter(Boolean).join(",");

    const response = NextResponse.redirect(new URL(`/w?auth0_connected=${state.service}`, url.origin));
    response.cookies.set("auth0_connected", connectedValue, {
      path: "/",
      maxAge: 365 * 24 * 60 * 60, // 1 year
      sameSite: "lax",
      secure: true,
    });
    if (auth0UserId) {
      response.cookies.set("auth0_user_id", auth0UserId, {
        path: "/",
        maxAge: 365 * 24 * 60 * 60,
        sameSite: "lax",
        secure: true,
        httpOnly: true,
      });
    }
    return response;
  } catch (err) {
    console.error("[auth0/callback] Error:", err);
    return NextResponse.redirect(new URL("/w?auth0_error=unknown", url.origin));
  }
}
