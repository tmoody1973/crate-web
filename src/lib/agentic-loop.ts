/**
 * Manual agentic loop supporting both Anthropic (direct) and OpenAI (OpenRouter).
 *
 * Loop: send message → if tool_use → execute tools → send results → repeat → done.
 * Emits CrateEvents (same format as crate-cli) for SSE streaming to the frontend.
 */

import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import type { CrateToolDef, HandlerEntry } from "./tool-adapter";
import {
  buildAnthropicToolkit,
  buildOpenAIToolkit,
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
  message: string;
  systemPrompt: string;
  model: string;
  apiKey: string;
  /** When true, route through OpenRouter (OpenAI-compatible API) */
  useOpenRouter?: boolean;
  toolGroups: Array<{ serverName: string; tools: CrateToolDef[] }>;
  maxTurns?: number;
  signal?: AbortSignal;
}

// ── Shared helpers ────────────────────────────────────────────────

async function* executeTools(
  handlers: Map<string, HandlerEntry>,
  calls: Array<{ id: string; name: string; input: Record<string, unknown> }>,
): AsyncGenerator<CrateEvent | { _toolResult: { id: string; content: string } }> {
  for (const call of calls) {
    const bare = bareToolName(call.name);
    const server = serverFromToolName(call.name);

    yield { type: "tool_start", tool: bare, server, input: call.input };

    const start = Date.now();
    const result = await executeTool(handlers, call.name, call.input);
    const durationMs = Date.now() - start;

    const resultSummary = result.content.length > 200
      ? result.content.slice(0, 200) + "..."
      : result.content;

    yield { type: "tool_end", tool: bare, server: result.serverName, durationMs, resultSummary };
    yield { _toolResult: { id: call.id, content: result.content } };
  }
}

function emitText(text: string): CrateEvent[] {
  const events: CrateEvent[] = [{ type: "answer_start" }];
  const chunkSize = 20;
  for (let i = 0; i < text.length; i += chunkSize) {
    events.push({ type: "answer_token", token: text.slice(i, i + chunkSize) });
  }
  return events;
}

// ── Anthropic loop ────────────────────────────────────────────────

async function* anthropicLoop(
  options: AgenticLoopOptions,
): AsyncGenerator<CrateEvent> {
  const { message, systemPrompt, model, apiKey, maxTurns = 25, signal } = options;

  const client = new Anthropic({ apiKey });
  const { tools, handlers } = buildAnthropicToolkit(options.toolGroups);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: message },
  ];

  const startTime = Date.now();
  const toolsUsed: string[] = [];
  let toolCallCount = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) break;

    // When nearing the turn limit, nudge the model to produce final output
    const turnsRemaining = maxTurns - turn;
    const nudgeMessages = turnsRemaining <= 3 && turn > 0
      ? [...messages, {
          role: "user" as const,
          content: `[SYSTEM: You have ${turnsRemaining} turns left. Stop making tool calls and output your final response NOW. If you were asked to output OpenUI Lang, output the component immediately with the data you have.]`,
        }]
      : messages;

    const response = await client.messages.create(
      {
        model,
        max_tokens: 16384,
        system: systemPrompt,
        messages: nudgeMessages,
        tools: tools.length > 0 ? tools : undefined,
      },
      { signal },
    );

    // Emit text, collect tool_use blocks
    const toolCalls: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];

    for (const block of response.content) {
      if (block.type === "text" && block.text) {
        for (const ev of emitText(block.text)) yield ev;
      } else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, name: block.name, input: block.input as Record<string, unknown> });
      }
    }

    if (toolCalls.length === 0 || response.stop_reason === "end_turn") break;

    // If we're on the last turn, don't execute more tools — force output
    if (turnsRemaining <= 1) break;

    // Add assistant message
    messages.push({ role: "assistant", content: response.content });

    // Execute tools
    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for await (const ev of executeTools(handlers, toolCalls)) {
      if ("_toolResult" in ev) {
        toolResults.push({ type: "tool_result", tool_use_id: ev._toolResult.id, content: ev._toolResult.content });
      } else {
        if (ev.type === "tool_start" || ev.type === "tool_end") {
          const bare = "tool" in ev ? ev.tool : "";
          if (ev.type === "tool_start") toolCallCount++;
          if (ev.type === "tool_start" && !toolsUsed.includes(bare)) toolsUsed.push(bare);
        }
        yield ev;
      }
    }

    messages.push({ role: "user", content: toolResults });
  }

  yield { type: "done", totalMs: Date.now() - startTime, toolsUsed, toolCallCount, costUsd: 0 };
}

// ── OpenAI/OpenRouter loop ────────────────────────────────────────

async function* openRouterLoop(
  options: AgenticLoopOptions,
): AsyncGenerator<CrateEvent> {
  const { message, systemPrompt, model, apiKey, maxTurns = 25, signal } = options;

  const client = new OpenAI({
    apiKey,
    baseURL: "https://openrouter.ai/api/v1",
  });

  const { tools, handlers } = buildOpenAIToolkit(options.toolGroups);

  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: message },
  ];

  const startTime = Date.now();
  const toolsUsed: string[] = [];
  let toolCallCount = 0;

  for (let turn = 0; turn < maxTurns; turn++) {
    if (signal?.aborted) break;

    // When nearing the turn limit, nudge the model to produce final output
    const turnsRemaining = maxTurns - turn;
    const currentMessages = turnsRemaining <= 3 && turn > 0
      ? [...messages, {
          role: "user" as const,
          content: `[SYSTEM: You have ${turnsRemaining} turns left. Stop making tool calls and output your final response NOW. If you were asked to output OpenUI Lang, output the component immediately with the data you have.]`,
        }]
      : messages;

    const response = await client.chat.completions.create(
      {
        model,
        max_tokens: 16384,
        messages: currentMessages,
        tools: tools.length > 0 ? tools : undefined,
      },
      { signal },
    );

    const choice = response.choices[0];
    if (!choice) break;

    const assistantMsg = choice.message;

    // Emit text
    if (assistantMsg.content) {
      for (const ev of emitText(assistantMsg.content)) yield ev;
    }

    // Check for tool calls
    const toolCalls = assistantMsg.tool_calls ?? [];
    if (toolCalls.length === 0 || choice.finish_reason === "stop") break;

    // If we're on the last turn, don't execute more tools — force output
    if (turnsRemaining <= 1) break;

    // Add assistant message to history
    messages.push(assistantMsg);

    // Execute tools
    const parsedCalls = toolCalls
      .filter((tc): tc is Extract<typeof tc, { type: "function" }> => tc.type === "function")
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments || "{}") as Record<string, unknown>,
      }));

    for await (const ev of executeTools(handlers, parsedCalls)) {
      if ("_toolResult" in ev) {
        messages.push({
          role: "tool",
          tool_call_id: ev._toolResult.id,
          content: ev._toolResult.content,
        });
      } else {
        if (ev.type === "tool_start" || ev.type === "tool_end") {
          const bare = "tool" in ev ? ev.tool : "";
          if (ev.type === "tool_start") toolCallCount++;
          if (ev.type === "tool_start" && !toolsUsed.includes(bare)) toolsUsed.push(bare);
        }
        yield ev;
      }
    }
  }

  yield { type: "done", totalMs: Date.now() - startTime, toolsUsed, toolCallCount, costUsd: 0 };
}

// ── Public entry point ────────────────────────────────────────────

export async function* agenticLoop(
  options: AgenticLoopOptions,
): AsyncGenerator<CrateEvent> {
  if (options.useOpenRouter) {
    yield* openRouterLoop(options);
  } else {
    yield* anthropicLoop(options);
  }
}
