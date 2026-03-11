import { CrateAgent } from "crate-cli/dist/agent/index.js";
import type { CrateEvent } from "crate-cli/dist/agent/events.js";

export type { CrateEvent };

/**
 * Create a CrateAgent with user's API keys + embedded fallbacks.
 * Uses the keys constructor option -- no process.env mutation, concurrency-safe.
 */
export function createAgent(
  userKeys: Record<string, string>,
  embeddedKeys: Record<string, string>,
): CrateAgent {
  const allKeys = { ...embeddedKeys, ...userKeys };
  return new CrateAgent({
    model: "claude-sonnet-4-6",
    keys: allKeys,
  });
}
