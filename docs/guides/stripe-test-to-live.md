# Moving Stripe from Test to Live

A plain-English guide to switching Crate's billing from Stripe test mode to accepting real payments. No code changes needed, just dashboard configuration and environment variable swaps.

---

## Before You Start

Make sure you've tested everything in test mode first:
- Subscribed with a test card (`4242 4242 4242 4242`)
- Verified the subscription shows up in Crate's Settings
- Tested the billing portal (Manage Subscription)
- Canceled and re-subscribed
- Checked the Stripe Dashboard for test transactions

If you haven't done this yet, see `docs/guides/stripe-setup.md`.

---

## Step 1: Complete Stripe Business Verification

Stripe won't let you accept real payments until your business is verified.

1. Go to **https://dashboard.stripe.com/settings/account**
2. Fill in everything Stripe asks for:
   - Business type (individual, LLC, etc.)
   - Legal business name
   - Address
   - Tax ID (EIN or SSN for sole proprietors)
   - Bank account for payouts
3. Submit for review

This can take **1-2 business days**. Stripe will email you when approved. You can continue setup while waiting, but live charges won't process until verification completes.

---

## Step 2: Switch to Live Mode in Stripe Dashboard

Look at the top-right corner of the Stripe Dashboard. You'll see a toggle that says **"Test mode"** with a switch. Click it to switch to **Live mode**.

Everything in the dashboard now shows real data. Your test products, prices, and webhooks are still there in test mode. You're not losing anything.

---

## Step 3: Create Live Products and Prices

Test mode products don't carry over. You need to recreate them in live mode.

### Create Crate Pro

1. Go to **Products** (in the left sidebar) and click **Add product**
2. Fill in:
   - **Name:** Crate Pro
   - **Description:** 50 research queries/month, publishing, memory, influence caching, 20 custom skills
3. Under Pricing, add:
   - Click **Add price**
   - **Price:** $15.00
   - **Billing period:** Monthly
   - Click **Add price** again
   - **Price:** $144.00 ($12/month billed annually)
   - **Billing period:** Yearly
4. Click **Save product**
5. Click into each price and copy the **Price ID** (starts with `price_`)

Write these down:
- Pro Monthly: `price_________________`
- Pro Annual: `price_________________`

### Create Crate Team

1. **Products** then **Add product**
2. Fill in:
   - **Name:** Crate Team
   - **Description:** 200 pooled queries, admin dashboard, shared org keys
3. Under Pricing:
   - **Price:** $25.00
   - **Billing period:** Monthly
4. Save and copy the Price ID

Write it down:
- Team Monthly: `price_________________`

---

## Step 4: Get Your Live API Keys

1. Go to **Developers** (left sidebar) then **API keys**
2. You'll see two keys:
   - **Publishable key** (starts with `pk_live_`) — safe to use in the browser
   - **Secret key** (starts with `sk_live_`) — keep this private, never expose it
3. Copy both

Write them down:
- Publishable: `pk_live_________________`
- Secret: `sk_live_________________`

---

## Step 5: Create a Live Webhook

Webhooks tell Crate when someone subscribes, cancels, or has a payment issue.

1. Go to **Developers** then **Webhooks**
2. Click **Add endpoint**
3. Fill in:
   - **Endpoint URL:** `https://digcrate.app/api/webhooks/stripe`
   - **Description:** Crate subscription events
4. Under "Select events to listen to," click **Select events** and check:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
5. Click **Add endpoint**
6. Click on the endpoint you just created
7. Under "Signing secret," click **Reveal** and copy the value (starts with `whsec_`)

Write it down:
- Webhook secret: `whsec_________________`

---

## Step 6: Enable the Customer Portal

The customer portal is where users manage their subscription (cancel, update card, switch plans).

1. Go to **Settings** (gear icon) then **Billing** then **Customer portal**
2. Make sure it's enabled
3. Under "Features," enable:
   - Cancel subscriptions
   - Update payment methods
   - View invoices
4. Under "Branding," optionally add Crate's logo and colors
5. Save

---

## Step 7: Update Vercel Environment Variables

Go to **Vercel Dashboard** (vercel.com) then your Crate project then **Settings** then **Environment Variables**.

Update these 6 variables (replace the old test values with the live values you copied above):

| Variable Name | What to paste |
|--------------|---------------|
| `STRIPE_SECRET_KEY` | Your `sk_live_` key from Step 4 |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Your `pk_live_` key from Step 4 |
| `STRIPE_WEBHOOK_SECRET` | Your `whsec_` from Step 5 |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Pro monthly `price_` from Step 3 |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Pro annual `price_` from Step 3 |
| `STRIPE_TEAM_MONTHLY_PRICE_ID` | Team monthly `price_` from Step 3 |

After updating all 6, click **Save** for each one.

**Do NOT change** any other environment variables. Clerk, Convex, Auth0, and everything else stays the same.

---

## Step 8: Redeploy

Vercel needs to pick up the new environment variables.

Option A: Push any small code change to trigger a deploy.

Option B: Go to **Vercel Dashboard** then **Deployments** then click the three dots on the latest deployment then **Redeploy**.

Wait for the deployment to finish (usually 1-2 minutes).

---

## Step 9: Test with a Real Card

This is the moment of truth.

1. Go to **digcrate.app/pricing**
2. Click **Upgrade to Pro** ($15/month)
3. Enter a **real credit card** (your own)
4. Complete the checkout

After checkout:
- You should be redirected back to Crate
- Settings should show "Pro" plan
- The Stripe Dashboard (live mode) should show a new customer and subscription

Then immediately:
1. Go to **Settings** then **Manage Subscription**
2. Cancel the subscription
3. Go to **Stripe Dashboard** then **Payments** then find the charge then **Refund**

This costs you nothing (refund processes in 5-10 business days) and confirms the entire flow works with real money.

---

## Step 10: Verify the Webhook

The webhook is the most important piece. Without it, Stripe takes money but Crate doesn't know about the subscription.

1. Go to **Stripe Dashboard** (live mode) then **Developers** then **Webhooks**
2. Click on your endpoint
3. Under "Recent deliveries," you should see events from your test purchase
4. Each event should show a green checkmark (200 response)

If you see red X marks (failed deliveries):
- Check that the URL is exactly `https://digcrate.app/api/webhooks/stripe`
- Check that `STRIPE_WEBHOOK_SECRET` in Vercel matches the signing secret shown here
- Click "Resend" on a failed event to retry

---

## You're Done

Real payments are now live. When a user upgrades on digcrate.app, they'll be charged real money, and Crate will unlock their Pro or Team features automatically.

**What to monitor in the first week:**
- Check Stripe Dashboard daily for failed payments or disputes
- Watch the Vercel logs for webhook errors
- Verify at least one real subscription activates correctly
- Check PostHog for `checkout_started` and `subscription_activated` events

---

## Quick Reference: What Changed

| Item | Test Mode | Live Mode |
|------|-----------|-----------|
| Secret key | `sk_test_...` | `sk_live_...` |
| Publishable key | `pk_test_...` | `pk_live_...` |
| Webhook secret | Test `whsec_...` | Live `whsec_...` |
| Price IDs | `price_test_...` | `price_live_...` |
| Card numbers | `4242 4242 4242 4242` | Real credit cards |
| Money | Fake | Real |

## If Something Goes Wrong

- **"No such price" error on checkout:** You're using a test price ID in live mode. Update the `STRIPE_PRO_MONTHLY_PRICE_ID` (and others) in Vercel to the live price IDs.
- **Webhook fails with 401:** The webhook secret doesn't match. Re-copy it from Stripe and update `STRIPE_WEBHOOK_SECRET` in Vercel. Redeploy.
- **User pays but doesn't get Pro:** The webhook isn't firing or failing. Check Stripe Dashboard for webhook delivery status. Check Vercel logs for errors in `/api/webhooks/stripe`.
- **"Your card was declined":** This is a real card issue, not a Crate issue. The customer needs to use a different card or contact their bank.
