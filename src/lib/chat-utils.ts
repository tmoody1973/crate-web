/**
 * Chat utilities used by the /api/chat route.
 */

/** Slash command preprocessor — transforms /commands into research prompts for the agent. */
export function preprocessSlashCommand(message: string): string {
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

      const today = new Date().toISOString().slice(0, 10); // e.g. 2026-03-22

      return [
        `Generate a Radio Milwaukee daily music news segment for ${day}, ${today}.`,
        `Today's date is ${today}. Find ${count} current music stories from TODAY or the past 24-48 hours.`,
        `IMPORTANT: Reject any results older than 3 days. If a search returns articles from months or years ago, discard them and search again with more specific date filters.`,
        ``,
        `RESEARCH STEPS (be efficient — minimize tool calls):`,
        `1. Do ONE broad search_web call for "music news today ${today}" to get the latest stories`,
        `2. Do ONE search_music_news call to check RSS feeds`,
        `3. Pick the ${count} most compelling stories from these results — do NOT fetch individual articles`,
        `4. Write the segment directly from the search snippets and summaries — you have enough context`,
        `5. Only use additional tool calls if a story needs a specific fact verified`,
        stationContext,
        ``,
        `FORMAT — follow the Music News Segment Format rules in your instructions exactly.`,
        `Output "For ${day}:" then ${count} numbered stories with source citations.`,
        ``,
        `CRITICAL — LINKS:`,
        `- ONLY use URLs that came directly from your search tool results (search_results, citations, source URLs).`,
        `- NEVER fabricate, guess, or construct URLs. If you don't have a real URL from a tool result, don't include a link.`,
        `- Every [Source](url) link MUST come verbatim from a tool result. Copy-paste the URL exactly.`,
        `- If a story has no verified source URL, cite the publication name without a link.`,
      ].join("\n");
    }

    case "show-prep":
    case "showprep":
    case "prep": {
      if (!arg) {
        return "Show prep — which station (88Nine, HYFIN, or Rhythm Lab) and what do you need? You can ask for:\n\u2022 Full show prep (paste your setlist)\n\u2022 Track context only\n\u2022 Talk breaks between tracks\n\u2022 Social media copy\n\u2022 Local events this weekend\n\u2022 Interview prep for a guest";
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
        trackList = tracks.filter((l: string) => l.length > 3 && (l.includes("-") || l.includes("\u2013") || l.includes("\u2014"))).join("\n");
      }

      const doFull = includeSet.size === 0;
      const wantsContext = doFull || includeSet.has("context");
      const wantsTalkBreaks = doFull || includeSet.has("breaks");
      const wantsSocial = doFull || includeSet.has("social");
      const wantsEvents = doFull || includeSet.has("events");
      const wantsInterview = doFull || includeSet.has("interview");

      const stationVoices: Record<string, string> = {
        hyfin: `STATION: HYFIN \u2014 Bold, culturally sharp, unapologetic. Music: urban alternative, neo-soul, progressive hip-hop, Afrobeats. Audience: young, culturally aware Milwaukee listeners invested in Black art and music. Voice: cultural context, movement-building. Vocabulary: culture, movement, lineage, vibration, frequency.`,
        "88nine": `STATION: 88Nine \u2014 Warm, eclectic, community-forward. Music: indie, alternative, world, electronic, hip-hop. Audience: Milwaukee music lovers who value discovery and local culture. Voice: discovery-oriented. Vocabulary: discover, connect, community, eclectic, homegrown.`,
        rhythmlab: `STATION: Rhythm Lab \u2014 Curated, global perspective, deep knowledge. Music: global beats, electronic, jazz fusion, experimental, Afrobeats, dub. Audience: dedicated music heads, DJs, producers, crate diggers. Voice: influence tracing, crate-digging stories. Vocabulary: lineage, crate, connection, thread, sonic, palette.`,
      };
      const stationKey = prepStation.toLowerCase().replace(/\s+/g, "");
      const stationVoice = stationVoices[stationKey] ?? "";

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day = days[new Date().getDay()];

      // Build the sections the agent should include
      const sections: string[] = [];
      if (wantsContext) sections.push("TrackContextCard (one per track)");
      if (wantsTalkBreaks) sections.push("TalkBreakCard (one per transition between tracks)");
      if (wantsSocial) sections.push("SocialPostCard (one per track or show overall)");
      if (wantsEvents) sections.push("ConcertEvent entries for Milwaukee events");
      if (wantsInterview && prepGuest) sections.push(`InterviewPrepCard for ${prepGuest}`);

      const intentLabel = doFull ? "full radio show prep" : sections.join(" + ");

      // Count tracks to scale research depth — budget is 25 tool calls total
      const trackLines = trackList ? trackList.split("\n").filter(Boolean) : [];
      const trackCount = trackLines.length;
      // Budget: reserve 2 calls for events/overhead, divide rest among tracks
      const callsPerTrack = trackCount > 0 ? Math.max(1, Math.floor(20 / trackCount)) : 3;

      // Research strategy: prefer research_track (Perplexity) — 1 call per track, pre-synthesized
      const maxResearchCalls = Math.min(trackCount, 8); // Never more than 8 research_track calls
      const researchStrategy = [
        `RESEARCH (1 call per track, up to ${maxResearchCalls} tracks):`,
        `For the first ${maxResearchCalls} tracks in the setlist, call research_track(artist, track${prepStation ? `, station="${prepStation}"` : ""}). ${trackCount > maxResearchCalls ? `Skip research for the remaining ${trackCount - maxResearchCalls} tracks and use your general knowledge.` : ""}`,
        `This returns a complete research brief (origin, production, connections, hook) in one call.`,
        `Do NOT use MusicBrainz, Discogs, Genius, Bandcamp, or Last.fm — research_track covers all of these.`,
        trackCount <= 4
          ? `After research_track calls, optionally call search_itunes_songs for artwork URLs.`
          : `Skip artwork lookups — prioritize getting all ${trackCount} tracks researched and outputting.`,
        `If research_track is not available, fall back to search_web (Exa or Tavily) for each track.`,
      ].join("\n");

      return [
        `Generate ${intentLabel} for a radio DJ.`,
        stationVoice || `Ask which station (88Nine, HYFIN, or Rhythm Lab) if not specified.`,
        prepDjName ? `DJ: ${prepDjName}` : ``,
        `Date: ${day}, Shift: ${prepShift}`,
        prepGuest ? `Interview guest: ${prepGuest}` : ``,
        ``,
        trackList ? `SETLIST:\n${trackList}` : wantsEvents && !wantsContext ? `` : `No tracks provided \u2014 ask for the setlist.`,
        ``,
        `HARD RULE: You MUST output the OpenUI Lang block. If you run out of research budget, OUTPUT WITH WHAT YOU HAVE.`,
        `Never narrate your research process. Go straight from tool calls to final output.`,
        ``,
        researchStrategy,
        wantsEvents ? `\nAlso: search_events (Ticketmaster) for Milwaukee shows — 1 call.` : ``,
        ``,
        `IMMEDIATELY AFTER RESEARCH — OUTPUT:`,
        `Output ONLY an OpenUI Lang code block. No prose, no markdown, no introduction, no narration.`,
        ``,
        `Always use ShowPrepPackage as the root container, even for partial prep. Set unused child arrays to empty [].`,
        ``,
        `EXACT SYNTAX (fill in REAL researched content, not placeholders):`,
        `\`\`\``,
        `root = ShowPrepPackage("${prepStation || "HYFIN"}", "${day}", "${prepDjName || "DJ"}", "${prepShift}", [${wantsContext ? trackLines.map((_, i) => `tc${i + 1}`).join(", ") || "tc1, tc2, tc3" : ""}], [${wantsTalkBreaks ? trackLines.slice(0, -1).map((_, i) => `tb${i + 1}`).join(", ") || "tb1, tb2" : ""}], [${wantsSocial ? "sp1" : ""}], [${wantsInterview && prepGuest ? "ip1" : ""}], [${wantsEvents ? "ev1, ev2, ev3" : ""}])`,
        wantsContext ? `tc1 = TrackContextCard("Artist Name", "Track Title", "2-3 sentence origin story", "Production details — studio, producer, instruments", "Genre connections, samples, influences", "influence chain: Artist A > Artist B > this track", "The detail listeners can't Google", "Why should THIS audience care right now?", "high", "Milwaukee show or local connection", "pronunciation guide if needed", "image URL if found")` : ``,
        wantsTalkBreaks ? `tb1 = TalkBreakCard("transition", "First Track Title", "Second Track Title", "Quick 10-15 sec context", "30-60 sec: compelling detail + segue", "60-120 sec: backstory connecting tracks + local tie-in", "**bold key phrases** that land on air", "Hit before the beat drops at 0:04", "pronunciation guide")` : ``,
        wantsSocial ? `sp1 = SocialPostCard("Track or Topic", "Instagram: visual-first, 1-2 sentences", "X/Twitter: punchy single line + hashtag", "Bluesky: conversational, community-oriented", "#HYFIN, #MKE")` : ``,
        wantsInterview && prepGuest ? `ip1 = InterviewPrepCard("${prepGuest}", "Warm-up question 1\\nWarm-up question 2", "Deep-dive question 1\\nDeep-dive question 2", "Milwaukee connection question", "Overasked question to avoid")` : ``,
        wantsEvents ? `ev1 = ConcertEvent("Artist Name", "Friday, March 14", "8:00 PM", "Venue Name", "Milwaukee", "$25-$50", "On Sale", "https://ticketmaster.com/...")` : ``,
        `\`\`\``,
        ``,
        `RULES:`,
        `- Every piece must answer "why does the listener care?"`,
        `- Talk breaks: bold **key phrases**, include pronunciation guides`,
        `- Rank by audience relevance (high/medium/low)`,
        `- Fill in REAL content from research — not placeholder text`,
        `- IMAGES: search_itunes_songs returns artworkUrl (600x600). Include in imageUrl field when available.`,
        `- Output ONLY the OpenUI Lang block. Nothing else. No narration before or after.`,
      ].filter(Boolean).join("\n");
    }

    case "published": {
      return [
        `Show me everything I've published.`,
        `Use the view_my_page tool to check Telegraph entries, and tumblr_blog_info to check Tumblr posts.`,
        `List all published items with their titles, URLs, categories, and dates.`,
        `Format as a clean list grouped by platform with clickable links.`,
      ].join("\n");
    }

    case "publish": {
      if (!arg) {
        return "Publish your research to the web. Usage:\n• `/publish telegraph` — Publish to Telegraph (free, instant, no account needed)\n• `/publish tumblr` — Publish to your Tumblr blog (requires Tumblr API keys in Settings)\n\nPaste your research or tell me what to publish and I'll format it.";
      }

      const target = arg.split(/\s+/)[0]?.toLowerCase() ?? "";
      const content = arg.slice(target.length).trim();

      if (target === "telegraph" || target === "tg") {
        return [
          `Publish the following content to Telegraph using the setup_page and post_to_page tools.`,
          `If the page hasn't been set up yet, call setup_page first.`,
          `Then call post_to_page with the content formatted as markdown.`,
          content ? `\nContent to publish:\n${content}` : `\nPublish my most recent research as a Telegraph article. Format it with a clear title, headings, and source links.`,
        ].join("\n");
      }

      if (target === "tumblr") {
        return [
          `Publish the following content to Tumblr using the post_to_tumblr tool.`,
          `Check tumblr_status first to see if Tumblr is connected.`,
          `If not connected, tell the user they need to add Tumblr API keys in Settings and run connect_tumblr.`,
          content ? `\nContent to publish:\n${content}` : `\nPublish my most recent research as a Tumblr post. Format it with a clear title, appropriate tags, and source links.`,
        ].join("\n");
      }

      // Default: publish to Telegraph
      return [
        `Publish the following content to Telegraph using the setup_page and post_to_page tools.`,
        `If the page hasn't been set up yet, call setup_page first.`,
        `Then call post_to_page with the content formatted as markdown.`,
        `\nContent to publish:\n${arg}`,
      ].join("\n");
    }

    case "radio": {
      if (!arg) {
        return [
          `Search for a radio station and start streaming it in the player.`,
          `Use search_radio to find stations, then play_radio to start the best match.`,
          `Ask the user what genre, station name, or vibe they want to listen to.`,
        ].join("\n");
      }

      // Check if it's a direct URL
      if (arg.startsWith("http://") || arg.startsWith("https://")) {
        return [
          `Play this radio stream directly in the browser player.`,
          `Use play_radio with url="${arg}".`,
        ].join("\n");
      }

      return [
        `Find and play a radio station matching: "${arg}"`,
        ``,
        `STEPS:`,
        `1. search_radio with name="${arg}" — find matching stations`,
        `2. Pick the best match (highest votes, working stream)`,
        `3. play_radio with the station name or URL to start streaming`,
        ``,
        `If multiple good matches, show the top 3-5 and ask which one to play.`,
        `If it's clearly a genre (jazz, hip-hop, electronic), search by tag instead of name.`,
      ].join("\n");
    }

    case "influence": {
      if (!arg) {
        return "Map an artist's influences. Usage: `/influence [artist name]`\nI'll check the influence cache, run discovery if needed, fetch artwork, and render an interactive influence chain.";
      }

      return [
        `Map the musical influences of ${arg}.`,
        ``,
        `PHASE 1 — DISCOVER (max 3 tool calls):`,
        `1. lookup_influences("${arg}") — check cache first`,
        `2. If cache < 5 connections, run discovery:`,
        `   - search_web (Perplexity) for "${arg} musical influences collaborations discography" — get a comprehensive overview in ONE call`,
        `   - If needed: search_reviews for "${arg}" — co-mentions = influence signal`,
        `3. cache_batch_influences — save discoveries`,
        ``,
        `PHASE 2 — ENRICH (1 tool call):`,
        `Call research_influences_batch("${arg}", [top 3-5 connection names])`,
        `This fires parallel Perplexity calls and returns all results in one tool response.`,
        `DO NOT call research_influence individually — use the batch tool instead.`,
        ``,
        `PHASE 2.5 — RE-CACHE enriched data:`,
        `After enriching, call cache_batch_influences with the enriched context and sources.`,
        ``,
        `PHASE 3 — OUTPUT (do this IMMEDIATELY — do NOT do extra image fetches or searches):`,
        `Output the InfluenceChain component. Images are auto-fetched by the component.`,
        `DO NOT call image/artwork APIs — the component handles this automatically.`,
        ``,
        `For each connection, include these fields:`,
        `- context: enriched paragraph or summary from research`,
        `- pullQuote: direct quote if found (optional)`,
        `- pullQuoteAttribution: "Artist Name, Publication, Year" (optional)`,
        `- sonicElements: array of sonic/stylistic qualities (optional)`,
        `- keyWorks: album-to-album reference (optional)`,
        `- sources: array with name, url, snippet, date (use real URLs from research)`,
        ``,
        `DIRECTION CONVENTION (Badillo-Goicoechea 2025):`,
        `- from=INFLUENCER, to=INFLUENCED. If review of B mentions A → edge A→B`,
        `- "influenced by" for directional, "collaborated with" for production/co-creation, "co_mention" for same-review co-occurrence`,
        ``,
        `CRITICAL — BUDGET YOUR TOOL CALLS:`,
        `You have ~50 tool calls total. If you've used 30+, STOP researching and OUTPUT NOW.`,
        `A connection with thin data is better than no connections at all.`,
        `The component shows a "Retry" button if connections are empty — that's worse than thin data.`,
        ``,
        `OUTPUT FORMAT — HARD REQUIREMENT:`,
        `Output ONLY an OpenUI Lang code block. No prose, no markdown, no introduction.`,
        ``,
        `\`\`\``,
        `root = InfluenceChain("${arg}", "[{\\"name\\":\\"Artist Name\\",\\"weight\\":0.9,\\"relationship\\":\\"influenced by\\",\\"context\\":\\"Rich paragraph about the connection\\",\\"sonicElements\\":[\\"element1\\",\\"element2\\"],\\"keyWorks\\":\\"Album A (year) → Album B (year)\\",\\"sources\\":[{\\"name\\":\\"Source\\",\\"url\\":\\"https://url\\",\\"snippet\\":\\"excerpt\\"}]}]")`,
        `\`\`\``,
        ``,
        `RULES:`,
        `- connections is a JSON array string (escaped quotes)`,
        `- Include 6-12 connections sorted by weight descending`,
        `- Every connection MUST have at least: name, weight, relationship, context, sources`,
        `- DO NOT fetch images — the component auto-fetches from Spotify`,
        `- Output ONLY the code block. Nothing else.`,
      ].join("\n");
    }

    case "create-skill": {
      if (!arg) {
        return [
          `I'll help you create a custom command. Describe what you want it to do.`,
          ``,
          `Examples:`,
          `- "Pull upcoming events from The Rave Milwaukee website"`,
          `- "Check Discogs for new vinyl releases in jazz"`,
          `- "Find this week's local Milwaukee music news"`,
          ``,
          `What should your command do?`,
        ].join("\n");
      }

      return [
        `The user wants to create a custom skill. Here's what they described:`,
        `"${arg}"`,
        ``,
        `SKILL CREATION WORKFLOW — FOLLOW EXACTLY:`,
        ``,
        `STEP 1 — DRY RUN (DO THIS IMMEDIATELY, NO QUESTIONS):`,
        `Start executing the task RIGHT NOW using your available tools.`,
        `If it involves a website, use the browser tool to navigate there and scrape results.`,
        `If it involves search, use web_search to find information.`,
        `DO NOT ask clarifying questions. DO NOT explain what you could do. Just DO it.`,
        `Use your best judgment on what the user wants — you can always refine later.`,
        ``,
        `STEP 2 — SHOW RESULTS WITH OPENUI:`,
        `Present results using OpenUI components when the data is structured:`,
        `- For record/vinyl search results: use TrackList with TrackItem children, setting url prop to the product page`,
        `- For artist research: use ArtistCard`,
        `- For event listings: use ConcertList with ConcertEvent children`,
        `- For playlists: use SpotifyPlaylist or SpotifyPlaylists`,
        `- For any list of items with links: use TrackList (it supports url prop for clickable links)`,
        `If the data doesn't fit an OpenUI component, use markdown with clickable links:`,
        `- Format each result as: [Title - Artist](full_url)`,
        `- Include the full URL so users can click through to the source`,
        `- Never show bare URLs — always wrap them in markdown links`,
        ``,
        `STEP 3 — SAVE THE SKILL:`,
        `Ask the user to confirm saving. Suggest a command name.`,
        `Call save_user_skill with:`,
        `   - command: lowercase-hyphens (e.g. dusty-groove-search)`,
        `   - name: human-readable name`,
        `   - description: one sentence`,
        `   - promptTemplate: the prompt that produced the dry run, WITH these additions:`,
        `     * "Present results using OpenUI components (TrackList, ArtistCard, ConcertList) when data is structured"`,
        `     * "For each result, include a clickable markdown link to the source page"`,
        `     * "Format as [Title - Artist](url) so users can click through"`,
        `     * "Always include the full URL for every item"`,
        `   - toolHints: array of tool names that worked`,
        `   - sourceUrl: the URL if a website was involved`,
        ``,
        `CRITICAL: Do NOT ask "what are you looking for?" or "what would work best?"`,
        `The user already told you what they want. Execute the dry run immediately.`,
      ].join("\n");
    }

    case "skills": {
      return [
        `List all of the user's custom skills.`,
        `Call list_user_skills to get them, then display each one with:`,
        `- Command name (e.g. /rave-events)`,
        `- Description`,
        `- Whether it's enabled or disabled`,
        `If the user has no custom skills, suggest they create one with /create-skill.`,
      ].join("\n");
    }

    case "story": {
      if (!arg) {
        return "What album, artist, genre, or event do you want the story behind? For example: /story Donuts";
      }

      return [
        `The user wants a deep narrative story about: "${arg}"`,
        ``,
        `MANDATORY: You MUST output a StoryCard OpenUI component. Do NOT write plain text.`,
        ``,
        `RESEARCH STEPS (be efficient):`,
        `1. Use research_influence or search_web (Perplexity) to get a comprehensive narrative about "${arg}" in ONE call — this works for albums, artists, genres, movements, labels, and events`,
        `2. For images: search_itunes_albums for album covers, or use image URLs from Perplexity search results. For genres/movements/events, use an iconic album cover from the genre. If no image found, pass "" — the component has a gradient fallback. NEVER fabricate image URLs.`,
        `3. Search YouTube for "${arg} documentary" or "${arg} history" — use a video ID from actual search results. NEVER guess a video ID.`,
        ``,
        `OUTPUT: Render a StoryCard with:`,
        `- title: the subject name`,
        `- subtitle: artist · year · label (or relevant context)`,
        `- heroImageUrl: album cover or artist photo`,
        `- category: "The Story Behind" or "The Making Of" or "The History Of"`,
        `- keyFacts: 3-5 key stats (tracks, samples, sales, chart position, etc.)`,
        `- chapters: 3-5 narrative chapters with title, subtitle, and 2-4 paragraphs of content each`,
        `- tracks: key tracks mentioned in the story [{name, artist, album?, year?}] — these become a playable mini-playlist`,
        `- videoId: YouTube video ID if you find a documentary or interview`,
        `- videoTitle: video title`,
        `- keyPeople: important people mentioned in the story`,
        `- sources: cited source links from your research`,
        ``,
        `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = StoryCard(...). Do NOT write any text before or after. No explanations.`,
      ].join("\n");
    }

    case "track": {
      if (!arg) return "Which track? Example: /track So What Miles Davis";
      return [
        `Research this track in detail: "${arg}"`,
        `MANDATORY: Output a TrackCard OpenUI component.`,
        ``,
        `RESEARCH (do these in this order — Perplexity FIRST):`,
        `1. Use search_web (Perplexity) FIRST for the full story behind the track — recording context, who played on it, cultural impact, interesting facts. This gives you the narrative for the context prop AND most of the credits.`,
        `2. Search Discogs for production credits, vinyl pressing count, median price, original pressing details, and cover art URL`,
        `3. Search WhoSampled for BOTH directions:`,
        `   - What samples does this track USE (direction: "from", use fields: name, artist, year, element)`,
        `   - What tracks have SAMPLED this track (direction: "by", use fields: name, artist, year)`,
        `4. Search MusicBrainz for additional track credits (musicians, writers) if Perplexity/Discogs didn't cover them`,
        `5. Search Genius for a notable annotation or fun fact (do NOT include actual lyrics — just trivia/context)`,
        `6. Search iTunes for album art if Discogs didn't return one`,
        ``,
        `SAMPLE FORMAT — use these exact field names:`,
        `  {name: "Track Name", artist: "Artist Name", year: "1990", direction: "from", element: "drum break"}`,
        `  {name: "Track Name", artist: "Artist Name", year: "2005", direction: "by"}`,
        ``,
        `OUTPUT: TrackCard with all available data. The context prop MUST contain the narrative/story from Perplexity (2-3 paragraphs about the recording, cultural impact, interesting facts). Include imageUrl from Discogs/iTunes.`,
        ``,
        `CRITICAL OUTPUT RULES:`,
        `- Your ENTIRE response must be ONLY the OpenUI Lang: root = TrackCard(...)`,
        `- Do NOT write any text before or after the component`,
        `- Do NOT explain your research process`,
        `- Do NOT say "Let me assemble" or "Here's the TrackCard"`,
        `- Just output the component directly — nothing else`,
      ].join("\n");
    }

    case "artist": {
      if (!arg) return "Which artist? Example: /artist MF DOOM";
      return [
        `Research this artist in full detail: "${arg}"`,
        `MANDATORY: Output an ArtistProfile OpenUI component.`,
        `RESEARCH:`,
        `1. Search MusicBrainz for artist metadata, discography, and relationships`,
        `2. Search Discogs for releases, labels, credits, and collaborators`,
        `3. Search Last.fm for listener stats, tags, and similar artists`,
        `4. Search Genius for artist bio and annotations`,
        `5. Search YouTube for a documentary, interview, or live performance`,
        `6. Search for artist image via artwork API`,
        `OUTPUT: ArtistProfile with all tabs populated. Use ArtistCard only for compact inline mentions.`,
        `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = ArtistProfile(...). Do NOT write any text before or after. No explanations.`,
      ].join("\n");
    }

    case "tumblr": {
      if (!arg) {
        return [
          `The user wants to browse their Tumblr dashboard for music content. Follow these steps EXACTLY:`,
          ``,
          `1. Call read_tumblr_dashboard with limit=20`,
          `2. Take the posts array from the result and stringify it as JSON`,
          `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
          ``,
          `TumblrFeed takes three arguments:`,
          `  - posts (JSON string): the posts array`,
          `  - source (string): "dashboard"`,
          `  - totalCount (number): number of posts returned`,
          ``,
          `Example OpenUI Lang output:`,
          `root = TumblrFeed("[{\\"type\\":\\"audio\\",\\"blog_name\\":\\"musicblog\\",\\"artist\\":\\"Ezra Collective\\",\\"track_name\\":\\"No Confusion\\"}]", "dashboard", 20)`,
          ``,
          `If Tumblr is not connected, tell the user to connect Tumblr in Settings → Connected Services.`,
          ``,
          `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after. No markdown. No explanations. Just the OpenUI Lang.`,
        ].join("\n");
      }

      if (arg.toLowerCase().trim() === "likes") {
        return [
          `The user wants to see their liked Tumblr posts. Follow these steps EXACTLY:`,
          ``,
          `1. Call read_tumblr_likes with limit=20`,
          `2. Take the posts array from the result and stringify it as JSON`,
          `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
          ``,
          `TumblrFeed takes three arguments:`,
          `  - posts (JSON string): the posts array`,
          `  - source (string): "likes"`,
          `  - totalCount (number): number of posts returned`,
          ``,
          `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after.`,
        ].join("\n");
      }

      // /tumblr #tag or /tumblr tag
      const tag = arg.replace(/^#/, "").trim();
      return [
        `The user wants to discover music on Tumblr tagged "${tag}". Follow these steps EXACTLY:`,
        ``,
        `1. Call read_tumblr_tagged with tag="${tag}"`,
        `2. Take the posts array from the result and stringify it as JSON`,
        `3. Output ONLY OpenUI Lang using TumblrFeed — nothing else`,
        ``,
        `TumblrFeed takes four arguments:`,
        `  - posts (JSON string): the posts array`,
        `  - source (string): "tagged"`,
        `  - totalCount (number): number of posts returned`,
        `  - tag (string): "${tag}"`,
        ``,
        `Example OpenUI Lang output:`,
        `root = TumblrFeed("[{\\"type\\":\\"audio\\",\\"blog_name\\":\\"afrobeatfm\\",\\"artist\\":\\"Fela Kuti\\",\\"track_name\\":\\"Zombie\\"}]", "tagged", 15, "${tag}")`,
        ``,
        `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = TumblrFeed(...). Do NOT write any text before or after. No markdown. No explanations.`,
      ].join("\n");
    }

    case "spotify": {
      if (!arg) {
        return [
          `The user wants to explore their Spotify library. Follow these steps EXACTLY:`,
          ``,
          `1. Call read_spotify_library with type="playlists" and limit=20`,
          `2. Take the playlists array from the result and stringify it as JSON`,
          `3. Output ONLY OpenUI Lang using SpotifyPlaylists — nothing else`,
          ``,
          `SpotifyPlaylists takes two arguments:`,
          `  - totalCount (number): total playlists`,
          `  - playlists (JSON string): the playlists array with name, trackCount, playlistId`,
          ``,
          `Example OpenUI Lang output:`,
          `root = SpotifyPlaylists(20, "[{\\"name\\":\\"HYFIN tracks\\",\\"trackCount\\":272,\\"playlistId\\":\\"3cEYpjA9oz9GiPac4AsH4n\\"},{\\"name\\":\\"Jazz Is Dead\\",\\"trackCount\\":45,\\"playlistId\\":\\"5Rrf7mqN8uus2AaQQQNdc1\\"}]")`,
          ``,
          `If Spotify is not connected, tell the user to connect Spotify in Settings → Connected Services.`,
          ``,
          `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = SpotifyPlaylists(...). Do NOT write any text before or after. No markdown tables. No explanations. Just the OpenUI Lang.`,
        ].join("\n");
      }

      // /spotify [playlist name] — search for a specific playlist
      return [
        `The user wants to find and play "${arg}" from their Spotify library. Follow these steps:`,
        ``,
        `1. Call read_spotify_library with type="playlists" and limit=50`,
        `2. Find the playlist matching "${arg}" (fuzzy match on name)`,
        `3. If found, call read_playlist_tracks with that playlistId`,
        `4. Output ONLY OpenUI Lang using SpotifyPlaylist — nothing else`,
        ``,
        `SpotifyPlaylist takes five arguments:`,
        `  - name (string): playlist name`,
        `  - trackCount (number): total tracks`,
        `  - playlistId (string): Spotify playlist ID`,
        `  - playlistUrl (string): full Spotify URL`,
        `  - tracks (JSON string): array of track objects with position, name, artist, album, year, durationSec`,
        ``,
        `Example OpenUI Lang output:`,
        `root = SpotifyPlaylist("HYFIN Evening Set", 45, "3cEYpjA9oz9GiPac4AsH4n", "https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n", "[{\\"position\\":1,\\"name\\":\\"Time (You and I)\\",\\"artist\\":\\"Khruangbin\\",\\"album\\":\\"Con Todo El Mundo\\",\\"year\\":\\"2018\\",\\"durationSec\\":234}]")`,
        ``,
        `If no playlist matches "${arg}", show all playlists using SpotifyPlaylists instead.`,
        `If Spotify is not connected, tell the user to connect Spotify in Settings → Connected Services.`,
        ``,
        `CRITICAL: Your ENTIRE response must be ONLY the OpenUI Lang: root = SpotifyPlaylist(...) or root = SpotifyPlaylists(...). Do NOT write any text before or after. No markdown tables. No explanations. Just the OpenUI Lang.`,
      ].join("\n");
    }

    default:
      // Unknown slash command — pass through as-is
      return message;
  }
}

/** Generate a human-readable session title from a message (especially slash commands). */
export function getSessionTitle(message: string): string {
  const trimmed = message.trim();

  if (trimmed.startsWith("/")) {
    const spaceIdx = trimmed.indexOf(" ");
    const nlIdx = trimmed.indexOf("\n");
    const firstBreak = spaceIdx === -1 ? nlIdx : nlIdx === -1 ? spaceIdx : Math.min(spaceIdx, nlIdx);
    const cmd = (firstBreak === -1 ? trimmed.slice(1) : trimmed.slice(1, firstBreak)).toLowerCase();
    const arg = firstBreak === -1 ? "" : trimmed.slice(firstBreak + 1).trim();

    switch (cmd) {
      case "prep":
      case "show-prep":
      case "showprep": {
        // Extract station from structured or freeform input
        const metaMatch = arg.match(/station=(\w[\w\s]*?)(?:\||])/i);
        const station = metaMatch?.[1]?.trim();
        if (station) return `${station} Show Prep`;
        const firstLine = arg.split("\n")[0]?.replace(/:$/, "").trim() ?? "";
        if (["88nine", "hyfin", "rhythm lab", "rhythmlab"].includes(firstLine.toLowerCase().replace(/\s+/g, ""))) {
          return `${firstLine} Show Prep`;
        }
        return "Show Prep";
      }
      case "story":
        return arg ? `Story: ${arg}` : "Story";
      case "track":
        return arg ? `Track: ${arg}` : "Track";
      case "artist":
        return arg ? `Artist: ${arg}` : "Artist";
      case "news":
        return arg ? `${arg.trim()} Music News` : "Music News";
      case "influence":
        return arg ? `${arg.trim()} Influences` : "Influence Map";
      case "publish":
        return arg ? `Publish to ${arg.split(/\s+/)[0]}` : "Publish";
      case "published":
        return "Published Content";
      case "radio":
        return arg ? `Radio: ${arg.trim().slice(0, 30)}` : "Radio";
      case "create-skill":
        return arg ? `Create Skill: ${arg.slice(0, 30)}` : "Create Skill";
      case "skills":
        return "My Skills";
      case "spotify":
        return arg ? `Spotify: ${arg.trim().slice(0, 30)}` : "My Spotify Library";
      case "tumblr":
        if (arg?.toLowerCase().trim() === "likes") return "Tumblr Likes";
        return arg ? `Tumblr: #${arg.replace(/^#/, "").trim()}` : "Tumblr Dashboard";
      default:
        break;
    }
  }

  // Regular message — truncate sensibly
  const title = trimmed.length > 50 ? trimmed.slice(0, 50) + "..." : trimmed;
  return title;
}

/** Commands that require Pro or Team plan. */
const PRO_COMMANDS = new Set(["publish", "published"]);

/**
 * Check if a slash command requires Pro plan.
 * Returns the command name if gated, or null if not.
 */
export function getGatedCommand(message: string): string | null {
  const trimmed = message.trim();
  if (!trimmed.startsWith("/")) return null;
  const firstBreak = trimmed.search(/[\s]/);
  const cmd = (firstBreak === -1 ? trimmed.slice(1) : trimmed.slice(1, firstBreak)).toLowerCase();
  return PRO_COMMANDS.has(cmd) ? cmd : null;
}

/** Simple chat-tier classifier — returns true for greetings and short conversational messages. */
export function isChatTier(message: string): boolean {
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
  // Messages that mention connected services or actions — always agent tier
  if (/send|share|post|slack|spotify|playlist|google doc|#\w+|@\w+/i.test(lower)) return false;
  // Very short messages without music-specific keywords
  if (lower.split(/\s+/).length <= 4 && !/artist|album|track|song|sample|genre|vinyl|record|concert|tour|library|influence/i.test(lower)) return true;
  return false;
}
