/**
 * Converts crate-cli's SdkMcpToolDefinition (Zod schemas + handlers) to
 * API tool definitions for both Anthropic and OpenAI (OpenRouter) formats.
 *
 * Also provides a tool executor that dispatches tool_use blocks to the
 * correct handler.
 */

import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { z } from "zod";

/**
 * Shape of a tool from crate-cli's tool-registry (SdkMcpToolDefinition).
 * We declare our own interface to avoid importing the Agent SDK at runtime.
 */
export interface CrateToolDef {
  name: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: any, extra: unknown) => Promise<{
    content: Array<{ type: string; text?: string; [key: string]: unknown }>;
    [key: string]: unknown;
  }>;
}

export interface ToolGroup {
  serverName: string;
  tools: CrateToolDef[];
}

/** Shared handler map entry. */
export interface HandlerEntry {
  handler: CrateToolDef["handler"];
  serverName: string;
}

/** Get JSON Schema (without $schema key) for a tool's input. */
function getInputJsonSchema(tool: CrateToolDef): Record<string, unknown> {
  const zodObject = z.object(tool.inputSchema);
  const jsonSchema = z.toJSONSchema(zodObject) as Record<string, unknown>;
  const { $schema: _, ...rest } = jsonSchema;
  return rest;
}

/** Prefix tool name with server: mcp__{server}__{tool} */
function prefixName(serverName: string, toolName: string): string {
  return `mcp__${serverName}__${toolName}`;
}

// ── Anthropic format ──────────────────────────────────────────────

export function buildAnthropicToolkit(toolGroups: ToolGroup[]): {
  tools: Anthropic.Tool[];
  handlers: Map<string, HandlerEntry>;
} {
  const tools: Anthropic.Tool[] = [];
  const handlers = new Map<string, HandlerEntry>();

  for (const group of toolGroups) {
    for (const tool of group.tools) {
      const name = prefixName(group.serverName, tool.name);
      const schema = getInputJsonSchema(tool);
      tools.push({
        name,
        description: tool.description,
        input_schema: {
          type: "object" as const,
          properties: schema.properties as Record<string, unknown> ?? {},
          required: schema.required as string[] | undefined,
        },
      });
      handlers.set(name, { handler: tool.handler, serverName: group.serverName });
    }
  }

  return { tools, handlers };
}

// ── OpenAI format (for OpenRouter) ────────────────────────────────

export function buildOpenAIToolkit(toolGroups: ToolGroup[]): {
  tools: OpenAI.ChatCompletionTool[];
  handlers: Map<string, HandlerEntry>;
} {
  const tools: OpenAI.ChatCompletionTool[] = [];
  const handlers = new Map<string, HandlerEntry>();

  for (const group of toolGroups) {
    for (const tool of group.tools) {
      const name = prefixName(group.serverName, tool.name);
      const schema = getInputJsonSchema(tool);
      tools.push({
        type: "function",
        function: {
          name,
          description: tool.description,
          parameters: {
            type: "object",
            properties: schema.properties ?? {},
            required: schema.required ?? [],
          },
        },
      });
      handlers.set(name, { handler: tool.handler, serverName: group.serverName });
    }
  }

  return { tools, handlers };
}

// ── Shared utilities ──────────────────────────────────────────────

/**
 * Execute a tool by its prefixed name.
 * Returns the tool result content as a string.
 */
export async function executeTool(
  handlers: Map<string, HandlerEntry>,
  toolName: string,
  toolInput: Record<string, unknown>,
): Promise<{ content: string; serverName: string }> {
  const entry = handlers.get(toolName);
  if (!entry) {
    return {
      content: JSON.stringify({ error: `Unknown tool: ${toolName}` }),
      serverName: "unknown",
    };
  }

  try {
    const result = await entry.handler(toolInput, {});
    const text = result.content
      .filter((c) => c.type === "text")
      .map((c) => c.text)
      .join("\n");
    return { content: text, serverName: entry.serverName };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Tool execution failed";
    return {
      content: JSON.stringify({ error: message }),
      serverName: entry.serverName,
    };
  }
}

/** Strip the mcp__{server}__ prefix to get the bare tool name. */
export function bareToolName(prefixedName: string): string {
  const parts = prefixedName.split("__");
  return parts.length >= 3 ? parts.slice(2).join("__") : prefixedName;
}

/** Extract server name from mcp__{server}__{tool}. */
export function serverFromToolName(prefixedName: string): string {
  const parts = prefixedName.split("__");
  return parts.length >= 3 ? (parts[1] ?? "unknown") : "unknown";
}
