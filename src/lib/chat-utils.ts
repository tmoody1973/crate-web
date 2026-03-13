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

      // Build research steps
      const researchSteps: string[] = [];
      if (wantsContext || wantsTalkBreaks) {
        researchSteps.push(
          `1. MusicBrainz: search_recording + get_recording_credits \u2014 metadata, producer, studio`,
          `2. Discogs: search_discogs + get_release_full \u2014 release year, label, album context`,
          `3. Genius: search_songs + get_song \u2014 annotations, artist commentary, production context`,
          `4. Bandcamp: search_bandcamp \u2014 artist statements, liner notes`,
          `5. Last.fm: get_track_info + get_similar_tracks \u2014 listener stats, tags`,
        );
      }
      if (wantsEvents) {
        researchSteps.push(`${researchSteps.length + 1}. Ticketmaster: search_events \u2014 upcoming Milwaukee shows`);
      }
      if (wantsContext) {
        researchSteps.push(`${researchSteps.length + 1}. Web search: Milwaukee sources (milwaukeerecord.com, jsonline.com) \u2014 local tie-ins`);
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
        trackList ? `SETLIST:\n${trackList}` : wantsEvents && !wantsContext ? `` : `No tracks provided \u2014 ask for the setlist.`,
        ``,
        researchSteps.length > 0 ? `RESEARCH STEPS:\n${researchSteps.join("\n")}` : ``,
        ``,
        `OUTPUT FORMAT \u2014 CRITICAL:`,
        `You MUST output OpenUI Lang syntax. This is a line-oriented format where each line assigns a component to a variable.`,
        `Do NOT output plain markdown, prose, or bullet points. Output ONLY OpenUI Lang component assignments.`,
        `The output will be rendered as interactive cards in the UI.`,
        ``,
        `Always use ShowPrepPackage as the root container, even for partial prep. Set unused child arrays to empty [].`,
        ``,
        `EXACT SYNTAX (follow this pattern, filling in real researched content):`,
        `\`\`\``,
        `root = ShowPrepPackage("${prepStation || "HYFIN"}", "${day}", "${prepDjName || "DJ"}", "${prepShift}", [${wantsContext ? "tc1, tc2, tc3" : ""}], [${wantsTalkBreaks ? "tb1, tb2" : ""}], [${wantsSocial ? "sp1" : ""}], [${wantsInterview && prepGuest ? "ip1" : ""}], [${wantsEvents ? "ev1, ev2, ev3" : ""}])`,
        wantsContext ? `tc1 = TrackContextCard("Artist Name", "Track Title", "2-3 sentence origin story of how this track came to be", "Key production details \u2014 studio, producer, instruments", "Genre connections, samples, influences", "influence chain: Artist A > Artist B > this track", "The detail listeners can't easily Google", "One sentence: why should THIS audience care right now?", "high", "Upcoming Milwaukee show or local connection", "pronunciation guide if needed", "image URL if found")` : ``,
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
        `- Fill in REAL content from your research \u2014 not placeholder text`,
        `- IMAGES: For each TrackContextCard, include an imageUrl. Get images from: iTunes (artworkUrl from search_itunes_songs \u2014 high-res 600x600, free, no key), Discogs (cover_image or images[0].uri from get_release_full), Genius (song_art_image_thumbnail_url from search_songs), or Bandcamp (image_url). Prioritize iTunes artwork > Discogs covers > Genius art > Bandcamp.`,
        `- Output the OpenUI Lang block with NO surrounding markdown, NO prose before or after`,
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

    case "influence": {
      if (!arg) {
        return "Map an artist's influences. Usage: `/influence [artist name]`\nI'll check the influence cache, run discovery if needed, fetch artwork, and render an interactive influence chain.";
      }

      return [
        `Map the musical influences of ${arg}.`,
        ``,
        `RESEARCH STEPS (do ALL of these):`,
        `1. Check influence cache: lookup_influences for "${arg}"`,
        `2. If cache has fewer than 5 connections, run FULL discovery using ALL available tools:`,
        `   a. search_reviews — find critical reviews that discuss influences and musical lineage`,
        `   b. extract_influences — extract influence relationships from review text`,
        `   c. search_web (Exa) — search for "${arg} musical influences interview" to find deeper analysis`,
        `   d. search_web (Tavily, topic="news") — search for "${arg} influences" for recent articles`,
        `   e. get_similar_tracks / get_artist_info (Last.fm) — find similar artists with similarity scores`,
        `   f. search_recording (MusicBrainz) — get metadata and collaborators`,
        `   g. search_songs (Genius) — find annotations about influences`,
        `3. For EVERY artist discovered, get images:`,
        `   a. search_spotify_artwork with type="artist" — primary source (640x640)`,
        `   b. If Spotify returns no image, use get_fanart_images with the artist's MusicBrainz ID as fallback`,
        `   c. If neither works, try search_itunes_songs for album art`,
        `4. Cache all discoveries: cache_batch_influences with source citations`,
        ``,
        `OUTPUT FORMAT — CRITICAL:`,
        `You MUST output an InfluenceChain OpenUI Lang component. Do NOT output plain text or markdown.`,
        `The connections prop is a JSON string with this structure:`,
        `[{"name":"Artist","weight":0.9,"relationship":"influenced by","context":"Why this connection matters","sources":[{"name":"Source","url":"https://..."}],"imageUrl":"https://spotify-image-url"}]`,
        ``,
        `Include imageUrl from search_spotify_artwork for every connection. Sort by weight descending.`,
        ``,
        `EXACT SYNTAX:`,
        `\`\`\``,
        `root = InfluenceChain("${arg}", "[JSON array of connections with images]")`,
        `\`\`\``,
      ].join("\n");
    }

    default:
      // Unknown slash command — pass through as-is
      return message;
  }
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
  // Very short messages without music-specific keywords
  if (lower.split(/\s+/).length <= 4 && !/artist|album|track|song|sample|genre|vinyl|record|concert|tour/i.test(lower)) return true;
  return false;
}
