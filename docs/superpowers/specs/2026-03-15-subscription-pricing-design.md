# Crate Subscription & Pricing System — Design Spec

**Date:** 2026-03-15
**Status:** Approved
**Purpose:** Implement a 3-tier subscription system (Free / Pro / Team) with Stripe billing, usage metering, and feature gating.

---

## 1. Tier Structure

| | **Free** | **Pro** | **Team** |
|---|---|---|---|
| **Price** | $0/mo | $15/mo ($120/yr) | $25/mo per domain |
| **Chat (Haiku, no tools)** | Unlimited | Unlimited | Unlimited |
| **Agent queries (Crate's key)** | 10/month | 50/month | 200/month pooled |
| **BYOK agent queries** | Unlimited | Unlimited | Unlimited |
| **Model on Crate's key** | Haiku (chat), Sonnet (agent) | Haiku (chat), Sonnet (agent) | Same |
| **Publishing (Telegraph/Tumblr)** | No | Yes | Yes |
| **Cross-session memory (Mem0)** | No | Yes | Yes |
| **Influence graph caching** | No | Yes | Yes |
| **Saved sessions** | Last 5 | Unlimited | Unlimited |
| **Shared org keys** | No | No | Yes (domain-based) |
| **Admin dashboard** | No | No | Yes |
| **Onboarding** | Standard wizard | Standard wizard | Team wizard (Radio Milwaukee style) |

### BYOK Rule

On any tier, adding your own Anthropic or OpenRouter key removes the agent query cap. Pro-only features (publishing, memory, influence caching) still require Pro or Team regardless of BYOK status.

### Unit Economics

**Pro at $15/mo:**
- Realistic usage (30 chat + 20 agent): ~$2.50 AI cost
- Heavy usage (100 chat + 50 agent): ~$6.00 AI cost
- Stripe fees (2.9% + $0.30): ~$0.74
- Embedded data source keys: ~$0.50/month amortized
- **Margin per Pro user: $5-11/month (35-75%)**

**Team at $25/mo (5 members avg):**
- 200 pooled agent queries: ~$12-20 AI cost worst case
- Stripe fees: ~$1.03
- **Margin: $4-12/month (16-48%)**

---

## 2. Convex Schema Additions

### New table: `subscriptions`

```typescript
subscriptions: defineTable({
  userId: v.id("users"),
  plan: v.string(),                    // "free" | "pro" | "team"
  status: v.string(),                  // "active" | "canceled" | "past_due"
  stripeCustomerId: v.optional(v.string()),
  stripeSubscriptionId: v.optional(v.string()),
  currentPeriodStart: v.number(),      // Unix timestamp
  currentPeriodEnd: v.number(),        // Unix timestamp
  cancelAtPeriodEnd: v.boolean(),
  teamDomain: v.optional(v.string()),  // For team plans only
  createdAt: v.number(),
}).index("by_user", ["userId"])
  .index("by_stripe_sub", ["stripeSubscriptionId"])
  .index("by_team_domain", ["teamDomain"])
```

### New table: `usageEvents`

```typescript
usageEvents: defineTable({
  userId: v.id("users"),
  type: v.string(),                    // "agent_query" | "chat_query"
  periodStart: v.number(),            // Billing period start (for grouping)
  createdAt: v.number(),
}).index("by_user_period", ["userId", "periodStart"])
  .index("by_domain_period", ["type", "periodStart"])
```

No changes to existing `users` or `orgKeys` tables. Subscription references users by ID. Team plans reference domains — same model `orgKeys` already uses.

### New Convex functions: `convex/subscriptions.ts`

- `getByUserId(userId)` — returns subscription record or null (defaults to free)
- `getByStripeSub(stripeSubscriptionId)` — for webhook lookups
- `create(userId, plan, stripeCustomerId, stripeSubscriptionId, periodStart, periodEnd, teamDomain?)` — create subscription record
- `update(subscriptionId, fields)` — update plan, status, period dates
- `cancel(subscriptionId)` — set cancelAtPeriodEnd = true

### New Convex functions: `convex/usage.ts`

- `recordEvent(userId, type, periodStart)` — write a usage event row
- `countAgentQueries(userId, periodStart)` — count agent queries for user in period
- `countTeamAgentQueries(teamDomain, periodStart)` — count pooled team queries in period
- `getUsageSummary(userId)` — returns { agentQueriesUsed, agentQueriesLimit, periodEnd }

---

## 3. Stripe Integration

### Stripe Products & Prices

Create in Stripe Dashboard (or via CLI):

| Product | Price ID (create in Stripe) | Amount | Interval |
|---|---|---|---|
| Crate Pro | `price_pro_monthly` | $15.00 | monthly |
| Crate Pro Annual | `price_pro_annual` | $120.00 | yearly |
| Crate Team | `price_team_monthly` | $25.00 | monthly |

### New API Routes

**`POST /api/stripe/checkout`**

Creates a Stripe Checkout Session and returns the URL.

```typescript
Input: { priceId: string, teamDomain?: string }
Flow:
  1. Get authenticated user via Clerk
  2. Look up or create Stripe customer (store stripeCustomerId in subscription record)
  3. Create Checkout Session with:
     - customer: stripeCustomerId
     - price: priceId
     - mode: "subscription"
     - success_url: "/settings?upgraded=true"
     - cancel_url: "/settings"
     - metadata: { userId, teamDomain }
  4. Return { url: session.url }
```

**`POST /api/stripe/portal`**

Creates a Stripe Billing Portal session for managing subscription.

```typescript
Input: (none — uses authenticated user)
Flow:
  1. Get authenticated user via Clerk
  2. Look up subscription → stripeCustomerId
  3. Create portal session with return_url: "/settings"
  4. Return { url: session.url }
```

**`POST /api/webhooks/stripe`**

Receives Stripe webhook events and syncs to Convex.

```typescript
Events handled:
  checkout.session.completed
    → Create subscription in Convex (plan from price metadata, status: "active")
    → Set currentPeriodStart/End from Stripe subscription object

  invoice.paid
    → Update currentPeriodStart/End (new billing period)
    → Usage counter effectively resets (new periodStart means old events aren't counted)

  invoice.payment_failed
    → Set status to "past_due"

  customer.subscription.updated
    → Sync plan changes, cancelAtPeriodEnd flag

  customer.subscription.deleted
    → Delete subscription record (user reverts to free)
```

### Environment Variables (new)

```
STRIPE_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRO_MONTHLY_PRICE_ID=price_xxx
STRIPE_PRO_ANNUAL_PRICE_ID=price_xxx
STRIPE_TEAM_MONTHLY_PRICE_ID=price_xxx
```

---

## 4. Enforcement

### Query Gating (in `src/app/api/chat/route.ts`)

Before processing any message in the existing chat route:

```
1. Look up user's subscription (Convex query by userId)
2. No subscription → plan = "free"
3. Determine query type: chat or agent
4. If chat → always allow (unlimited on all tiers)
5. If agent → count usageEvents for current billing period
6. Get limit for plan: free=10, pro=50, team=200 (pooled by domain)
7. If over limit AND user has BYOK key → proceed using their key
8. If over limit AND no BYOK key → return 402 with upgrade message
9. If under limit → proceed, write usageEvent to Convex
```

### Feature Gating

Pro-only features check plan before executing:

| Feature | Gate Location | Behavior on Free |
|---|---|---|
| `/publish` | Chat route command handling | Agent responds: "Publishing requires Pro. Upgrade for $15/mo." |
| `/published` | Chat route command handling | Same upgrade message |
| Mem0 memory | Agentic loop (skip Mem0 tool) | Memory tools not registered for free users |
| Influence cache write | `influence-cache.ts` | Read from cache allowed, write skipped |
| Session saving (>5) | Chat persistence | Oldest session auto-deleted when 6th is created |

### Team Pooled Quota

For team plan users:
1. Look up subscription by userId → get teamDomain
2. Count agent queries WHERE email domain matches teamDomain AND periodStart matches current period
3. Compare against 200 pooled limit
4. Same BYOK overflow rule applies per-member

---

## 5. Upgrade UX

### Conversion Trigger 1: Agent Query Limit Hit

When a user exceeds their agent query cap and has no BYOK key:

The chat route returns a 402 response. The frontend renders a styled in-chat message (not a system modal):

```
"You've used all 10 research queries this month.

Upgrade to Pro for 50 queries/month — $15/mo
Or add your own API key for unlimited queries."

[Upgrade to Pro]  [Add API Key]
```

- "Upgrade to Pro" button → calls `/api/stripe/checkout` → redirects to Stripe
- "Add API Key" button → opens Settings panel

### Conversion Trigger 2: Pro Feature on Free Tier

When a free user types `/publish`, `/published`, or triggers a pro-only feature:

Agent responds inline:
```
"Publishing is available on Pro ($15/mo). Pro also includes
cross-session memory, influence graph caching, and 50 research
queries/month on us.

[Upgrade to Pro]"
```

### Conversion Trigger 3: Settings Page

New "Your Plan" section in Settings:

```
YOUR PLAN: Free

Usage this period:
  Agent queries: 7 of 10 used
  Chat queries: Unlimited
  Period resets: April 15, 2026

[Upgrade to Pro — $15/mo]  [Add API Key]
```

For Pro/Team users:
```
YOUR PLAN: Pro ($15/mo)

Usage this period:
  Agent queries: 23 of 50 used (or unlimited with BYOK)
  Chat queries: Unlimited
  Period resets: April 15, 2026

[Manage Subscription]  ← opens Stripe Portal
```

---

## 6. Pre-Launch Dependencies

- [ ] **Move Clerk to production instance** — dev mode has rate limits and branded UI
- [ ] **Create Stripe account** (if not exists) and set up products/prices
- [ ] **Add Stripe env vars** to Vercel (secret key, publishable key, webhook secret, price IDs)
- [ ] **Configure Stripe webhook** endpoint in Stripe Dashboard → `https://crate.fm/api/webhooks/stripe` (or whatever the production domain is)

---

## 7. What's NOT in v1

- Per-seat team pricing (flat domain rate for now)
- Usage-based overage charges (hard cap → BYOK, no overage billing)
- Annual team billing (monthly only)
- Invoice-based enterprise billing (custom deals, not self-serve)
- Billing history UI (Stripe Portal handles this)
- Promo codes / free trials (add later via Stripe Coupons)
- Plan downgrades mid-cycle (Stripe handles proration automatically)

---

## 8. Files to Create or Modify

### New Files
| File | Purpose |
|---|---|
| `convex/subscriptions.ts` | Convex queries and mutations for subscription state |
| `convex/usage.ts` | Convex queries and mutations for usage tracking |
| `src/app/api/stripe/checkout/route.ts` | Create Stripe Checkout session |
| `src/app/api/stripe/portal/route.ts` | Create Stripe Billing Portal session |
| `src/app/api/webhooks/stripe/route.ts` | Stripe webhook handler |
| `src/lib/plans.ts` | Plan definitions, limits, feature flags (single source of truth) |

### Modified Files
| File | Change |
|---|---|
| `convex/schema.ts` | Add `subscriptions` and `usageEvents` tables |
| `src/app/api/chat/route.ts` | Add quota check before processing, write usage events |
| `src/components/workspace/chat-panel.tsx` | Render upgrade prompts on 402 responses |
| `src/components/settings/` | Add "Your Plan" section with usage stats and upgrade/manage buttons |
| `.env.local.example` | Add Stripe env vars |
