/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as artifacts from "../artifacts.js";
import type * as collection from "../collection.js";
import type * as crates from "../crates.js";
import type * as crons from "../crons.js";
import type * as influence from "../influence.js";
import type * as keys from "../keys.js";
import type * as messages from "../messages.js";
import type * as orgKeys from "../orgKeys.js";
import type * as playlists from "../playlists.js";
import type * as published from "../published.js";
import type * as rateLimits from "../rateLimits.js";
import type * as receipt from "../receipt.js";
import type * as recommend_admin from "../recommend/admin.js";
import type * as recommend_arcOrder from "../recommend/arcOrder.js";
import type * as recommend_citationVerify from "../recommend/citationVerify.js";
import type * as recommend_cleanup from "../recommend/cleanup.js";
import type * as recommend_diag from "../recommend/diag.js";
import type * as recommend_groundedQuote from "../recommend/groundedQuote.js";
import type * as recommend_haikuStructured from "../recommend/haikuStructured.js";
import type * as recommend_index from "../recommend/index.js";
import type * as recommend_intentClassify from "../recommend/intentClassify.js";
import type * as recommend_itunesArtwork from "../recommend/itunesArtwork.js";
import type * as recommend_migrations from "../recommend/migrations.js";
import type * as recommend_moderationClassify from "../recommend/moderationClassify.js";
import type * as recommend_mutations from "../recommend/mutations.js";
import type * as recommend_perplexityRecommend from "../recommend/perplexityRecommend.js";
import type * as recommend_pickSelector from "../recommend/pickSelector.js";
import type * as recommend_promptRedact from "../recommend/promptRedact.js";
import type * as recommend_promptTest from "../recommend/promptTest.js";
import type * as recommend_queryDecompose from "../recommend/queryDecompose.js";
import type * as recommend_slug from "../recommend/slug.js";
import type * as recommend_types from "../recommend/types.js";
import type * as recommend_voyageEmbed from "../recommend/voyageEmbed.js";
import type * as recommend_wikiMemory from "../recommend/wikiMemory.js";
import type * as recommend_youtubeResolve from "../recommend/youtubeResolve.js";
import type * as sessions from "../sessions.js";
import type * as shares from "../shares.js";
import type * as subscriptions from "../subscriptions.js";
import type * as telegraph from "../telegraph.js";
import type * as tinydeskCompanions from "../tinydeskCompanions.js";
import type * as toolCalls from "../toolCalls.js";
import type * as tumblr from "../tumblr.js";
import type * as usage from "../usage.js";
import type * as userSkills from "../userSkills.js";
import type * as users from "../users.js";
import type * as wiki from "../wiki.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  artifacts: typeof artifacts;
  collection: typeof collection;
  crates: typeof crates;
  crons: typeof crons;
  influence: typeof influence;
  keys: typeof keys;
  messages: typeof messages;
  orgKeys: typeof orgKeys;
  playlists: typeof playlists;
  published: typeof published;
  rateLimits: typeof rateLimits;
  receipt: typeof receipt;
  "recommend/admin": typeof recommend_admin;
  "recommend/arcOrder": typeof recommend_arcOrder;
  "recommend/citationVerify": typeof recommend_citationVerify;
  "recommend/cleanup": typeof recommend_cleanup;
  "recommend/diag": typeof recommend_diag;
  "recommend/groundedQuote": typeof recommend_groundedQuote;
  "recommend/haikuStructured": typeof recommend_haikuStructured;
  "recommend/index": typeof recommend_index;
  "recommend/intentClassify": typeof recommend_intentClassify;
  "recommend/itunesArtwork": typeof recommend_itunesArtwork;
  "recommend/migrations": typeof recommend_migrations;
  "recommend/moderationClassify": typeof recommend_moderationClassify;
  "recommend/mutations": typeof recommend_mutations;
  "recommend/perplexityRecommend": typeof recommend_perplexityRecommend;
  "recommend/pickSelector": typeof recommend_pickSelector;
  "recommend/promptRedact": typeof recommend_promptRedact;
  "recommend/promptTest": typeof recommend_promptTest;
  "recommend/queryDecompose": typeof recommend_queryDecompose;
  "recommend/slug": typeof recommend_slug;
  "recommend/types": typeof recommend_types;
  "recommend/voyageEmbed": typeof recommend_voyageEmbed;
  "recommend/wikiMemory": typeof recommend_wikiMemory;
  "recommend/youtubeResolve": typeof recommend_youtubeResolve;
  sessions: typeof sessions;
  shares: typeof shares;
  subscriptions: typeof subscriptions;
  telegraph: typeof telegraph;
  tinydeskCompanions: typeof tinydeskCompanions;
  toolCalls: typeof toolCalls;
  tumblr: typeof tumblr;
  usage: typeof usage;
  userSkills: typeof userSkills;
  users: typeof users;
  wiki: typeof wiki;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
