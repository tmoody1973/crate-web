/**
 * One-off data migrations for /recommend tours.
 *
 * Run from the project root:
 *   bunx convex run recommend/migrations:stripUnverifiedQuotes '{"dryRun":true}'
 *   bunx convex run recommend/migrations:stripUnverifiedQuotes '{"dryRun":false}'
 *
 * Start with dryRun: true to preview the impact before mutating data.
 *
 * Scale note: `.collect()` on artifactsRecommend is fine while the tour
 * count stays under ~500. Above that, switch to an internalAction that
 * paginates with `.paginate({ cursor, numItems: 100 })` and dispatches
 * per-batch mutations to stay under Convex's ~8MB read / ~8k write
 * transaction limits. The rest of the logic ports cleanly.
 */

import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const SAMPLE_LIMIT = 20;

type QuoteStrip = {
  slug: string;
  artistName: string;
  previousUrl: string;
};

export const stripUnverifiedQuotes = internalMutation({
  args: {
    dryRun: v.optional(v.boolean()),
  },
  handler: async (ctx, { dryRun = true }) => {
    const tours = await ctx.db.query("artifactsRecommend").collect();

    const stripped: QuoteStrip[] = [];
    let toursTouched = 0;

    for (const tour of tours) {
      const before = stripped.length;

      const nextArtists = tour.artists.map((artist) => {
        if (!artist.quote || artist.quote.verified !== false) return artist;
        stripped.push({
          slug: tour.slug,
          artistName: artist.name,
          previousUrl: artist.quote.url,
        });
        const { quote: _quote, ...rest } = artist;
        return rest;
      });

      if (stripped.length === before) continue;
      toursTouched += 1;
      if (dryRun) continue;

      await ctx.db.patch(tour._id, { artists: nextArtists });
    }

    return {
      dryRun,
      toursScanned: tours.length,
      toursTouched,
      quotesStripped: stripped.length,
      sample: stripped.slice(0, SAMPLE_LIMIT),
    };
  },
});
