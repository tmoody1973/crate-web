import { CrateAgent } from "crate-cli/dist/agent/index.js";
import type { CrateEvent } from "crate-cli/dist/agent/events.js";
import { getCrateOpenUIPrompt } from "./openui/prompt";

export type { CrateEvent };

/**
 * Create a CrateAgent with user's API keys + embedded fallbacks.
 * Uses the keys constructor option -- no process.env mutation, concurrency-safe.
 * Injects OpenUI Lang system prompt so the LLM can generate structured UI components.
 */
export function createAgent(
  userKeys: Record<string, string>,
  embeddedKeys: Record<string, string>,
): CrateAgent {
  const allKeys = { ...embeddedKeys, ...userKeys };
  const agent = new CrateAgent({
    model: "claude-sonnet-4-6",
    keys: allKeys,
    skipPlanning: true,
  });
  agent.setPromptSuffix(getCrateOpenUIPrompt());
  return agent;
}
