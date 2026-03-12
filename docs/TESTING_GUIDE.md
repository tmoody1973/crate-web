# Crate Web — Feature Testing Guide

> Test prompts organized by user persona. Each section covers a real workflow with expected results.

## Quick Start

1. Open [localhost:3000](http://localhost:3000) and sign in
2. Add your Anthropic API key in Settings (Shift+S)
3. Pick a persona below and try the prompts in order

---

## DJ Persona

DJs need sample discovery, BPM info, set building, and crate digging across genres.

### Sample Discovery
```
Who sampled "Amen Brother" by The Winstons?
```
Expected: Sample chain showing the Amen Break's use across hip-hop, jungle, and drum & bass. Sources: WhoSampled, Discogs, Wikipedia.

```
Trace the sample history of "It's a New Day" by Skull Snaps
```
Expected: Deep sample archaeology — dozens of hip-hop tracks that sampled this break.

```
What songs sample "Impeach the President" by The Honey Drippers?
```
Expected: List of tracks with years, artists, and links back to source databases.

### Set Building
```
Build me a 10-track playlist of deep house tracks from the late 90s Chicago scene
```
Expected: Curated playlist with verified track names, artists, labels. Playable via YouTube.

```
Find tracks similar to "Mystery of Love" by Mr. Fingers
```
Expected: Similar tracks from Last.fm similarity data + Bandcamp discovery.

```
What's playing on NTS Radio right now?
```
Expected: Live radio station search results with stream links.

### Crate Digging
```
Show me rare funk 45s on the Stax label worth over $50
```
Expected: Discogs marketplace data with pressing details, median prices, and condition notes.

```
What are the most valuable Northern Soul records?
```
Expected: Vinyl valuation data from Discogs with pressing info and market stats.

---

## Radio Host Persona

Radio hosts need artist context, talking points, event info, and publishable research.

### Artist Research for On-Air
```
Give me a deep dive on Khruangbin — I'm interviewing them next week
```
Expected: Comprehensive artist profile — bio, discography, influences, touring history, scene context. Triggers the Artist Deep Dive skill.

```
Tell me everything about Noname — her career, influences, and what makes her unique
```
Expected: Multi-source research pulling from Wikipedia, MusicBrainz, Genius, Last.fm, and Bandcamp.

```
What are the connections between Erykah Badu, J Dilla, and Madlib?
```
Expected: Influence network mapping showing collaboration history, shared samples, and artistic connections.

### Show Prep
```
/news 5
```
Expected: 5 music news stories from today pulled from Pitchfork, Stereogum, Resident Advisor, The Quietus, and other publications.

```
What concerts are happening in Milwaukee this month?
```
Expected: Ticketmaster event listings with dates, venues, and ticket links.

```
What's the story behind the Numero Group label?
```
Expected: Label research from Discogs (catalog), Wikipedia (history), and Bandcamp (current releases).

### Publishing & Sharing
After getting a great research response, test the action bar:

- **Copy** — Click Copy, paste into a document
- **Slack** — Click Slack (visible only for @radiomilwaukee.org users), verify delivery to #88nine channel
- **Email** — Click Email, enter an address, verify delivery
- **Share** — Click Share, verify clipboard

```
Publish a deep dive on Milwaukee's hip-hop scene to Telegraph
```
Expected: Agent creates a Telegraph page with formatted content and returns a shareable link.

---

## Record Collector Persona

Collectors need pressing identification, market prices, label catalogs, and collection management.

### Vinyl Identification & Valuation
```
I have a first pressing of "Blue Train" by John Coltrane on Blue Note — what's it worth?
```
Expected: Triggers Vinyl Valuation skill. Returns pressing details (BLP 1577), matrix numbers, and Discogs marketplace prices by condition.

```
How do I identify an original pressing of Stevie Wonder "Songs in the Key of Life"?
```
Expected: Matrix/runout info, label variations, and price ranges from Discogs.

```
What are the most valuable jazz records from the Prestige label?
```
Expected: Label catalog search with marketplace stats for top releases.

### Collection Management
```
Add "Kind of Blue" by Miles Davis to my collection — 1959 Columbia original, VG+ condition
```
Expected: Record added to collection with metadata (label, year, format, condition, tags).

```
Show me everything in my collection tagged "jazz"
```
Expected: Collection search results with all saved records matching the tag.

```
What's the total value of my collection?
```
Expected: Collection stats with count, estimated value range, and tag breakdown.

### Label Deep Dives
```
Map out the Blue Note Records catalog from the 1960s — key artists and essential releases
```
Expected: Discogs label search + MusicBrainz cross-reference. Key artists, landmark albums, and catalog numbers.

```
Compare the ECM and Blue Note approaches to recording jazz
```
Expected: Multi-source research comparing label philosophies, production styles, and key releases.

---

## Music Lover / Casual Listener Persona

Music lovers want discovery, context, playlists, and rabbit holes to follow.

### Discovery
```
I love Radiohead — what else should I listen to?
```
Expected: Similar artists from Last.fm + influence tracing. Mix of obvious (Thom Yorke solo) and surprising (CAN, Autechre) recommendations.

```
What's the best music coming out of Nigeria right now?
```
Expected: Scene mapping of Afrobeats, Afropop, and alternative scenes with key artists and recommended tracks.

```
Recommend some albums for a rainy Sunday afternoon
```
Expected: Curated suggestions with album artwork, descriptions, and play links.

### Going Down Rabbit Holes
```
How did punk rock in the 1970s influence electronic music?
```
Expected: Influence path tracing from punk (Suicide, Wire, Cabaret Voltaire) to electronic (Depeche Mode, New Order, DAF).

```
Map the influence chain from Robert Johnson to Jack White
```
Expected: Multi-hop influence path through blues, rock & roll, garage rock with sources cited.

```
What's the connection between Brazilian Tropicalia and modern indie rock?
```
Expected: Cultural/musical influence tracing — Os Mutantes → Animal Collective, Caetano Veloso → David Byrne, etc.

### Playback
```
/play Massive Attack - Teardrop
```
Expected: YouTube search and playback in the persistent player bar.

```
Create a playlist called "Late Night Drives" with 8 tracks — mix of trip-hop, downtempo, and ambient
```
Expected: Playlist created with verified tracks. Playable via the player.

```
/play playlist Late Night Drives
```
Expected: Starts playing the saved playlist.

---

## Music Journalist Persona

Journalists need deep research, source attribution, interview prep, and publishable content.

### Investigative Research
```
Deep dive into the history of sampling lawsuits — key cases and how they changed music
```
Expected: Multi-source research pulling from Wikipedia (legal cases), Genius (annotations about sampling), and web search (journalism).

```
How has streaming changed the economics of independent music? Pull data from multiple sources
```
Expected: Research combining industry data, artist perspectives, and label economics.

```
What's the current state of the vinyl revival? Sales numbers, key labels, pressing plant capacity
```
Expected: Data-driven research from multiple sources with citations.

### Artist Profiles
```
Write a profile of Floating Points — his academic background, musical evolution, and the Promises collaboration with Pharoah Sanders
```
Expected: Comprehensive artist research suitable as a starting point for a feature article.

```
Compare the careers and artistic approaches of Kendrick Lamar and J. Cole
```
Expected: Side-by-side analysis drawing from discographies, critical reception (reviews), streaming data, and touring.

### Scene Reporting
```
Map the current electronic music scene in Berlin — key clubs, labels, and artists
```
Expected: Triggers Scene Mapping skill. Geographic music scene with venues, labels, key figures, and timeline.

```
What's happening in the Amapiano scene? Origin, key artists, and global spread
```
Expected: Genre research combining Wikipedia history, Bandcamp discovery, and web search for current developments.

### Publishing Workflow
After researching, test the full publishing pipeline:

1. Copy a response and verify formatting
2. Send to email for editing
3. Publish a polished version to Telegraph
4. Post to Tumblr (if configured)

```
Publish my research on Berlin's electronic scene as a Telegraph article
```
Expected: Formatted article posted to Telegraph with a shareable URL.

---

## Feature Checklist

Use this checklist to verify all major features work:

### Core Chat
- [ ] Simple greeting responds in ~1-2s (fast path)
- [ ] Music research query uses full agent with tools (10-30s)
- [ ] Streaming tokens appear progressively
- [ ] Tool activity shown during research
- [ ] Multi-model switching works (Settings → model selector)

### Data Sources
- [ ] MusicBrainz (free) — artist/release search
- [ ] Discogs (embedded key) — vinyl, marketplace
- [ ] Last.fm (embedded key) — similar artists, top tracks
- [ ] Bandcamp (free) — independent music discovery
- [ ] Wikipedia (free) — artist bios, genre context
- [ ] Ticketmaster (embedded key) — live events
- [ ] Genius (user key) — lyrics, annotations
- [ ] WhoSampled (browser key) — sample relationships
- [ ] Web Search (Tavily/Exa key) — general research

### Skills (Auto-triggered)
- [ ] Artist Deep Dive — "deep dive on [artist]"
- [ ] Sample Archaeology — "who sampled [track]"
- [ ] Scene Mapping — "map the music scene in [city]"
- [ ] Vinyl Valuation — "what's my [record] worth"

### Player
- [ ] `/play [track]` starts YouTube playback
- [ ] Player bar persists across navigation
- [ ] Pause/resume works
- [ ] Volume control works

### Actions
- [ ] Copy button copies response to clipboard
- [ ] Slack button sends to channel (allowed users only)
- [ ] Email button sends to custom address
- [ ] Share button copies to clipboard

### Sidebar & Persistence
- [ ] New chat creates a session
- [ ] Chat history persists across page refreshes
- [ ] Crates (project groups) work
- [ ] Search finds past sessions
- [ ] Artifacts panel opens when agent generates components

### Settings
- [ ] API keys save and encrypt
- [ ] Model selector shows correct models
- [ ] OpenRouter models appear when key is added
- [ ] Team key sharing works for admins

### Keyboard Shortcuts
- [ ] `Cmd+K` — Search
- [ ] `Cmd+N` — New chat
- [ ] `Cmd+B` — Toggle sidebar
- [ ] `Shift+S` — Settings

---

## Tips for Testers

1. **Start simple** — Try a greeting first to verify the fast path works
2. **Check the tools** — Watch the tool activity indicator during research to see which sources are being queried
3. **Try follow-ups** — After a research response, ask a follow-up to test conversational context
4. **Test edge cases** — Misspelled artist names, obscure genres, very old records
5. **Compare models** — Try the same query with Claude Haiku vs Sonnet to compare speed/quality
6. **Check sources** — Verify that links and data match the original sources (Discogs, MusicBrainz, etc.)
