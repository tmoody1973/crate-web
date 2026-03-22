import { auth } from "@clerk/nextjs/server";
import { isTokenVaultConfigured } from "@/lib/auth0-token-vault";

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  if (!isTokenVaultConfigured()) {
    return Response.json({
      configured: false,
      connections: { spotify: false, slack: false, google: false },
    });
  }

  // TODO: Query Auth0 to check which connections exist for this user
  // For the hackathon MVP, this can check if tokens are retrievable
  // by attempting a token exchange for each service

  return Response.json({
    configured: true,
    connections: {
      spotify: false, // Will be populated once Auth0 is configured
      slack: false,
      google: false,
    },
  });
}
