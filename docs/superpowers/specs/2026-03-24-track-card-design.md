# TrackCard Component — Design Spec

> **Date:** March 24, 2026
> **Status:** Approved
> **Goal:** Add a single-track deep dive OpenUI component that goes beyond Spotify's SongDNA with full credits (MusicBrainz + Discogs), samples (WhoSampled), lyrics (Genius), vinyl pressings (Discogs), playback, and cross-component navigation.

## Overview

`TrackCard` is the single-track equivalent of what `InfluenceChain` does for artists and `StoryCard` does for narratives. It answers "tell me about this track" with everything: who played on it, what it samples, what sampled it, lyrics context, and where to buy the vinyl. Crate's direct competition to Spotify's SongDNA, but richer because it pulls from MusicBrainz, Discogs, WhoSampled, and Genius — data Spotify doesn't expose.

## Triggers

- **`/track So What Miles Davis`** — slash command, guaranteed TrackCard output
- **Natural language** — "Tell me about So What by Miles Davis", "What samples did Workinonit use?"
- **From other components** — tapping a track in StoryCard, TrackList, SpotifyPlaylist, or InfluenceChain injects `/track [name] [artist]` into chat

## Layout (tabbed deep dive)

### Hero section
- Album art as full-width background with gradient overlay (same pattern as StoryCard/InfluenceChain)
- Track name (large, bold) bottom-left
- Artist name below
- Album · year · label as muted subtitle
- Floating green play button (uses existing PlayButton component)

### Quick stats bar
- Horizontal scrollable chips below hero
- Duration (e.g. "9:22"), key/BPM if available, genre tags, Discogs pressing count
- Same chip styling as StoryCard key facts

### Four tabs
Horizontal pill tabs (same pattern as StoryCard chapters and InfluenceChain's Roots/Built With/Legacy):

**Credits tab:**
- Combined data from MusicBrainz (performers, writers) + Discogs (producer, engineer, mastering, studio, design)
- Each person: photo (batch-fetched via artwork API with Wikipedia fallback), name, role
- Deep Dive → link on each person (injects chat message)
- On mobile: vertical list. On desktop: two-column grid.

**Samples tab:**
- Two sections: "Sampled from" (what this track uses) and "Sampled by" (who used this track)
- Each entry: track name, artist, year, play button
- Tapping a sample entry injects `/track [sample name] [sample artist]` (cross-linking)
- If no samples found, show "No known samples" with a note about WhoSampled coverage

**Lyrics tab:**
- Genius annotation snippet or first verse (not full lyrics — licensing)
- Styled as a blockquote with orange left border
- "Read full lyrics on Genius →" link
- If no lyrics found, hide the tab entirely

**Vinyl tab:**
- Discogs data: total pressings, median price, highest-value pressing info
- Link to Discogs marketplace
- If no Discogs data, hide the tab

### Mobile layout
Same content but:
- Hero is shorter (120px vs 180px)
- Tabs are horizontal scrollable pills
- Credits list is single-column
- Active tab content fills width

### Action buttons
Bottom bar:
- **Open in Spotify** — link to `https://open.spotify.com/search/{track} {artist}`
- **Slack** — sends track info via SlackSendButton
- **Influence →** — injects `/influence {artist}` into chat
- **Story →** — injects `/story {album}` into chat

## Props

```typescript
TrackCard(
  name: string,           // "So What"
  artist: string,         // "Miles Davis"
  album: string,          // "Kind of Blue"
  year: string,           // "1959"
  label: string,          // "Columbia"
  imageUrl: string,       // Album art URL
  duration: string,       // "9:22" (optional)
  musicalKey: string,     // "D Dorian" (optional)
  bpm: string,            // "120" (optional)
  genre: string,          // "Modal Jazz" (optional)
  credits: JSON array,    // [{name, role, imageUrl?}] — from MusicBrainz + Discogs
  samples: JSON array,    // [{name, artist, year, direction}] — direction: "from"|"by". PlayButton uses name+artist for playback.
  lyricsSnippet: string,  // First verse or annotation (optional)
  lyricsUrl: string,      // Genius URL (optional)
  pressingsCount: string, // "847" (optional) — from Discogs
  pressingsMedianPrice: string, // "$25" (optional)
  pressingsOriginalInfo: string, // "1959 mono: $450+" (optional)
  discogsUrl: string,     // Discogs marketplace URL (optional)
  spotifyUrl: string,     // Direct Spotify track URL if available, falls back to search URL (optional)
  sources: JSON array,    // [{name, url}]
)
```

All JSON props use `z.any()` arrays with runtime parsing (same resilient pattern as StoryCard). Scalar pressings fields avoid the freeform JSON object pattern.

## `/track` command

```typescript
case "track": {
  if (!arg) return "Which track? Example: /track So What Miles Davis";
  return [
    `Research this track in detail: "${arg}"`,
    `MANDATORY: Output a TrackCard OpenUI component.`,
    `RESEARCH:`,
    `1. Search MusicBrainz for track credits (musicians, writers, composer)`,
    `2. Search Discogs for production credits (producer, engineer, mastering, studio, label)`,
    `3. Search WhoSampled for samples (what it samples + what sampled it)`,
    `4. Search Genius for lyrics snippet or notable annotation`,
    `5. Search Discogs for vinyl pressing count and pricing`,
    `6. Search iTunes for album art`,
    `OUTPUT: TrackCard with all available data. Hide tabs with no data.`,
  ].join("\n");
}
```

## Cross-component linking

Add tap handlers to track items in existing components:

- **StoryCard tracks section** — each track's name is a tappable link that injects `/track {name} {artist}`
- **TrackItem** (in TrackList) — add a small info icon (visible on hover/tap) that injects `/track {name} {artist}`. No long-press — info icon matches existing UX patterns.
- **SpotifyPlaylist tracks** — same info icon pattern

These inject chat messages, not direct navigation. The agent receives the `/track` command and renders a TrackCard.

## Agent prompt rules

Add to `library.ts` in the `componentGroups` array (as notes in a "Track Deep Dive" group) AND add component documentation to `prompt.ts`:

**library.ts componentGroups:**
```
- Use TrackCard when the user asks about a specific track, wants to know who played on a song, what it samples, or wants detailed credit/pressing information.
- TrackCard is for SINGLE TRACK deep dives. For artist profiles use ArtistCard, for album stories use StoryCard, for influence mapping use InfluenceChain.
- Combine MusicBrainz credits (musicians, writers) with Discogs credits (producer, engineer, mastering) for the fullest picture.
- For the Samples tab, search WhoSampled for both directions: what the track samples AND what has sampled it.
```

**prompt.ts component documentation:**
```
**TrackCard(name, artist, album, year, label, imageUrl, duration?, musicalKey?, bpm?, genre?, credits, samples, lyricsSnippet?, lyricsUrl?, pressingsCount?, pressingsMedianPrice?, pressingsOriginalInfo?, discogsUrl?, spotifyUrl?, sources)**
Single-track deep dive with tabbed credits, samples, lyrics, and vinyl data. `credits`, `samples`, and `sources` are JSON arrays.
```

## "Deep Cuts" reference

Deep Cuts is the name for Crate's saved research artifacts. They appear in the resizable panel and can be published as shareable links at `digcrate.app/cuts/[shareId]`. TrackCards are saved as Deep Cuts automatically when they render, and can be published via the Publish button in the panel header.

## Files

### Modified files
| File | Change |
|------|--------|
| `src/lib/openui/components.tsx` | Add `TrackCard` component with tabbed layout |
| `src/lib/openui/library.ts` | Register `TrackCard`, add component group, add prompt example |
| `src/lib/openui/prompt.ts` | Add TrackCard usage rules |
| `src/lib/chat-utils.ts` | Add `/track` slash command |
| `src/components/workspace/chat-panel.tsx` | Add `/track` to autocomplete |
| `src/app/api/chat/route.ts` | Add `/track` to research command detection |

## What SongDNA can't do

| Feature | SongDNA | Crate TrackCard |
|---------|---------|----------------|
| Writers/producers | Yes | Yes (MusicBrainz + Discogs) |
| Session musicians | No | Yes (MusicBrainz) |
| Engineer/mastering/studio | No | Yes (Discogs) |
| Samples from | Yes | Yes (WhoSampled) |
| Sampled by | Limited | Yes (WhoSampled, with play buttons) |
| Lyrics/annotations | No | Yes (Genius) |
| Vinyl pressings/pricing | No | Yes (Discogs) |
| In-context playback | No | Yes (YouTube player) |
| Cross-component navigation | Limited (Spotify only) | Yes (→ InfluenceChain, → StoryCard, → any person) |
| Send to Slack | No | Yes |
| Publish as shareable link | No | Yes (Deep Cuts) |
| Works outside Spotify | No | Yes (web, mobile, published links) |
