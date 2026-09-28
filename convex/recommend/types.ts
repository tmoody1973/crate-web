/**
 * Shared types for the /recommend pipeline.
 *
 * Intent types locked in CEO review Cherry-pick #6. See
 * docs/crate-recommend-feature/v1-scope.md.
 */

import { z } from "zod";

export const IntentType = z.enum([
  "mood_theme",
  "era_genre",
  "artist_similar",
  "activity",
  "emotional",
  "show_prep",
  "single_artist",
  "vague",
]);

export type IntentType = z.infer<typeof IntentType>;

/**
 * StructuredQuery — the classifier's output. The LLM parses the user's free
 * text into this shape. All fields after `intent_type` are optional hints the
 * per-intent Perplexity prompt builder can consume.
 */
export const StructuredQuery = z.object({
  intent_type: IntentType,
  mood: z
    .object({
      valence: z.number().min(-1).max(1),
      arousal: z.number().min(0).max(1),
    })
    .optional(),
  themes: z.array(z.string()).optional(),
  artist_hints: z.array(z.string()).optional(),
  era_hint: z.string().optional(),
  activity_hint: z.string().optional(),
  sonic_hints: z.array(z.string()).optional(),
  raw_text: z.string(),
});

export type StructuredQuery = z.infer<typeof StructuredQuery>;

/**
 * One artist in a generated tour. Published on /r/[slug] and rendered in the
 * tour artifact component. `quote.verified=true` means it survived both the
 * HEAD URL check and the quote-on-page substring match.
 */
export type TourArtist = {
  name: string;
  album?: string;
  year?: number;
  quote?: {
    text: string;
    publication: string;
    author?: string;
    url: string;
    verified: boolean;
  };
  youtubeTrackId?: string;
  arcPosition: number;
};

/**
 * Perplexity's structured output for one artist. What the classifier prompt
 * asks Perplexity to return per pick. Pre-verification — `quote` may still
 * be false once we run citation-verify.
 */
export const PerplexityArtistPick = z.object({
  name: z.string(),
  album: z.string().optional(),
  year: z.number().optional(),
  quote_text: z.string().optional(),
  quote_publication: z.string().optional(),
  quote_author: z.string().optional(),
  quote_url: z.string().optional(),
  relationship: z.string().optional(), // for graph write-back
  weight: z.number().optional(),
});

export type PerplexityArtistPick = z.infer<typeof PerplexityArtistPick>;

/**
 * Moderation classifier output. Empty `categories` array = approved.
 */
export const ModerationResult = z.object({
  categories: z.array(
    z.enum([
      "hate",
      "harassment",
      "self-harm",
      "sexual",
      "copyright",
      "prompt-injection",
    ]),
  ),
  reasoning: z.string().optional(),
});

export type ModerationResult = z.infer<typeof ModerationResult>;
