# Stripe Setup Guide

## 1. Create a Stripe Account

Go to [dashboard.stripe.com](https://dashboard.stripe.com) and sign up. You'll land in **test mode** by default (toggle in the top-right says "Test mode" with an orange badge). Stay in test mode for now.

## 2. Get Your API Keys

**Dashboard → Developers → API keys** (or click the "Developers" tab in the top nav)

You'll see two keys:

| Key | Env Var | What it looks like |
|-----|---------|-------------------|
| **Publishable key** | `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_51ABC...` |
| **Secret key** | `STRIPE_SECRET_KEY` | `sk_test_51ABC...` (click "Reveal" to copy) |

Copy both into your `.env.local`.

## 3. Create Your Products + Prices

**Dashboard → Product catalog → + Add product**

Create **two products**:

### Product 1: Crate Pro

- Name: `Crate Pro`
- Pricing: **Recurring**, `$15.00`, `Monthly`
- Click **Save product**
- On the product page, find the **Price** section → copy the **Price ID** (starts with `price_`)
- This goes in `STRIPE_PRO_MONTHLY_PRICE_ID`

### Product 2: Crate Team

- Name: `Crate Team`
- Pricing: **Recurring**, `$25.00`, `Monthly`
- Click **Save product**
- Copy the Price ID → `STRIPE_TEAM_MONTHLY_PRICE_ID`

(Optional: add an annual Pro price at $144/yr → `STRIPE_PRO_ANNUAL_PRICE_ID`)

## 4. Set Up the Webhook

**Dashboard → Developers → Webhooks → + Add endpoint**

- **Endpoint URL**: `https://your-domain.com/api/webhooks/stripe`
  - For local dev, use the Stripe CLI instead (see below)
- **Events to listen to** — select these 5:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_succeeded`
  - `invoice.payment_failed`
- Click **Add endpoint**
- On the endpoint page, click **Reveal** under "Signing secret"
- Copy it → `STRIPE_WEBHOOK_SECRET` (starts with `whsec_`)

## 5. Local Development with Stripe CLI

For testing webhooks locally:

```bash
# Install
brew install stripe/stripe-cli/stripe

# Login (opens browser)
stripe login

# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

The CLI prints a **webhook signing secret** (`whsec_...`) — use that as your `STRIPE_WEBHOOK_SECRET` for local dev (it's different from the dashboard one).

## 6. Your Final .env.local Additions

```bash
# Stripe API keys (from step 2)
STRIPE_SECRET_KEY=sk_test_51ABC...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_51ABC...

# Webhook secret (from step 4 or step 5)
STRIPE_WEBHOOK_SECRET=whsec_...

# Price IDs (from step 3)
STRIPE_PRO_MONTHLY_PRICE_ID=price_...
STRIPE_PRO_ANNUAL_PRICE_ID=price_...
STRIPE_TEAM_MONTHLY_PRICE_ID=price_...

# Your own Anthropic key for serving free/pro users
PLATFORM_ANTHROPIC_KEY=sk-ant-...

# Admin bypass
ADMIN_EMAILS=tarikjmoody@gmail.com
```

## 7. Test It

With `stripe listen` running locally:

1. Start your dev server
2. Open Settings → you should see "Your Plan: Free"
3. Click "Upgrade to Pro" → Stripe Checkout opens
4. Use test card `4242 4242 4242 4242`, any future expiry, any CVC
5. After checkout, the webhook fires → your plan updates to Pro
6. Settings now shows "Your Plan: Pro ($15/mo)"

**Test card numbers:**

| Card | Behavior |
|------|----------|
| `4242 4242 4242 4242` | Always succeeds |
| `4000 0000 0000 0341` | Payment failure (test `past_due` handling) |
