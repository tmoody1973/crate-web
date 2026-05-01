# Crate Show Prep — Feature Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** Turn a pasted setlist into a structured, station-voiced show prep package rendered as a single OpenUI artifact — music context, talk breaks, social copy, local tie-ins, and interview prep.

**Architecture:** Skill + OpenUI components. No new MCP server, no new Convex tables, no dedicated route in Phase 1. The skill orchestrates existing tools (Discogs, MusicBrainz, Genius, Bandcamp, Last.fm, Ticketmaster, web search, news) and outputs a ShowPrepPackage artifact. Station voice comes from YAML profiles.

**Tech Stack:** Crate CLI skill system (SKILL.md), OpenUI Lang components, YAML station profiles, existing MCP servers.

---

## Stations Served

Three Radio Milwaukee stations, each with distinct voice and audience:

| Station | Voice | Music Focus | Talk Style |
|---------|-------|-------------|------------|
| **88Nine** | Warm, eclectic, community-forward | Indie, alternative, world, electronic, hip-hop | Discovery-oriented, "let me tell you about this artist" |
| **HYFIN** | Bold, culturally sharp, unapologetic | Urban alternative, neo-soul, progressive hip-hop, Afrobeats | Cultural context, movement-building, "here's why this matters" |
| **Rhythm Lab** | Curated, global perspective, deep knowledge | Global beats, electronic, jazz fusion, experimental | Influence tracing, crate-digging stories, "the thread connecting these sounds" |

---

## Input Flow

DJs paste their setlist directly in the chat:

```
Prep my evening show for HYFIN:
Khruangbin - Time (You and I)
Little Simz - Gorilla
KAYTRANADA - Glued
```

The skill parses station, shift, and "Artist - Title" lines from the message body. If no tracks are provided, the skill asks for them.

Single-track quick mode also supported:
```
show prep track Khruangbin - Time (You and I) for HYFIN
```

---

## Skill Workflow

**Step 1: Parse** — Extract station name, shift (morning/midday/afternoon/evening/overnight), and track list from the message.

**Step 2: Resolve** — For each track, parallel lookups:
- MusicBrainz → canonical metadata, producer/engineer credits, recording relationships
- Discogs → release year, label, catalog number, pressing details
- Genius → song annotations, verified artist commentary, production context
- Bandcamp → artist statements, liner notes, community tags
- Last.fm → similar artists, listener stats, top tags

**Step 3: Synthesize** — Merge results per track into TrackContext:
- Origin story (how this track came to be)
- Production notes (studio, producer, notable instruments)
- Connections (influences, samples, collaborations)
- Influence chain (musical lineage via Crate's influence tracer)
- Lesser-known fact (the detail listeners can't easily Google)
- Apply "why it matters" filter (Rule 1) and audience relevance ranking (Rule 6)

**Step 4: Format** — Load station YAML profile. Generate:
- Talk breaks in 30s/60s/deep variants using station voice
- Social copy per platform (Instagram, X, Bluesky) with station hashtags
- Local tie-ins from Milwaukee sources (see below) and Ticketmaster events

**Step 5: Assemble** — Output a single `ShowPrepPackage` OpenUI artifact. Chat shows progress text during research. Artifact appears in slide-in panel when complete.

---

## Milwaukee Local Sources

Integrated via RSS feeds and web search during Step 4 for hyper-local tie-ins:

| Source | URL | Content |
|--------|-----|---------|
| **Milwaukee Record** | milwaukeerecord.com | Local music coverage, venue news, scene reports |
| **Journal Sentinel** | jsonline.com | Arts & entertainment, community events |
| **Urban Milwaukee** | urbanmilwaukee.com | Neighborhood news, cultural coverage, venue openings |
| **OnMilwaukee** | onmilwaukee.com | Events, food/arts/music intersections, city culture |
| **88Nine** | radiomilwaukee.org | Station news, local artist features, event calendar |
| **Shepherd Express** | shepherdexpress.com | Alt-weekly, music reviews, local show listings |

These surface:
- **Event tie-ins:** "Catch [local artist] at Turner Hall Saturday — similar vibes to that Khruangbin track"
- **Community spotlights:** Local organizations, openings, milestones relevant to the audience
- **Neighborhood callouts:** Bay View, Riverwest, Walker's Point, Bronzeville cultural moments
- **Seasonal hooks:** Festival previews, seasonal context, weather-appropriate transitions

---

## OpenUI Components

Five new components added to `src/lib/openui/components.tsx`:

### ShowPrepPackage
```
ShowPrepPackage(station, date, dj, shift, tracks, talkBreaks, socialPosts, interviewPreps?)
```
Top-level container. Station badge with color (HYFIN = gold, 88Nine = blue, Rhythm Lab = purple). Date, DJ name, shift. Children are arrays of cards. Collapsible sections per track.

### TrackContextCard
```
TrackContextCard(artist, title, originStory, productionNotes, connections, influenceChain, lesserKnownFact, whyItMatters, audienceRelevance, localTieIn?, pronunciationGuide?, imageUrl?)
```
Core card per track. Album art + play button. Relevance badge (high = green, medium = yellow, low = gray). `whyItMatters` always visible as the headline. Expandable sections for origin story, production notes, influence chain.

### TalkBreakCard
```
TalkBreakCard(type, beforeTrack, afterTrack, shortVersion, mediumVersion, longVersion, keyPhrases, timingCue?, pronunciationGuide?)
```
Type badge (intro/back-announce/transition/feature). Three tabs for short/medium/long variants. Key phrases bolded. Copy button per variant.

### SocialPostCard
```
SocialPostCard(trackOrTopic, instagram, twitter, bluesky, hashtags)
```
Three platform tabs with pre-formatted copy. Copy button per platform. Station-specific hashtags as pills.

### InterviewPrepCard
```
InterviewPrepCard(guestName, warmUpQuestions, deepDiveQuestions, localQuestions, avoidQuestions)
```
Three question categories as expandable sections. "Avoid" section in muted red — common overasked questions flagged. Only generated when DJ mentions an interview or guest.

---

## Station YAML Profile Structure

Each station is a YAML file at `src/skills/show-prep/stations/{station}.yaml`:

```yaml
name: HYFIN
tagline: "Black alternative radio"
color: "#D4A843"

voice:
  tone: "Bold, culturally sharp, unapologetic"
  perspective: "Cultural context, movement-building, 'here's why this matters'"
  music_focus: "Urban alternative, neo-soul, progressive hip-hop, Afrobeats"
  vocabulary:
    prefer: ["culture", "movement", "lineage", "vibration", "frequency"]
    avoid: ["urban (standalone)", "exotic", "ethnic"]

defaults:
  break_length: medium
  depth: deep_cultural_context
  audience: "Young, culturally aware Milwaukee listeners invested in Black art and music"

social:
  hashtags: ["#HYFIN", "#MKE", "#BlackAlternative"]
  tone: "Confident, community-first"

recurring_features:
  - name: "The Lineage"
    description: "Influence chain connecting today's new release to its roots"
    frequency: daily
  - name: "Culture Check"
    description: "Arts/culture moment from Black and brown communities locally and globally"
    frequency: daily

local:
  venues: ["Turner Hall Ballroom", "Vivarium", "The Cooperage", "Cactus Club"]
  neighborhoods: ["Bronzeville", "Riverwest", "Bay View", "Walker's Point"]
  market: "Milwaukee, WI"
  sources: ["milwaukeerecord.com", "jsonline.com", "urbanmilwaukee.com", "onmilwaukee.com"]
```

DJs can override per-session in the chat: "prep my show for HYFIN but keep it shorter than usual."

---

## Radio Milwaukee Show Prep Rules (Design Foundation)

Every feature must serve at least one of these six rules, already posted in the Radio Milwaukee studio:

1. **Always ask why the information matters to the listener. Avoid slot filling.** → `whyItMatters` field on every TrackContextCard. No generic filler.
2. **Know the audience. Keep content audience-focused.** → Station YAML profiles shape all generated content.
3. **Test drive the content. Practice. Do not do the show before the show.** → Talk breaks are starting points, not scripts. Multiple lengths for the DJ to choose and develop.
4. **Schedule your music in advance to allow time for prep.** → Playlist-in workflow is the primary input. Also supports reverse lookup: "find songs for this break idea."
5. **Go with the moment. Be flexible.** → Modular cards, not monolithic document. Single-track quick mode for mid-show pivots.
6. **When selecting a topic, consider if the audience wants it.** → `audienceRelevance` ranking (high/medium/low) on every card.

---

## Phasing

### Phase 1 — Core Skill + Components (ship first)
- `show-prep` SKILL.md with triggers, workflow, tool priority
- 3 station YAML profiles (88Nine, HYFIN, Rhythm Lab)
- 5 OpenUI components (ShowPrepPackage, TrackContextCard, TalkBreakCard, SocialPostCard, InterviewPrepCard)
- OpenUI prompt additions documenting new components
- Setlist parsing from inline paste
- Single-track quick mode
- Test with Rhythm Lab (Tarik's own show = fastest feedback loop)

### Phase 2 — Polish + Local Context
- Milwaukee local tie-ins via RSS feeds, web search, Ticketmaster
- Recurring feature generation (The Lineage, Deep Cut Daily, Crate Connection)
- Social copy refinement with station-specific hashtag conventions
- Interview prep triggered by guest mention
- Reverse lookup: "find songs for a break about [topic] for [station]"

### Phase 3 — Dedicated Web View (later)
- `/show-prep` route with station selector, date picker, shift selector
- Paste-friendly setlist input area with track search/add
- Pre-fills agent chat with structured context
- Export to PDF/Markdown for studio printing
- Show prep history in sidebar

---

## What We're NOT Building in Phase 1

- No new MCP server — skill orchestrates existing tools
- No new Convex tables — prep packages save as artifacts (already persist)
- No dedicated web route — chat-first, artifact panel is the view
- No Zetta integration — paste input only
- No 414 Music station — three stations only
- No PDF export — Phase 3
- No multi-agent orchestration — single agent with skill instructions
