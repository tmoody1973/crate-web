import { auth } from "@clerk/nextjs/server";
import { resolveUserKeys } from "@/lib/resolve-user-keys";
import { preprocessSlashCommand, isChatTier, getGatedCommand } from "@/lib/chat-utils";
import { agenticLoop } from "@/lib/agentic-loop";
import type { CrateEvent } from "@/lib/agentic-loop";
import { createTelegraphTools } from "@/lib/web-tools/telegraph";
import { createTumblrTools } from "@/lib/web-tools/tumblr";
import { createImageTools } from "@/lib/web-tools/images";
import { createInfluenceCacheTools } from "@/lib/web-tools/influence-cache";
import { createInfographicTools } from "@/lib/web-tools/infographic";
import { createRadioTools } from "@/lib/web-tools/radio";
import { createWhoSampledTools } from "@/lib/web-tools/whosampled";
import { createBrowserTools } from "@/lib/web-tools/browser";
import { createBandcampWebTools } from "@/lib/web-tools/bandcamp";
import { createPrepResearchTools } from "@/lib/web-tools/prep-research";
import {
  searchMemories,
  addMemories,
  formatMemoriesForPrompt,
  createMemoryTools,
} from "@/lib/mem0-client";
import type { Id } from "../../../../convex/_generated/dataModel";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import {
  isAdmin,
  PLAN_LIMITS,
  PAST_DUE_GRACE_MS,
  checkRateLimit,
  RATE_LIMIT_AGENT_PER_MINUTE,
  RATE_LIMIT_CHAT_PER_MINUTE,
} from "@/lib/plans";
import type { PlanId } from "@/lib/plans";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

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
  history?: Array<{ role: "user" | "assistant"; content: string }>,
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
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
      }
    : {
        model: modelId,
        max_tokens: 1024,
        stream: true,
        system: CHAT_SYSTEM,
        messages: [
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
      };

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    let detail = "";
    try { detail = await res.text(); } catch { /* ignore */ }
    console.error(`[chat/direct] ${res.status} from ${url} model=${modelId}:`, detail);
    return new Response(
      sseEncode({ type: "error", message: `API error: ${res.status} — ${detail || "unknown"}` }) +
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
  clerkId: string,
  useOpenRouter?: boolean,
  isResearchCommand?: boolean,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
  hasMemory?: boolean,
  hasInfluenceWrite?: boolean,
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
        const webInfluenceCacheTools = createInfluenceCacheTools(
          convexUrl, userId, hasInfluenceWrite !== false,
        );

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

        // Mem0 memory tools (if API key available and plan allows)
        const mem0Key = envKeys.MEM0_API_KEY || process.env.MEM0_API_KEY;
        const webMemoryTools = mem0Key && hasMemory !== false
          ? createMemoryTools(mem0Key, clerkId)
          : [];

        // Perplexity-powered track research (show prep)
        const perplexityKey = envKeys.PERPLEXITY_API_KEY || process.env.PERPLEXITY_API_KEY;
        const webPrepResearchTools = perplexityKey
          ? createPrepResearchTools(perplexityKey)
          : [];

        // Kernel.sh browser tools (WhoSampled + browse/screenshot)
        const hasKernel = !!(envKeys.KERNEL_API_KEY || process.env.KERNEL_API_KEY);
        const webWhoSampledTools = hasKernel ? createWhoSampledTools() : [];
        const webBrowserTools = hasKernel ? createBrowserTools() : [];

        // Bandcamp related tags (no key needed)
        const webBandcampTools = createBandcampWebTools();

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
              g.serverName !== "radio" &&
              g.serverName !== "memory",
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
          ...(webMemoryTools.length > 0
            ? [{ serverName: "memory", tools: webMemoryTools }]
            : []),
          ...(webWhoSampledTools.length > 0
            ? [{ serverName: "whosampled", tools: webWhoSampledTools }]
            : []),
          ...(webBrowserTools.length > 0
            ? [{ serverName: "browser", tools: webBrowserTools }]
            : []),
          { serverName: "bandcamp-web", tools: webBandcampTools },
          ...(webPrepResearchTools.length > 0
            ? [{ serverName: "prep-research", tools: webPrepResearchTools }]
            : []),
        ];

        // For research-heavy commands, only include relevant tool servers
        // to stay under the 200K token context limit (tool defs alone can be 80K+ tokens)
        const RESEARCH_SERVERS = new Set([
          "influence", "influencecache", "websearch", "musicbrainz",
          "genius", "lastfm", "discogs", "images", "infographic", "itunes",
          "memory", "whosampled", "browser", "bandcamp-web", "prep-research",
        ]);
        const toolGroups = isResearchCommand
          ? allToolGroups.filter((g: { serverName: string }) => RESEARCH_SERVERS.has(g.serverName))
          : allToolGroups;

        // Build system prompt with soul + OpenUI prompt + user memory context
        const { CRATE_SOUL } = await import("@/lib/soul");
        const { getCrateOpenUIPrompt } = await import("@/lib/openui/prompt");

        // Load user memories from mem0 to personalize the session
        let memoryContext = "";
        if (mem0Key && hasMemory !== false) {
          try {
            const memories = await searchMemories(
              mem0Key,
              clerkId,
              "user preferences music taste research interests",
              10,
            );
            memoryContext = formatMemoriesForPrompt(memories);
          } catch (err) {
            console.error("[chat/mem0] Failed to load memories:", err);
          }
        }

        const systemPrompt = [
          getSystemPrompt(),
          CRATE_SOUL,
          getCrateOpenUIPrompt(),
          memoryContext,
        ].filter(Boolean).join("\n\n");

        // Run the agentic loop
        // Research commands get more turns since they need tool calls + final output
        const events = agenticLoop({
          message,
          history,
          systemPrompt,
          model: modelId,
          apiKey,
          useOpenRouter,
          toolGroups,
          maxTurns: isResearchCommand ? 35 : 25,
        });

        // Collect assistant text for mem0 conversation saving
        let assistantText = "";
        for await (const event of events) {
          controller.enqueue(encoder.encode(sseEncode(event)));
          if (event && typeof event === "object" && "type" in event) {
            if (event.type === "answer_token" && "token" in event) {
              assistantText += (event as { token: string }).token;
            }
          }
        }

        controller.enqueue(encoder.encode(sseEncode("[DONE]")));

        // Save conversation to mem0 in the background (don't block response)
        if (mem0Key && hasMemory !== false && assistantText.length > 50) {
          addMemories(mem0Key, clerkId, [
            { role: "user", content: message },
            { role: "assistant", content: assistantText },
          ]).catch((err) =>
            console.error("[chat/mem0] Failed to save memories:", err),
          );
        }

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

  const userEmail = resolved.user.email ?? "";
  const adminBypass = isAdmin(userEmail);

  // Look up subscription (uses module-level convex client)
  let plan: PlanId = "free";
  // For free users without a subscription, use first-of-month as synthetic period start
  const now = new Date();
  let periodStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  let teamDomain: string | undefined;

  if (!adminBypass) {
    const sub = await convex.query(api.subscriptions.getByUserId, {
      userId: resolved.user._id as Id<"users">,
    });
    if (sub) {
      // Check past_due grace period
      if (sub.status === "past_due") {
        const graceExpired = Date.now() > sub.currentPeriodEnd + PAST_DUE_GRACE_MS;
        plan = graceExpired ? "free" : sub.plan;
      } else if (sub.status === "active") {
        plan = sub.plan;
      }
      // else "canceled" → stay on free
      periodStart = sub.currentPeriodStart;
      teamDomain = sub.teamDomain ?? undefined;
    }
  }

  const limits = PLAN_LIMITS[plan];

  // Determine if user has BYOK
  const hasBYOK = hasAnthropic || hasOpenRouter;
  const { platformKey } = resolved;

  // If no BYOK and no platform key, user can't proceed at all
  if (!hasBYOK && !platformKey && !adminBypass) {
    return Response.json(
      { error: "An API key is required. Add one in Settings or upgrade to Pro." },
      { status: 400 },
    );
  }

  let body: { message?: string; model?: string; history?: Array<{ role: string; content: string }> };
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

  // Rate limiting (admin bypasses)
  if (!adminBypass) {
    const isAgent = !isChatTier(rawMessage);
    const rlKey = isAgent ? `agent:${clerkId}` : `chat:${clerkId}`;
    const rlMax = isAgent ? RATE_LIMIT_AGENT_PER_MINUTE : RATE_LIMIT_CHAT_PER_MINUTE;
    const rl = checkRateLimit(rlKey, rlMax);
    if (!rl.allowed) {
      return Response.json(
        { error: "Rate limit exceeded. Please wait a moment." },
        { status: 429 },
      );
    }
  }

  // Sanitize history — only allow user/assistant roles with string content
  const history = (body.history ?? []).filter(
    (m): m is { role: "user" | "assistant"; content: string } =>
      (m.role === "user" || m.role === "assistant") &&
      typeof m.content === "string" &&
      m.content.length > 0,
  );

  // Slash command preprocessing
  const message = preprocessSlashCommand(rawMessage);

  // Feature gate: Pro-only commands
  if (!adminBypass) {
    const gatedCmd = getGatedCommand(rawMessage);
    if (gatedCmd && !limits.hasPublishing) {
      return Response.json(
        {
          error: "feature_gated",
          message: `/${gatedCmd} requires Pro ($15/mo). Pro includes publishing, cross-session memory, influence caching, and 50 research queries/month.`,
          feature: gatedCmd,
        },
        { status: 402 },
      );
    }
  }

  // Force Sonnet for research-heavy commands that need deep tool use + structured output
  const isResearchCommand = /^\/(?:influence|show-prep|prep|news)\b/i.test(rawMessage.trim());

  const rawModelId = isResearchCommand
    ? "claude-sonnet-4-6"
    : (model || "claude-haiku-4-5-20251001");

  // Route based on the model: if the model ID contains "/" it's an OpenRouter model
  const isOpenRouterModel = rawModelId.includes("/");
  const useOpenRouter = isOpenRouterModel && hasOpenRouter;

  // Pick the right API key and model ID for the provider
  let apiKey: string;
  let modelId: string;

  if (useOpenRouter) {
    // OpenRouter model (openai/gpt-4o, google/gemini-2.5-pro, etc.)
    apiKey = rawKeys.openrouter;
    modelId = rawModelId;
  } else if (hasAnthropic) {
    // Anthropic model via direct API
    apiKey = rawKeys.anthropic;
    modelId = rawModelId;
  } else if (hasOpenRouter) {
    // Anthropic model but user only has OpenRouter key — map the ID
    const ANTHROPIC_TO_OPENROUTER: Record<string, string> = {
      "claude-sonnet-4-6": "anthropic/claude-sonnet-4.6",
      "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
      "claude-opus-4-6": "anthropic/claude-opus-4.6",
    };
    apiKey = rawKeys.openrouter;
    modelId = ANTHROPIC_TO_OPENROUTER[rawModelId] ?? `anthropic/${rawModelId}`;
  } else if (platformKey) {
    // No BYOK — use platform key (admin or quota-checked user)
    apiKey = platformKey;
    modelId = rawModelId;
  } else {
    apiKey = "";
    modelId = rawModelId;
  }

  console.log(`[chat] useOpenRouter=${useOpenRouter} rawModel=${rawModelId} resolvedModel=${modelId} isChatTier=${isChatTier(message)}`);

  // Chat-tier: fast direct call (no tools)
  if (isChatTier(message)) {
    return streamChatDirect(message, apiKey, modelId, useOpenRouter, history);
  }

  // Agent-tier: check quota (admin and BYOK users bypass)
  // Note: quota is recorded before the agent runs. If the agent call fails, the query is still consumed.
  // This is intentional — it prevents abuse via intentional failures and keeps the atomic check simple.
  if (!adminBypass && !hasBYOK) {
    const quota = await convex.mutation(api.usage.recordAndCheckQuota, {
      userId: resolved.user._id as Id<"users">,
      type: "agent_query",
      periodStart,
      limit: limits.agentQueriesPerMonth,
      teamDomain,
    });

    if (!quota.allowed) {
      return Response.json(
        {
          error: "quota_exceeded",
          message: `You've used all ${quota.limit} research queries this month.`,
          used: quota.used,
          limit: quota.limit,
          upgradeUrl: "/api/stripe/checkout",
        },
        { status: 402 },
      );
    }
  }

  // Agent-tier: full agentic loop with tools
  // Merge user keys + embedded keys for tool access
  const allEnvKeys = { ...embeddedKeys, ...userEnvKeys };
  return streamAgenticResponse(
    message, apiKey, modelId, allEnvKeys, resolved.user._id, clerkId,
    useOpenRouter, isResearchCommand, history,
    adminBypass || limits.hasMemory,
    adminBypass || limits.hasInfluenceCache,
  );
}
