import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { checkRateLimit, BLOCKED_TEAM_DOMAINS } from "@/lib/plans";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Rate limit: 5 requests/minute
  const rl = checkRateLimit(`stripe-checkout:${clerkId}`, 5);
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  let priceId: string;
  let teamDomain: string | undefined;
  try {
    const body = await req.json();
    priceId = body.priceId;
    teamDomain = body.teamDomain;
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!priceId || typeof priceId !== "string") {
    return Response.json({ error: "priceId is required" }, { status: 400 });
  }

  // Validate team domain if provided
  if (teamDomain) {
    const domain = teamDomain.toLowerCase();
    if (BLOCKED_TEAM_DOMAINS.includes(domain)) {
      return Response.json(
        { error: "Team plans require a private email domain (not gmail.com, etc.)" },
        { status: 400 },
      );
    }
  }

  // Look up Convex user
  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  try {
    // Look up or create Stripe customer
    let stripeCustomerId = user.stripeCustomerId;
    if (!stripeCustomerId) {
      const customer = await getStripe().customers.create({
        email: user.email,
        metadata: { clerkId, convexUserId: user._id },
      });
      stripeCustomerId = customer.id;
      // Save stripeCustomerId to Convex user
      await convex.mutation(api.users.updateStripeCustomerId, {
        userId: user._id,
        stripeCustomerId,
      });
    }

    const origin = req.headers.get("origin") || "https://crate.fm";
    const session = await getStripe().checkout.sessions.create({
      customer: stripeCustomerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/settings?upgraded=true`,
      cancel_url: `${origin}/settings`,
      metadata: {
        convexUserId: user._id,
        teamDomain: teamDomain || "",
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout] Error:", err);
    return Response.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
