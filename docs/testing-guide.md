# Crate Web — Feature Testing Guide

> **PR #10:** `feat/subscription-pricing` → `main`
> **Date:** March 22, 2026
> **Scope:** 57 commits, 49 files changed, ~5,600 lines added

This guide covers every new feature in the PR. Test in order — later sections depend on earlier ones passing.

---

## Prerequisites

### Environment Variables

Ensure these are set in `.env.local` (local) and/or Vercel (production):

| Variable | Where to get it | Required for |
|----------|----------------|--------------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → API keys (use `sk_test_...`) | Billing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API keys (use `pk_test_...`) | Billing |
| `STRIPE_WEBHOOK_SECRET` | Stripe CLI or Dashboard → Webhooks | Billing |
| `STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe Dashboard → Products → Price ID | Billing |
| `STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe Dashboard → Products → Price ID | Billing |
| `STRIPE_TEAM_MONTHLY_PRICE_ID` | Stripe Dashboard → Products → Price ID | Billing |
| `NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID` | Same as `STRIPE_PRO_MONTHLY_PRICE_ID` | Client-side upgrade button |
| `PLATFORM_ANTHROPIC_KEY` | Anthropic Dashboard | Free/Pro users without BYOK |
| `ADMIN_EMAILS` | Your email, comma-separated | Admin bypass |
| `BETA_DOMAINS` | e.g. `radiomilwaukee.org` | Beta access |
| `AUTH0_DOMAIN` | Auth0 Dashboard → Applications → Settings | Token Vault |
| `AUTH0_CLIENT_ID` | Auth0 Dashboard → Applications → Settings | Token Vault |
| `AUTH0_CLIENT_SECRET` | Auth0 Dashboard → Applications → Settings | Token Vault |
| `AUTH0_TOKEN_VAULT_AUDIENCE` | Auth0 Dashboard → APIs | Token Vault |
| `AUTH0_CALLBACK_URL` | `https://crate.fm/api/auth0/callback` (or localhost) | Token Vault |
| `NEXT_PUBLIC_CANNY_APP_ID` | Canny Dashboard → Settings | Feedback widget |
| `NEXT_PUBLIC_CANNY_URL` | Your Canny URL | Feedback widget |

### Stripe Test Mode Setup

1. Create a Stripe account (or use existing)
2. Stay in **Test Mode** (toggle in top-right of Dashboard)
3. Create a Product called "Crate Pro" with two Prices:
   - Monthly: $15/month → copy Price ID to `STRIPE_PRO_MONTHLY_PRICE_ID`
   - Annual: $150/year → copy Price ID to `STRIPE_PRO_ANNUAL_PRICE_ID`
4. Create a Product called "Crate Team" with one Price:
   - Monthly: $25/month → copy Price ID to `STRIPE_TEAM_MONTHLY_PRICE_ID`
5. For local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
6. Copy the webhook signing secret to `STRIPE_WEBHOOK_SECRET`

### Auth0 Setup (for Token Vault testing)

1. Create Auth0 tenant with Token Vault enabled
2. Configure connections for Spotify, Slack, Google in Auth0 Dashboard
3. Set callback URL to `https://crate.fm/api/auth0/callback` (or localhost equivalent)
4. Note: Auth0 Token Vault testing requires the Auth0 hackathon features — if not configured, the Connected Services section simply won't appear (this is expected)

### Test Cards (Stripe)

| Card Number | Result |
|-------------|--------|
| `4242 4242 4242 4242` | Success |
| `4000 0000 0000 0002` | Decline |
| `4000 0000 0000 3220` | 3D Secure required |

Use any future expiry date and any 3-digit CVC.

---

## Section 1: Core App (Regression Check)

These features existed before the PR. Verify no regressions.

### 1.1 Authentication
- [ ] Sign in with Clerk works
- [ ] Sign up creates new user
- [ ] Sign out clears session

### 1.2 Chat (Basic)
- [ ] Send a simple chat message → get response
- [ ] Response streams in real-time (not all-at-once)
- [ ] Sidebar shows session history
- [ ] Can create new chat session
- [ ] Can switch between sessions

### 1.3 Agent Commands (Existing)
- [ ] Type `/influence Stevie Wonder` → influence chain renders with connections
- [ ] Type `/prep [artist] [venue] [date]` → show prep research runs
- [ ] Type `/news` → music news aggregation works
- [ ] Agent uses tools (check tool calls appear in UI)

### 1.4 Settings Drawer
- [ ] Click gear icon → settings drawer opens
- [ ] API key entry fields render
- [ ] Can save/remove API keys
- [ ] Drawer closes properly

---

## Section 2: Subscription Billing (Stripe)

### 2.1 Free Tier Limits
- [ ] New user starts on **Free** plan
- [ ] Settings → "Your Plan" section shows "Free" badge
- [ ] Agent queries counter shows "X of 10 used"
- [ ] Chat queries show "Unlimited"
- [ ] After 10 agent queries → user sees upgrade prompt in chat
- [ ] Free user can still use basic chat (non-agent) after hitting limit
- [ ] Free user has max 5 saved sessions

### 2.2 Feature Gates (Free Tier)
- [ ] Type `/publish` → should see Pro-only gate message
- [ ] Type `/published` → should see Pro-only gate message
- [ ] Influence cache: free users can READ cached data but NOT write
- [ ] Mem0 memory tools: should NOT be available for free users

### 2.3 Upgrade Flow
- [ ] Click "Upgrade to Pro — $15/mo" in Your Plan section
- [ ] Redirects to Stripe Checkout with correct price
- [ ] Use test card `4242 4242 4242 4242` → payment succeeds
- [ ] Redirected back to `/settings?upgraded=true`
- [ ] Plan badge updates to "Pro ($15/mo)"
- [ ] Agent queries limit increases to 50
- [ ] Previously gated features now work (`/publish`, mem0, influence cache writes)

### 2.4 Billing Portal
- [ ] Pro/Team user → "Manage Subscription" button appears
- [ ] Click → opens Stripe Billing Portal
- [ ] Can see subscription details
- [ ] Can cancel subscription (sets `cancelAtPeriodEnd`)
- [ ] Return to settings → plan still shows as active until period ends

### 2.5 Webhook Processing
- [ ] After checkout → Stripe sends `checkout.session.completed`
- [ ] Verify Convex subscription record created (check Convex dashboard)
- [ ] Subscription has correct plan, period start/end
- [ ] Duplicate webhook doesn't create duplicate subscription

### 2.6 Admin Bypass
- [ ] Set your email in `ADMIN_EMAILS` env var
- [ ] Sign in with that email → plan shows "Admin"
- [ ] No query limits enforced
- [ ] All features unlocked (publishing, memory, influence cache)
- [ ] No "Upgrade" button shown

### 2.7 Beta Domain Access
- [ ] Set a domain in `BETA_DOMAINS` (e.g. `radiomilwaukee.org`)
- [ ] Sign in with an email from that domain
- [ ] Plan shows "Beta Access"
- [ ] Has Pro-level features without billing

### 2.8 Rate Limiting
- [ ] Send 6+ agent queries within 1 minute → should get "Too many requests" (429)
- [ ] Send 31+ chat messages within 1 minute → should get rate limited
- [ ] Rate limit resets after 1 minute window

### 2.9 Platform Key Fallback
- [ ] Free user without BYOK API key → agent still works using `PLATFORM_ANTHROPIC_KEY`
- [ ] Pro user with their own key → uses their key (not platform key)
- [ ] If `PLATFORM_ANTHROPIC_KEY` is missing → free users get clear error message

### 2.10 Error Handling
- [ ] Invalid JSON to `/api/stripe/checkout` → returns 400 "Invalid request body"
- [ ] Stripe API failure → returns 500 with error message (not a crash)
- [ ] Portal session failure → returns 500 with error message
- [ ] Plan section shows red error text when API calls fail (disconnect network and reload)

---

## Section 3: Custom Skills

### 3.1 Create Skill
- [ ] Type `/create-skill` in chat
- [ ] Agent asks what kind of research/workflow to create
- [ ] Describe a workflow (e.g. "find rave events in Milwaukee this weekend")
- [ ] Agent does a dry run using real tools
- [ ] Agent asks to confirm saving the skill
- [ ] Skill is saved with command name, description, prompt template, tool hints

### 3.2 List Skills
- [ ] Type `/skills` in chat → agent lists your skills
- [ ] Each skill shows command name, description, enabled/disabled status
- [ ] If no skills exist → agent suggests using `/create-skill`

### 3.3 Use Custom Skill
- [ ] Type `/<your-skill-command>` → agent runs the saved prompt template
- [ ] Agent uses the tool hints from the skill
- [ ] Run count increments (visible in settings)

### 3.4 Skills in Settings
- [ ] Open Settings drawer → "Custom Skills" section appears
- [ ] Each skill shows name, command, description, run count
- [ ] Toggle switch enables/disables a skill
- [ ] Disabled skill: typing its command should NOT trigger it
- [ ] Edit button → can modify prompt template
- [ ] Delete button → removes the skill (with confirmation)

### 3.5 Skill Limits by Plan
- [ ] Free user: max 3 custom skills
- [ ] Try creating a 4th → should get "Skill limit reached" error
- [ ] Pro user: max 20 skills
- [ ] Team user: max 50 skills

### 3.6 Slash Command Autocomplete
- [ ] Type `/` in chat input → autocomplete menu appears
- [ ] Custom skills appear in the autocomplete list alongside built-in commands
- [ ] Selecting a custom skill from autocomplete inserts the command

---

## Section 4: Auth0 Token Vault (Connected Services)

> **Note:** These tests require Auth0 Token Vault to be configured. If Auth0 env vars are not set, the Connected Services section should NOT appear — that's the expected behavior.

### 4.1 UI Visibility
- [ ] **Without** Auth0 env vars → Connected Services section is hidden (no errors)
- [ ] **With** Auth0 env vars → Connected Services section appears in Settings
- [ ] Shows Spotify, Slack, Google with Connect buttons

### 4.2 Spotify Connect Flow
- [ ] Click "Connect" next to Spotify
- [ ] Redirects to Auth0 → Spotify OAuth consent screen
- [ ] Authorize → redirected back to `/settings?auth0_connected=spotify`
- [ ] URL is cleaned (query params removed)
- [ ] Spotify shows "Connected" badge (green)

### 4.3 Read Spotify Library
- [ ] After connecting Spotify, ask: "What's in my Spotify library?"
- [ ] Agent calls `read_spotify_library` tool
- [ ] Returns your saved tracks with artist, album, year
- [ ] Ask "Show my top artists" → returns top artists with genres
- [ ] Ask "Show my playlists" → returns playlist names and track counts

### 4.4 Export to Spotify
- [ ] Run `/influence [artist]` to generate an influence chain
- [ ] Say "Save this as a Spotify playlist"
- [ ] Agent calls `export_to_spotify` with track queries
- [ ] Playlist is created in your Spotify account
- [ ] Returns playlist URL that opens in Spotify
- [ ] Verify tracks were actually added

### 4.5 Slack Connect + Send
- [ ] Click "Connect" next to Slack → OAuth flow
- [ ] After connecting, run `/prep [artist] [venue] [date]`
- [ ] Say "Send this to #general on Slack"
- [ ] Agent calls `send_to_slack`
- [ ] Message appears in your Slack channel
- [ ] Verify Block Kit formatting (header + sections)

### 4.6 Google Docs Connect + Save
- [ ] Click "Connect" next to Google → OAuth flow
- [ ] After researching, say "Save this to Google Docs"
- [ ] Agent calls `save_to_google_doc`
- [ ] Returns a Google Docs URL
- [ ] Open the URL → document contains the research content

### 4.7 Graceful Fallback (Not Connected)
- [ ] Without connecting Spotify, ask "What's in my Spotify library?"
- [ ] Agent responds: "Connect Spotify in Settings" (not a crash)
- [ ] Without connecting Slack, say "Send to Slack"
- [ ] Agent responds: "Connect Slack in Settings"
- [ ] Same for Google Docs

### 4.8 OAuth Security
- [ ] Inspect the redirect URL → `state` param is a nonce (not user data)
- [ ] Check cookies → `auth0_state` cookie is HttpOnly, Secure, SameSite=Lax
- [ ] Try replaying a callback URL → should fail (nonce mismatch or expired cookie)

---

## Section 5: Influence Chain v2

### 5.1 Perplexity Enrichment
- [ ] Type `/influence Flying Lotus`
- [ ] Agent runs Phase 1 (initial influence map)
- [ ] Agent runs Phase 2 (Perplexity enrichment via `research_influence`)
- [ ] Each connection gets enriched context (longer than the initial thin description)
- [ ] Sources have verified URLs (not hallucinated)

### 5.2 Enhanced UI Components
- [ ] InfluenceChain component renders
- [ ] Pull quotes appear (if the research found direct quotes)
- [ ] Sonic element chips render (e.g. "synthesizer textures", "cosmic imagery")
- [ ] Source cards show with clickable links
- [ ] Top 3 connections auto-expand

### 5.3 Influence Cache
- [ ] Run `/influence [artist]` → results are cached
- [ ] Run same artist again → cached results load faster (check for "cached" indicator)
- [ ] Pro user: cache writes work
- [ ] Free user: cache reads work, but writes should be skipped

---

## Section 6: Show Prep Research

### 6.1 Research Track Tool
- [ ] Type `/prep [artist] [venue] [date]`
- [ ] Agent calls `research_track` for relevant tracks
- [ ] Results include artist context, track background
- [ ] Sources have verified Perplexity citations
- [ ] Research respects 30-second timeout (no hanging requests)

---

## Section 7: Landing Page

### 7.1 Pricing Section
- [ ] Visit homepage → scroll to pricing section
- [ ] Three tiers displayed: Free, Pro ($15/mo), Team ($25/mo)
- [ ] Feature lists are accurate per plan
- [ ] "Get Started" / "Upgrade" CTAs work
- [ ] Visit `/pricing` → standalone pricing page renders

### 7.2 Canny Feedback Widget
- [ ] Sidebar footer shows feedback button/link
- [ ] Click → opens Canny feedback widget
- [ ] Clerk SSO passes user identity to Canny
- [ ] Can submit feedback

---

## Section 8: Guardrails

### 8.1 Music Scope Guardrail
- [ ] Ask a non-music question (e.g. "Write me Python code")
- [ ] Agent should redirect to music-related topics
- [ ] Music-adjacent questions still work (e.g. "What venues are in Chicago?")

### 8.2 Tool Call Cap
- [ ] Complex query that triggers many tool calls
- [ ] After 25 tool calls, agent should stop and summarize
- [ ] Response indicates it hit the cap (not a silent cutoff)

### 8.3 Session Limits (Free Tier)
- [ ] Free user creates 5 sessions
- [ ] Try creating a 6th → should enforce limit
- [ ] Pro user → unlimited sessions

---

## Section 9: Edge Cases & Error States

### 9.1 Network Failures
- [ ] Disconnect internet mid-agent-query → error shown to user (not blank screen)
- [ ] Stripe checkout with network failure → error message in plan section
- [ ] Auth0 connect with network failure → redirects to settings with error param

### 9.2 Missing Environment Variables
- [ ] Remove `PLATFORM_ANTHROPIC_KEY` → free users get clear error, not crash
- [ ] Remove Auth0 vars → Connected Services hides (no console errors)
- [ ] Remove Stripe vars → billing features degrade gracefully

### 9.3 Concurrent Requests
- [ ] Two tabs sending agent queries simultaneously → both get responses
- [ ] Rapid-fire "Upgrade" button clicks → rate limiter kicks in (429)

### 9.4 Invalid Inputs
- [ ] `/create-skill` with empty name → validation error
- [ ] Stripe checkout with invalid `priceId` → 400 error
- [ ] Auth0 connect with invalid `service` param → 400 "Invalid service"

---

## Test Results Summary

| Section | Tests | Passed | Failed | Blocked |
|---------|-------|--------|--------|---------|
| 1. Core App (Regression) | 13 | | | |
| 2. Subscription Billing | 28 | | | |
| 3. Custom Skills | 16 | | | |
| 4. Auth0 Token Vault | 20 | | | |
| 5. Influence Chain v2 | 8 | | | |
| 6. Show Prep Research | 5 | | | |
| 7. Landing Page | 6 | | | |
| 8. Guardrails | 6 | | | |
| 9. Edge Cases | 10 | | | |
| **Total** | **112** | | | |

### Notes
- Record any bugs found with: **[SECTION.TEST] Description of issue**
- For Auth0 tests: mark as "Blocked" if Token Vault is not yet configured
- For Stripe tests: use Test Mode only — never test with live keys
- Screenshot any UI issues for reference

### Priority Order
If time is limited, test in this order:
1. Section 1 (regressions — most critical)
2. Section 2.1-2.3 (billing core flow)
3. Section 3.1-3.3 (skills core flow)
4. Section 5 (influence chain — key feature)
5. Section 4 (Auth0 — hackathon deliverable)
6. Everything else
