# ArtistProfile Component — Design Spec

> **Date:** March 24, 2026
> **Status:** Approved
> **Goal:** Add a full-page artist deep dive OpenUI component with tabbed layout (Overview, Discography, Connections, Media), playable tracks, tappable album list, clickable influence chips, and YouTube embeds. ArtistCard stays as the compact inline summary.

## Overview

`ArtistProfile` is the full artist deep dive. `ArtistCard` remains the compact "baseball card" used inside InfluenceChain and other components. When someone asks "tell me about MF DOOM" or types `/artist MF DOOM`, the agent renders ArtistProfile instead of ArtistCard.

The relationship: ArtistCard is TrackItem, ArtistProfile is TrackCard. Summary vs deep dive.

## Triggers

- **`/artist MF DOOM`** — slash command, guaranteed ArtistProfile
- **Natural language** — "Tell me about MF DOOM", "Who is Flying Lotus?", "Give me a full profile on Madlib"
- **From other components** — tapping "Deep Dive →" on key people in StoryCard, TrackCard, or InfluenceChain injects the chat message

## Layout

### Hero section
- Artist photo as full-width background with gradient overlay (same pattern as InfluenceChain/StoryCard)
- Artist name (large, bold) bottom-left
- Real name, origin, years active below
- Genre chips as pills below the subtitle

### Quick stats bar
- Horizontal scrollable chips below hero
- Last.fm listeners, scrobbles, Discogs release count, active years
- Same chip styling as StoryCard/TrackCard

### Four tabs

**Overview tab:**
- "Known For" blurb (the signature sound description)
- Labels list
- Collaborators — each name is a tappable link that injects `Tell me about {name}` into chat
- On-Air Talking Point (the DJ fact, same as current ArtistCard)

**Discography tab:**
- Vertical album list, each row:
  - Album cover art (48x48, auto-fetched from iTunes via artwork API)
  - Album title (tappable — injects `/story {title}` into chat)
  - Year
  - Play button (plays top track from album via PlayButton)
- Sorted by year descending (newest first)

**Connections tab:**
- "Influenced By" section — tappable chips. Each chip injects `/influence {name}` into chat
- "Influenced" section — same pattern
- "Map full influence chain →" button at bottom — injects `/influence {artist name}`
- Each chip uses the existing pill styling with hover states

**Media tab:**
- YouTube video embed (lazy-loaded thumbnail, same as StoryCard's YouTubeThumbnail)
- External links: Bandcamp, Discogs, Genius, Spotify — each as a styled link button
- If no video found, tab shows only external links

### Action buttons (bottom bar)
- Listen on Spotify (link)
- Slack (SlackSendButton)
- Influence → (injects `/influence {name}`)
- Story → (injects `/story {name}`)

### Mobile layout
- Hero is shorter (120px)
- Tabs are horizontal scrollable pills
- Album list is full-width
- Collaborator and influence chips wrap naturally

## Props

```typescript
ArtistProfile(
  name: string,            // "MF DOOM"
  realName: string,        // "Daniel Dumile" (optional)
  origin: string,          // "London, England (raised Long Beach, NY)"
  activeYears: string,     // "1971–2020"
  imageUrl: string,        // Artist photo URL
  genres: JSON array,      // ["Hip-Hop", "Underground Hip-Hop", "Abstract Hip-Hop"]
  knownFor: string,        // "Dense internal rhymes, dusty samples..."
  labels: JSON array,      // ["Stones Throw", "Metal Face Records"]
  collaborators: JSON array, // [{name, role?}] — tappable
  influences: JSON array,  // [{name}] — tappable chips
  influenced: JSON array,  // [{name}] — tappable chips
  albums: JSON array,      // [{title, year, imageUrl?}] — with play + story link
  topTracks: JSON array,   // [{name, album?, year?}] — with play buttons
  videoId: string,         // YouTube video ID (optional)
  videoTitle: string,      // (optional)
  djTalkingPoint: string,  // On-air talking point (optional)
  lastfmListeners: string, // "2.1M" (optional)
  lastfmScrobbles: string, // "45M" (optional)
  bandcampUrl: string,     // (optional)
  discogsUrl: string,      // (optional)
  geniusUrl: string,       // (optional)
  sources: JSON array,     // [{name, url}]
)
```

All JSON props use `z.any()` arrays with runtime parsing (same resilient pattern as StoryCard/TrackCard).

## `/artist` command

```typescript
case "artist": {
  if (!arg) return "Which artist? Example: /artist MF DOOM";
  return [
    `Research this artist in full detail: "${arg}"`,
    `MANDATORY: Output an ArtistProfile OpenUI component.`,
    `RESEARCH:`,
    `1. Search MusicBrainz for artist metadata, discography, and relationships`,
    `2. Search Discogs for releases, labels, and collaborators`,
    `3. Search Last.fm for listener stats, tags, and similar artists`,
    `4. Search Genius for artist bio and annotations`,
    `5. Search YouTube for a documentary, interview, or live performance`,
    `6. Search for artist image via artwork API`,
    `OUTPUT: ArtistProfile with all tabs populated. Use ArtistCard only for compact inline mentions.`,
  ].join("\n");
}
```

## Cross-component interactions

Every interactive element injects a chat message:

| Element | Action on tap |
|---------|--------------|
| Collaborator name | `Tell me about {name}` |
| Influenced By chip | `/influence {name}` |
| Influenced chip | `/influence {name}` |
| Album title | `/story {title}` |
| "Map full influence chain →" button | `/influence {artist}` |
| Play button on album | Plays top track via PlayButton |
| Play button on top track | Plays track via PlayButton |

## Agent prompt rules

Add to `library.ts` componentGroups as "Artist Deep Dive":
```
- Use ArtistProfile when the user asks for a detailed artist profile, biography, or "tell me about [artist]".
- Use ArtistCard for compact inline mentions inside other components (InfluenceChain, search results).
- ArtistProfile has four tabs: Overview, Discography, Connections, Media. Populate all available tabs.
- Search MusicBrainz + Discogs for discography, Last.fm for stats, Genius for bio, YouTube for video.
```

Add to `prompt.ts`:
```
**ArtistProfile(name, realName, origin, activeYears, imageUrl, genres, knownFor, labels, collaborators, influences, influenced, albums, topTracks, videoId?, videoTitle?, djTalkingPoint?, lastfmListeners?, lastfmScrobbles?, bandcampUrl?, discogsUrl?, geniusUrl?, sources)**
Full artist deep dive with four tabs: Overview (bio, collaborators, talking point), Discography (albums with play buttons), Connections (influence chips), Media (YouTube + external links).
```

## Files to modify

| File | Change |
|------|--------|
| `src/lib/openui/components.tsx` | Add `ArtistProfile` component |
| `src/lib/openui/library.ts` | Register, add "Artist Deep Dive" group, add prompt example |
| `src/lib/openui/prompt.ts` | Add ArtistProfile documentation and rules |
| `src/lib/chat-utils.ts` | Add `/artist` slash command |
| `src/components/workspace/chat-panel.tsx` | Add `/artist` to autocomplete |
| `src/app/api/chat/route.ts` | Add `/artist` to research command detection |

## ArtistCard stays unchanged

ArtistCard remains the compact card. No modifications. It continues to be used:
- Inside InfluenceChain as inline artist mentions
- In search results
- As a quick reference when the agent needs a summary, not a deep dive

The agent chooses between them based on context:
- "Who is MF DOOM?" → ArtistProfile (full deep dive)
- `/influence Flying Lotus` → InfluenceChain with ArtistCard-style nodes
- "List artists similar to Madlib" → multiple ArtistCards
