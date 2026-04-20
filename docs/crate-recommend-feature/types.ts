// convex/ingestion/publications/types.ts
//
// The contract every publication adapter implements. Keeping this small means
// we can add a new publication without touching pipeline code.

export type DiscoveredReview = {
  url: string;
  // Best-effort published timestamp from the feed/sitemap. Used to skip
  // already-ingested items without fetching. If unavailable, the pipeline
  // will still fetch and dedup by body hash.
  published_at_estimate?: number;
  // Optional hint — some publications put album/artist in the feed title.
  title_hint?: string;
};

export type ParsedReview = {
  url: string;                        // as fetched
  canonical_url: string;              // normalized (strip trailing slash, query params)
  published_at: number;               // epoch millis
  title: string;                      // headline or album title
  primary_artist_name: string;        // best guess at review subject
  author?: string;
  body: string;                       // plain text, HTML stripped
  body_hash: string;                  // sha256(normalized body)
};

export type PublicationAdapter = {
  slug: string;                       // "pitchfork", "the-quietus"
  displayName: string;
  baseUrl: string;

  // Find new review URLs. If `since` is provided, should only return
  // URLs with published_at_estimate > since (or all if unsure — pipeline
  // dedupes downstream). Called by the nightly cron and the backfill.
  discover(args: { since?: number; limit?: number }): Promise<DiscoveredReview[]>;

  // Parse a fetched HTML document. Throw if the review isn't a review
  // (e.g., fetched a list page by mistake). Throwing is caught upstream
  // and logged; one bad parse doesn't kill the batch.
  parse(html: string, url: string): ParsedReview;

  // Optional per-publication rate limit override in ms between fetches.
  // Defaults to RATE_LIMIT_MS_PER_PUB in pipeline.ts.
  minFetchIntervalMs?: number;
};
