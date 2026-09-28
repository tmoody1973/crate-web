# How `/recommend` works — technology primer

*Companion to `crate-recommend-design-doc.md`. Written for a builder who doesn't live in ML papers but needs to explain the system on stage, to press, to partners, and to engineering candidates — and needs enough mental model to make architecture decisions during implementation.*

---

## The approach we're taking

**A-then-C sequencing.**

1. **Weeks 1–3 — ship Approach A silently as a prototype.** Perplexity-driven `/recommend`: ask Perplexity Sonar for 8–12 artists fitting the mood/theme, render as a Deep Cut artifact using existing OpenUI components, write shareable URLs via the `/cuts/[shareId]` pattern. No corpus. No graph. No embeddings. Do not publish the essay.
2. **Weeks 2–6 — unassisted user observation.** The missing validation data from `docs/PRODUCT_ANALYSIS.md`. Does anyone share a tour? Does anyone pay? Does anyone return?
3. **Week 6 decision point.** If demand is real → commit to Approach C (own the corpus, Voyage embeddings, NER, graph, PPR). Publish the essay alongside the first Tier 1 corpus release. If demand is weak → don't build C, pivot positioning. Two-way door preserved.

**The essay ("A music recommender that reads") is a promise. Promises have to be kept. It ships with C, not before.** Shipping A under the essay's banner is a positioning risk — Crate would be claiming to have read the critics while actually renting Perplexity's retrieval.

---

## The six concepts you need to understand

### 1. Embeddings (vectors) — the magic that makes prose searchable

**The radio analogy:** You know when you hear a new record and you can tell within 10 seconds that it lives in the same neighborhood as *Another Green World* — not because the BPM matches, but because something about the mood, the space, the intent is adjacent. Your brain did that match because it has a "taste vector" for Eno's record and it's comparing the new thing against that taste vector.

**What an embedding actually is:** A paragraph of prose gets fed to a model (Voyage, OpenAI, Cohere) and the model returns a list of about 1,024 numbers. That list is the paragraph's "location" in an abstract taste-space. Two paragraphs that *mean* similar things — "elegiac and spacious" vs "mournful, vast, patient" — land near each other in that space even though they share zero words. Two paragraphs that use the same words to mean different things ("dense electronic" describing techno vs. "dense electronic" describing IDM) land far apart.

```
  "elegiac, spacious"         ●
                                  ● "mournful, vast, patient"
                                        ● "sits with you"

                         "muscular, low-end heavy, relentless"   ●
                                                                      ● "club-ready, propulsive"
```

**Why this matters to `/recommend`:** A user types *"sad about the climate."* That sentence becomes a vector. You compare it to the vectors of every review in your corpus. The reviews that land nearby are the ones that were written in similar emotional terms — regardless of whether the critic used the word "climate." The match is semantic, not keyword.

**The UX implication:** The system answers questions it was never explicitly programmed to answer. You never defined "climate music" anywhere in code. The critics did it for you, in their prose, and the vectors surface it.

**The cost implication:** Voyage-3 is ~$0.06 per million tokens. Embedding the full Tier 1 corpus (~180K reviews × ~1,000 tokens = ~180M tokens) is ~$11 one-time. Live query embedding is ~$0.0001 per query. Embedding is the cheapest part of the system.

---

### 2. Retrieval — two strategies, different bets

**Strategy A (what Crate does today at `/i/`):** Ask Perplexity Sonar a question. Perplexity does its own retrieval against the live web and returns an answer with citations. You never index anything. You rent the reader.

**Strategy C (design doc):** Index your own corpus of reviews. When a query comes in, compute its embedding, run a similarity search against your index, get the top-N reviews. You are the reader.

```
  STRATEGY A (rent the reader — Perplexity)
  ─────────────────────────────────────────
  user query ──▶ Perplexity ──▶ the web ──▶ citations + answer
                                                     │
                                                     ▼
                                              Crate renders


  STRATEGY C (own the reader — Voyage + Convex vector index)
  ─────────────────────────────────────────────────────────
  corpus ──▶ embed offline ──▶ Convex vector index
                                       ▲
                                       │
  user query ──▶ embed ──────────────▶ nearest-neighbor search
                                       │
                                       ▼
                                top-50 reviews ──▶ seed artists ──▶ Crate renders
```

**The trade you're making:** A is faster to ship, zero-ops, and cheaper until you're at scale. C gives you control (which publications, which weighting), reproducibility (same query, same answer), and no external dependency. C is the moat; A is the MVP.

**What Convex gives you for free:** Convex has a native vector index — you declare a column as `vectorIndex({ vectorField, dimensions: 1024 })` in your schema and searches become one line: `ctx.vectorSearch("reviews", "by_embedding", { vector: qEmbed, limit: 50 })`. You do not need Pinecone, Weaviate, pgvector, or any of that. This is why the design doc stays inside Convex.

---

### 3. Named Entity Recognition — how you pull artist names out of prose

**The problem:** You have a Pitchfork review of MIKE's new record. Somewhere in paragraph 3 the critic writes "billy woods lurks in the margins here, as does Navy Blue, and the beats have that Earl Sweatshirt *Some Rap Songs* quality." You need the system to pull out `billy woods`, `Navy Blue`, `Earl Sweatshirt` as artist names — not "Navy Blue" as a color, not "*Some Rap Songs*" as an artist.

**Why traditional NER fails:** Classical NLP libraries (spaCy, NLTK) were trained on news corpora. They expect names to be capitalized properly. They choke on `billy woods` (lowercase), `clipping.` (ends with a period), `$uicideboy$` (dollar signs), `JPEGMAFIA` (all caps, looks like an acronym), `!!!` (punctuation).

**Why Haiku wins:** Give Claude Haiku a review, a 40-line prompt explaining the rules, and ask for JSON output. It returns:

```json
{
  "primary_subject": "MIKE",
  "mentioned_artists": [
    { "name": "billy woods", "position": "body", "salience": "comparison" },
    { "name": "Navy Blue", "position": "body", "salience": "comparison" },
    { "name": "Earl Sweatshirt", "position": "body", "salience": "central" }
  ]
}
```

Haiku has seen enough music writing during training to know `billy woods` is a rapper, not two regular words. Cost: ~$0.0015 per review. For 180K reviews, that's $270 one-time.

**What you're actually buying:** A pipeline that turns *every sentence about every artist* into structured data. Without this step, the graph doesn't exist — you just have a pile of prose.

---

### 4. The artist graph — how "who gets mentioned next to whom" becomes a recommender

**The move:** Every time a review of Artist A mentions Artist B, draw a directed edge `A → B`. Weight it by how prominent the mention is (first paragraph vs body vs passing list), how many times it appears, and which publication it's from.

Do this for 180K reviews. You get a graph with maybe 50K artist nodes and 500K–1M edges.

```
                   Arthur Russell
                   (hub — mentioned in 400+ reviews)
                          ▲  ▲  ▲
                          │  │  │
          Laurel Halo ────┘  │  └──── Julia Holter
                             │
                       Laurie Anderson
                             │
                             ▼
                      Meredith Monk ──────▶ Moor Mother
                                                 │
                                                 ▼
                                            ANOHNI ───▶ Weyes Blood
```

**What the graph structurally captures:** The critical consensus of the last 25 years. Who the critics think belongs in conversation with whom. That's the "map" the essay describes.

**Why directed edges matter:** A review of Julia Holter mentioning Laurie Anderson is not the same as a review of Laurie Anderson mentioning Julia Holter. The first happens all the time. The second almost never happens (Anderson predates Holter by decades). Direction tells you who's *reaching back* to whom.

---

### 5. Personalized PageRank — how you "walk" the graph to get a recommendation

**PageRank** is the algorithm that made Google. It's a way of asking: *if I'm randomly wandering this graph, following links, which nodes do I end up on most often?* Those nodes are "important."

**Personalized** PageRank adds one twist: *start the walk from a specific set of nodes* (the seeds). Now the important nodes are "important relative to my starting point."

**How it applies to `/recommend`:**

1. User types *"spacious and sad about the climate."*
2. That sentence becomes an embedding. You find the 50 reviews whose embeddings are closest. The artists those reviews are *about* become your seed set: maybe ANOHNI, Cassandra Jenkins, Hiroshi Yoshimura, Moor Mother, Weyes Blood.
3. Now run PageRank starting from those 5 seeds. The walker bounces around the graph following edges. At each step, the probability of following an edge is boosted if the destination artist's own "critical profile" is also close to the query embedding.
4. After 20–30 iterations the walker settles. The artists it visits most often that *aren't* seeds become your tour.

```
                    SEEDS (from semantic search)
                ANOHNI   Cassandra Jenkins   Moor Mother
                   │          │                  │
              (walks steered by "does this neighbor's critic prose
               also sound like 'spacious and sad about climate'?")
                   │          │                  │
                   ▼          ▼                  ▼
           Julianna Barwick  Tanya Tagaq   Hiroshi Yoshimura
                   │
                   ▼
             Colin Stetson  ◀── you would NEVER have guessed
                                this, but the critics connected
                                Stetson to Barwick to ANOHNI
                                in dozens of reviews
```

**This is the "explainable surprise" the design doc is chasing.** Collaborative filtering gives you picks that are near your listening history. PPR gives you picks that are near *the query* — via the critics' map. Those are different directions and often yield different artists.

---

### 6. MMR diversity + arc ordering — making a tour, not a list

**MMR (Maximal Marginal Relevance):** After PPR gives you 30 candidates, you don't just take the top 10 by score. If you did, you'd get 10 artists that all sound similar. Instead, you pick artists greedily: at each step, pick the highest-scoring candidate *penalized by how similar it is to picks you've already made.* This gives you 10 that span the space.

**Arc ordering:** Once you have your 10 picks, don't present them alphabetically or by score. Project each artist's profile vector onto a valence axis (how dark/light their critical reception is) and sort to produce an up-and-back curve: start low, build, pause, resolve. Same trick a DJ uses when sequencing a set.

```
  TOUR ORDERING AS AN ARC

  valence ▲
          │                   ●
          │              ●         ●
          │         ●                   ●
          │    ●                             ●
          │●                                    ●
          └──────────────────────────────────────▶ position
           1    2    3    4    5    6    7    8    9   10
          (entry)      (build)   (turn)      (reflective close)
```

The tour isn't a playlist. It's a *reading list* of artists to explore in sequence — each one introduced by a critic's sentence.

---

## Stage 1 (Approach A, weeks 1–3) — what you actually build and need to understand

A is Perplexity-driven. You're *not* indexing a corpus and *not* building a graph. You need to understand:

1. **How Perplexity's Sonar API works.** You send a prompt, it returns a JSON blob with `content` (the model's answer) and `citations` (an array of URLs it says backed the claims). It's doing retrieval + generation + citation internally. Already wired at `src/lib/perplexity-discover.ts`.
2. **How your Music Wiki works.** `convex/wikiPages` — each artist has a markdown-shaped entry with sections, sources, and a contradiction-tracking field. Already compounding per-user. `/recommend` outputs plug into it.
3. **How OpenUI renders artifacts.** `src/lib/openui/library.ts` has ~25 components. Starting combo for the tour artifact: `ReviewSourceCard` + `ArtistProfileCard` + `TrackList` + `ShowPrepPackage`.
4. **How Deep Cuts sharing works.** `/cuts/[shareId]` — artifact is written to the `shares` table, accessible to anyone with the link. Reuse this for `/recommend`'s share button.
5. **How ISR + Convex cache behave on Vercel.** First request generates + caches; subsequent requests serve from cache. Already done at `/i/[slug]` with `revalidate = 86400`.

**What you don't need yet:** Voyage, NER, the graph, PPR, MMR. Those all live in Stage 3.

---

## Stage 3 (Approach C, week 6+ if validated) — what you learn to build next

If demand is real, C layers on in roughly this order:

1. **Publication adapter + one source (Bandcamp Daily first, not Pitchfork — friendlier TOS, cleaner HTML, less legal heat).** `cheerio` for HTML parsing, `fast-xml-parser` for RSS. Ship one working adapter before adding more.
2. **Convex vector index on reviews.** Declare `.vectorIndex("by_embedding", { vectorField: "embedding", dimensions: 1024 })` in the schema. Write a Convex action that batches reviews to Voyage and stores the embeddings.
3. **Haiku NER as a Convex action.** Per-review, cached by body hash. Prompts from the design doc (`prompts.ts`) are already written.
4. **Edge writer.** Each NER result produces `N × (N-1)` directed edges. Upsert into `artist_edges` with weight accumulation.
5. **Seed search.** One semantic query against the Convex vector index returns the top-50 reviews. Dedupe by primary artist.
6. **PPR as a matrix op.** Build a sparse transition matrix in-memory per query (cheap — only the reachable subgraph, bounded by ~3 hops from seeds). Power-iterate 30 times. ~60 lines of code.
7. **MMR + arc ordering.** Pure functions, no state. ~40 lines combined.

**What you're NOT building in C:** A graph database. Convex tables are fine. A dedicated ML ops pipeline. Convex crons are fine. A distributed vector DB. Convex vector index handles it.

---

## How you'll explain it on stage / to press / to Spotify

Three sentences that stand up to a skeptical engineer:

> *"Crate converts every critic's review into a semantic vector and draws a graph of who-mentions-whom across 180K reviews. When you ask for 'something sad about the climate,' we find the reviews whose language matches yours, start a weighted random walk from those artists, and return ten artists whose critical reception genuinely fits — each one introduced by the exact sentence from the exact review that put them in the tour. We never use click data, collaborative filtering, or audio features. The substrate is the prose."*

That sentence holds up because every claim in it is verifiable in the code.

---

## Vocabulary cheat sheet

| Term | Plain-English meaning | Where it lives in the design doc |
|---|---|---|
| **Embedding / vector** | A list of ~1,024 numbers representing what a paragraph *means* | §2.3 Embedding layer |
| **Semantic search** | Find documents by meaning, not keyword match | §2.5 Seed search |
| **NER (Named Entity Recognition)** | Pulling proper nouns (artist names) out of prose | §2.1 Corpus layer, NER |
| **Graph node** | One artist | §2.2 Graph layer |
| **Directed edge** | "Review of A mentions B" — one-way arrow | §2.2 Graph layer |
| **Edge weight** | How strongly A is linked to B (compounded across reviews) | §2.1, `edgeWeightFor` in `prompts.ts` |
| **PageRank** | "If you randomly follow arrows, which nodes do you land on most?" | §2.6 Traversal |
| **Personalized PageRank (PPR)** | PageRank but start from a specific set of seeds | §2.6 Traversal |
| **MMR (Maximal Marginal Relevance)** | Greedy picker that trades relevance for diversity | §2.6 Tour assembly |
| **ISR (Incremental Static Regeneration)** | Cache the result; rebuild on a schedule | `/i/[slug]` already uses this |
| **Seed** | Starting artist for graph traversal | §2.5 Seed search |
| **Profile vector** | The average of every review *about* an artist — their "critical DNA" | §2.3 Artist profile vector |
| **Salience** | How prominently an artist is mentioned (central, comparison, passing, list_item) | `prompts.ts`, `NerResult` type |

---

## Known things to NOT do

- **Do not reinvent graph DBs.** Convex tables + indices are plenty for O(100K) nodes. You're not Facebook.
- **Do not chunk reviews for embedding.** Embed the whole review. Chunking destroys the "this is about one record" signal.
- **Do not use spaCy or NLTK for artist NER.** They'll mangle `billy woods`, `clipping.`, `MIKE`. Haiku handles these natively.
- **Do not hit live publisher sites at scale.** Wayback Machine for backfill, RSS for delta. Even then, respect rate limits (1 req/sec per publication max).
- **Do not ship C with one publication.** The editorial-legibility argument requires breadth. Minimum launch corpus: 4 Tier 1 publications spanning indie, electronic, Black music coverage, and jazz/experimental.
- **Do not in-memory rate-limit on Vercel serverless.** Each invocation gets its own memory. Use Convex or Upstash. (Already a known bug in `src/app/api/influence/expand/route.ts`.)

---

*This file is a living primer. Update with learnings from Stage 1 observation and any implementation surprises.*
