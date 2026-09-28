# /recommend v1 — Locked Scope & Decisions

Summary of the /plan-ceo-review on 2026-04-20. Source of truth for what ships in v1.

**Mode:** SELECTIVE EXPANSION · **Approach:** A-then-C sequencing · **Budget:** ~18–25 realistic human-days / ~7–9 CC working days (10 cherry-picks + Cherry-pick #8a persistence; 6 deferred post-eng-review per Codex cross-model review).

## Revision history

- **v1 (2026-04-20, /plan-ceo-review):** 16 cherry-picks accepted, budget 23–31 days.
- **v2 (2026-04-20, /plan-eng-review + Codex outside voice):** Cherry-picks 11-16 deferred; Cherry-pick #8 split (persistence kept, cross-user cache-match UI deferred); /i/expand rate-limit migration moves to separate earlier PR. Budget revised to 18-25 days. Scope discipline: the week-6 validation experiment gets a clean signal on the core recommendation thesis, unpolluted by coalition-marketing features.
- **v3 (2026-04-20, /plan-design-review):** Cherry-pick #5 (Spotify playlist export) deferred to Phase 2. NEW Cherry-pick #5: YouTube inline play (per-artist + tour-level) using Crate's existing `playerQueue` + YouTube integration. Zero-login `/r/[slug]` viewers can now listen without auth — the listen-loop closes for everyone. 5 approved mockups locked (tour artifact, loading state, /r/[slug], /r library, vague-clarify). Design system formalized. Budget stays ~18-25 days (YouTube play ~1-1.5d build replaces Spotify export ~2d build — slight net reduction).

See also: `crate-recommend-design-doc.md` (long-form technical design, original), `how-it-works.md` (tech primer for non-ML readers), `../plans/2026-04-20-recommend-ceo-plan-archive.md` (full CEO plan with vision, rationale, and deferred items).

---

## Strategic posture

**Ship Approach A as a silent prototype.** No essay, no press, weeks 1–3. Observation sprint weeks 2–6 fills the validation gaps from `docs/PRODUCT_ANALYSIS.md`. Week 6 decision: if ≥3 of 5 orthogonal criteria fire, commit to Approach C (corpus + Voyage + NER + PPR). Publish `a-music-recommender-that-reads.md` alongside C, not before. The essay is a promise that ships with C.

---

## Accepted v1 scope

### Base: Approach A
- Perplexity Sonar returns 8–12 artists per query with citations
- Haiku orders the arc (entry → build → turn → reflective close)
- Artifact renders with OpenUI components (`ReviewSourceCard`, `ArtistProfileCard`, `TrackList`, `ShowPrepPackage` or new `TourArtifact`)
- Public share via `/r/[slug]` pattern
- Writes to Music Wiki for each featured artist

### Cherry-pick 1 — Graph write-back
Every `/recommend` writes Perplexity-returned edges to `influenceEdges` with `source="perplexity/recommend"`. Weight compounding capped at 10.0. Async fire-and-forget mutation; never blocks UX.

### Cherry-pick 2 — `/r/[slug]` zero-login public pages
Zero-login ISR-cached share pages with Satori text-only OG image. Slug scheme: `{first-seed-artist-slug}-{4-char-hash}`, lazy check+retry, 8-char fallback. Zero-login viewing; generation stays auth-gated. Cache key is slug-only; no cross-user cache poisoning.

### Cherry-pick 3 — Auth0 personalized seeds (opt-in)
Users with Spotify connected via Auth0 Token Vault see an opt-in toggle: "Seed from my last 30 days." Scope: `user-top-read` + `user-library-read`. Token refresh checked at seed-read time (<5min to expiry → force refresh). No silent use. Graceful fallback when vault/Spotify unavailable.

### Cherry-pick 4 — Steering chips
4–6 contextually generated chips per tour. Clicking re-runs with modifier prepended to original prompt + previous tour artist list. Previous tour dims to 60% opacity; cross-fade to new tour. Cap: 10 refinements per session.

### Cherry-pick 5 — YouTube inline play (REPLACES Spotify export in v1)
Every artist in the tour gets a prominent circular amber Play button (primary action per row). The tour hero has a "Play full tour" CTA that queues all 10 tracks into Crate's existing YouTube-backed player via the `playerQueue` table. **Zero-login `/r/[slug]` viewers can listen without auth** — the listen-loop closes for public viewers. Track resolution per artist via existing `/api/youtube/*` endpoints. Per-row states: idle → in-place spinner → "▶ Now playing" (with equalizer animation) / "Not on YouTube" (with small report link). "Play full tour" states: idle → "Queueing 10 tracks..." → success OR partial ("Couldn't find 3 — play the 7?" ack modal). Player bar is Crate's existing persistent bottom bar (64px on mobile, 72px on desktop, persists across all Crate surfaces once queued).

**Deferred to Phase 2:** "Save to Spotify playlist" via Auth0 Vault — moves to T25 in TODOS.md. Ships with coalition-essay launch if validation justifies. The Auth0 Token Vault infrastructure from the hackathon stays in place but the Spotify export button comes off the tour artifact UI entirely.

### Cherry-pick 6 — Claude intent classifier + intent-aware prompts
Haiku classifies user input into 8 types: `mood_theme`, `era_genre`, `artist_similar`, `activity`, `emotional`, `show_prep`, `single_artist`, `vague`. Each gets a dedicated Perplexity prompt template. Artifact shape is constant; copy/chips/"why this arc" header adapt. Vague queries trigger clarifying UI with 4 chips instead of generating a bad tour.

### Cherry-pick 7 — Legible Wiki-mediated self-improvement
Per-artist 🎯/👋/💾 (keep/pass/save) buttons in tour artifact. Signals write to user's Music Wiki `tourHistory` field (visible + editable). Next tour reads Wiki as Perplexity prompt context. "You kept this before" badge on influenced picks. 3-second undo toast. Hard anti-criterion: no implicit behavioral learning.

### Cherry-pick 8a — Tour persistence + embedding (keeps in v1)
New `artifactsRecommend` Convex table stores every generated tour permanently with Voyage-3 prompt embedding. Embedding enables future threshold tuning, `/r` library ranking, and eventual Phase-2 cross-user cache-match UI. Vector search used internally for logging near-misses (0.85–0.95 cosine window) for threshold tuning.

### Cherry-pick 8b — Cross-user cache-match UI — DEFERRED to Phase 2 per Codex cross-model review
Previously planned: "Someone asked something like this" UI surfacing another user's cached tour on semantic match. Deferred because it exposes sensitive prompts indirectly across users without a consent model. Phase 2 adds: opt-in consent checkbox on tour creation (default OFF), cache-match UI respects flag. Library discovery still works via `/r` browse in v1.

### Cherry-pick 9 — Browse + search library surface
`/r` homepage shows 15 most recent approved tours. Search box for semantic query. Filter chips: intent_type, primary artist, featured artists. Tag-based browse at `/r/tag/[slug]`. Default result page size = 15.

### Cherry-pick 10 — Moderation pipeline (mandatory, locked by auto-publish)
Pre-publish Haiku classifier on prompt + output: hate / harassment / self-harm / sexual / copyright / prompt-injection. Flagged tours stay private to creator with "Staying private" message. Fail-closed indefinitely when service down; cron retries every 10min. Pre-publish prompt redaction: raw prompt becomes generic 4–8 word summary for public display; creator can opt to show raw. Report button per tour → `tourReports` → admin review. Output classifier against artist blocklist. Prompt-injection detector. 24-hour cooling period before Google-indexable.

### Cherry-picks 11–16 — DEFERRED to Phase 2 per Codex cross-model review

These six cherry-picks were accepted during /plan-ceo-review SELECTIVE EXPANSION but deferred during /plan-eng-review on 2026-04-20 after the Codex outside voice flagged them as coalition-marketing features that invalidate the week-6 validation experiment. See `TODOS.md` items T14–T19 for full context. Summary:

- **~~Cherry-pick 11~~** — 15 curator seed tours (moved to T14)
- **~~Cherry-pick 12~~** — Implicit tag aggregates / StoryGraph-mode scaffolding (T15)
- **~~Cherry-pick 13~~** — "Read the full review" CTA parity (T16)
- **~~Cherry-pick 14~~** — UTM tracking on outbound citation clicks (T17)
- **~~Cherry-pick 15~~** — Publication attribution in OG cards (T18)
- **~~Cherry-pick 16~~** — `/r/pub/[slug]` publication landing pages (T19)

Rationale: week-6 criteria must attribute signal cleanly to the core recommendation thesis, not to coalition distribution features launching simultaneously. Coalition features ship as Phase 2 IF v1 validation justifies continued investment.

**Note on the coalition essay + critic outreach plan:** Still viable. The essay is about the thesis ("critical prose as substrate"), not about specific v1 features. Outreach to Gioia/Hogan/Doran/Martin/Orlov/Moore can proceed with the Phase-1 product; the pub-landing and UTM evidence lands with Phase 2.

---

## Anti-criteria (blocked from v1)

- ❌ **No collaborative filtering.** No "users who liked X also listened to Y."
- ❌ **No Spotify audio features** (deprecated Nov 2024; the essay treats this as a gift).
- ❌ **No publisher scraping in v1.** No Pitchfork, no Bandcamp Daily adapter. That's Approach C, week 6+.
- ❌ **No silent use of personal listening data.** Opt-in toggles only.
- ❌ **No forced Spotify export.** Users without Auth0 connection see a CTA, not a wall.
- ❌ **Essay ("A music recommender that reads") not published** until Approach C ships.
- ❌ **No essay-adjacent copy in v1 UI, OG cards, or marketing.** Forbidden: "reads the critics," "critical corpus," "we've read," "critic-mediated graph," "own the reader," "the substrate is the prose," "graph," "knowledge graph," "network of influence," "growing corpus." Allowed: "mood-based music tour," "artists with citations," "find artists by feel," "with sources."
- ❌ **No fabricated provenance quotes.** Two-step verification (URL HEAD + quote-on-page GET) before rendering any quote. Drop with "No verified source found for this one" if either check fails.
- ❌ **No Haiku NER on Perplexity prose for graph write-back.** Structured output only.
- ❌ **No implicit behavioral learning.** No click tracking feeds tours. No silent preference vectors. Wiki-mediated memory (Cherry-pick #7) is the only cross-session learning; every influence visible to user.
- ❌ **No hidden intent classification.** Classifier output logged in tour record; visible in admin debug view; visible to user in future phase.

---

## Key architecture decisions

1. **Embedding provider:** Voyage-3 everywhere (v1 prompts + C reviews). No migration at C.
2. **Table naming:** `artifactsRecommend` (camelCase per Convex convention). Pattern extends to future `artifactsShowprep`, `artifactsSampleTree`, etc.
3. **Similarity threshold:** 0.90 at launch; log near-misses 0.85–0.95 for internal tuning data; Tarik reviews ~100 near-misses week 2 to inform Phase-2 cross-user cache-match UI design.
4. **Moderation on outage:** fail-closed indefinitely with 10-min cron retry. After 2h sustained outage: `/recommend` page shows banner "Some tours may take longer to publish." After 6h: email-to-Tarik with pending queue for manual review (circuit breaker per Codex #9).
5. **Prompt-injection defense:** single-layer Haiku moderation + hardened system prompts on every LLM in chain + logging for weekly review.
6. **Vague prompt handling:** 4 clarifying chips, no tour generated until intent is clear.
7. **`perplexity-discover.ts` refactor:** atomic — refactor + update `/i/` + add `/recommend` in one PR (the PR that introduces `/recommend` — NOT the separate PR that migrates `/i/expand` rate-limit).
8. **Golden tour testing:** 10 hand-curated (prompt, expected ~12 artists) pairs; assert ≥50% overlap + provenance plausibility.
9. **Design owner:** `/plan-design-review` before implementation to catch AI-slop risk.
10. **PR sequencing (new, v2):** PR 1 ships shared Convex rate-limit table + migrates `/i/expand` to it. Ships and is observable in prod. PR 2 is `/recommend` v1 using the already-shipped helper.
11. **Orchestration location:** `convex/recommend/index.ts` as a Convex action. `/api/recommend/generate` is a thin ~30-line Vercel proxy for auth + streaming.
12. **Streaming UI:** Real streaming via Convex reactivity. New `tourStatus` table; action writes phase updates; client subscribes via `useQuery`. Matches Tarik's Level-3-transparency preference.
13. **Rate-limit keying:** composite key `{userId}:{endpoint}` with per-endpoint window. No shared budget across endpoints (generate quota does not deplete signal/report budgets).
14. **Tour lifecycle state machine:** `pending → generating → verifying → moderating → {completed | timed_out | failed | flagged}`. Transitions logged to `tourEvents`. 45s action-timeout race aborts and marks `timed_out`.
15. **Moderation state consistency:** on moderation flip public→private, fire `revalidatePath` on `/r/[slug]`, `/r`, `/r/pub/*`, `/r/tag/*` within 30s.
16. **Citation verification tolerance:** HEAD + GET + quote-on-page match with paywall domain allowlist. For known-blocking publishers (Cloudflare 403/429 on HEAD), skip quote-on-page but keep quote with "Source verified via publisher" note. Target revised to ≥50% verified-quote OR source-verified (was ≥70%, not achievable given publisher anti-scraping reality).
17. **Contract tests:** Zod-validated response schemas for Perplexity, Anthropic, intent classifier. Schema mismatch blocks deploy via CI (Codex #10).
18. **Testing harness:** `convex-test` for action unit tests; Vitest for lib unit tests; Playwright for E2E; 5 eval suites (classifier, moderation, tour quality, redaction, injection).
19. **Design system (new, from /plan-design-review v3):**
    - Color: `#0a0a0a` background, `#ffffff` text, `#e8b86a` single accent (amber). Muted white at 60% opacity for secondary text.
    - Typography: Bebas Neue for display (hero titles, artist names, section headings); Space Grotesk for body and UI chrome; Georgia italic for critic quotes. Size scale 72 / 48 / 32 / 24 / 18 / 16 / 14.
    - Spacing: 720px max content width (tour), 900px (library). 4rem between artist rows. 6-8rem between major sections.
    - New components: `PlayButton` (circular amber filled, play triangle), `PlayFullTour` (outlined amber pill), `SteeringChip` (outlined pill, toggleable), `FeedbackIcon` (minimal line icons for keep/pass/save), `CriticQuote` (italic serif + small-caps byline), `ArtistRow`, `TourHero`.
    - Mobile-first responsive: tour artifact stacks action icons below critic quote on mobile; steering chips horizontal-scroll; player bar 64px tall on mobile, 72px desktop; /r library grid 1-col/2-col/3-col by breakpoint.
    - Accessibility: WCAG 2.1 AA. Amber-on-black contrast 9.8:1 ✓. White-on-black 20.4:1 ✓. Touch targets 44×44 min. `prefers-reduced-motion` respected. Semantic `<blockquote>` + `<cite>` for quotes. `role="status"` + `aria-live="polite"` on loading phase text.
20. **DESIGN.md follow-up:** Formalize the design system into a committed `DESIGN.md` file at the project root during v1 implementation. Implementation references it. Future screens (not just `/recommend`) calibrate against it.
21. **Entry page IA (new, from /plan-design-review):** `/recommend` entry screen shows Crate wordmark + nav top, centered prompt box with placeholder "Describe what you're looking for — a mood, an era, artists you love, or a moment.", 4 example chips below ("sad about the climate", "90s Detroit techno", "if you love Fela Kuti", "Monday morning coffee"), small "or browse the library →" link to `/r`. Single column. Post-submit transitions to loading state.
22. **Share button UX (new):** Top-right of tour artifact. Click → copies `/r/[slug]` URL to clipboard + toast "Link copied." No separate Twitter/Facebook buttons. Users paste where they want.
23. **Tour is auto-public — no private-generation path in v1:** tours auto-publish (with moderation approval) per Cherry-pick #10. Users see a small "Will be public once approved" note during generation so they understand their tour becomes library-visible. Private generation is deferred to Phase 2 if observation signals demand it.

---

## Success criteria (v1, revised post-Codex)

1. Ships in ~7–9 CC working days / ~18–25 realistic human-days.
2. Five tours tested by serious listeners produce tours "I would actually put on" ≥3/5.
3. ≥50% of picks retain verified-quote OR source-verified status after two-step verification (revised from 70% per Codex #8 — publisher anti-scraping reality).
4. By week 4: ≥50 distinct user sessions have generated tours, producing ≥400 new edges in `influenceEdges`.
5. At least one tour shared externally by a non-founder within first 2 weeks.
6. Observation sprint yields week-6 decision data across 5 orthogonal criteria, attributable to the core recommendation thesis (not mixed with coalition-marketing signal — scope defer to Phase 2 preserves experiment integrity).

---

## Week-6 decision criteria (commit to Approach C if ≥3 fire)

1. **Explicit pricing willingness:** ≥1 recruited observer says "I'd pay for this" in week-4 interview.
2. **Independent external sharing:** ≥3 tours shared by non-observer, non-founder users.
3. **Engagement depth:** ≥30% of observed sessions include a chip refinement AND a Spotify export.
4. **Industry inbound:** ≥1 unsolicited inbound from press or industry.
5. **Graph density:** ≥5,000 edges from distinct sessions (not single power user).

Pivot positioning if <2 fire.

---

## Deferred to Phase 2+ (TODOS)

- "More like track 3" per-row one-click re-run (folded into chips for v1)
- Copy-as-markdown export (show-prep users)
- Sonic DNA tags row per artist (`/i/` visual reuse)
- YouTube/Bandcamp preview widgets per row
- One-line "why this arc?" explainer
- Apple Music + Tidal playlist export
- Community-visible tours (opt-in discovery beyond library)
- `/recommend` → Show Prep integration
- Tier 1 corpus ingestion (Pitchfork, Bandcamp Daily, Quietus, NPR)
- Voyage embeddings on review corpus
- Haiku NER pipeline
- Personalized PageRank traversal
- MMR diversity selection
- Arc ordering via valence projection
- Per-publication authority weighting
- Graph weight reinforcement (per-user Loop #3)
- Global quality signal / prompt evolution (Loop #5)
- Streaming / progressive tour rendering
- A/B framework for prompt variants

---

## Approved Mockups (from /plan-design-review 2026-04-20)

| Surface | Approved variant | Mockup path |
|---|---|---|
| Tour artifact (with YouTube Play) | A (v2) | `~/.gstack/projects/tmoody1973-crate-web/designs/recommend-v1-20260420/tour-artifact/variant-A.png` |
| Loading state (real streaming phases) | B | `~/.gstack/projects/tmoody1973-crate-web/designs/recommend-v1-20260420/loading-state/variant-B.png` |
| `/r/[slug]` zero-login public page | B | `~/.gstack/projects/tmoody1973-crate-web/designs/recommend-v1-20260420/r-slug-public/variant-B.png` |
| `/r` library browse | B | `~/.gstack/projects/tmoody1973-crate-web/designs/recommend-v1-20260420/r-library/variant-B.png` |
| Vague-clarify UI (chip refinement) | A | `~/.gstack/projects/tmoody1973-crate-web/designs/recommend-v1-20260420/vague-clarify/variant-A.png` |

Implementation reads these as the visual source of truth. All match the locked design system (Bebas Neue + Space Grotesk + Georgia italic, #0a0a0a bg, #e8b86a accent, editorial left-aligned layout).

---

*Locked on 2026-04-20 after /plan-ceo-review SELECTIVE EXPANSION with 10 accepted cherry-picks, 2-iteration spec review (final quality 7.5/10), 11-section architecture/security/performance review, Codex cross-model review (3 tensions resolved toward Codex), and 7-pass design review with 5 approved mockup sets (initial 5/10 → 9/10 after fixes).*
