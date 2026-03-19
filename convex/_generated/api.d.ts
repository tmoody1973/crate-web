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
import type * as influence from "../influence.js";
import type * as keys from "../keys.js";
import type * as messages from "../messages.js";
import type * as orgKeys from "../orgKeys.js";
import type * as playlists from "../playlists.js";
import type * as published from "../published.js";
import type * as sessions from "../sessions.js";
import type * as subscriptions from "../subscriptions.js";
import type * as telegraph from "../telegraph.js";
import type * as usage from "../usage.js";
import type * as toolCalls from "../toolCalls.js";
import type * as tumblr from "../tumblr.js";
import type * as userSkills from "../userSkills.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  artifacts: typeof artifacts;
  collection: typeof collection;
  crates: typeof crates;
  influence: typeof influence;
  keys: typeof keys;
  messages: typeof messages;
  orgKeys: typeof orgKeys;
  playlists: typeof playlists;
  published: typeof published;
  sessions: typeof sessions;
  subscriptions: typeof subscriptions;
  telegraph: typeof telegraph;
  toolCalls: typeof toolCalls;
  usage: typeof usage;
  tumblr: typeof tumblr;
  userSkills: typeof userSkills;
  users: typeof users;
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
