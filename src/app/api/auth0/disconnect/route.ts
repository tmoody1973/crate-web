import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { TokenVaultService } from "@/lib/auth0-token-vault";

const VALID_SERVICES = new Set<TokenVaultService>(["spotify", "slack", "google"]);

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const body = await req.json().catch(() => ({}));
  const service = body.service as TokenVaultService | undefined;

  if (!service || !VALID_SERVICES.has(service)) {
    return Response.json({ error: "Invalid service" }, { status: 400 });
  }

  // Remove this service from the auth0_connected cookie
  const cookies = req.headers.get("cookie") ?? "";
  const connCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("auth0_connected="));
  const connected = connCookie
    ? connCookie.split("=").slice(1).join("=").trim().split(",").filter((s) => s !== service)
    : [];

  const response = NextResponse.json({ success: true, service });

  // Clear per-service Auth0 user ID cookie
  response.cookies.set(`auth0_user_id_${service}`, "", {
    path: "/",
    maxAge: 0,
    sameSite: "lax",
    secure: true,
    httpOnly: true,
  });

  // Update connected services cookie
  response.cookies.set("auth0_connected", connected.join(","), {
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
    sameSite: "lax",
    secure: true,
  });

  return response;
}
