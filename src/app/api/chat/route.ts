import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { decrypt } from "@/lib/encryption";
import { createAgent } from "@/lib/agent";

/** Slash command preprocessor — transforms /commands into research prompts for the agent. */
function preprocessSlashCommand(message: string): string {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) return message;

  const spaceIdx = trimmed.indexOf(" ");
  const nlIdx = trimmed.indexOf("\n");
  const firstBreak = spaceIdx === -1 ? nlIdx : nlIdx === -1 ? spaceIdx : Math.min(spaceIdx, nlIdx);
  const cmd = firstBreak === -1 ? trimmed.slice(1) : trimmed.slice(1, firstBreak);
  const arg = firstBreak === -1 ? "" : trimmed.slice(firstBreak + 1);

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
        return "Show prep — which station (88Nine, HYFIN, or Rhythm Lab) and what do you need? You can ask for:\n• Full show prep (paste your setlist)\n• Track context only\n• Talk breaks between tracks\n• Social media copy\n• Local events this weekend\n• Interview prep for a guest";
      }

      // --- Parse structured metadata from form: /prep [station=HYFIN|shift=evening|dj=Tarik|include=context,breaks] ---
      let prepStation = "";
      let prepShift = "evening";
      let prepDjName = "";
      let prepGuest = "";
      let includeSet = new Set<string>(); // empty = full prep
      let trackList = "";

      const metaMatch = arg.match(/^\[([^\]]+)\]\s*/);
      if (metaMatch) {
        // Structured form input
        const metaStr = metaMatch[1]!;
        const rest = arg.slice(metaMatch[0].length).trim();
        for (const pair of metaStr.split("|")) {
          const eq = pair.indexOf("=");
          if (eq === -1) continue;
          const key = pair.slice(0, eq).trim().toLowerCase();
          const val = pair.slice(eq + 1).trim();
          if (key === "station") prepStation = val;
          else if (key === "shift") prepShift = val;
          else if (key === "dj") prepDjName = val;
          else if (key === "guest") prepGuest = val;
          else if (key === "include") includeSet = new Set(val.split(",").map((s: string) => s.trim()));
        }
        trackList = rest;
      } else {
        // Freeform input: /prep HYFIN\nArtist - Track\n...
        const prepLines = arg.split("\n").map((l: string) => l.trim()).filter(Boolean);
        const firstLine = (prepLines[0] ?? "").replace(/:$/, "").trim().toLowerCase().replace(/\s+/g, "");
        if (["88nine", "hyfin", "rhythmlab"].includes(firstLine)) {
          prepStation = prepLines[0]!.replace(/:$/, "").trim();
          prepLines.splice(0, 1);
        } else {
          const forMatch = arg.match(/\bfor\s+(88nine|hyfin|rhythm\s*lab)\b/i);
          if (forMatch) prepStation = forMatch[1]!;
        }
        // Extract metadata lines
        const tracks = prepLines.filter((line: string) => {
          if (/^dj:\s*/i.test(line)) { prepDjName = line.replace(/^dj:\s*/i, "").trim(); return false; }
          if (/^shift:\s*/i.test(line)) { prepShift = line.replace(/^shift:\s*/i, "").trim(); return false; }
          if (/^(?:interviewing|guest:?)\s*/i.test(line)) { prepGuest = line.replace(/^(?:interviewing|guest:?)\s*/i, "").trim(); return false; }
          return true;
        });
        trackList = tracks.filter((l: string) => l.length > 3 && (l.includes("-") || l.includes("–") || l.includes("—"))).join("\n");
      }

      const doFull = includeSet.size === 0;
      const wantsContext = doFull || includeSet.has("context");
      const wantsTalkBreaks = doFull || includeSet.has("breaks");
      const wantsSocial = doFull || includeSet.has("social");
      const wantsEvents = doFull || includeSet.has("events");
      const wantsInterview = doFull || includeSet.has("interview");

      const stationVoices: Record<string, string> = {
        hyfin: `STATION: HYFIN — Bold, culturally sharp, unapologetic. Music: urban alternative, neo-soul, progressive hip-hop, Afrobeats. Audience: young, culturally aware Milwaukee listeners invested in Black art and music. Voice: cultural context, movement-building. Vocabulary: culture, movement, lineage, vibration, frequency.`,
        "88nine": `STATION: 88Nine — Warm, eclectic, community-forward. Music: indie, alternative, world, electronic, hip-hop. Audience: Milwaukee music lovers who value discovery and local culture. Voice: discovery-oriented. Vocabulary: discover, connect, community, eclectic, homegrown.`,
        rhythmlab: `STATION: Rhythm Lab — Curated, global perspective, deep knowledge. Music: global beats, electronic, jazz fusion, experimental, Afrobeats, dub. Audience: dedicated music heads, DJs, producers, crate diggers. Voice: influence tracing, crate-digging stories. Vocabulary: lineage, crate, connection, thread, sonic, palette.`,
      };
      const stationKey = prepStation.toLowerCase().replace(/\s+/g, "");
      const stationVoice = stationVoices[stationKey] ?? "";

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day = days[new Date().getDay()];

      // Build research steps
      const researchSteps: string[] = [];
      if (wantsContext || wantsTalkBreaks) {
        researchSteps.push(
          `1. MusicBrainz: search_recording + get_recording_credits — metadata, producer, studio`,
          `2. Discogs: search_discogs + get_release_full — release year, label, album context`,
          `3. Genius: search_songs + get_song — annotations, artist commentary, production context`,
          `4. Bandcamp: search_bandcamp — artist statements, liner notes`,
          `5. Last.fm: get_track_info + get_similar_tracks — listener stats, tags`,
        );
      }
      if (wantsEvents) {
        researchSteps.push(`${researchSteps.length + 1}. Ticketmaster: search_events — upcoming Milwaukee shows`);
      }
      if (wantsContext) {
        researchSteps.push(`${researchSteps.length + 1}. Web search: Milwaukee sources (milwaukeerecord.com, jsonline.com) — local tie-ins`);
      }

      // Build the sections the agent should include
      const sections: string[] = [];
      if (wantsContext) sections.push("TrackContextCard (one per track)");
      if (wantsTalkBreaks) sections.push("TalkBreakCard (one per transition between tracks)");
      if (wantsSocial) sections.push("SocialPostCard (one per track or show overall)");
      if (wantsEvents) sections.push("ConcertEvent entries for Milwaukee events");
      if (wantsInterview && prepGuest) sections.push(`InterviewPrepCard for ${prepGuest}`);

      const intentLabel = doFull ? "full radio show prep" : sections.join(" + ");

      return [
        `Generate ${intentLabel} for a radio DJ.`,
        stationVoice || `Ask which station (88Nine, HYFIN, or Rhythm Lab) if not specified.`,
        prepDjName ? `DJ: ${prepDjName}` : ``,
        `Date: ${day}, Shift: ${prepShift}`,
        prepGuest ? `Interview guest: ${prepGuest}` : ``,
        ``,
        trackList ? `SETLIST:\n${trackList}` : wantsEvents && !wantsContext ? `` : `No tracks provided — ask for the setlist.`,
        ``,
        researchSteps.length > 0 ? `RESEARCH STEPS:\n${researchSteps.join("\n")}` : ``,
        ``,
        `OUTPUT FORMAT — CRITICAL:`,
        `You MUST output OpenUI Lang syntax. This is a line-oriented format where each line assigns a component to a variable.`,
        `Do NOT output plain markdown, prose, or bullet points. Output ONLY OpenUI Lang component assignments.`,
        `The output will be rendered as interactive cards in the UI.`,
        ``,
        `Always use ShowPrepPackage as the root container, even for partial prep. Set unused child arrays to empty [].`,
        ``,
        `EXACT SYNTAX (follow this pattern, filling in real researched content):`,
        `\`\`\``,
        `root = ShowPrepPackage("${prepStation || "HYFIN"}", "${day}", "${prepDjName || "DJ"}", "${prepShift}", [${wantsContext ? "tc1, tc2, tc3" : ""}], [${wantsTalkBreaks ? "tb1, tb2" : ""}], [${wantsSocial ? "sp1" : ""}], [${wantsInterview && prepGuest ? "ip1" : ""}], [${wantsEvents ? "ev1, ev2, ev3" : ""}])`,
        wantsContext ? `tc1 = TrackContextCard("Artist Name", "Track Title", "2-3 sentence origin story of how this track came to be", "Key production details — studio, producer, instruments", "Genre connections, samples, influences", "influence chain: Artist A > Artist B > this track", "The detail listeners can't easily Google", "One sentence: why should THIS audience care right now?", "high", "Upcoming Milwaukee show or local connection", "pronunciation guide if needed", "image URL if found")` : ``,
        wantsTalkBreaks ? `tb1 = TalkBreakCard("transition", "First Track Title", "Second Track Title", "Quick 10-15 sec context before vocal kicks in", "30-60 sec: That was [artist]... compelling detail... segue to next track", "60-120 sec: Fuller backstory connecting the two tracks with local tie-in", "bold these, key phrases, that land on air", "Hit before the beat drops at 0:04", "pronunciation guide")` : ``,
        wantsSocial ? `sp1 = SocialPostCard("Track or Topic", "Instagram: visual-first, 1-2 sentences with station hashtags", "X/Twitter: punchy single line + hashtag", "Bluesky: conversational, community-oriented", "#HYFIN, #MKE, #hashtag")` : ``,
        wantsInterview && prepGuest ? `ip1 = InterviewPrepCard("${prepGuest}", "Warm-up question 1\\nWarm-up question 2", "Deep-dive question 1\\nDeep-dive question 2", "Milwaukee connection question", "Overasked question to avoid")` : ``,
        wantsEvents ? `ev1 = ConcertEvent("Artist Name", "Friday, March 14", "8:00 PM", "Venue Name", "Milwaukee", "$25-$50", "On Sale", "https://ticketmaster.com/...")` : ``,
        `\`\`\``,
        ``,
        `RULES:`,
        `- Research each track thoroughly BEFORE generating output`,
        `- Every piece must answer "why does the listener care?"`,
        `- Talk breaks: bold **key phrases**, include pronunciation guides`,
        `- Rank by audience relevance (high/medium/low)`,
        `- Fill in REAL content from your research — not placeholder text`,
        `- IMAGES: For each TrackContextCard, include an imageUrl. Get images from: Discogs (cover_image or images[0].uri from get_release_full), Genius (song_art_image_thumbnail_url from search_songs), or Bandcamp (image_url). Prioritize Discogs covers > Genius art > Bandcamp.`,
        `- Output the OpenUI Lang block with NO surrounding markdown, NO prose before or after`,
      ].filter(Boolean).join("\n");
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
