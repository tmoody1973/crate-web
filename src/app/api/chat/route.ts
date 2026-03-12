import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { createAgent } from "@/lib/agent";

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

  const { message, model } = body;
  if (!message || typeof message !== "string") {
    return new Response(
      JSON.stringify({ error: "message field is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
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
