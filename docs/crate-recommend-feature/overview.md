# `/recommend` — folder overview

Reading order for anyone new to this feature (including future-you after 3 months away).

## Start here

1. **[`v1-scope.md`](v1-scope.md)** — the thing we're actually building. Locked scope, anti-criteria, decisions, success criteria. Last updated 2026-04-20 via `/plan-ceo-review`.

2. **[`how-it-works.md`](how-it-works.md)** — tech primer for a smart builder who doesn't live in ML papers. Six concepts (embeddings, retrieval, NER, graph, PPR, arc ordering) explained with radio analogies. Use this to explain the system on stage, to press, to partners.

3. **[`crate-recommend-design-doc.md`](crate-recommend-design-doc.md)** — the long-form technical design doc written before this review. Still current; `v1-scope.md` refines it. Uses bumwad-coding methodology (schematic design → construction documents).

## Supporting references (external to this folder)

- **The essay:** `~/Downloads/a-music-recommender-that-reads.md` — the philosophical framing. **NOT PUBLISHED YET.** Ships with Approach C, not before. See `v1-scope.md` anti-criteria for why.
- **Product analysis:** `../PRODUCT_ANALYSIS.md` — March 2026 YC Office Hours output. Validation gaps that the `/recommend` observation sprint is designed to fill.
- **Influence Receipt design:** `~/.gstack/projects/tmoody1973-crate-web/tarikmoody-main-design-20260415-152735.md` — the shipped `/i/[slug]` wedge that `/recommend` builds on top of.

## Prototype stubs (reference only — not yet wired)

The five stub files in this folder (`pipeline.ts`, `pitchfork.ts`, `prompts.ts`, `registry.ts`, `types.ts`) are Approach C scaffolding from the original design doc. **They are NOT part of v1.** v1 uses Perplexity Sonar; these stubs belong to the Phase C corpus ingestion pipeline decided at week 6.

## Build sequence for v1

Per `v1-scope.md`:

1. **Infrastructure** (days 1–3): Schema delta, `artifactsRecommend` table, Convex mutations, rate-limiting table, paywall domains table.
2. **Core flow** (days 4–9): Intent classifier, prompt redaction, citation verification, Perplexity refactor (atomic), arc ordering, moderation classifier, `/api/recommend/generate` route.
3. **Artifact UI** (days 10–13): Tour artifact component, keep/pass/save UI, steering chips, loading states. Run `/plan-design-review` before this phase begins.
4. **Library surfaces** (days 14–17): `/r/[slug]` public page, OG image, `/r` browse, search, filters, 15 curator seed tours.
5. **Auth0 + Spotify** (days 18–22): Seed-reading toggle, playlist export button, re-consent modal, track resolution, error UX.
6. **Observability + launch** (days 23–27): PostHog dashboards, Slack alerts, admin moderation UI, smoke tests, silent launch + friends test.

## Observation sprint (weeks 2–6 overlapping with build)

Per `v1-scope.md` success criteria and week-6 decision plan. Kill-switch at week 3 if recruitment has failed or zero external shares exist. Week-4 pricing interview. Week-6 C-commit decision across 5 orthogonal criteria.

## How this feature relates to Crate's positioning

Crate is the **liner notes layer for the streaming era** (per user memory — locked positioning). `/recommend` is the command that delivers that value as a shareable, compounding artifact. Every tour is a small editorial act; every shared `/r/[slug]` is free distribution; every generated tour compounds the influence graph the essay (eventually) claims.

Do not describe `/recommend` as "AI-powered music recommendation." Describe it as "a music tour with sources." The critics are the expertise; Crate is the interface.
