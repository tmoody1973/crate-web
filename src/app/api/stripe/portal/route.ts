import { auth } from "@clerk/nextjs/server";
import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { checkRateLimit } from "@/lib/plans";

function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!);
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const rl = checkRateLimit(`stripe-portal:${clerkId}`, 5);
  if (!rl.allowed) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const sub = await convex.query(api.subscriptions.getByUserId, { userId: user._id });
  if (!sub?.stripeCustomerId) {
    return Response.json({ error: "No active subscription" }, { status: 400 });
  }

  const origin = req.headers.get("origin") || "https://crate.fm";
  try {
    const session = await getStripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${origin}/w`,
    });
    return Response.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/portal] Error:", err);
    return Response.json({ error: "Failed to create portal session" }, { status: 500 });
  }
}
