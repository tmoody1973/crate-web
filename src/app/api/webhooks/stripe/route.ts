import Stripe from "stripe";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

// Determine plan from Stripe price ID
function planFromPriceId(priceId: string): "pro" | "team" {
  if (priceId === process.env.STRIPE_TEAM_MONTHLY_PRICE_ID) return "team";
  return "pro"; // pro monthly or annual
}

/**
 * Retrieve billing period from the subscription's latest invoice.
 * In Stripe v20, current_period_start/end were removed from Subscription;
 * the canonical source is the latest paid invoice's period fields.
 */
async function getSubPeriod(
  stripeSubId: string,
): Promise<{ currentPeriodStart: number; currentPeriodEnd: number }> {
  const stripeSub = await stripe.subscriptions.retrieve(stripeSubId, {
    expand: ["latest_invoice"],
  });
  const invoice = stripeSub.latest_invoice as Stripe.Invoice | null;
  if (invoice && invoice.period_start && invoice.period_end) {
    return {
      currentPeriodStart: invoice.period_start * 1000,
      currentPeriodEnd: invoice.period_end * 1000,
    };
  }
  // Fallback: use billing_cycle_anchor as start, start_date as reference
  const now = Date.now();
  const anchor = stripeSub.billing_cycle_anchor * 1000;
  return {
    currentPeriodStart: anchor,
    currentPeriodEnd: now + 30 * 24 * 60 * 60 * 1000,
  };
}

export async function POST(req: Request) {
  // MUST use text() for signature verification (not json())
  // Next.js App Router does not auto-consume the body, so req.text() works correctly
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const convexUserId = session.metadata?.convexUserId;
      const teamDomain = session.metadata?.teamDomain || undefined;
      const stripeSubId = session.subscription as string;

      if (!convexUserId || !stripeSubId) break;

      // Idempotency: check if subscription already exists
      const existing = await convex.query(api.subscriptions.getByStripeSub, {
        stripeSubscriptionId: stripeSubId,
      });
      if (existing) break;

      // Fetch subscription details from Stripe
      const stripeSub = await stripe.subscriptions.retrieve(stripeSubId);
      const priceId = stripeSub.items.data[0]?.price.id ?? "";
      const plan = planFromPriceId(priceId);
      const period = await getSubPeriod(stripeSubId);

      // Note: ConvexHttpClient accepts string IDs for v.id() fields
      await convex.mutation(api.subscriptions.create, {
        userId: convexUserId as Id<"users">,
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: stripeSubId,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
        teamDomain,
      });
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      // In Stripe v20, subscription is nested under parent.subscription_details.subscription
      const stripeSubId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : (invoice.parent?.subscription_details?.subscription?.id ?? "");
      if (!stripeSubId) break;

      const sub = await convex.query(api.subscriptions.getByStripeSub, {
        stripeSubscriptionId: stripeSubId,
      });
      if (!sub) break;

      await convex.mutation(api.subscriptions.update, {
        subscriptionId: sub._id,
        status: "active",
        currentPeriodStart: invoice.period_start * 1000,
        currentPeriodEnd: invoice.period_end * 1000,
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const stripeSubId =
        typeof invoice.parent?.subscription_details?.subscription === "string"
          ? invoice.parent.subscription_details.subscription
          : (invoice.parent?.subscription_details?.subscription?.id ?? "");
      if (!stripeSubId) break;

      const sub = await convex.query(api.subscriptions.getByStripeSub, {
        stripeSubscriptionId: stripeSubId,
      });
      if (!sub) break;

      await convex.mutation(api.subscriptions.update, {
        subscriptionId: sub._id,
        status: "past_due",
      });
      break;
    }

    case "customer.subscription.updated": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const sub = await convex.query(api.subscriptions.getByStripeSub, {
        stripeSubscriptionId: stripeSub.id,
      });
      if (!sub) break;

      const priceId = stripeSub.items.data[0]?.price.id ?? "";
      const period = await getSubPeriod(stripeSub.id);
      await convex.mutation(api.subscriptions.update, {
        subscriptionId: sub._id,
        plan: planFromPriceId(priceId),
        cancelAtPeriodEnd: stripeSub.cancel_at_period_end,
        currentPeriodStart: period.currentPeriodStart,
        currentPeriodEnd: period.currentPeriodEnd,
      });
      break;
    }

    case "customer.subscription.deleted": {
      const stripeSub = event.data.object as Stripe.Subscription;
      const sub = await convex.query(api.subscriptions.getByStripeSub, {
        stripeSubscriptionId: stripeSub.id,
      });
      if (!sub) break;

      // Set to canceled + free (preserves audit trail)
      await convex.mutation(api.subscriptions.update, {
        subscriptionId: sub._id,
        status: "canceled",
        plan: "free",
      });
      break;
    }
  }

  return new Response("ok", { status: 200 });
}
