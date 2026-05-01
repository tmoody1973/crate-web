# Stripe Billing Setup Guide

Step-by-step guide to set up Stripe billing for Crate, from test mode through production.

---

## Crate's Billing Architecture

Crate uses Stripe for subscription billing with three tiers:

| Plan | Price | Features |
|------|-------|----------|
| **Free** | $0 | 10 agent queries/month, 5 sessions, 3 custom skills, connected services |
| **Pro** | $15/mo | 50 queries, unlimited sessions, 20 skills, memory, publishing, influence caching |
| **Team** | $25/mo | 200 pooled queries, admin dashboard, shared org keys |

BYOK (Bring Your Own Key) users get unlimited queries regardless of plan.

### How it works

1. User clicks "Upgrade" on the pricing page
2. Crate creates a Stripe Checkout session (`/api/stripe/checkout`)
3. User completes payment on Stripe's hosted checkout page
4. Stripe sends a webhook to `/api/webhooks/stripe`
5. Webhook handler creates/updates a `subscriptions` record in Convex
6. The chat route checks the subscription to determine plan limits and feature access

### Key files

| File | Purpose |
|------|---------|
| `src/app/api/stripe/checkout/route.ts` | Creates Checkout sessions for new subscriptions |
| `src/app/api/stripe/portal/route.ts` | Opens the Stripe Billing Portal for managing subscriptions |
| `src/app/api/webhooks/stripe/route.ts` | Handles webhook events (subscription created, updated, canceled, payment failed) |
| `src/lib/plans.ts` | Plan definitions, limits, rate limiting, admin/beta access |
| `convex/subscriptions.ts` | Convex table for subscription state |
| `src/components/settings/plan-section.tsx` | Settings UI showing current plan and upgrade/manage buttons |
| `src/components/landing/pricing.tsx` | Public pricing page |

---

## Part 1: Stripe Account Setup

1. Create a Stripe account at **https://dashboard.stripe.com/register** (if you don't have one)
2. Complete the business profile (name, address, bank account for payouts)
3. You start in **Test Mode** by default (toggle in the top right of the dashboard)

---

## Part 2: Create Products and Prices (Test Mode)

Stay in Test Mode for initial setup.

### Create the Pro plan

1. Go to **Products** → **Add Product**
2. Fill in:
   - Name: `Crate Pro`
   - Description: `50 research queries/month, publishing, memory, influence caching`
3. Add pricing:
   - **Monthly**: $15.00 USD, Recurring, Monthly
   - Click "Add another price"
   - **Annual**: $144.00 USD ($12/mo), Recurring, Yearly
4. Save. Copy both price IDs (`price_test_...`)

### Create the Team plan

1. **Products** → **Add Product**
2. Fill in:
   - Name: `Crate Team`
   - Description: `200 pooled queries, admin dashboard, shared org keys`
3. Add pricing:
   - **Monthly**: $25.00 USD, Recurring, Monthly
4. Save. Copy the price ID.

---

## Part 3: Set Up Webhooks (Test Mode)

1. Go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Endpoint URL: `https://digcrate.app/api/webhooks/stripe`
4. Select events:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
   - `invoice.paid`
5. Click **Add endpoint**
6. Click on the endpoint, then **Reveal** the Signing Secret (`whsec_...`)
7. Copy the signing secret

---

## Part 4: Configure Environment Variables

Add these to your `.env.local` and Vercel environment variables:

```bash
# Stripe keys (from Dashboard → Developers → API keys)
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Webhook signing secret (from the webhook endpoint you created)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from the products you created)
STRIPE_PRO_MONTHLY_PRICE_ID=price_test_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_test_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_test_...
```

---

## Part 5: Test the Full Flow

### Test subscription checkout

1. Go to digcrate.app → **Pricing** → click **Upgrade to Pro**
2. Use Stripe's test card numbers:

| Scenario | Card Number | Expiry | CVC |
|----------|------------|--------|-----|
| Successful payment | `4242 4242 4242 4242` | Any future date | Any 3 digits |
| Card declined | `4000 0000 0000 0002` | Any future date | Any 3 digits |
| Requires authentication | `4000 0025 0000 3155` | Any future date | Any 3 digits |
| Insufficient funds | `4000 0000 0000 9995` | Any future date | Any 3 digits |

3. After successful checkout, verify:
   - Settings shows "Pro" plan badge
   - 50 queries/month limit applies
   - Publishing features are unlocked
   - Memory features are available

### Test billing portal

1. Go to Settings → click **Manage Subscription**
2. Stripe's portal opens showing the current plan
3. Test: cancel subscription, verify plan reverts to Free
4. Test: re-subscribe

### Test webhook handling

1. In Stripe Dashboard → **Developers** → **Webhooks** → click your endpoint
2. Click **Send test webhook** → select `customer.subscription.updated`
3. Check Convex dashboard to verify the subscription record updated

### Verify in Stripe Dashboard

- **Customers** → your test customer should appear with email
- **Subscriptions** → active subscription with the correct plan
- **Events** → webhook events should show as delivered

---

## Part 6: Move to Production (Live Mode)

When you're ready to accept real payments:

### Step 1: Complete Stripe verification

- Stripe Dashboard → **Settings** → **Business details**
- Complete all required verification (business type, address, bank account, tax ID)
- This may take 1-2 business days for Stripe to verify

### Step 2: Create live products and prices

1. Toggle to **Live Mode** in the Stripe Dashboard (top right switch)
2. Repeat Part 2: create the same products and prices in live mode
   - Crate Pro: $15/mo monthly, $144/yr annual
   - Crate Team: $25/mo monthly
3. Copy the new live price IDs (`price_live_...`)

Note: Test mode products and prices do NOT carry over to live mode. You must recreate them.

### Step 3: Create live webhook

1. In Live Mode → **Developers** → **Webhooks** → **Add endpoint**
2. URL: `https://digcrate.app/api/webhooks/stripe`
3. Same events as test mode
4. Copy the new live signing secret

### Step 4: Get live API keys

1. **Developers** → **API keys**
2. Copy the live Publishable key (`pk_live_...`) and Secret key (`sk_live_...`)

### Step 5: Update Vercel environment variables

| Variable | Test Value | Live Value |
|----------|-----------|------------|
| `STRIPE_SECRET_KEY` | `sk_test_...` | `sk_live_...` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` | `pk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | test `whsec_...` | live `whsec_...` |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | `price_test_...` | `price_live_...` |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | `price_test_...` | `price_live_...` |
| `STRIPE_TEAM_MONTHLY_PRICE_ID` | `price_test_...` | `price_live_...` |

### Step 6: Redeploy

Push to main or trigger a manual Vercel deploy. The app will now process real payments.

### Step 7: Verify with a real card

1. Subscribe with a real credit card ($15 charge)
2. Verify the subscription is active
3. Cancel and confirm the refund processes in Stripe Dashboard
4. Check that the webhook updates the Convex subscription record

---

## Gotchas

1. **Test vs Live mode is global in the dashboard.** Make sure you're looking at the right mode when copying keys and price IDs. The toggle is in the top right corner.

2. **Webhooks are mode-specific.** Test mode webhooks only fire for test transactions. You need separate webhook endpoints for test and live mode. The URL can be the same, but the signing secrets are different.

3. **Price IDs don't transfer.** `price_test_...` IDs are invalid in live mode. You must create new products/prices in live mode and get new `price_live_...` IDs.

4. **Past-due grace period.** Crate gives a 3-day grace period for past-due subscriptions (`PAST_DUE_GRACE_MS` in `src/lib/plans.ts`). After that, the user reverts to Free.

5. **Admin and beta bypass.** Users in `ADMIN_EMAILS` env var bypass all billing. Users with `BETA_DOMAINS` email domains get Pro access for free. These are checked in `src/lib/plans.ts`.

6. **Stripe Customer Portal.** The portal URL is generated dynamically via `/api/stripe/portal`. Make sure the Customer Portal is configured in Stripe Dashboard → **Settings** → **Billing** → **Customer portal** (enable it and customize the branding).

7. **Convex subscription schema.** The `subscriptions` table in Convex stores: `userId`, `plan`, `status`, `stripeSubscriptionId`, `stripeCustomerId`, `currentPeriodStart`, `currentPeriodEnd`, `teamDomain`. The webhook handler creates/updates this record.

---

## Quick Reference

### Stripe Dashboard URLs

| Page | URL |
|------|-----|
| API Keys | https://dashboard.stripe.com/apikeys |
| Products | https://dashboard.stripe.com/products |
| Webhooks | https://dashboard.stripe.com/webhooks |
| Customers | https://dashboard.stripe.com/customers |
| Subscriptions | https://dashboard.stripe.com/subscriptions |
| Customer Portal Settings | https://dashboard.stripe.com/settings/billing/portal |
| Business Settings | https://dashboard.stripe.com/settings/account |

### Test Card Numbers

| Card | Number |
|------|--------|
| Visa (success) | `4242 4242 4242 4242` |
| Visa (declined) | `4000 0000 0000 0002` |
| 3D Secure | `4000 0025 0000 3155` |
| Insufficient funds | `4000 0000 0000 9995` |
| Expired card | `4000 0000 0000 0069` |

Full list: https://docs.stripe.com/testing#cards
