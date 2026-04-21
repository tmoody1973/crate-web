# /recommend v1 — Manual E2E Checklist

Run through these scenarios before merging PR #12 to main. Automated coverage
is intentionally narrow (route-handler + mutation unit tests + eval skeleton).
The rest is a human-verified flight check. Check the box when you complete
each step.

## Setup

- [ ] `bun run dev` is running
- [ ] Convex dev deployment is connected (`bunx convex dev` running)
- [ ] You're signed into both Clerk admin accounts:
  - `tarik@radiomilwaukee.org`
  - `tarikjmoody@gmail.com`
- [ ] Convex env has `ADMIN_EMAILS` set for both (verify `bunx convex env list`)
- [ ] `PERPLEXITY_API_KEY`, `VOYAGE_API_KEY`, and `ANTHROPIC_API_KEY` are set
  in the Convex dev deployment

## 1. Happy path: generate + view + signal

- [ ] Open `/recommend` signed in
- [ ] Prompt: "sad about the climate but I still want to dance"
- [ ] Tap **GENERATE TOUR**
- [ ] Loading panel animates through phases (classifying → embedding →
  reading reviews → verifying → sequencing → moderating)
- [ ] Redirects to `/r/[slug]` on completion
- [ ] 8–12 artists rendered in arc order with position badges
- [ ] At least 3 cited quotes with **VERIFIED** badges
- [ ] Redacted title displayed at top
- [ ] Tap **KEEP** on an artist → button fills amber
- [ ] Tap **KEEP** again → clears back to neutral
- [ ] Tap **PASS** on a different artist → button shows red tone
- [ ] Reload page → signals persist for your account

## 2. YouTube inline play

- [ ] Tap **▶ PLAY** on artist 1 → iframe expands, auto-plays
- [ ] Tap **▶ PLAY** on artist 3 → artist 1's iframe unmounts, artist 3's loads
- [ ] Tap **CLOSE** → iframe unmounts, button returns to PLAY

## 3. Share

- [ ] Desktop: tap **SHARE** → "LINK COPIED" badge flashes for 1.8s, URL in clipboard
- [ ] Mobile (real device): tap SHARE → native share sheet appears
- [ ] `shareCount` on the tour row in Convex table browser incremented

## 4. Report

- [ ] Tap **REPORT** → modal opens
- [ ] Click CANCEL → modal closes, no row written
- [ ] Tap REPORT again, type a 1-char reason → SUBMIT disabled / error
- [ ] Type "the pitchfork quote looks made up" → SUBMIT
- [ ] "Thanks — a human will review this soon." state visible
- [ ] DONE closes modal
- [ ] Try to report 6 times in one session → 6th throws "Daily report limit reached"

## 5. Admin moderation

- [ ] Visit `/admin/recommend`
- [ ] Pending reports section shows the report from step 4
- [ ] Tap **VIEW ↗** on the report → tour page opens in a new tab
- [ ] Tap **DISMISS** → report disappears from queue, status in Convex is
  `reviewed_approved`, tour still public
- [ ] File another report, then **UPHOLD** → tour is now `isPublic: false`,
  `moderationCategories` contains an `admin:block:…` entry, report status
  is `reviewed_blocked`
- [ ] Flagged tours section: if moderation naturally flags anything, it shows
  here. If you want to force one, manually set `moderationStatus = "flagged"`
  on a row via the Convex dashboard and reload.

## 6. Library (/r)

- [ ] Visit `/r` signed out
- [ ] Recent public tours render in a grid
- [ ] Click a card → lands on `/r/[slug]`
- [ ] **REPORT** button in action bar prompts sign-in when tapped
- [ ] Signal buttons say "SIGN IN TO KEEP / PASS"

## 7. OG image

- [ ] Visit `/r/[slug]/opengraph-image` directly in a browser → 1200×630 PNG
  renders with title + top 4 artist names
- [ ] Paste a tour URL into Slack/iMessage/Twitter → preview card shows the
  generated image

## 8. Spotify seeds (optional — requires connected Spotify)

- [ ] Connect Spotify via `/settings` if not already
- [ ] Generate a tour; check the Convex `tourEvents` row for the generation
- [ ] Check PostHog for a `recommend_tour_started` event with
  `hasSpotifySeeds: true` and `spotifySeedCount > 0`
- [ ] The tour artists should skew slightly toward your Spotify taste but
  NOT just mirror it. (Qualitative check.)

## 9. Observability

- [ ] PostHog project has events in the last 24h:
  - `recommend_tour_started_attempt` (client)
  - `recommend_tour_started` (server)
  - `recommend_tour_completed` (Convex → PostHog HTTP)
  - `recommend_tour_viewed` (client)
  - `recommend_signal_recorded` (client)
  - `recommend_tour_shared` (client)
  - `recommend_tour_reported` (client)
- [ ] Convex `tourEvents` table has one row per generation with phase
  durations, cost, and error list
- [ ] TTL crons visible in Convex dashboard → Cron Jobs section:
  - `prune tour status rows` (every 15 min)
  - `prune tour events rows` (every 6 h)
  - `prune citation cache rows` (every 1 h)

## 10. Error handling

- [ ] Generate with empty prompt → `Prompt is required` error in panel
- [ ] Generate 21 times in 24h (same account) → 21st returns
  `Daily tour limit reached` with minutes-until-reset
- [ ] Kill Perplexity by temporarily invalidating the API key in Convex env
  → generation fails gracefully, tour marked `failed`, client shows "Stopped"

## After all checks pass

- [ ] Unmark PR #12 as draft: `gh pr ready 12`
- [ ] CodeRabbit will auto-review on un-draft
- [ ] Squash-merge when green: `gh pr merge 12 --squash`
