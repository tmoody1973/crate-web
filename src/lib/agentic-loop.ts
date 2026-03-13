/**
 * Manual agentic loop using the direct Anthropic SDK.
 *
 * Replaces the Claude Agent SDK's `query()` subprocess with a simple loop:
 *   1. Send message to Anthropic Messages API (with tools)
 *   2. If response contains tool_use blocks → execute tools → send results → goto 1
 *   3. If response is end_turn → yield final answer → done
 *
 * Emits CrateEvents (same format as crate-cli) for SSE streaming to the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { CrateToolDef } from "./tool-adapter";
import {
  buildToolkit,
  executeTool,
  bareToolName,
  serverFromToolName,
} from "./tool-adapter";

/** CrateEvent types — matches crate-cli/dist/agent/events.d.ts exactly. */
export type CrateEvent =
  | { type: "thinking"; text: string }
  | { type: "tool_start"; tool: string; server: string; input: unknown }
  | { type: "tool_end"; tool: string; server: string; durationMs: number; resultSummary?: string }
  | { type: "answer_start" }
  | { type: "answer_token"; token: string }
  | { type: "done"; totalMs: number; toolsUsed: string[]; toolCallCount: number; costUsd: number }
  | { type: "error"; message: string }
  | { type: "plan"; tasks: Array<{ id: number; description: string; done: boolean }> };

export interface AgenticLoopOptions {
  /** User's message */
  message: string;
  /** System prompt */
  systemPrompt: string;
  /** Model ID */
  model: string;
  /** Anthropic API key */
  apiKey: string;
  /** Optional base URL (for OpenRouter) */
  baseURL?: string;
  /** Tool groups from crate-cli's getActiveTools() */
  toolGroups: Array<{ serverName: string; tools: CrateToolDef[] }>;
  /** Max agentic loop iterations (default 25) */
  maxTurns?: number;
  /** AbortSignal for cancellation */
  signal?: AbortSignal;
}

/**
 * Run the agentic loop, yielding CrateEvents.
 */
export async function* agenticLoop(
  options: AgenticLoopOptions,
): AsyncGenerator<CrateEvent> {
  const {
    message,
    systemPrompt,
    model,
    apiKey,
    baseURL,
    toolGroups,
    maxTurns = 25,
    signal,
  } = options;

  // OpenRouter uses Authorization: Bearer (authToken), not x-api-key
  const isOpenRouter = !!baseURL;
  const client = new Anthropic({
    apiKey: isOpenRouter ? "" : apiKey,
    ...(isOpenRouter ? { authToken: apiKey, baseURL } : {}),
  });

  const { tools, handlers } = buildToolkit(toolGroups);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: message },
  ];

  const startTime = Date.now();
  const toolsUsed: string[] = [];
  let toolCallCount = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) break;

    // Use non-streaming for tool turns, streaming only when producing text
    const response = await client.messages.create(
      {
        model,
        max_tokens: 16384,
        system: systemPrompt,
        messages,
        tools: tools.length > 0 ? tools : undefined,
      },
      { signal },
    );

    // Process content blocks
    const toolUseBlocks: Anthropic.ToolUseBlock[] = [];

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        // Stream text tokens (emit as individual tokens for SSE)
        yield { type: "answer_start" };
        // Split into chunks for streaming feel
        const chunkSize = 20;
        for (let i = 0; i < block.text.length; i += chunkSize) {
          yield { type: "answer_token", token: block.text.slice(i, i + chunkSize) };
        }
      } else if (block.type === "tool_use") {
        toolUseBlocks.push(block);
      }
    }

    // If no tool calls or stop_reason is end_turn, we're done
    if (toolUseBlocks.length === 0 || response.stop_reason === "end_turn") {
      break;
    }

    // Add assistant message to conversation
    messages.push({
      role: "assistant",
      content: response.content,
    });

    // Execute each tool and collect results
    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolUse of toolUseBlocks) {
      const bare = bareToolName(toolUse.name);
      const server = serverFromToolName(toolUse.name);

      toolCallCount++;
      if (!toolsUsed.includes(bare)) {
        toolsUsed.push(bare);
      }

      yield { type: "tool_start", tool: bare, server, input: toolUse.input };

      const toolStart = Date.now();
      const result = await executeTool(
        handlers,
        toolUse.name,
        toolUse.input as Record<string, unknown>,
      );
      const durationMs = Date.now() - toolStart;

      const resultSummary = result.content.length > 200
        ? result.content.slice(0, 200) + "..."
        : result.content;

      yield { type: "tool_end", tool: bare, server: result.serverName, durationMs, resultSummary };

      toolResults.push({
        type: "tool_result",
        tool_use_id: toolUse.id,
        content: result.content,
      });
    }

    // Add tool results to conversation
    messages.push({ role: "user", content: toolResults });
  }

  const totalMs = Date.now() - startTime;
  yield { type: "done", totalMs, toolsUsed, toolCallCount, costUsd: 0 };
}
