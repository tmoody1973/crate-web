# TODOS

Work deferred from completed plan reviews. Review before each Phase 2 kickoff.

---

## /recommend — Phase 2+ candidates (deferred 2026-04-20 via /plan-ceo-review + /plan-eng-review + Codex cross-model review)

### T14–T19: Coalition-marketing bundle (deferred 2026-04-20 per Codex #11)

These 6 items were accepted during CEO review's SELECTIVE EXPANSION but deferred during eng review after Codex flagged them as coalition-marketing features that would pollute the week-6 validation signal. They ship as Phase 2 IF v1 validation justifies continued investment.

### T14. 15 curator seed tours (was Cherry-pick #11)
- **What:** Tarik hand-authors 15 exemplar tours pre-launch spanning all 8 intent types; marked `is_featured=true`.
- **Why:** Library cold-start solution + quality bar for auto-published tours.
- **Context:** Deferred because writing 15 tours is ~1 day of Tarik's time that doesn't advance the v1 validation test. If week 6 signals are strong and /r library launches for real, seed it then.
- **Effort:** Human S (~1 day Tarik writing) / CC: N/A
- **Priority:** P2
- **Depends on:** v1 core validated; /r library live; coalition essay draft

### T15. Implicit tag aggregates / StoryGraph-mode scaffolding (was Cherry-pick #12)
- **What:** Aggregate badges from keep/pass/save/chip/share/export signal counts displayed on tour cards.
- **Why:** StoryGraph-style community signal on tours. Scaffolding for Phase-3 explicit tagging.
- **Context:** Deferred because aggregates are only meaningful at scale (hundreds of tours × multiple taggers). v1 volume won't produce useful signal yet.
- **Effort:** Human S (~0.5 day) / CC S (~1 hr)
- **Priority:** P2 (conditional on week-4 engagement signal)
- **Depends on:** ≥100 tours in library with ≥3 signals each

### T16. "Read the full review" CTA parity with Spotify export (was Cherry-pick #13)
- **What:** Every tour pick gets two equally-sized buttons: "Listen on Spotify" + "Read the full review."
- **Why:** Critic-click-through path elevated to same weight as Spotify listen path; aligns with coalition thesis.
- **Context:** Pure UI change; ~30 min of work. Deferred because it only matters if coalition positioning is actively being marketed (Phase 2).
- **Effort:** Human S (~30 min) / CC S (~15 min)
- **Priority:** P2 (ships with coalition essay launch)
- **Depends on:** Coalition essay published; coalition positioning decided

### T17. UTM tracking on outbound citation clicks (was Cherry-pick #14)
- **What:** All outbound citation links carry `?ref=crate.app&utm_source=crate&utm_medium=recommend-tour&utm_campaign={tour_slug}`.
- **Why:** Publications see Crate as a named referrer in their analytics; "we drive you traffic" claim becomes auditable.
- **Context:** Pure tracking add; ~30 min. Only useful when actively engaged in publication partnerships/outreach.
- **Effort:** Human S (~30 min) / CC S (~15 min)
- **Priority:** P2 (ships with partnership outreach kickoff)
- **Depends on:** Coalition essay published; outreach to Gioia/Hogan/Doran/etc. begun

### T18. Publication attribution in OG cards (was Cherry-pick #15)
- **What:** Satori OG image footer: "Featuring criticism from Pitchfork · The Quietus · Bandcamp Daily" (dynamic per tour).
- **Why:** Every social share is free publication distribution; positions Crate as publication-aligned.
- **Context:** ~1 hour. Phase 2 once coalition positioning is marketed.
- **Effort:** Human S (~1 hr) / CC S (~30 min)
- **Priority:** P2 (ships with coalition essay launch)
- **Depends on:** Coalition essay published

### T19. `/r/pub/[slug]` publication landing pages (was Cherry-pick #16)
- **What:** Each publication with citations gets a landing page showing tours featuring their reviews, total count, total outbound click count.
- **Why:** Mutual flywheel; publications can link their readers to their own Crate presence.
- **Context:** ~1 day. Highest-value coalition feature but also highest-effort. Phase 2 once partnerships are real.
- **Effort:** Human M (~1 day) / CC S (~2-4 hrs)
- **Priority:** P2 (ships alongside at least one formalized publication partnership)
- **Depends on:** At least one publication partnership formalized; coalition essay published

### T20. Cross-user cache-match UI + consent model (was part of Cherry-pick #8b)
- **What:** "Someone asked something like this" UI surfacing cached tours when user B types a prompt semantically similar to user A's. Opt-in consent model — tour-creator checkbox: "Allow others to see this tour when they ask similar questions" (default OFF).
- **Why:** Cost savings at scale (cache hit rate up to 40%+ at 10K+ tours). Also doubles as discovery surface.
- **Context:** Deferred during eng review after Codex flagged privacy hole. v1 keeps tour persistence + embedding (for tuning data); UI and consent-model ship Phase 2 after similarity threshold is empirically calibrated.
- **Effort:** Human M (~1 day UI + schema) / CC S (~3-4 hrs)
- **Priority:** P2 (conditional on v1 scale hitting cost-pressure point)
- **Depends on:** Near-miss threshold tuned from v1 log data; opt-in UX designed

---

## /recommend — other deferred items (from /plan-ceo-review)

### T1. "More like track 3" per-row re-run

- **What:** Each tour row has a tiny button: "more like this artist." Click → re-run tour with that artist pinned as a seed.
- **Why:** Some users will find 1–2 artists they love in a tour and want variations built around them specifically. Currently, they'd have to regenerate with a new prompt, losing the other 8 good picks.
- **Pros:** Power-user refinement path. Complements chips (which modify the whole tour) with per-row pinning.
- **Cons:** Overlaps with steering chips conceptually; may confuse users. Costs another Perplexity call per click.
- **Context:** Design doc §2.9 calls this out. Deferred because steering chips (Cherry-pick #4) cover the broader refinement case. Revisit after week 4 observation if users specifically ask for per-artist drilldown.
- **Effort:** Human S (~half day) / CC S (~1–2 hrs)
- **Priority:** P3
- **Depends on:** Cherry-pick #4 (chips) shipped and validated

### T2. Copy-as-markdown export

- **What:** Button on tour artifact: "Copy as markdown." Formats the tour into a clean markdown snippet (artist, album, critic quote, source URL per row) for pasting into notes, blog posts, or radio show prep docs.
- **Why:** Show-prep users (radio hosts, DJs) will want to paste tours into their prep workflows. Also serves users who don't want Spotify export but want to keep the tour.
- **Pros:** ~1 hour of work. Serves the professional-user segment cheaply. Provides a fallback for users without Spotify connection.
- **Cons:** None significant; could theoretically confuse casual listeners unused to markdown.
- **Context:** Deferred in v1 because Spotify export (Cherry-pick #5) is the higher-value consumer action. Add in Phase 2 or pull forward if observation sprint reveals show-prep usage.
- **Effort:** Human S (~1 hour) / CC S (~30 min)
- **Priority:** P2 (high-value, low-cost)
- **Depends on:** Tour artifact component shipped

### T3. Sonic DNA tags row (reuse `/i/` visual language)

- **What:** Below the tour header, a row of ~8 sonic descriptor chips ("spacious," "melancholic," "acoustic," "electronic textures," "political," etc.). Reuses the tag visual language from `/i/[slug]`.
- **Why:** Adds scannability. Users can see the tour's sonic signature at a glance before reading artist-by-artist. Good for shareable previews.
- **Pros:** Reuses existing design system. Improves the OG card shareability (tags visible in social card).
- **Cons:** Tags are Perplexity-generated — may be inconsistent. Need QA.
- **Context:** `/i/[slug]` has this pattern for influence DNA; applies cleanly to tour DNA. Deferred because base tour UX should be validated first.
- **Effort:** Human S (~1 hour) / CC S (~30 min)
- **Priority:** P3
- **Depends on:** Tour artifact component shipped and validated

### T4. Preview widgets per tour row (YouTube or Bandcamp embed)

- **What:** Expandable preview under each tour row: 30-second audio preview via YouTube embed or Bandcamp player.
- **Why:** Users decide if they want to explore a pick based on 30 seconds of audio, not just reading. Lowers the barrier to engagement.
- **Pros:** In-page preview without leaving to Spotify/YouTube. Retention improvement.
- **Cons:** YouTube embed CSP complexity. Track resolution misses. UI weight. Autoplay issues.
- **Context:** Design doc mentions this as Phase 4 (playlist export phase). Defer until there's evidence of preview-driven engagement want.
- **Effort:** Human M (~2 days) / CC M (~3–5 hrs)
- **Priority:** P3
- **Depends on:** YouTube track ID resolution for each artist; Bandcamp API (if used)

### T5. "Why this arc?" one-line explainer at top of tour

- **What:** A single italic sentence above the tour: "Enter with ANOHNI's grief, build through Moor Mother's rage, turn toward Hiroshi Yoshimura's stillness, close with Cassandra Jenkins's reflection."
- **Why:** Makes the arc ordering visible and legible. Teaches users what arc means. Increases trust in the sequencing.
- **Pros:** Adds ~200ms to generation (one extra Haiku call). Makes the editorial logic overt.
- **Cons:** More model-generated text = more moderation surface. Another thing that can hallucinate.
- **Context:** Only worth building if arc ordering (Haiku) is producing tours with felt trajectory. If ordering feels random, this explainer exposes the weakness. Validate arc quality first.
- **Effort:** Human S (~1 hour) / CC S (~30 min)
- **Priority:** P3
- **Depends on:** Arc ordering quality verified (at least 70% of panel-tested tours have a felt trajectory)

### T6. Apple Music + Tidal playlist export

- **What:** Same as Cherry-pick #5 (Spotify export) but for Apple Music (via MusicKit + Apple OAuth) and Tidal (via their OAuth + playlists API).
- **Why:** ~30–40% of the serious-listener audience is on Apple Music or Tidal, not Spotify. Forcing Spotify-only creates exclusion.
- **Pros:** Broader reach. Signal to Apple/Tidal that Crate is platform-agnostic (partnership optionality).
- **Cons:** Apple MusicKit is complex (developer token server-side, storefront detection, native authentication flow). Tidal is easier but smaller. Two new OAuth stacks.
- **Context:** Deferred explicitly in cherry-pick ceremony. Priority depends on observed user distribution. If observation sprint shows >20% of users are non-Spotify, pull forward.
- **Effort:** Human L (~1 week each, so 2 weeks for both) / CC L (~2–3 days each)
- **Priority:** P2 (depends on user distribution data from observation sprint)
- **Depends on:** Auth0 Token Vault extended to Apple Music + Tidal scopes

### T7. Community-visible tours (opt-in discovery beyond library)

- **What:** Extends the `/r` library with social features: follow creators whose tours you liked, "tours similar to this one" recommendations, comment/react on tours.
- **Why:** Turns tour generation into a social object. Currently tours are public but there's no follow mechanism. Social surface would compound engagement.
- **Pros:** Deep retention loop. Every tour becomes a conversation starter. Social proof amplified.
- **Cons:** Requires robust moderation (comments are attack surface). Follow mechanics are non-trivial. Premature before core tour UX validated.
- **Context:** Explicitly deferred in cherry-pick ceremony as "premature pre-validation." Revisit Phase 3 once community norms are established.
- **Effort:** Human L (~2–3 weeks) / CC M (~5–8 days)
- **Priority:** P3
- **Depends on:** Observation sprint validates core tour UX; moderation pipeline matured; at least 100 active users in library

### T8. `/recommend` → Show Prep integration

- **What:** Tour artifact gets a button: "Use this as show prep." Clicking routes the tour into Crate's existing `/show-prep` command and generates talk breaks, transitions, and interview prep per-tour-artist.
- **Why:** Radio host segment value-add. A 10-artist tour becomes a full hour of programmed content with talking points.
- **Pros:** Closes loop from discovery → performance for pros. Reuses existing `/show-prep` infrastructure.
- **Cons:** Pro-user feature in a consumer-facing v1. Hidden value for casual users.
- **Context:** Deferred as "professional-user expansion; Phase 2 after consumer validation." If observation sprint reveals radio-host usage is significant, pull forward.
- **Effort:** Human M (~2 days) / CC M (~4–6 hrs)
- **Priority:** P2 (high-value for Radio Milwaukee relationship; low-cost)
- **Depends on:** Tour artifact shipped; existing `/show-prep` command operational

### T9. Approach C commitment (week 6 decision)

- **What:** The full corpus-ingestion pipeline: Tier 1 publications (Pitchfork, Bandcamp Daily, Quietus, NPR Music to start), Voyage-3 review embeddings in Convex vector index, Haiku NER pipeline, Personalized PageRank traversal, MMR diversity selection, arc ordering via valence projection, per-publication authority weighting.
- **Why:** The essay promise. Owns the corpus. Differentiates from Perplexity wrappers. Defensible moat per `PRODUCT_ANALYSIS.md`.
- **Pros:** Everything the essay claims becomes true. Corpus as platform asset. Publication-weighting per query becomes possible.
- **Cons:** 2–4 months of engineering. Publisher legal exposure (Pitchfork's parent is Condé Nast; litigious). Operational burden (RSS parsing breaks, sitemap scraping edge cases).
- **Context:** The WHOLE POINT of A-then-C. Decide at week 6 based on observation-sprint criteria (see `v1-scope.md` §"Week-6 decision criteria"). Publish `a-music-recommender-that-reads.md` alongside C, not before.
- **Effort:** Human XL (~2–4 months) / CC L (~3–5 weeks)
- **Priority:** P1 (mission-critical, conditional on week-6 decision)
- **Depends on:** v1 observation sprint results; ≥3 of 5 decision criteria firing; essay final draft ready

### T10. Graph weight reinforcement (Loop #3)

- **What:** When a user signals "keep" on a tour pick, the influence-graph edge that surfaced that pick gets a small weight boost in the user's per-user `influenceEdges` subgraph. "Pass" signals decay the edge.
- **Why:** Per-user graph refinement over time. When Approach C's PPR ships, these reweighted edges will traverse differently per user.
- **Pros:** Compounds Wiki-mediated memory into graph-structural learning. Meaningful once PPR is live.
- **Cons:** Only semi-legible (users can see graph but few read edge weights). No-op in Approach A since PPR doesn't exist yet.
- **Context:** Deferred explicitly; only meaningful once Approach C ships. Revisit after PPR is in production.
- **Effort:** Human M (~1–2 days) / CC S (~3–4 hrs)
- **Priority:** P3
- **Depends on:** Approach C with PPR traversal operational

### T11. Global quality signal / prompt evolution (Loop #5)

- **What:** Aggregate signal across all users — which picks in similar queries get "kept" vs "passed" at scale. Use aggregate to evolve the Perplexity prompt templates per intent type.
- **Why:** The system gets better for everyone over time, not just per-user.
- **Pros:** Compounding quality moat. Observable in dashboards.
- **Cons:** Requires signal volume (hundreds of users minimum). Premature before there's data.
- **Context:** Explicitly deferred; needs signal volume first. Revisit at week 12+ once the observation sprint and initial growth provide data.
- **Effort:** Human L (~3–5 days) / CC M (~1–2 days)
- **Priority:** P3
- **Depends on:** ≥500 Keep/Pass signals logged across ≥100 unique users

### T12. Streaming / progressive tour rendering

- **What:** Start rendering the tour UI skeleton as soon as Perplexity returns, before citation verification completes. Citations populate in-place as they verify. Perplexity streams artist tokens; Crate parses incrementally.
- **Why:** Target p50 under 5 seconds for cached tours, p95 under 10s for fresh. Feels instant.
- **Pros:** Significant perceived-latency win. Good product feel.
- **Cons:** Complex state management. UI jumps if citation verification changes picks. Optimistic-then-corrected UX.
- **Context:** Flagged in Section 7 as "would make this magical." Not v1 scope. Revisit once base flow is validated and latency is the primary complaint.
- **Effort:** Human M (~2–3 days) / CC M (~5–8 hrs)
- **Priority:** P3
- **Depends on:** Base `/recommend` flow operational; latency measurements from real users

### T13. Explicit StoryGraph-style mood/pace tagging (Phase 2)

- **What:** After viewing or saving a tour, a user can tag it with structured metadata: mood captured (melancholy / defiant / contemplative / energized / etc.), listenability (background / active / event), arc feel (consistent / arcs up / arcs down), coverage (single era / cross-era / single genre / cross-genre), use case (workday / party / driving / grieving / celebrating), depth (accessible / needs context / deep-cut). Tags aggregate across the library; composite search becomes possible: `/r?mood=contemplative&use-case=grieving`.
- **Why:** StoryGraph's moat is user-submitted mood/pace tags on every book — 5M+ users bootstrapped via labeled discovery data. Equivalent for Crate: community-validated tour metadata that Spotify can't replicate from clickstream. Makes `/r` library dramatically richer; delivers on the "StoryGraph for music" positioning in `PRODUCT_ANALYSIS.md` literally.
- **Pros:** Community moat on top of critic-prose moat. Rich discovery layer: "slow-paced, contemplative, single-era" queries return tours users validated. Scales with the library — the flywheel StoryGraph ran. Compounds into Approach C (tags become PPR edge weights). Essay-compatible (adds another layer of legible editorial metadata).
- **Cons:** Cold-start problem severe (tags useless for first ~500 tours × 3 taggers each). Tag-schema design is a real product question (music ≠ books; pace doesn't map). Quality variance + spam surface. UX weight (more asks). Wrong taxonomy means retrofit pain.
- **Context:** v1 ships with implicit aggregates (Cherry-pick #12 — keep/pass/save/share/export counts as badges) which is the scaffolding for this. Before building explicit tagging, gather observation-sprint data on (a) which terms users naturally use in prompts, (b) whether users engage with implicit badges at all, (c) what queries users wish they could ask the library. Then design the taxonomy from evidence, not guess.
- **Effort:** Human M (~3–5 days) / CC M (~6–10 hrs)
- **Priority:** P2 (high strategic value; conditional on observation data)
- **Depends on:** Observation sprint data; at least 500 tours in library; demonstrated engagement with implicit badges (Cherry-pick #12); tag-schema design validated with 3–5 users before building

### T21. Bandcamp + Discogs affiliate links (Phase 2 — coalition monetization v1)

- **What:** Each tour row gets "Buy on Bandcamp" / "Buy on Discogs" buttons with affiliate tracking codes. Clicks that convert to purchases generate revenue for Crate via affiliate programs.
- **Why:** First concrete revenue stream that's aligned with the coalition thesis — Crate captures value on commerce adjacent to discovery, without taking from publications or artists. Bandcamp has an active affiliate program; Discogs does too.
- **Pros:** Monetizes discovery without subscription or ads. Aligns with pro-artist stance (Bandcamp pays artists better than streaming). Simple implementation.
- **Cons:** Requires affiliate program sign-ups with Bandcamp + Discogs. Revenue per click is modest. Doesn't directly share with publications yet.
- **Effort:** Human S (~1 day including affiliate program sign-up) / CC S (~2 hrs code)
- **Priority:** P2
- **Depends on:** v1 shipped; Bandcamp + Discogs affiliate accounts approved

### T22. Subscription revenue-share with publications (Phase 3 — coalition economics)

- **What:** When a Crate user subscribes to Pro after clicking through from a publication-attributed tour, that publication earns a revenue share on the subscription (e.g., 15-20% for first year, declining thereafter). Requires tracking attribution path, calculating revenue allocation, and building payout infrastructure.
- **Why:** The coalition thesis in its fullest form. Publications directly benefit from Crate's success — a publication's critic drove a conversion, the publication gets paid. No precedent in streaming. Creates aligned incentive: publications champion Crate because Crate pays them.
- **Pros:** Turns publications into sales partners. Creates a revenue flywheel unavailable to any competitor. Press-worthy in itself — "the music platform that actually pays critics."
- **Cons:** Complex attribution logic (which publication gets credit for a user who viewed tours citing multiple publications?). Legal + financial plumbing. Requires real partnership agreements with publications. Payout infrastructure.
- **Effort:** Human L (~3-5 weeks including partnership conversations) / CC M (~1-2 weeks code)
- **Priority:** P2 (strategic, high-value; requires Phase 2 traction as prerequisite)
- **Depends on:** At least 100 Pro subscribers; at least 3 publications willing to formalize partnership; legal review of attribution + payout terms

### T23. Publication-partnered landing contexts (Phase 2-3)

- **What:** Cobranded entry points: `crate.app/quietus`, `crate.app/pitchfork` — when publications link readers to Crate, they land on a publication-branded surface ("The Quietus × Crate") with publication voice honored in copy, logo in header, and attributed tours from their critics highlighted. Converts publication traffic to Crate users while crediting the publication visibly.
- **Why:** Publications want to send readers SOMEWHERE from their reviews. Today that somewhere is nothing. A publication-branded Crate landing lets them link to Crate as "more from our critics" without it feeling like off-brand abandonment.
- **Pros:** Makes Crate a first-class distribution surface for publications. Increases partnership value. Strong press angle.
- **Cons:** Requires publication buy-in (partnership agreement). Cobranded UI work per publication. Maintenance overhead.
- **Effort:** Human M (~1 week per publication partnership + generic template) / CC M (~3-5 days)
- **Priority:** P2 (conditional on publication partnerships materializing)
- **Depends on:** At least one publication partnership formalized; template system to onboard additional ones quickly

### T24. Save as Spotify playlist via Auth0 Vault (was Cherry-pick #5 — deferred 2026-04-20 per /plan-design-review)

- **What:** Button in tour artifact: "Save to Spotify playlist." Creates a Spotify playlist via Auth0 Token Vault write scope (`playlist-modify-private` + `playlist-modify-public`). Re-consent modal for write-scope escalation. Track selection policy from design doc §3.5 (most-reviewed > most recent single > opener of featured album). "Not on Spotify" badge + user ack for incomplete playlists.
- **Why:** Original Cherry-pick #5 from CEO review — closes the loop from discovery to listen for Spotify users. Ships alongside the coalition essay when Phase 2 marketing begins.
- **Context:** Deferred 2026-04-20 because /plan-design-review locked YouTube inline play as the primary v1 listen mechanism. YouTube play covers zero-login `/r/[slug]` viewers (Spotify export requires auth), covers obscure/experimental artists Spotify lacks (catalog misses are common for the target audience), and aligns better with the essay's "reading list, not playlist" framing (YouTube = sampling, Spotify export = commit). Spotify export remains valuable for users who want to save tours to their library — but it's additive, not core to validation. Auth0 Token Vault infrastructure from the April 6 hackathon stays in place, ready to activate.
- **Pros:** Catalog-native listen path for Spotify users. Stronger acqui-hire story with Spotify-the-acquirer. Audits the Auth0 hackathon investment.
- **Cons:** Requires auth, excludes zero-login viewers. Catalog misses common for experimental/international artists. Partial-playlist UX friction. Adds ~2 days over YouTube play.
- **Effort:** Human M (~2 days) / CC M (~4-6 hrs)
- **Priority:** P2 (conditional on Phase 2 coalition essay launch)
- **Depends on:** v1 shipped; week-6 validation criteria met; coalition essay launch decision; Auth0 Vault extended with write scope

### T25. A/B framework for prompts

- **What:** Per-intent Perplexity prompts become A/B-testable. Route 10% of traffic to prompt variant B; compare tour quality via engagement signals.
- **Why:** Without this, every prompt change is deploy-and-pray. Eval suite catches regressions, but can't distinguish "worse" from "different."
- **Pros:** Enables disciplined prompt iteration. Useful for Approach C's corpus-weighted prompts too.
- **Cons:** Complexity overhead. Needs PostHog feature flags + user-to-variant consistency + statistical power calculations.
- **Context:** Flagged in Section 5 as "not accepted for v1." Revisit once there's meaningful variant-decision throughput (monthly prompt changes with quality debate).
- **Effort:** Human M (~2–3 days) / CC M (~4–6 hrs)
- **Priority:** P3
- **Depends on:** ≥1000 tours/day sustained; active prompt-tuning practice

---

## Other deferred items from prior reviews

*(None yet — this TODOS.md was created 2026-04-20 with the /recommend plan review. Future reviews append here.)*
