import { auth } from "@clerk/nextjs/server";
import { resolveUserKeys } from "@/lib/resolve-user-keys";
import { preprocessSlashCommand, isChatTier } from "@/lib/chat-utils";
import { agenticLoop } from "@/lib/agentic-loop";
import type { CrateEvent } from "@/lib/agentic-loop";
import { createTelegraphTools } from "@/lib/web-tools/telegraph";
import { createTumblrTools } from "@/lib/web-tools/tumblr";
import { createImageTools } from "@/lib/web-tools/images";
import { createInfluenceCacheTools } from "@/lib/web-tools/influence-cache";
import { createInfographicTools } from "@/lib/web-tools/infographic";
import { createRadioTools } from "@/lib/web-tools/radio";
import type { Id } from "../../../../convex/_generated/dataModel";

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

const CHAT_SYSTEM =
  "You are Crate, an AI music research assistant. For casual conversation, be friendly and brief. Mention that you can help with music research — artists, samples, vinyl, concerts, genres, and more.";

/** Fast direct API call for chat-tier messages — no tools, ~1-2s response. */
async function streamChatDirect(
  message: string,
  apiKey: string,
  modelId: string,
  useOpenRouter?: boolean,
): Promise<Response> {
  // OpenRouter uses OpenAI format; Anthropic uses its own Messages format
  const url = useOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : "https://api.anthropic.com/v1/messages";

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(useOpenRouter
      ? { Authorization: `Bearer ${apiKey}` }
      : { "x-api-key": apiKey, "anthropic-version": "2023-06-01" }),
  };

  const body = useOpenRouter
    ? {
        model: modelId,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: "system", content: CHAT_SYSTEM },
          { role: "user", content: message },
        ],
      }
    : {
        model: modelId,
        max_tokens: 1024,
        stream: true,
        system: CHAT_SYSTEM,
        messages: [{ role: "user", content: message }],
      };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
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
              // Extract text from either Anthropic or OpenAI SSE format
              const text = useOpenRouter
                ? parsed.choices?.[0]?.delta?.content  // OpenAI format
                : parsed.delta?.text;                   // Anthropic format (content_block_delta)
              if (text) {
                controller.enqueue(
                  encoder.encode(sseEncode({ type: "answer_token", token: text })),
                );
              }
            } catch {
              /* skip unparseable lines */
            }
          }
        }
        controller.enqueue(
          encoder.encode(
            sseEncode({ type: "done", totalMs: 0, toolsUsed: [], toolCallCount: 0, costUsd: 0 }),
          ),
        );
        controller.enqueue(encoder.encode(sseEncode("[DONE]")));
      } catch (err) {
        controller.enqueue(
          encoder.encode(
            sseEncode({ type: "error", message: err instanceof Error ? err.message : "Stream error" }),
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
  convexUserId: string,
  useOpenRouter?: boolean,
  isResearchCommand?: boolean,
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

        const cliToolGroups = getActiveTools();

        // Replace SQLite-based tools with Convex-backed web versions
        const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
        const userId = convexUserId as Id<"users">;

        const webTelegraphTools = createTelegraphTools(convexUrl, userId);
        const webTumblrTools =
          envKeys.TUMBLR_CONSUMER_KEY && envKeys.TUMBLR_CONSUMER_SECRET
            ? createTumblrTools(
                convexUrl,
                userId,
                envKeys.TUMBLR_CONSUMER_KEY,
                envKeys.TUMBLR_CONSUMER_SECRET,
              )
            : [];

        // Image tools (Spotify + fanart.tv)
        const webImageTools =
          envKeys.SPOTIFY_CLIENT_ID && envKeys.SPOTIFY_CLIENT_SECRET
            ? createImageTools(
                envKeys.SPOTIFY_CLIENT_ID,
                envKeys.SPOTIFY_CLIENT_SECRET,
                envKeys.FANART_API_KEY,
              )
            : [];

        // Influence cache tools (Convex-backed, replaces SQLite influencecache)
        const webInfluenceCacheTools = createInfluenceCacheTools(convexUrl, userId);

        // Infographic generation (Gemini)
        const webInfographicTools =
          envKeys.GEMINI_API_KEY || process.env.GEMINI_API_KEY
            ? createInfographicTools(
                envKeys.GEMINI_API_KEY || process.env.GEMINI_API_KEY!,
                convexUrl,
                convexUserId,
              )
            : [];

        // Web radio tool (replaces crate-cli's mpv-based play_radio)
        const webRadioTools = createRadioTools();

        // Filter out crate-cli groups that use SQLite or mpv, inject web versions
        // For radio: keep crate-cli's search/browse/tags tools, replace play_radio
        const cliRadioGroup = cliToolGroups.find(
          (g: { serverName: string }) => g.serverName === "radio",
        );
        const cliRadioSearchTools = cliRadioGroup
          ? cliRadioGroup.tools.filter(
              (t: { name: string }) => t.name !== "play_radio",
            )
          : [];

        const allToolGroups = [
          ...cliToolGroups.filter(
            (g: { serverName: string }) =>
              g.serverName !== "telegraph" &&
              g.serverName !== "tumblr" &&
              g.serverName !== "influencecache" &&
              g.serverName !== "radio",
          ),
          // Radio: crate-cli search/browse/tags + web play_radio
          { serverName: "radio", tools: [...cliRadioSearchTools, ...webRadioTools] },
          ...(webTelegraphTools.length > 0
            ? [{ serverName: "telegraph", tools: webTelegraphTools }]
            : []),
          ...(webTumblrTools.length > 0
            ? [{ serverName: "tumblr", tools: webTumblrTools }]
            : []),
          ...(webImageTools.length > 0
            ? [{ serverName: "images", tools: webImageTools }]
            : []),
          { serverName: "influencecache", tools: webInfluenceCacheTools },
          ...(webInfographicTools.length > 0
            ? [{ serverName: "infographic", tools: webInfographicTools }]
            : []),
        ];

        // For research-heavy commands, only include relevant tool servers
        // to stay under the 200K token context limit (tool defs alone can be 80K+ tokens)
        const RESEARCH_SERVERS = new Set([
          "influence", "influencecache", "web-search", "musicbrainz",
          "genius", "lastfm", "discogs", "images", "infographic", "itunes",
        ]);
        const toolGroups = isResearchCommand
          ? allToolGroups.filter((g: { serverName: string }) => RESEARCH_SERVERS.has(g.serverName))
          : allToolGroups;

        // Build system prompt with soul + OpenUI prompt
        const { CRATE_SOUL } = await import("@/lib/soul");
        const { getCrateOpenUIPrompt } = await import("@/lib/openui/prompt");
        const systemPrompt = `${getSystemPrompt()}\n\n${CRATE_SOUL}\n\n${getCrateOpenUIPrompt()}`;

        // Run the agentic loop
        // Research commands get more turns since they need tool calls + final output
        const events = agenticLoop({
          message,
          systemPrompt,
          model: modelId,
          apiKey,
          useOpenRouter,
          toolGroups,
          maxTurns: isResearchCommand ? 35 : 25,
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

  // Determine API key and routing
  const useOpenRouter = hasOpenRouter && !hasAnthropic;
  const apiKey = hasAnthropic ? rawKeys.anthropic : rawKeys.openrouter;

  // Force Sonnet for research-heavy commands that need deep tool use + structured output
  const isResearchCommand = /^\/(?:influence|show-prep|prep|news)\b/i.test(rawMessage.trim());

  // Anthropic direct API → OpenRouter model ID mapping
  // Anthropic uses dashes (claude-sonnet-4-6), OpenRouter uses dots (anthropic/claude-sonnet-4.6)
  const ANTHROPIC_TO_OPENROUTER: Record<string, string> = {
    "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
    "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
    "claude-opus-4-6": "anthropic/claude-opus-4.6",
  };

  const rawModelId = isResearchCommand
    ? "claude-sonnet-4-6"
    : (model || "claude-haiku-4-5-20251001");

  // Map Anthropic model IDs to OpenRouter format when needed
  const modelId = useOpenRouter && !rawModelId.includes("/")
    ? (ANTHROPIC_TO_OPENROUTER[rawModelId] ?? `anthropic/${rawModelId}`)
    : rawModelId;

  // Chat-tier: fast direct call (no tools)
  if (isChatTier(message)) {
    return streamChatDirect(message, apiKey, modelId, useOpenRouter);
  }

  // Agent-tier: full agentic loop with tools
  // Merge user keys + embedded keys for tool access
  const allEnvKeys = { ...embeddedKeys, ...userEnvKeys };
  return streamAgenticResponse(message, apiKey, modelId, allEnvKeys, resolved.user._id, useOpenRouter, isResearchCommand);
}
