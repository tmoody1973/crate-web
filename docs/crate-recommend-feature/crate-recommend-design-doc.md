# `/recommend` — Crate design doc

| | |
|---|---|
| **Project** | Crate — slash command `/recommend` |
| **Author** | Tarik Moody |
| **Status** | Schematic through CDs, pre-implementation |
| **Precedent** | Logos et al., "Modeling Artist Influence for Music Selection and Recommendation: A Purely Network-Based Approach," HDSR 7.4 (Fall 2025) |
| **Methodology** | Bumwad coding — architecture phases applied to product development |

---

## 0. Programming

### Problem
DJ/host mood-and-theme queries ("I'm feeling down about the climate," "something heavy for a late-night drive," "joyful but not saccharine") don't survive contact with mainstream music recommenders. Collaborative filtering optimizes for what you'd click next. Genre-based tools demand that you already know the genre. Audio-feature engines describe tempo and valence, not meaning. None of them answer "what is this mood actually asking for, and which artists have critics already described in exactly those terms."

### Users
Music lovers — the people who read reviews, follow specific critics, collect vinyl or dig deep in digital catalogs, and know the feeling of an algorithmic recommender flattening their taste. They want discovery the way a well-read friend would recommend something: with a reason, a quote, a reference. Professional users (DJs, writers, curators, hosts) sit inside this audience, not outside it — they're an intense subset, not a separate tier. The design target is anyone who treats listening as a practice, not anyone who wants a generic "focus" playlist.

### Goals
Produce an ordered tour of 8–12 artists (with a representative album per artist and a one-line critical provenance sentence) that responds to a mood + theme query, ordered as a playable arc. Every recommendation carries the review sentence that justifies its inclusion.

### Non-goals
- BPM sorting, key detection, beat matching. Different command, different workflow.
- Personal listening history. Crate `/recommend` is stateless by design (see Privacy).
- Replacing Spotify's algorithmic playlisting. Crate is for curatorial discovery, not background listening.
- Generic "vibe playlist" generation. Design for people who care about music enough to read about it.

### Success criteria
1. **Provenance traceability.** Every artist in the output has a named review quote that connected it to the query or to another tour member.
2. **Mood fit at the prose level.** The user can read the provenance sentence and immediately understand why this artist is in the tour.
3. **Theme coverage is real.** For "climate," the tour includes artists whose work genuinely engages ecological themes — not just artists tagged "ambient" or "sad."
4. **Arc, not flat list.** The ordering is a playable sequence: entry, sit-with-it, turn, reflective close. Not eight tracks of the same thing in a row.
5. **Explainable surprise.** At least two artists in a typical tour should be ones the user hasn't considered — and the provenance sentence explains why they belong.

### Constraints
- No Spotify audio features (deprecated 2024-11-27).
- Convex as system of record. Anthropic SDK for LLM calls. MCP for external data where available.
- Build on top of existing Crate infrastructure (26+ MCP data sources already connected).
- Corpus must serve music lovers across genres, eras, and cultural contexts — not just indie-press coverage. Implies deliberate tier expansion, not a one-publication scrape.

---

## 1. Schematic Design

### Parti
**Critical prose is the substrate.** Everything downstream — the graph, the seeds, the traversal weights, the provenance — comes from the sentences critics already wrote. The system reads reviews so the user doesn't have to.

This is a single-move parti. Every design decision later cashes out as "does this preserve or degrade our ability to use critic prose as the primary signal." Spotify's deprecation clarified the move by removing the tempting compromise.

### Major moves

**Corpus as foundation.** A curated set of music publications, ingested and embedded. Not a scrape of every music blog on the internet — a deliberate list chosen for critical depth and genre breadth, so the system can speak to a jazz head, a techno fan, and a hip-hop obsessive without flattening any of them.

**Artist graph from mentions.** When a review of A mentions B, draw a directed edge A → B, weighted by mention salience. This is the paper's core move, preserved.

**Embeddings carry the mood signal.** Each review is vectorized. Aggregated per artist, these vectors become the "critical description profile" that replaces Spotify audio features entirely.

**Query is two-part: intent + traversal.** Claude parses the user's natural language into a structured mood/theme query. That query seeds the graph and weights the walk.

**Output is an artifact, not a chat message.** React artifact with tour, provenance, and playlist. Steerable via chips and follow-up prompts.

### Massing — component topology

Two planes:

**Offline plane (data layer).** Ingestion → dedup → NER → embedding → graph construction. Runs nightly or on corpus refresh. Stable, background, not on the hot path.

**Online plane (request path).** Parse intent → semantic seed search → weighted traversal → artifact render. Runs per `/recommend` invocation. Target latency: 8–15s end-to-end including LLM calls.

### Parti-level decisions (locked at SD)

| Decision | Choice | Why |
|---|---|---|
| Data plane | Convex (existing) | Already Crate's backbone; native vector search; incremental updates |
| Embedding model | Voyage-3 or voyage-3-large | Anthropic partner; strong on long-form text; same provider surface as Claude |
| Intent parser | Claude Sonnet via existing SDK | Structured output, good at mood decomposition, already wired |
| Graph store | Convex table, not a dedicated graph DB | Scale is low (O(100K) nodes); avoids a new dependency |
| Traversal | Personalized PageRank with mood/theme-weighted edges | Well-studied, converges fast, naturally handles multi-seed |
| User state | None — stateless per call | Privacy-preserving; aligns with paper's framing |
| Corpus curation | Manual publication list, not crawl-everything | Quality and ethics over volume |

### SD-level schematic — the whole machine in one paragraph

User types `/recommend I'm feeling down about the climate`. Claude parses this into `{ mood: {valence, arousal, density}, themes: [climate, ecology, grief, loss, anthropocene], text: "..."}`. A composite embedding of mood + themes is computed and searched against the review vector index; the top reviews surface a seed set of 5–8 artists whose reviews genuinely engage the query. Personalized PageRank runs from that seed set, with edge traversal probabilities modulated by per-artist theme-fit scores. Top-k non-seed artists by PPR score, with diversity applied via MMR, become the tour. For each tour member, the system pulls the specific review sentence that scored highest against the query and attaches it as provenance. Results render in a React artifact with a playlist suggestion (one track per artist, ordered to match the PPR trajectory).

---

## 2. Design Development

### 2.1 Corpus layer

**Publication list, v1.** The corpus is the product. Start narrow, expand deliberately.

*Tier 1 (launch — broad general coverage).* Pitchfork, Bandcamp Daily, The Quietus, Aquarium Drunkard, NPR Music, Resident Advisor (reviews only, not news), The Wire. Strong in indie, rock, electronic, and experimental.

*Tier 2 (expansion — genre and cultural coverage).* Passion of the Weiss, Pigeons & Planes, DJBooth, Afropunk, OkayAfrica, Wax Poetics archive, Pan M 360, NPR's Alt.Latino, Rap Genius editorial. Fills in hip-hop, R&B, global, and diasporic music — the structural blind spots of Tier 1.

*Tier 3 (depth and archive).* Rolling Stone, Stereogum, Fader, KEXP, AllMusic editorial reviews (not user reviews), Mojo, Uncut, DownBeat archive. Adds historical depth and jazz/classic rock coverage.

The Tier 1 list alone is ~180K reviews across the catalog era Crate cares about. Each tier roughly doubles coverage and materially changes what queries the system can answer well.

**Ingestion.** Where RSS exists, use it. Where RSS is thin, use the Internet Archive's Wayback Machine as the scraping target rather than the live site — lower load on publishers, stable URLs, already public. For publications that expose a content API or have a known Common Crawl presence, prefer that. Rate-limit aggressively (1 req/sec per publication), cache forever, respect robots.txt. Log every fetch with source, URL, timestamp, content hash.

**Deduplication.** Two-pass: exact URL canonicalization, then MinHash/LSH on article body to catch syndication and cross-posting.

**NER.** Don't use off-the-shelf NLTK or spaCy for artist extraction — they mangle names like `billy woods`, `MIKE`, `JPEGMAFIA`, `Yaya Bey`, `$uicideboy$`, `clipping.`. Use Claude Haiku as the NER extractor with a structured output schema. Two-shot prompt, 500-token review chunks, cache the extraction. Fall back to string-match against a MusicBrainz-seeded canonical artist list for validation.

**Schema evolution.** Design assumes more publications land after launch. Keep the `reviews` table publication-agnostic; make `publication_id` a foreign key.

### 2.2 Graph layer

**Edge construction.** When review R of artist A mentions artist B (B ≠ A), write edge `(A, B)` with weight derived from:
- Mention count in R (log-scaled)
- Mention position (first paragraph = higher weight)
- Mention prominence (review subject reference vs. casual list)
- Review publication's authority weight (tunable; default uniform)

Multiple reviews mentioning the same pair compound the edge weight.

**Graph properties to preserve:** the paper's graph had 63% of artists in the largest connected component with the remainder in small islands of 2–3. That's acceptable. We don't need to force connectivity — isolated artists just don't surface from traversal, which is fine.

**Directionality.** Edges are directed (review of A mentions B ≠ review of B mentions A). The paper treats them as directed; keep that. Influence flows both ways in practice but the graph should reflect the actual prose.

**Self-loops and aliases.** Strip self-loops. Collapse known aliases (MF DOOM / Daniel Dumile / Viktor Vaughn / King Geedorah → single canonical node with alias list preserved for display).

### 2.3 Embedding layer

**What gets embedded.** Each *review*, whole body, up to 8K tokens. Not chunks — reviews are already roughly the right size, and chunking destroys the "this critic is describing this album as a whole" signal.

**Model.** Voyage-3 (1024-dim, 32K context) as default. Swappable — design the embedding call as an interface so swapping to OpenAI 3-large or Cohere embed-v4 is a one-line change.

**Artist profile vector.** Mean of embeddings of all reviews mentioning the artist as primary subject, weighted by recency (exponential half-life ~5 years so recent critical consensus dominates without erasing legacy).

**Theme embedding.** User's parsed theme tokens joined with a small prompt template ("Music that engages themes of: X, Y, Z. Evocative descriptions a critic might write:") and embedded. This gives better theme vectors than embedding raw tokens.

**Storage.** Convex vector index on `reviews.embedding` for seed search. Artist profile vectors stored on the `artists` table and updated nightly from the review set.

### 2.4 Intent parser

```
Input: user prompt (string)
Output: StructuredQuery {
  mood: { valence: -1..1, arousal: 0..1, density: 0..1 },
  themes: string[],
  sonic_hints: string[],       // e.g. "slow", "acoustic", "minor key"
  era_hint?: string,           // e.g. "recent", "90s", "any"
  exclusions?: string[],       // e.g. "not instrumental"
  raw_text: string
}
```

Claude Sonnet, structured output, single call. The full user prompt is also retained as `raw_text` and embedded directly for the seed search — don't throw away the user's actual words by parsing them into tokens.

### 2.5 Seed search

Compute composite query embedding as: `0.4 * embed(raw_text) + 0.4 * embed(themes_as_prose) + 0.2 * embed(mood_descriptor)`. Search against review index, take top-50 reviews, pull the artists those reviews are *about* (not artists they *mention* — seeds are review subjects). Dedupe. Take top 5–8 unique artists by best review score.

Weights tunable; defaults above favor the user's literal words.

### 2.6 Traversal — scoring and algorithm

**Score function for candidate artist C, given seeds S and query Q:**

```
score(C) = 
    α · ppr_score(C | S)                  // proximity in the critical network
  + β · cosine(profile(C), embed(Q))      // does this artist's critical prose match
  + γ · max_review_match(C, Q)            // best single review sentence fit
  − δ · redundancy(C, tour_so_far)        // MMR-style diversity penalty
```

Default weights: `α=0.35, β=0.30, γ=0.25, δ=0.10`. These are starting points for A/B tuning against a curator panel's held-out set of hand-built tours.

**PPR computation.** Standard power iteration, damping 0.85, teleport vector uniform over seed set, edge transition probabilities weighted by edge strength × `cosine(profile(target), Q)` so the walk is drawn toward query-relevant neighbors. Converges in 20–30 iterations for a graph this size. Cache the edge-weight matrix per-query (it varies with Q) but only materialize the top-K rows we need.

**Tour assembly.** Greedy pick with MMR:
1. Start with highest-PPR non-seed artist.
2. For each subsequent pick, choose the argmax of `(1-λ)·score(C) − λ·max_similarity(C, tour_so_far)`.
3. Continue until `|tour| = 10`.

λ = 0.3 as a starting point.

**Ordering.** After assembly, re-sort the tour to produce an arc. Compute a 1D projection of each artist's profile vector onto the mood valence axis and sort ascending then descending to create an up-and-back arc: enter low, build, pause, resolve. This is a heuristic — tune based on listening.

### 2.7 Artifact render

Claude (via artifacts API in-chat) generates a React component given the tour structured data. The artifact is the *output*, but Claude is not re-deciding content — it's formatting what the backend returned.

Structure:
- **Header.** Echoed mood interpretation + theme tokens, so the user can see what Claude thought they meant.
- **Tour list.** 10 rows, each: artist name, featured album (latest or most-reviewed), the provenance sentence in italic serif with publication attribution, compact metadata (year, label).
- **Playlist.** One track per artist, ordered to match the arc. Track chosen per: most-reviewed track > most recent single > opener of featured album.
- **Steering chips.** "Darker," "More groove," "Less ambient," "Women artists," "Recent only" — each sends a follow-up prompt that re-runs with a modifier.
- **Export row.** Copy as markdown (for notes, blog posts, or show prep), export to Spotify/Apple Music/Tidal playlist via MCP (later), share as a permalink.

### 2.8 Edge cases

**Thin corpus coverage.** If the seed search returns fewer than 3 artists with review scores above threshold, fall back: let Claude generate 5–8 candidate artists from priors given the prompt, then snap each to the nearest node in the graph via artist name match. The tour then runs from those fallback seeds. Surface a subtle UI note: "Reaching beyond the critical corpus for this one."

**Cold artist.** Artist in graph but only 1–2 reviews. Profile vector is noisy. Weight their inclusion down (reduce α contribution proportional to review count floor).

**Disconnected seed.** Seed artist is in the graph but in a tiny connected component. PPR doesn't escape — that's fine; fall back to embedding-only similarity for that seed's contribution.

**Ambiguous prompt.** "I want sad music" with no theme. Claude's parser detects thin themes, flags it, and the system widens the seed search to embed-match purely on mood descriptor. Explicitly surface in the header: "Interpreted as: mood-only query, no specific theme."

**Corpus bias.** The critical press has known biases — overindexed on indie, rock, and electronic, thin on hip-hop, R&B, global music, and historical jazz. If the query is one Tier 1 handles poorly (e.g., "soulful Friday morning gospel," "late-80s Detroit techno," "Brazilian tropicália"), route the seed search and PPR weights toward the relevant Tier 2 or 3 publications. The publication-weight vector is query-conditional.

### 2.9 Mid-tour steering

User can chat after the artifact renders. Follow-up prompts are interpreted as modifiers to the existing tour, not fresh `/recommend` calls:

- "More like track 3" → re-run traversal with that artist added to seeds.
- "Less ambient" → add sonic exclusion, re-run with penalty on candidates whose profiles match "ambient" descriptor prose.
- "Replace #7" → keep tour, re-sample one slot with existing tour in the diversity penalty set.
- "Make it darker" → re-embed mood toward lower valence, re-run PPR.

This is what turns it from one-shot into show-prep-grade. Budget for this from the start.

### 2.10 Observability

Log per call (no PII):
- Parsed query structure
- Seed set + their scores
- Top-20 PPR candidates + scores
- Final tour + per-artist score breakdown
- Latency per stage
- User steering follow-ups in session
- Whether the artifact was exported and to where

These logs are the training signal for tuning α/β/γ/δ/λ and for deciding which publications to add to the corpus.

### 2.11 Privacy & ethics

**User side.** No account required for `/recommend`. No listening history retained per call. The parsed query is logged for system tuning but not attached to a user ID. This aligns with the paper's privacy-preserving framing, and it's a feature for the kind of listener who specifically doesn't want a recommender building a profile on them.

**Publisher side.** Scraping is ethically fraught even when technically permitted. Mitigations: Wayback Machine over live sites where possible, aggressive rate limiting, full citation + linkback in every artifact output, reach out to each Tier 1 publication with a "we're using your review archive to power critical recommendation; here's what's in it for your traffic" note before launch. Crate should link out to the original review, not reproduce it. Provenance quotes are single sentences — fair use territory, but keep them short and attributed.

**Artist side.** The graph encodes critical consensus, which has historical biases. Surface this in the app copy somewhere — "Crate's recommendations reflect the opinions of music critics, which have their own limitations." Tier 2 expansion is a mitigation, not a fix.

---

## 3. Construction Documents

### 3.1 Convex schema

```typescript
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  publications: defineTable({
    slug: v.string(),            // "pitchfork", "bandcamp-daily"
    name: v.string(),
    tier: v.union(v.literal(1), v.literal(2), v.literal(3)),
    base_url: v.string(),
    ingestion_method: v.union(
      v.literal("rss"),
      v.literal("wayback"),
      v.literal("api"),
      v.literal("sitemap")
    ),
    authority_weight: v.number(),    // default 1.0
    last_ingested_at: v.number(),
  }).index("by_slug", ["slug"]),

  artists: defineTable({
    canonical_name: v.string(),
    aliases: v.array(v.string()),
    musicbrainz_id: v.optional(v.string()),
    profile_embedding: v.optional(v.array(v.number())),   // mean of review embeddings
    review_count: v.number(),
    first_review_year: v.optional(v.number()),
    last_review_year: v.optional(v.number()),
  })
    .index("by_canonical_name", ["canonical_name"])
    .vectorIndex("by_profile", {
      vectorField: "profile_embedding",
      dimensions: 1024,
    }),

  reviews: defineTable({
    publication_id: v.id("publications"),
    primary_artist_id: v.id("artists"),
    album_title: v.string(),
    author: v.optional(v.string()),
    published_at: v.number(),
    url: v.string(),
    body: v.string(),
    body_hash: v.string(),              // for dedup
    embedding: v.array(v.number()),
    mentioned_artist_ids: v.array(v.id("artists")),
  })
    .index("by_url", ["url"])
    .index("by_hash", ["body_hash"])
    .index("by_primary_artist", ["primary_artist_id"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
    }),

  artist_edges: defineTable({
    from_artist_id: v.id("artists"),
    to_artist_id: v.id("artists"),
    weight: v.number(),
    review_ids: v.array(v.id("reviews")),   // provenance
  })
    .index("by_from", ["from_artist_id"])
    .index("by_to", ["to_artist_id"])
    .index("by_pair", ["from_artist_id", "to_artist_id"]),

  recommendation_sessions: defineTable({
    prompt: v.string(),
    parsed_query: v.any(),        // StructuredQuery
    seed_artist_ids: v.array(v.id("artists")),
    tour_artist_ids: v.array(v.id("artists")),
    weights: v.any(),             // alpha/beta/gamma/delta used
    latency_ms: v.number(),
    created_at: v.number(),
  }).index("by_created_at", ["created_at"]),
});
```

### 3.2 Function surface

```typescript
// convex/recommend.ts

// Main entry point — called from the slash command handler
export const recommend = action({
  args: { prompt: v.string() },
  handler: async (ctx, { prompt }): Promise<TourResult> => {
    // 1. Parse intent
    const query = await parseIntent(ctx, prompt);

    // 2. Compute composite query embedding
    const qEmbed = await composeQueryEmbedding(ctx, query);

    // 3. Seed search
    const seeds = await findSeeds(ctx, qEmbed, { k: 8 });

    // 4. Run weighted PPR
    const candidates = await runPPR(ctx, {
      seeds: seeds.map(s => s._id),
      queryEmbedding: qEmbed,
      topK: 30,
    });

    // 5. Assemble tour with MMR diversity
    const tour = await assembleTour(ctx, {
      candidates,
      seeds,
      query,
      size: 10,
      lambda: 0.3,
    });

    // 6. Order as arc
    const ordered = orderAsArc(tour);

    // 7. Attach provenance quotes
    const withProvenance = await attachProvenance(ctx, ordered, qEmbed);

    // 8. Log session
    await ctx.runMutation(api.recommend.logSession, {
      prompt, query, seeds: seeds.map(s => s._id),
      tour: ordered.map(a => a._id),
    });

    return { header: query, tour: withProvenance };
  },
});

// Internal helpers (not called from client)
async function parseIntent(ctx, prompt): Promise<StructuredQuery> { ... }
async function composeQueryEmbedding(ctx, query): Promise<number[]> { ... }
async function findSeeds(ctx, qEmbed, opts): Promise<Artist[]> { ... }
async function runPPR(ctx, opts): Promise<ScoredArtist[]> { ... }
async function assembleTour(ctx, opts): Promise<Artist[]> { ... }
function orderAsArc(tour: Artist[]): Artist[] { ... }
async function attachProvenance(ctx, tour, qEmbed): Promise<TourRow[]> { ... }
```

### 3.3 PPR pseudocode

```
function runPPR(seeds, queryEmbedding, topK):
  # Build query-conditioned transition matrix
  neighbors_by_node = fetch_edges_from_nodes(reachable_set(seeds, max_hops=3))

  for each (from, to, weight) in neighbors_by_node:
    theme_fit = cosine(profile(to), queryEmbedding)
    transition[from][to] = weight * max(theme_fit, 0.1)   # floor to avoid zeroing

  normalize rows of transition to sum to 1

  # Teleport vector
  teleport = zeros(N)
  for s in seeds:
    teleport[s] = 1 / len(seeds)

  # Power iteration
  score = teleport.copy()
  for i in 1..30:
    score = 0.85 * (transition.T @ score) + 0.15 * teleport
    if delta(score) < 1e-4:
      break

  # Remove seeds from results
  for s in seeds:
    score[s] = 0

  return top K by score
```

### 3.4 Provenance attachment

For each artist in the tour, find the one review sentence across their reviews that maximizes cosine similarity to the query embedding. Sentences split with a musically-aware splitter (don't break on "Mr." or "St." or "feat."). Store the sentence, the review URL, the publication, the author, and the year. This becomes the italic quote in the artifact.

### 3.5 Artifact contract

The React component receives:

```typescript
type TourResult = {
  header: {
    parsed_mood: string;           // humanized, e.g. "melancholy, reflective"
    themes: string[];
    echo: string;                  // e.g. "Reading: 'feeling down about the climate'"
  };
  tour: {
    artist: { name: string; id: string };
    album: { title: string; year: number; label?: string };
    provenance: {
      quote: string;               // single sentence
      publication: string;
      author?: string;
      url: string;
      year: number;
    };
    track_suggestion: { title: string; duration_sec?: number };
  }[];
  steering_chips: string[];        // ["Darker", "More groove", ...]
};
```

The artifact is a single-file React component. State managed with `useState`. No localStorage. Steering chips call `sendPrompt()` to send a follow-up. Export row uses copy-to-clipboard for markdown and `openLink()` for external playlist services.

### 3.6 Ingestion jobs

Three Convex cron jobs:

1. **Corpus refresh** — nightly 03:00 CT. For each publication, fetch new reviews via the publication's ingestion method, dedup, NER-extract artists, embed, write to `reviews` and update `artist_edges`.

2. **Artist profile rebuild** — weekly Sunday 04:00 CT. Recompute `artists.profile_embedding` as recency-weighted mean. Cheap — just an aggregation.

3. **Graph health report** — weekly, emits to the operator dashboard: largest connected component size, orphan count, new edges, new artists, publication delta.

### 3.7 Dependencies

- `@anthropic-ai/sdk` — already in Crate
- `voyageai` — add
- Convex native — already in Crate
- `fast-xml-parser` or similar for RSS
- `minhash-lsh` for dedup

Keep NetworkX-equivalent graph lib out — don't need it. PPR is one matrix op.

### 3.8 Rollout

**Phase 1 — MVP (Tier 1 corpus only, no steering, no export).** Prove the parti. Ingest Pitchfork + Bandcamp Daily + The Quietus + NPR. ~40K reviews. Build graph, stand up `/recommend`, get a tour out. Tour rendered as markdown artifact, not React. Success: five hand-tested mood/theme queries produce tours a serious listener would actually put on.

**Phase 2 — Full Tier 1 corpus + React artifact + steering chips.** Add remaining Tier 1 publications. Swap markdown output for proper React component with chips. Wire copy-as-markdown export.

**Phase 3 — Tier 2 corpus + publication weighting.** Bring in hip-hop, R&B, global, and diasporic press. Add query-conditional publication weighting so a jazz query pulls from different corpus weights than a shoegaze query. This is the phase that moves Crate from "indie-press recommender" to "actually serves music lovers across genres."

**Phase 4 — MCP playlist export + artist page integration.** Export to Spotify, Apple Music, and Tidal via MCP. Wire each tour artist to their Crate artist page so the provenance source is pre-loaded for deeper digging. Closes the loop from discovery to listen-and-own.

**Phase 5 — Tier 3 corpus + operator mode.** Historical and archive publications. Add an operator mode where advanced users can override scoring weights per call for experimental sessions — the kind of power-user control pros want and casual users can ignore.

### 3.9 Testing

**Unit.** NER extraction, edge weighting, embedding normalization, PPR convergence, MMR diversity, arc ordering.

**Golden set.** 20 hand-curated (query, expected tour) pairs built from a small panel of serious listeners across genres. Regression-run on every corpus refresh. Doesn't need to match exactly — just needs to overlap by 50%+ and pass a provenance-plausibility check.

**Live qualitative.** Biweekly panel review. Run 5 fresh prompts per panelist, collect "would keep" / "would edit" / "would throw out" plus a written note on what broke or surprised. Feed back into the weights.

**Shadow mode.** Before public launch, run `/recommend` in shadow against natural mood/theme queries from Crate's existing research sessions. Compare output to what users actually engaged with.

### 3.10 Known open questions (to resolve during implementation)

1. **How far out does NER reach?** Should mentions of producers, collaborators, or samples count as edges, or only artists-as-subjects? Current design: artists only. Producers might be worth a separate edge type later.

2. **What's the aging function on reviews?** A 2004 Pitchfork review and a 2024 Pitchfork review shouldn't weight the same, but 20-year-old reviews of canonical albums matter more than recent hot takes for some artists. Needs empirical tuning.

3. **Is there a minimum review count for inclusion?** An artist with one review has an unreliable profile vector. Floor at 2? 3? Tradeoff: exclusion vs. noise.

4. **Should steering chips be static or generated?** Claude could generate contextually relevant chips per tour ("More early-period work," "Less US-centric"). Dynamic is better but costs a call. Phase 2 decision.

5. **How does `/recommend` interact with Crate's existing artist pages?** Probably: every tour artist name is a link that opens that artist's Crate page with the provenance source pre-loaded.

6. **Publication takedowns.** What's the policy if a Tier 1 publication asks us to stop ingesting? Pre-plan: graceful degrade, remove that publication's embeddings, recompute, note in artifact header if the query would have leaned on them.

---

## 4. Appendix — why this shape matters to music lovers

A recommender you can't argue with isn't a recommender, it's a slot machine. When Spotify plays you an artist you don't like, there's nothing to push back on — "the algorithm" is a black wall. When a well-read friend recommends an artist, you can ask *why* and get a real answer: "because you liked how X handled loss, and this record does the same thing but with more space."

That's what Crate's `/recommend` should be. Every artist in the tour arrives with a named sentence from a named critic in a named publication. You can agree with the critic, disagree, or go read the full review. You have something to think with.

The graph, the embeddings, the PPR — all machinery in service of being able to answer "why this artist?" with a sentence a human actually wrote. Every design choice above either preserves that answer or doesn't belong.
