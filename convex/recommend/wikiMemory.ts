/**
 * Wiki memory reader — pulls the user's past keep/pass signals from the
 * Music Wiki to inject as taste context into the Perplexity prompt.
 *
 * Per v1-scope.md Cherry-pick #7 (Legible Wiki-mediated self-improvement):
 * "Next tour reads Wiki as Perplexity prompt context. 'You kept this before'
 * badge on influenced picks."
 *
 * For v1, the Wiki schema doesn't yet have a `tourHistory` field on each
 * wikiPage — that's a schema extension landing in the UI chunks when the
 * keep/pass/save buttons ship. For now, this module returns empty arrays
 * so the main action can already consume the wiki-memory interface without
 * blocking on the schema change.
 *
 * When the UI ships and populates tourHistory, swap the empty-array body
 * here with a real query over wikiPages.sections (or a dedicated
 * tourHistory table). The main action's contract doesn't change.
 */

import { v } from "convex/values";
import { internalQuery } from "../_generated/server";

export type WikiMemory = {
  /** Artist names the user has "kept" in past tours of similar intent. */
  keptArtistNames: string[];
  /** Artist names the user has "passed" on in similar contexts. */
  passedArtistNames: string[];
};

export const getWikiMemoryForIntent = internalQuery({
  args: {
    userId: v.id("users"),
    intentType: v.string(),
  },
  handler: async (_ctx, _args): Promise<WikiMemory> => {
    // TODO: implement real query once keep/pass UI lands and populates
    // wikiPages.tourHistory (chunk 6). Until then, every tour starts with
    // a clean slate. The main action already wires this correctly; it just
    // has no memory to pull yet.
    return {
      keptArtistNames: [],
      passedArtistNames: [],
    };
  },
});
