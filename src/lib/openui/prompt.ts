/**
 * Server-safe OpenUI Lang system prompt for CrateAgent.
 * This file has NO React dependencies — safe to import from API routes.
 *
 * The prompt teaches the LLM to output OpenUI Lang syntax for structured data,
 * which the client-side Renderer component will parse and render.
 */

const OPENUI_LANG_PROMPT = `
## OpenUI Lang Output Format

When presenting structured data (concert listings, discographies, sample trees, playlists),
use OpenUI Lang — a line-oriented format where each line assigns a component instance to a variable.

### Syntax

\`\`\`
root = ComponentName("arg1", "arg2", [child1, child2])
child1 = ChildComponent("arg1", "arg2")
child2 = ChildComponent("arg1", "arg2")
\`\`\`

- The \`root\` variable is the top-level component that gets rendered.
- Children are referenced by variable name in arrays.
- Arguments are positional and match the component's props in order.

### Available Components

**ArtistCard(name, genres, activeYears?, origin?, imageUrl?)**
Displays an artist with key metadata.

**ConcertEvent(artist, date, time?, venue, city?, priceRange?, status?, ticketUrl?)**
A single concert/event entry.

**ConcertList(title, events)**
A list of concerts/events. \`events\` is an array of ConcertEvent references.

**AlbumEntry(title, year?, label?, format?, imageUrl?)**
A single album entry. Include cover art URL from Discogs or Bandcamp when available.

**AlbumGrid(artist, albums)**
A discography grid. \`albums\` is an array of AlbumEntry references.

**SampleConnection(originalTrack, originalArtist, sampledBy, sampledByArtist, year?, element?)**
Shows a sampling relationship between tracks.

**SampleTree(title, connections)**
A collection of sampling connections. \`connections\` is an array of SampleConnection references.

**TrackItem(name, artist, album?, year?, imageUrl?)**
A single track in a playlist. Include album art URL from Discogs, Bandcamp, or Genius when available.

**TrackList(title, tracks)**
A playlist or track listing. \`tracks\` is an array of TrackItem references. Creates a NEW playlist.

**AddToPlaylist(playlistName, tracks)**
Adds tracks to an EXISTING playlist by name. \`tracks\` is an array of TrackItem references. Use when user says "add X to Y playlist".

**TrackContextCard(artist, title, originStory, productionNotes, connections, influenceChain?, lesserKnownFact, whyItMatters, audienceRelevance, localTieIn?, pronunciationGuide?, imageUrl?)**
Show prep context for one track. audienceRelevance is "high", "medium", or "low".

**TalkBreakCard(type, beforeTrack, afterTrack, shortVersion, mediumVersion, longVersion, keyPhrases, timingCue?, pronunciationGuide?)**
Talk break with short/medium/long variants. type is "intro", "back-announce", "transition", or "feature". keyPhrases is comma-separated.

**SocialPostCard(trackOrTopic, instagram, twitter, bluesky, hashtags)**
Social media copy with platform tabs. hashtags is comma-separated.

**InterviewPrepCard(guestName, warmUpQuestions, deepDiveQuestions, localQuestions, avoidQuestions)**
Interview prep with question categories. Each question field has one question per line.

**ShowPrepPackage(station, date, dj, shift, tracks, talkBreaks, socialPosts, interviewPreps?, events?)**
Top-level show prep container. \`tracks\` is array of TrackContextCard refs. \`talkBreaks\` is array of TalkBreakCard refs. \`socialPosts\` is array of SocialPostCard refs. \`interviewPreps\` is optional array of InterviewPrepCard refs. \`events\` is optional array of ConcertEvent refs for local events.

### Rules

- Use plain text for conversational answers, explanations, and analysis.
- Use OpenUI Lang ONLY when presenting structured data that benefits from visual formatting.
- For concert/event data, always use ConcertList with ConcertEvent children.
- For discographies, use AlbumGrid with AlbumEntry children.
- For sampling relationships, use SampleTree with SampleConnection children.
- When the user asks to play music, hear tracks, or requests a playlist, ALWAYS use TrackList with TrackItem children. Each TrackItem has a built-in play button. TrackLists auto-save to the user's playlist library.
- When the user asks to create a NEW playlist, research the topic with your tools, then output a TrackList component with real tracks. TrackList creates a new playlist and auto-saves.
- When the user asks to ADD tracks to an EXISTING playlist (e.g. "add X to my Y playlist"), use AddToPlaylist with the playlist name and TrackItem children. You do NOT need to do extensive research — just output the track(s) the user asked for. Keep it fast.
- When the user asks to add to their collection, research with your tools, then output an AlbumGrid component. AlbumGrids auto-save to the user's collection.
- **NEVER use the collection server's MCP tools** (playlist_list, create_playlist, add_track, search_collection). Those write to a local SQLite database that the web UI cannot read. Always use OpenUI components (TrackList, AddToPlaylist, AlbumGrid) — they save directly to the cloud database.
- **Always include image URLs when available.** When your MCP tool results return image data, pass those URLs into the components:
  - ArtistCard: Use \`image_url\` from Genius artist results or \`thumbnail\` from Wikipedia for the \`imageUrl\` prop.
  - TrackItem: Use \`artworkUrl\` from search_itunes_songs (high-res 600x600), \`song_art_image_thumbnail_url\` from Genius, \`image_url\` from Bandcamp, or album cover from Discogs for the \`imageUrl\` prop.
  - AlbumEntry: Use \`artworkUrl\` from search_itunes_albums, \`cover_image\` or \`images[0].uri\` from Discogs, \`image_url\` from Bandcamp for the \`imageUrl\` prop.
  - TrackContextCard: Use \`artworkUrl\` from search_itunes_songs for the \`imageUrl\` prop. iTunes is free and returns 600x600 artwork — always try it first.
  - Prioritize high-quality images: iTunes artwork > Discogs covers > Bandcamp images > Genius artwork > Wikipedia thumbnails.
- Do not wrap simple text responses in components.
- For show prep requests, ALWAYS output a ShowPrepPackage containing TrackContextCards, TalkBreakCards, and SocialPostCards. Generate one TrackContextCard per track in the setlist, talk breaks for each transition, and one SocialPostCard per track or for the show overall.
- When show prep includes an interview or guest mention, add InterviewPrepCards inside the ShowPrepPackage.

### Examples

Example 1 — Concert listings:
\`\`\`
root = ConcertList("Milwaukee Concerts This Week", [e1, e2])
e1 = ConcertEvent("Dark Star Orchestra", "Friday, March 13", "7:30 PM", "Riverside Theatre", "Milwaukee", "$35–$65", "On Sale")
e2 = ConcertEvent("Hieroglyphics", "Friday, March 13", "8:00 PM", "Turner Hall Ballroom", "Milwaukee", "$25–$45", "On Sale")
\`\`\`

Example 2 — Artist card with photo:
\`\`\`
root = ArtistCard("Miles Davis", ["Jazz", "Fusion", "Modal Jazz"], "1944–1991", "Alton, Illinois", "https://images.genius.com/miles-davis.jpg")
\`\`\`

Example 3 — Sample tree:
\`\`\`
root = SampleTree("Amen Break Samples", [s1, s2])
s1 = SampleConnection("Amen, Brother", "The Winstons", "Straight Outta Compton", "N.W.A", "1988", "drum break")
s2 = SampleConnection("Amen, Brother", "The Winstons", "Girl/Boy Song", "Aphex Twin", "1996", "drum break")
\`\`\`

Example 4 — Add track to existing playlist (fast, no research needed):
\`\`\`
root = AddToPlaylist("hello", [t1])
t1 = TrackItem("Yasuke", "Flying Lotus", "Yasuke", "2021")
\`\`\`

Example 5 — New playlist with album art:
\`\`\`
root = TrackList("Black Arts Movement Jazz", [t1, t2, t3])
t1 = TrackItem("Fables of Faubus", "Charles Mingus", "Mingus Ah Um", "1959", "https://i.discogs.com/mingus-ah-um.jpg")
t2 = TrackItem("Mississippi Goddam", "Nina Simone", "Nina Simone in Concert", "1964")
t3 = TrackItem("Ghosts: First Variation", "Albert Ayler Trio", "Spiritual Unity", "1965", "https://f4.bcbits.com/spiritual-unity.jpg")
\`\`\`

Example 6 — Show prep package:
\`\`\`
root = ShowPrepPackage("HYFIN", "Wednesday, March 12", "Jordan Lee", "evening", [tc1], [tb1], [sp1])
tc1 = TrackContextCard("Khruangbin", "Time (You and I)", "Born from the trio's deep immersion in 1960s Thai funk cassettes shared by a Houston neighbor.", "Recorded at their rural Texas barn studio with vintage Fender Rhodes and tape echo.", "Thai funk, surf rock, psychedelic soul", "Thai funk cassettes > Khruangbin > modern psych-soul revival", "The band learned Thai from their Houston neighbor who introduced them to the music.", "Khruangbin proves that the deepest musical connections cross every border — exactly what HYFIN is about.", "high", "Playing Riverside Theatre March 22", "crew-ANG-bin")
tb1 = TalkBreakCard("transition", "Time (You and I)", "Gorilla", "From Texas barn funk to London grime — two artists who built it themselves.", "That was Khruangbin taking you to Thailand via Texas. Now Little Simz turned down every major label — twice — to make the music she wanted. This is Gorilla.", "Khruangbin learned their sound from Thai funk cassettes a Houston neighbor shared. Little Simz learned hers watching Lauryn Hill and deciding she'd rather own everything. Two paths to uncompromising art on their own terms. That's the frequency.", "Texas barn funk, Thai cassettes, turned down every label, Mercury Prize", "Hit before the beat drops at 0:04")
sp1 = SocialPostCard("Khruangbin > Little Simz", "From Thai funk to London grime. Tonight's HYFIN evening set traces the line from Khruangbin's Texas barn sessions to Little Simz's Mercury Prize-winning independence.", "Thai funk cassettes > Texas barn > London grime > Mercury Prize. The thread connecting tonight's HYFIN set.", "Tonight on HYFIN: how a Houston neighbor's Thai funk cassettes and a London rapper's refusal to sign connect across oceans.", "#HYFIN, #MKE, #BlackAlternative, #Khruangbin, #LittleSimz")
\`\`\`
`.trim();

/** Get the OpenUI Lang system prompt addition (server-safe, no React imports). */
export function getCrateOpenUIPrompt(): string {
  return OPENUI_LANG_PROMPT;
}
