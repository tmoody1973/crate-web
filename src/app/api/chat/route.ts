import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { createAgent } from "@/lib/agent";

/** Slash command preprocessor — transforms /commands into research prompts for the agent. */
function preprocessSlashCommand(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) return message;

  const [cmd, ...rest] = trimmed.slice(1).split(/\s+/);
  const arg = rest.join(" ");

  switch (cmd.toLowerCase()) {
    case "news": {
      const parts = arg?.split(/\s+/) ?? [];
      let count = 5;
      let station = "";

      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          count = num;
        } else if (["88nine", "hyfin", "rhythmlab"].includes(part.toLowerCase().replace(/\s+/g, ""))) {
          station = part;
        }
      }

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day = days[new Date().getDay()];

      const stationContext = station
        ? [
            ``,
            `STATION VOICE: This segment is for ${station}. Match the station's voice, music focus, and audience:`,
            station.toLowerCase().includes("hyfin")
              ? `- HYFIN: Bold, culturally sharp. Focus on hip-hop, neo-soul, Afrobeats, cultural context. Audience: young, culturally aware Milwaukee listeners.`
              : station.toLowerCase().includes("rhythm")
                ? `- Rhythm Lab: Curated, global perspective, deep knowledge. Focus on global beats, electronic, jazz fusion. Audience: dedicated music heads and crate diggers.`
                : `- 88Nine: Warm, eclectic, community-forward. Focus on indie, alternative, world, electronic. Audience: Milwaukee music lovers who value discovery.`,
            `- Prioritize stories relevant to this station's audience and music focus.`,
            `- Use Milwaukee local sources (milwaukeerecord.com, jsonline.com, urbanmilwaukee.com) for local angles.`,
          ].join("\n")
        : "";

      return [
        `Generate a Radio Milwaukee daily music news segment for ${day}.`,
        `Find ${count} current music stories from TODAY or the past 24-48 hours.`,
        ``,
        `RESEARCH STEPS:`,
        `1. Use search_music_news to scan RSS feeds for breaking stories`,
        `2. Use search_web (Tavily, topic="news", time_range="day") to find additional breaking music news not in RSS`,
        `3. Use search_web (Exa) for any trending music stories or scene coverage the keyword search missed`,
        `4. Cross-reference and pick the ${count} most compelling, newsworthy stories`,
        `5. For each story, verify facts using available tools (MusicBrainz, Discogs, Bandcamp, etc.)`,
        stationContext,
        ``,
        `FORMAT — follow the Music News Segment Format rules in your instructions exactly.`,
        `Output "For ${day}:" then ${count} numbered stories with source citations.`,
      ].join("\n");
    }

    case "show-prep":
    case "showprep":
    case "prep": {
      if (!arg) {
        return "Show prep — which station (88Nine, HYFIN, or Rhythm Lab) and what's your setlist?";
      }
      return `Prep my show: ${arg}`;
    }

    default:
      // Unknown slash command — pass through as-is
      return message;
  }
}

/** Simple chat-tier classifier — returns true for greetings and short conversational messages. */
function isChatTier(message: string): boolean {
  const lower = message.toLowerCase().trim();
  // Greetings, thanks, simple questions
  const chatPatterns = [
    /^(hi|hey|hello|yo|sup|what'?s up|howdy|greetings)\b/,
    /^(thanks?|thank you|thx|ty)\b/,
    /^(ok|okay|got it|cool|nice|great|awesome|perfect)\b/,
    /^(yes|no|yep|nope|yeah|nah)\b/,
    /^(bye|goodbye|see ya|later)\b/,
    /^what (can|do) you do/,
    /^who are you/,
    /^help\b/,
  ];
  if (chatPatterns.some((p) => p.test(lower))) return true;
  // Very short messages without music-specific keywords
  if (lower.split(/\s+/).length <= 4 && !/artist|album|track|song|sample|genre|vinyl|record|concert|tour/i.test(lower)) return true;
  return false;
}

/** Fast direct API call for chat-tier messages — no subprocess, ~1-2s response. */
async function streamChatDirect(
  message: string,
  apiKey: string,
  modelId: string,
): Promise<Response> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 1024,
      stream: true,
      system: "You are Crate, an AI music research assistant. For casual conversation, be friendly and brief. Mention that you can help with music research — artists, samples, vinyl, concerts, genres, and more.",
      messages: [{ role: "user", content: message }],
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text();
    return new Response(
      `data: ${JSON.stringify({ type: "error", message: `API error: ${res.status}` })}\n\ndata: [DONE]\n\n`,
      { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } },
    );
  }

  // Transform Anthropic SSE → Crate SSE format
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
              if (parsed.type === "content_block_delta" && parsed.delta?.text) {
                const event = { type: "answer_token", token: parsed.delta.text };
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
              }
            } catch { /* skip unparseable lines */ }
          }
        }
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done", totalMs: 0, toolsUsed: [], toolCallCount: 0, costUsd: 0 })}\n\n`));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "error", message: err instanceof Error ? err.message : "Stream error" })}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Map user-facing key names to env var names expected by CrateAgent servers. */
const KEY_ENV_MAP: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  discogs_key: "DISCOGS_KEY",
  discogs_secret: "DISCOGS_SECRET",
  lastfm: "LASTFM_API_KEY",
  genius: "GENIUS_ACCESS_TOKEN",
  tumblr_key: "TUMBLR_CONSUMER_KEY",
  tumblr_secret: "TUMBLR_CONSUMER_SECRET",
  kernel: "KERNEL_API_KEY",
  mem0: "MEM0_API_KEY",
  tavily: "TAVILY_API_KEY",
  exa: "EXA_API_KEY",
  ticketmaster: "TICKETMASTER_API_KEY",
};

/** Embedded Tier 1 keys from Vercel env vars (shared across all users). */
function getEmbeddedKeys(): Record<string, string> {
  const embedded: Record<string, string> = {};
  if (process.env.EMBEDDED_TICKETMASTER_KEY)
    embedded.TICKETMASTER_API_KEY = process.env.EMBEDDED_TICKETMASTER_KEY;
  if (process.env.EMBEDDED_LASTFM_KEY)
    embedded.LASTFM_API_KEY = process.env.EMBEDDED_LASTFM_KEY;
  if (process.env.EMBEDDED_DISCOGS_KEY)
    embedded.DISCOGS_KEY = process.env.EMBEDDED_DISCOGS_KEY;
  if (process.env.EMBEDDED_DISCOGS_SECRET)
    embedded.DISCOGS_SECRET = process.env.EMBEDDED_DISCOGS_SECRET;
  if (process.env.EMBEDDED_TAVILY_KEY)
    embedded.TAVILY_API_KEY = process.env.EMBEDDED_TAVILY_KEY;
  if (process.env.EMBEDDED_EXA_KEY)
    embedded.EXA_API_KEY = process.env.EMBEDDED_EXA_KEY;
  if (process.env.EMBEDDED_KERNEL_KEY)
    embedded.KERNEL_API_KEY = process.env.EMBEDDED_KERNEL_KEY;
  return embedded;
}

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  // Decrypt user's personal API keys
  let rawKeys: Record<string, string> = {};
  if (user.encryptedKeys) {
    rawKeys = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
  }

  // Check for org shared keys (fallback for team members)
  const emailDomain = user.email?.split("@")[1] ?? "";
  if (emailDomain) {
    const orgRecord = await convex.query(api.orgKeys.getByDomain, { domain: emailDomain });
    if (orgRecord?.encryptedKeys) {
      const orgRawKeys: Record<string, string> = JSON.parse(
        decrypt(Buffer.from(orgRecord.encryptedKeys)),
      );
      // Org keys fill gaps — user's own keys take priority
      for (const [key, value] of Object.entries(orgRawKeys)) {
        if (!rawKeys[key]) {
          rawKeys[key] = value;
        }
      }
    }
  }

  const hasAnthropic = !!rawKeys.anthropic;
  const hasOpenRouter = !!rawKeys.openrouter;

  if (!hasAnthropic && !hasOpenRouter) {
    return new Response(
      JSON.stringify({
        error: "An Anthropic or OpenRouter API key is required. Add one in Settings.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Map user key names to env var names
  const userEnvKeys: Record<string, string> = {};
  for (const [userKey, envVar] of Object.entries(KEY_ENV_MAP)) {
    if (rawKeys[userKey]) {
      userEnvKeys[envVar] = rawKeys[userKey];
    }
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

  // Slash command preprocessing — transform commands into research prompts
  const message = preprocessSlashCommand(rawMessage);

  // Fast path: chat-tier messages bypass the full agent subprocess (~1-2s vs 13s)
  const modelId = model || "claude-haiku-4-5-20251001";
  if (isChatTier(message) && hasAnthropic) {
    return streamChatDirect(message, rawKeys.anthropic, modelId);
  }

  // Non-Anthropic models require OpenRouter
  const isThirdPartyModel = model && !model.startsWith("claude-");
  if (isThirdPartyModel && !hasOpenRouter) {
    return new Response(
      JSON.stringify({
        error: "An OpenRouter key is required for non-Anthropic models. Add one in Settings.",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Configure SDK auth per OpenRouter docs:
  // https://openrouter.ai/docs/guides/community/anthropic-agent-sdk
  //
  // For non-Claude models via OpenRouter, we remap the model using
  // ANTHROPIC_DEFAULT_SONNET_MODEL so the SDK sees a "sonnet" alias
  // but OpenRouter routes to the actual model (GPT-4o, Gemini, etc.)
  let agentModel = model;
  if (hasOpenRouter && (isThirdPartyModel || !hasAnthropic)) {
    process.env.ANTHROPIC_BASE_URL = "https://openrouter.ai/api";
    process.env.ANTHROPIC_AUTH_TOKEN = rawKeys.openrouter;
    process.env.ANTHROPIC_API_KEY = ""; // Must be explicitly empty for OpenRouter
    if (isThirdPartyModel && model) {
      // Override the default Sonnet model to the OpenRouter model ID
      process.env.ANTHROPIC_DEFAULT_SONNET_MODEL = model;
      agentModel = "claude-sonnet-4-6"; // SDK sees "sonnet", OpenRouter routes to actual model
    }
  } else if (userEnvKeys.ANTHROPIC_API_KEY) {
    // Direct Anthropic: clear any previous OpenRouter config
    delete process.env.ANTHROPIC_BASE_URL;
    delete process.env.ANTHROPIC_AUTH_TOKEN;
    delete process.env.ANTHROPIC_DEFAULT_SONNET_MODEL;
    process.env.ANTHROPIC_API_KEY = userEnvKeys.ANTHROPIC_API_KEY;
  }

  // Unset CLAUDECODE to prevent "cannot launch inside another session" error
  // when dev server was started from a Claude Code terminal session
  delete process.env.CLAUDECODE;

  // Set all user keys on process.env so third-party SDKs (Kernel, etc.) can find them.
  // The keys dict tells CrateAgent which servers to register, but the SDKs themselves
  // read from process.env (e.g. @onkernel/sdk reads KERNEL_API_KEY).
  const mergedKeys = { ...getEmbeddedKeys(), ...userEnvKeys };
  for (const [envVar, value] of Object.entries(mergedKeys)) {
    if (value) process.env[envVar] = value;
  }

  // Create agent with user's keys + embedded fallbacks
  const agent = createAgent(userEnvKeys, getEmbeddedKeys(), agentModel);

  // Load user memories from Mem0 (if key is configured)
  await agent.startSession();

  // Stream CrateEvents as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of agent.research(message)) {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        console.error("[SSE stream] Error:", err);
        const errorEvent = {
          type: "error",
          message: err instanceof Error ? `${err.message}\n${err.stack}` : "Unknown error",
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`),
        );
      } finally {
        // Note: endSession() skipped — each request creates a fresh agent with <6 messages.
        // The AI uses remember_about_user / update_user_memory tools directly during research.
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
