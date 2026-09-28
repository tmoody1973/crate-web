/**
 * Mem0 client for persistent user memory across chat sessions.
 * Uses the Mem0 Platform REST API (https://docs.mem0.ai).
 *
 * Memory types used:
 * - User memory (user_id) — long-term preferences, tastes, habits
 * - Session memory (user_id + session_id) — current research context
 */

const MEM0_API = "https://api.mem0.ai/v1";

interface Mem0Memory {
  id: string;
  memory: string;
  created_at?: string;
  updated_at?: string;
  metadata?: Record<string, unknown>;
}

interface Mem0SearchResult {
  id: string;
  memory: string;
  score?: number;
  metadata?: Record<string, unknown>;
}

// ── Core API helpers ─────────────────────────────────────────────

async function mem0Fetch(
  path: string,
  apiKey: string,
  body: Record<string, unknown>,
): Promise<unknown> {
  const res = await fetch(`${MEM0_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Token ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mem0 API ${res.status}: ${text}`);
  }

  return res.json();
}

async function mem0Get(
  path: string,
  apiKey: string,
  params?: Record<string, string>,
): Promise<unknown> {
  const url = new URL(`${MEM0_API}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Token ${apiKey}` },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Mem0 API ${res.status}: ${text}`);
  }

  return res.json();
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Search user memories for relevant context.
 * Called at session start to load user preferences into the system prompt.
 */
export async function searchMemories(
  apiKey: string,
  userId: string,
  query: string,
  limit = 10,
): Promise<Mem0SearchResult[]> {
  try {
    const data = await mem0Fetch("/memories/search/", apiKey, {
      query,
      filters: { user_id: userId },
      limit,
    });
    // API returns array of results
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error("[mem0] search failed:", err);
    return [];
  }
}

/**
 * Add conversation messages to memory.
 * Mem0 auto-extracts facts and preferences from the conversation.
 * Called at session end or after significant exchanges.
 */
export async function addMemories(
  apiKey: string,
  userId: string,
  messages: Array<{ role: "user" | "assistant"; content: string }>,
  metadata?: Record<string, string>,
): Promise<void> {
  try {
    await mem0Fetch("/memories/", apiKey, {
      messages,
      user_id: userId,
      metadata,
    });
  } catch (err) {
    console.error("[mem0] add failed:", err);
  }
}

/**
 * Store a specific fact about the user.
 * Used by the agent's remember_about_user tool.
 */
export async function rememberFact(
  apiKey: string,
  userId: string,
  fact: string,
  category?: string,
): Promise<void> {
  try {
    await mem0Fetch("/memories/", apiKey, {
      messages: [{ role: "user", content: fact }],
      user_id: userId,
      metadata: category ? { category } : undefined,
    });
  } catch (err) {
    console.error("[mem0] remember failed:", err);
  }
}

/**
 * List all user memories, optionally filtered.
 */
export async function listMemories(
  apiKey: string,
  userId: string,
): Promise<Mem0Memory[]> {
  try {
    const data = await mem0Get("/memories/", apiKey, { user_id: userId });
    // API returns { results: [...] } or array directly
    if (Array.isArray(data)) return data;
    const obj = data as { results?: Mem0Memory[] };
    return obj.results ?? [];
  } catch (err) {
    console.error("[mem0] list failed:", err);
    return [];
  }
}

/**
 * Format memories into a system prompt section.
 * Used to inject user context at session start.
 */
export function formatMemoriesForPrompt(memories: Mem0SearchResult[]): string {
  if (memories.length === 0) return "";

  const facts = memories
    .map((m) => `- ${m.memory}`)
    .join("\n");

  return `
## User Context (from previous sessions)

The following facts were remembered about this user from past conversations.
Use this context to personalize your responses — reference their preferences,
avoid repeating questions they've already answered, and build on prior research.

${facts}
`.trim();
}

// ── Agent tool creators ──────────────────────────────────────────

import type { CrateToolDef } from "./tool-adapter";
import { z } from "zod";

/**
 * Create mem0 memory tools for the agent to use during conversations.
 * These let the agent explicitly remember facts and search user context.
 */
export function createMemoryTools(
  apiKey: string,
  userId: string,
): CrateToolDef[] {
  return [
    {
      name: "remember_about_user",
      description:
        "Remember a fact about the user for future sessions. Use when the user shares preferences, habits, or context that would be useful later. Examples: musical taste, collecting habits, DJ station, research interests.",
      inputSchema: {
        fact: z.string().describe("The fact to remember about the user"),
        category: z
          .enum([
            "taste_preferences",
            "collecting_focus",
            "active_projects",
            "research_expertise",
            "workflow_patterns",
            "personal_info",
          ])
          .optional()
          .describe("Category for organizing the memory"),
      },
      handler: async (args: { fact: string; category?: string }) => {
        await rememberFact(apiKey, userId, args.fact, args.category);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ status: "remembered", fact: args.fact }),
            },
          ],
        };
      },
    },
    {
      name: "get_user_context",
      description:
        "Search the user's memory for relevant context. Use at the start of research to check if you already know their preferences, or when they reference something from a past session.",
      inputSchema: {
        query: z
          .string()
          .describe("What to search for in user memory (e.g., 'music preferences', 'favorite genres')"),
      },
      handler: async (args: { query: string }) => {
        const results = await searchMemories(apiKey, userId, args.query);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                memories: results.map((r) => ({
                  fact: r.memory,
                  score: r.score,
                })),
                count: results.length,
              }),
            },
          ],
        };
      },
    },
    {
      name: "list_user_memories",
      description:
        "List all stored memories about the user. Use when the user asks 'what do you remember about me?' or wants to review their stored context.",
      inputSchema: {},
      handler: async () => {
        const memories = await listMemories(apiKey, userId);
        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                memories: memories.map((m) => ({
                  id: m.id,
                  fact: m.memory,
                  created: m.created_at,
                })),
                count: memories.length,
              }),
            },
          ],
        };
      },
    },
  ];
}
