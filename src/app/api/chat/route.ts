import { auth } from "@clerk/nextjs/server";
import { resolveUserKeys } from "@/lib/resolve-user-keys";
import { preprocessSlashCommand, isChatTier } from "@/lib/chat-utils";
import { agenticLoop } from "@/lib/agentic-loop";
import type { CrateEvent } from "@/lib/agentic-loop";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
  "X-Accel-Buffering": "no",
} as const;

/** Write a CrateEvent as an SSE data line. */
function sseEncode(event: CrateEvent | string): string {
  if (typeof event === "string") return `data: ${event}\n\n`;
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Fast direct API call for chat-tier messages — no tools, ~1-2s response. */
async function streamChatDirect(
  message: string,
  apiKey: string,
  modelId: string,
  baseURL?: string,
): Promise<Response> {
  const isOpenRouter = !!baseURL;
  const url = isOpenRouter
    ? `${baseURL}/v1/messages`
    : "https://api.anthropic.com/v1/messages";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // OpenRouter uses Bearer auth; Anthropic uses x-api-key
      ...(isOpenRouter
        ? { Authorization: `Bearer ${apiKey}` }
        : { "x-api-key": apiKey }),
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      stream: true,
      system:
        "You are Crate, an AI music research assistant. For casual conversation, be friendly and brief. Mention that you can help with music research — artists, samples, vinyl, concerts, genres, and more.",
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok || !res.body) {
    return new Response(
      sseEncode({ type: "error", message: `API error: ${res.status}` }) +
        sseEncode("[DONE]"),
      { headers: SSE_HEADERS },
    );
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const reader = res.body.getReader();

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.text
              ) {
                controller.enqueue(
                  encoder.encode(
                    sseEncode({ type: "answer_token", token: parsed.delta.text }),
                  ),
                );
              }
            } catch {
              /* skip unparseable lines */
            }
          }
        }
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: "done",
              totalMs: 0,
              toolsUsed: [],
              toolCallCount: 0,
              costUsd: 0,
            }),
          ),
        );
        controller.enqueue(encoder.encode(sseEncode("[DONE]")));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEncode({
              type: "error",
              message: err instanceof Error ? err.message : "Stream error",
            }),
          ),
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

/**
 * Stream an agentic research response.
 * Loads tools from crate-cli, runs the agentic loop, emits CrateEvents as SSE.
 */
async function streamAgenticResponse(
  message: string,
  apiKey: string,
  modelId: string,
  envKeys: Record<string, string>,
  baseURL?: string,
): Promise<Response> {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Set env vars so crate-cli's getActiveTools() sees the user's keys
        const envSnapshot: Record<string, string | undefined> = {};
        for (const [key, value] of Object.entries(envKeys)) {
          envSnapshot[key] = process.env[key];
          process.env[key] = value;
        }

        // Dynamic import to avoid loading crate-cli at module scope
        // (it has side effects that read process.env)
        const { getActiveTools } = await import(
          "crate-cli/dist/servers/tool-registry.js"
        );
        const { getSystemPrompt } = await import(
          "crate-cli/dist/agent/system-prompt.js"
        );

        const toolGroups = getActiveTools();

        // Build system prompt with soul + OpenUI prompt
        const { CRATE_SOUL } = await import("@/lib/soul");
        const { getCrateOpenUIPrompt } = await import("@/lib/openui-prompt");
        const systemPrompt = `${getSystemPrompt()}\n\n${CRATE_SOUL}\n\n${getCrateOpenUIPrompt()}`;

        // Run the agentic loop
        const events = agenticLoop({
          message,
          systemPrompt,
          model: modelId,
          apiKey,
          baseURL,
          toolGroups,
          maxTurns: 25,
        });

        for await (const event of events) {
          controller.enqueue(encoder.encode(sseEncode(event)));
        }

        controller.enqueue(encoder.encode(sseEncode("[DONE]")));

        // Restore env vars
        for (const [key, original] of Object.entries(envSnapshot)) {
          if (original === undefined) {
            delete process.env[key];
          } else {
            process.env[key] = original;
          }
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Agent error";
        console.error("[chat/agentic] error:", err);
        controller.enqueue(
          encoder.encode(sseEncode({ type: "error", message })),
        );
        controller.enqueue(encoder.encode(sseEncode("[DONE]")));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}

// Allow up to 300s for research queries with many tool calls
export const maxDuration = 300;

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  let resolved;
  try {
    resolved = await resolveUserKeys(clerkId);
  } catch {
    return new Response(
      JSON.stringify({ error: "User not found" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const { rawKeys, userEnvKeys, embeddedKeys, hasAnthropic, hasOpenRouter } =
    resolved;

  if (!hasAnthropic && !hasOpenRouter) {
    return new Response(
      JSON.stringify({
        error:
          "An Anthropic or OpenRouter API key is required. Add one in Settings.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  let body: { message?: string; model?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid JSON body" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const { message: rawMessage, model } = body;
  if (!rawMessage || typeof rawMessage !== "string") {
    return new Response(
      JSON.stringify({ error: "message field is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Slash command preprocessing
  const message = preprocessSlashCommand(rawMessage);

  // Determine API key and base URL
  // OpenRouter: base URL is https://openrouter.ai/api (SDK appends /v1/messages)
  // OpenRouter uses Authorization: Bearer, not x-api-key
  const useOpenRouter = hasOpenRouter && !hasAnthropic;
  const apiKey = hasAnthropic ? rawKeys.anthropic : rawKeys.openrouter;
  const baseURL = useOpenRouter ? "https://openrouter.ai/api" : undefined;

  const modelId = model || "claude-haiku-4-5-20251001";

  // Chat-tier: fast direct call (no tools)
  if (isChatTier(message)) {
    return streamChatDirect(message, apiKey, modelId, baseURL);
  }

  // Agent-tier: full agentic loop with tools
  // Merge user keys + embedded keys for tool access
  const allEnvKeys = { ...embeddedKeys, ...userEnvKeys };
  return streamAgenticResponse(message, apiKey, modelId, allEnvKeys, baseURL);
}
