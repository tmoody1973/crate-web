# PostHog Analytics Guide for Crate

How to understand what your users do, what they ignore, and what to build next.

---

## Quick Start

1. Go to **https://us.posthog.com** and sign in
2. You're in project **352161** (Crate)
3. Your pinned dashboard is **Daily Pulse** — check it every morning

---

## Your Dashboards

You have 5 dashboards. Each one answers a different question about Crate.

### 1. Daily Pulse (check every morning)
**Link:** https://us.posthog.com/project/352161/dashboard/1441667

**What it tells you:** Is anyone using Crate today?

| Insight | What to look for |
|---------|-----------------|
| Messages sent (7d) | Trend line going up = growing. Flat = stalled. Dips on weekends are normal. |
| Active users (7d) | Unique people. More important than total messages. 1 person sending 50 messages isn't growth. |
| Research query duration | If avg goes above 30 seconds, something is slow. Under 10 seconds is great. |
| Research queries by model | Shows Sonnet vs Haiku split. If most queries hit Sonnet, your slash commands are working. |

**When to worry:** Active users drops to zero for 2+ days. Query duration spikes above 60 seconds.

---

### 2. Agent Connect
**Link:** https://us.posthog.com/project/352161/dashboard/1441668

**What it tells you:** Is the connected services feature (Spotify, Tumblr, Slack, Google Docs) being used?

| Insight | What to look for |
|---------|-----------------|
| Services connected (by service) | Which services people connect most. Spotify first? Or do they skip straight to Tumblr? |
| Action buttons clicked (by type) | Copy vs Slack vs Docs vs Tumblr. If "Copy" dominates and Slack/Docs are zero, people aren't using Agent Connect. |
| Service connect to action funnel | Of people who connect a service, how many actually use the action buttons? Low conversion = the feature is confusing or not useful. |

**The key metric:** % of users who connect at least one service AND use an action button. That's the Agent Connect adoption rate.

**When to worry:** Everyone connects Spotify but nobody clicks the Tumblr/Slack/Docs buttons. That means the connected services work for reading (library) but not for writing (publishing/sending).

---

### 3. Retention
**Link:** https://us.posthog.com/project/352161/dashboard/1441669

**What it tells you:** Do people come back?

| Insight | What to look for |
|---------|-----------------|
| Weekly active users (12 weeks) | The most important chart. Is the line going up, flat, or down? |

**How to read retention:**
- **D1 retention** (come back next day): 30%+ is good for a tool. 50%+ is exceptional.
- **D7 retention** (come back within a week): 20%+ means you have a habit.
- **D30 retention** (come back within a month): 10%+ means you have a product.

**When to worry:** WAU is flat or declining. That means you're acquiring users but losing them. Fix retention before spending time on acquisition.

---

### 4. Conversion Funnel
**Link:** https://us.posthog.com/project/352161/dashboard/1441670

**What it tells you:** Are free users becoming paying users?

| Insight | What to look for |
|---------|-----------------|
| Signup to first query funnel | How many signups actually send a message? If 50% sign up but never ask a question, the onboarding is broken. |
| Research queries by tier | Free vs Pro usage. If free users query heavily, they're getting value. That's your upgrade audience. |
| Quota exceeded events | Free users hitting the 10-query limit. Every one of these is a potential upgrade. If this number is zero, free users aren't engaged enough. |
| BYOK vs platform key | How many bring their own API key vs use yours. BYOK users are power users who bypass the quota entirely. |
| Subscriptions activated / canceled | Revenue pulse. Are more people subscribing than canceling? |

**The key metric:** Quota exceeded count. This directly measures upgrade pressure. Zero = no one cares enough to hit the limit. 10+ per week = time to optimize the upgrade prompt.

**When to worry:** Lots of signups but the funnel drops to near-zero at "first query." That means the onboarding or empty state isn't compelling enough.

---

### 5. Feature Usage
**Link:** https://us.posthog.com/project/352161/dashboard/1441671

**What it tells you:** Which features should you invest in?

| Insight | What to look for |
|---------|-----------------|
| Top slash commands | Which commands people actually use. If `/influence` is 60% of all commands, that's your core feature. If `/tumblr` is 0%, nobody knows about it. |
| Artifact types opened | Which OpenUI components get viewed. InfluenceChain, ArtistProfile, ShowPrepPackage, TumblrFeed, etc. This tells you what research output people find valuable. |
| Onboarding completion funnel | Where new users drop off. Started → Step 1 → Step 2 → Completed. Big drop at step 2? That step is confusing. |

**The key metric:** Top 3 slash commands. These are your product. Everything else is a feature.

**When to worry:** One command dominates (e.g., 90% is `/influence`) and everything else is unused. Either double down on that one thing, or figure out why people don't discover the rest.

---

## How to Read PostHog (for Non-Technical People)

### Events Tab
Go to **Events** in the left sidebar. This shows a live stream of every event happening on Crate. You can filter by event name (e.g., `message_sent`) or by person (search by email).

This is useful for debugging: "Did that user's event fire?"

### Persons Tab
Go to **Persons** in the left sidebar. Search by email to see a specific user's entire history: every page they visited, every event they triggered, in chronological order.

This is useful for understanding: "What did this user actually do?"

### Insights Tab
Go to **Insights** in the left sidebar. This shows all saved insights. Filter by tag (`crate`) to see only yours.

Each insight can be edited. Click into it, change the date range, add filters, and save.

### Session Recordings (optional)
If you enable session recordings in PostHog settings, you can watch actual users navigate the app. This is the most powerful feature for understanding "where do people get confused."

To enable: Settings → Session Recording → Turn on. Note: this increases PostHog usage and costs.

---

## Events Reference

Every event Crate sends to PostHog, what triggers it, and what properties it includes.

### Server-side events (API routes)

| Event | Trigger | Properties |
|-------|---------|------------|
| `message_sent` | Every chat message | `is_slash_command`, `slash_command`, `is_chat_tier`, `tier` |
| `research_query_completed` | After agent finishes | `model`, `is_research`, `slash_command`, `tier`, `has_byok`, `duration_ms` |
| `quota_exceeded` | Free user hits limit | `tier`, `used`, `limit` |
| `service_connected` | OAuth callback success | `service` (spotify/tumblr/slack/google) |
| `checkout_started` | User clicks upgrade | `plan`, `current_tier` |
| `subscription_activated` | Stripe confirms payment | `plan`, `interval` |
| `subscription_canceled` | User cancels in portal | `plan` |
| `user_signed_up` | Clerk webhook | `email`, `name` |

### Client-side events (React components)

| Event | Trigger | Properties |
|-------|---------|------------|
| `action_button_clicked` | Copy/Slack/Docs/Tumblr/Email/Share button | `action` |
| `artifact_opened` | Research opens in panel | `type` (InfluenceChain, ArtistProfile, etc.) |
| `service_connect_clicked` | Click Connect in Settings | `service` |
| `service_disconnected` | Click Disconnect in Settings | `service` |
| `onboarding_started` | Wizard opens | — |
| `onboarding_step_completed` | Next step in wizard | `step` |
| `onboarding_completed` | Wizard finished | `has_api_key`, `step_count` |
| `cta_clicked` | Landing page buttons | `location`, `label` |
| `track_played` | Play button in player | `title`, `artist`, `source` |
| `api_key_saved` | Save API key in Settings | `service` |

### Auto-captured by PostHog

| Event | What it tracks |
|-------|---------------|
| `$pageview` | Every page navigation (automatic) |
| `$pageleave` | When user leaves a page |
| `$ai_generation` | Every LLM API call (tokens, model, latency) via @posthog/ai |

---

## Weekly Routine

**Every Monday morning (5 minutes):**

1. Open **Daily Pulse** dashboard
2. Check: Did active users go up or down this week?
3. Check: Any slash commands getting more popular?
4. Open **Conversion Funnel**
5. Check: How many quota_exceeded events? (upgrade pressure)
6. Check: Any new subscriptions?

**Every month (15 minutes):**

1. Open **Retention** dashboard
2. Check: Is D7 retention improving?
3. Open **Feature Usage**
4. Check: Top 3 commands. Are they the same as last month?
5. Check: Onboarding funnel. Where do people drop off?
6. Open **Agent Connect**
7. Check: Are more people connecting services? Which ones?

---

## What to Do With the Data

### "Nobody uses /tumblr"
- Is it in the command menu? (Check chat-panel.tsx SLASH_COMMANDS array)
- Do people know about it? (Add a tooltip or onboarding step)
- Is the output good? (Try it yourself, compare to /influence)

### "Everyone uses Copy, nobody uses Slack/Docs"
- Copy is frictionless (no auth needed). Slack/Docs require connecting a service.
- Add a nudge: "Want to send this to Slack? Connect in Settings."
- Or: make the first action button always Copy, and show Slack/Docs only after connection.

### "Lots of signups, few first queries"
- The empty state is the problem. What does a new user see?
- Add a pre-filled example: "Try this: /influence Flying Lotus"
- Or: auto-run a demo query on first visit.

### "Free users keep hitting quota"
- This is good. It means they want more.
- Optimize the upgrade prompt: show it inline when quota is reached, not as a modal.
- Consider raising the free limit slightly (10 → 15) to reduce friction while keeping upgrade pressure.

### "Query duration is increasing"
- Check which model is getting slower (model breakdown).
- Check if tool call count is increasing (agents doing more work per query).
- Consider caching common queries or influence chains.

---

## Adding the Insights to Dashboards

The insights are created but need to be added to their dashboards. For each insight:

1. Go to **Insights** in the left sidebar
2. Filter by tag (e.g., `daily`, `agent-connect`, `conversion`, `features`, `retention`)
3. Click into each insight
4. Click the **three dots menu** (top right)
5. Select **Add to dashboard**
6. Pick the matching dashboard
7. Save

Once added, the dashboard shows all its insights together on one page.

---

## Useful PostHog Links

| Page | URL |
|------|-----|
| All dashboards | https://us.posthog.com/project/352161/dashboards |
| All insights | https://us.posthog.com/project/352161/insights |
| Live events | https://us.posthog.com/project/352161/events |
| Persons | https://us.posthog.com/project/352161/persons |
| Settings | https://us.posthog.com/project/352161/settings |
