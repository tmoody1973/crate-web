# Crate `/recommend` — Phase 1 ingestion pipeline

This module ingests music review corpora into Convex: fetches reviews from a publication, extracts artist mentions with Claude Haiku, embeds the text with Voyage, writes reviews and artist edges to the graph.

## Shape

```
discover  →  fetch  →  extract  →  embed  →  write
(per pub)    (one URL)  (NER)       (Voyage)   (Convex)
```

Each stage is a separate Convex action or mutation so the scheduler can fan out and failures in one review don't poison the batch.

## Files

| File | Role |
|---|---|
| `publications/types.ts` | Adapter interface — what every publication adapter must implement |
| `publications/pitchfork.ts` | Reference adapter. Pattern for adding others. |
| `publications/registry.ts` | Adapter registry keyed by slug |
| `pipeline.ts` | The five stages, as Convex actions/mutations |
| `prompts.ts` | Claude Haiku NER prompt + output schema |

## Running a backfill

From a Convex dashboard or CLI:

```ts
// Tier 1, full backfill
await ctx.scheduler.runAfter(0, internal.ingestion.pipeline.backfillPublication, {
  pubSlug: "pitchfork",
  limit: null,  // all reviews
});
```

Pass `limit: 100` first to sanity-check. The action enqueues per-review jobs; monitor in the Convex dashboard.

## Running the nightly delta

Handled by `crons.ts` (not included here — add the cron to your existing `convex/crons.ts`):

```ts
crons.daily("corpus refresh", { hourUTC: 9, minuteUTC: 0 }, internal.ingestion.pipeline.nightlyDelta, {});
```

9:00 UTC = 03:00 Central. Every Tier 1/2 publication gets checked for new reviews since the last run.

## Adding a new publication

Implement `PublicationAdapter` for the publication, register it in `registry.ts`. That's it — the pipeline doesn't care which publication it's running against.

Start with the publication's RSS feed if it exists and is complete enough. For backfill, go to their XML sitemap or the Internet Archive's Wayback CDX API — don't hammer the live site.

Per-publication adapter checklist:
1. Confirm RSS URL and how much history it carries. If RSS returns only last 50 items, plan a sitemap-based backfill.
2. Inspect the HTML of a current review. Pin the CSS selectors for title, artist, author, published date, body. Note: these break. Budget for breakage.
3. Decide on title → `primary_artist_name` heuristic (Pitchfork uses "Artist: Album", Bandcamp Daily uses "Artist's 'Album' Is ...", The Quietus varies).
4. Test parse against 5 recent reviews and 5 older reviews.
5. Set `authority_weight` on the `publications` row (default 1.0).

## What this code does *not* do yet

- **Deduplication across publications.** If Pitchfork and NPR both review the same album, you get two reviews in the corpus. That's usually correct (two critics, two perspectives = two edges). But cross-publication MinHash dedup is a Phase 2 thing if syndication becomes an issue.
- **Wayback/archive backfill.** Adapters here ingest from live RSS + sitemaps. For pre-RSS archives, you'll need a Wayback CDX adapter variant. Patterned after the same interface.
- **Artist disambiguation.** If Haiku extracts "MGMT" and later "M.G.M.T.", normalization catches that, but two different artists both named "Galaxy" won't be separated without a MusicBrainz round-trip. We call MB; if it returns a clean single hit, we use that ID. Ambiguous MB responses get logged and left as separate records.
- **Retry/backoff.** Convex actions retry by default. For external API failures (Voyage, Anthropic, publisher 503s), the stage re-enqueues itself with a 30s delay. Good enough for v1.

## Tuning knobs

Everything tunable lives in `pipeline.ts` as `const` at the top of the file:

- `NER_CHUNK_TOKENS = 3000` — Haiku input size per review (we chunk long reviews)
- `EMBED_BATCH_SIZE = 96` — Voyage batch ceiling (their API caps at 128)
- `DISCOVER_CONCURRENCY = 2` — parallel fetches per publication
- `RATE_LIMIT_MS_PER_PUB = 1200` — min ms between fetches against one publication
- `EDGE_WEIGHT_POSITION_BOOST = 1.5` — multiplier for artist mentions in first paragraph

## Dependencies to add

```json
{
  "cheerio": "^1.0.0",
  "voyageai": "^0.0.3",
  "fast-xml-parser": "^4.5.0"
}
```

Anthropic SDK and Convex are assumed present.
