/**
 * Converts crate-cli's SdkMcpToolDefinition (Zod schemas + handlers) to
 * Anthropic Messages API tool definitions (JSON Schema).
 *
 * Also provides a tool executor that dispatches tool_use blocks to the
 * correct handler.
 */

import type Anthropic from "@anthropic-ai/sdk";
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

/**
 * Convert a single CrateToolDef to an Anthropic API Tool definition.
 * Prefixes the tool name with the server name (mcp__{server}__{tool}).
 */
function toAnthropicTool(
  serverName: string,
  tool: CrateToolDef,
): Anthropic.Tool {
  // Build a Zod object from the raw shape, then use Zod 4's native toJSONSchema
  const zodObject = z.object(tool.inputSchema);
  const jsonSchema = z.toJSONSchema(zodObject) as Record<string, unknown>;

  // Remove $schema key — Anthropic API doesn't accept it
  const { $schema: _, ...schemaWithoutDollarSchema } = jsonSchema;

  return {
    name: `mcp__${serverName}__${tool.name}`,
    description: tool.description,
    input_schema: {
      type: "object" as const,
      properties: schemaWithoutDollarSchema.properties as Record<string, unknown> ?? {},
      required: schemaWithoutDollarSchema.required as string[] | undefined,
    },
  };
}

/**
 * Convert all active tool groups to Anthropic API tool definitions.
 * Returns both the tool definitions (for the API) and a handler map (for execution).
 */
export function buildToolkit(toolGroups: ToolGroup[]): {
  tools: Anthropic.Tool[];
  handlers: Map<string, { handler: CrateToolDef["handler"]; serverName: string }>;
} {
  const tools: Anthropic.Tool[] = [];
  const handlers = new Map<string, { handler: CrateToolDef["handler"]; serverName: string }>();

  for (const group of toolGroups) {
    for (const tool of group.tools) {
      const prefixedName = `mcp__${group.serverName}__${tool.name}`;
      tools.push(toAnthropicTool(group.serverName, tool));
      handlers.set(prefixedName, {
        handler: tool.handler,
        serverName: group.serverName,
      });
    }
  }

  return { tools, handlers };
}

/**
 * Execute a tool by its prefixed name.
 * Returns the tool result content as a string.
 */
export async function executeTool(
  handlers: Map<string, { handler: CrateToolDef["handler"]; serverName: string }>,
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
