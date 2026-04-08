import { auth } from "@clerk/nextjs/server";
import { isTokenVaultConfigured } from "@/lib/auth0-token-vault";

export async function GET(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({
      configured: false,
      connections: { spotify: false, slack: false, google: false, tumblr: false },
    });
  }

  // Read connected services from cookie (set during OAuth callback)
  const cookies = req.headers.get("cookie") ?? "";
  const connCookie = cookies
    .split(";")
    .find((c) => c.trim().startsWith("auth0_connected="));
  const connectedServices = connCookie
    ? connCookie.split("=").slice(1).join("=").trim().split(",")
    : [];

  return Response.json({
    configured: true,
    connections: {
      spotify: connectedServices.includes("spotify"),
      slack: connectedServices.includes("slack"),
      google: connectedServices.includes("google"),
      tumblr: connectedServices.includes("tumblr"),
    },
  });
}
