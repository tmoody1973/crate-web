# TrackCard + ArtistProfile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two new OpenUI components: TrackCard (single-track deep dive with credits, samples, lyrics, vinyl) and ArtistProfile (full artist deep dive with tabbed discography, connections, media). Together with StoryCard and InfluenceChain, these complete Crate's component suite to directly compete with Spotify's SongDNA.

**Architecture:** Both components follow the established pattern: defineComponent with Zod props, `z.any()` arrays with runtime parsing, `useIsMobile()` for responsive layout, batch image fetching, `injectChatMessage` for cross-component linking. Each component adds a `/command`, autocomplete entry, research detection, library registration, and prompt rules.

**Tech Stack:** React, Tailwind CSS, OpenUI (`@openuidev/react-lang`), Zod

**Specs:**
- `docs/superpowers/specs/2026-03-24-track-card-design.md`
- `docs/superpowers/specs/2026-03-24-artist-profile-design.md`

**Working directory:** `/Users/tarikmoody/Documents/Projects/crate-web`

---

## File Structure

### Modified Files (both components touch the same 6 files)
| File | TrackCard changes | ArtistProfile changes |
|------|------------------|----------------------|
| `src/lib/openui/components.tsx` | Add TrackCard component | Add ArtistProfile component |
| `src/lib/openui/library.ts` | Register + group + example | Register + group + example |
| `src/lib/openui/prompt.ts` | Add rules + docs | Add rules + docs |
| `src/lib/chat-utils.ts` | Add `/track` command | Add `/artist` command |
| `src/components/workspace/chat-panel.tsx` | Add `/track` to autocomplete | Add `/artist` to autocomplete |
| `src/app/api/chat/route.ts` | Add `/track` to research detection | Add `/artist` to research detection |

---

## Part 1: TrackCard

### Task 1: Add TrackCard component

**Files:**
- Modify: `src/lib/openui/components.tsx`

- [ ] **Step 1: Add the TrackCard component at the end of the file**

The component has these internal parts:
- Reuses existing `YouTubeThumbnail` (from StoryCard), `PlayButton`, `SafeImage`, `useIsMobile`, `useAutoImage`, `injectChatMessage`, `SlackSendButton`
- New: `TrackCreditRow` helper for the credits tab
- New: `SampleRow` helper for the samples tab
- Main `TrackCard` with four tabs: Credits, Samples, Lyrics, Vinyl

Props schema (all JSON use `z.any()` with runtime parsing):
```
name, artist, album, year, label, imageUrl,
duration?, musicalKey?, bpm?, genre?,
credits (array), samples (array),
lyricsSnippet?, lyricsUrl?,
pressingsCount?, pressingsMedianPrice?, pressingsOriginalInfo?, discogsUrl?,
spotifyUrl?, sources (array)
```

Desktop: full hero with album art background, stats chips, four tabs
Mobile: shorter hero, horizontal pill tabs

Credits tab: batch-fetched people images, name + role, Deep Dive links
Samples tab: two sections ("Sampled from" / "Sampled by"), play buttons, tap to `/track`
Lyrics tab: blockquote with orange border, Genius link. Hidden if no lyrics.
Vinyl tab: pressing count, median price, original info, Discogs link. Hidden if no data.

Action buttons: Spotify, Slack, Influence →, Story →

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: add TrackCard OpenUI component with credits, samples, lyrics, vinyl tabs"
```

---

### Task 2: Register TrackCard + add /track command

**Files:**
- Modify: `src/lib/openui/library.ts`
- Modify: `src/lib/openui/prompt.ts`
- Modify: `src/lib/chat-utils.ts`
- Modify: `src/components/workspace/chat-panel.tsx`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Register in library.ts**

Add `TrackCard` to import, components array, new "Track Deep Dive" component group with notes, and a prompt example.

- [ ] **Step 2: Add documentation to prompt.ts**

Add TrackCard signature and usage rules to the prompt.

- [ ] **Step 3: Add /track slash command to chat-utils.ts**

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

Also add session title:
```typescript
case "track":
  return arg ? `Track: ${arg}` : "Track";
```

- [ ] **Step 4: Add /track to autocomplete in chat-panel.tsx**

Add to SLASH_COMMANDS array:
```typescript
{ command: "/track", description: "Deep dive into a specific track", usage: "/track [song] [artist]", example: "/track So What Miles Davis" },
```

- [ ] **Step 5: Add /track to research command detection in route.ts**

Update the regex:
```typescript
const isSlashResearch = /^\/(?:influence|show-prep|prep|news|story|track)\b/i.test(rawMessage.trim());
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/openui/library.ts src/lib/openui/prompt.ts src/lib/chat-utils.ts src/components/workspace/chat-panel.tsx src/app/api/chat/route.ts
git commit -m "feat: register TrackCard, add /track command, autocomplete, and research detection"
```

---

## Part 2: ArtistProfile

### Task 3: Add ArtistProfile component

**Files:**
- Modify: `src/lib/openui/components.tsx`

- [ ] **Step 1: Add the ArtistProfile component after TrackCard**

Internal parts:
- Reuses: `YouTubeThumbnail`, `PlayButton`, `SafeImage`, `useIsMobile`, `injectChatMessage`, `SlackSendButton`, batch image fetch pattern
- New: `AlbumRow` helper — album cover + title (tappable → `/story`) + year + play button
- New: `ConnectionChip` helper — tappable pill that injects `/influence {name}`
- Main `ArtistProfile` with four tabs: Overview, Discography, Connections, Media

Props schema:
```
name, realName, origin, activeYears, imageUrl,
genres (array), knownFor, labels (array),
collaborators (array), influences (array), influenced (array),
albums (array), topTracks (array),
videoId?, videoTitle?, djTalkingPoint?,
lastfmListeners?, lastfmScrobbles?,
bandcampUrl?, discogsUrl?, geniusUrl?,
sources (array)
```

Desktop: full hero with artist photo, genre chips, stats bar, four tabs
Mobile: shorter hero, horizontal pill tabs

Overview tab: knownFor blurb, labels, collaborators with Deep Dive links, DJ talking point
Discography tab: album list with covers (auto-fetched), play buttons, story links
Connections tab: influenced by / influenced chips (tappable), "Map full chain →" button
Media tab: YouTube embed, external links (Bandcamp, Discogs, Genius, Spotify)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: add ArtistProfile OpenUI component with tabbed overview, discography, connections, media"
```

---

### Task 4: Register ArtistProfile + add /artist command

**Files:**
- Modify: `src/lib/openui/library.ts`
- Modify: `src/lib/openui/prompt.ts`
- Modify: `src/lib/chat-utils.ts`
- Modify: `src/components/workspace/chat-panel.tsx`
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Register in library.ts**

Add `ArtistProfile` to import, components array, new "Artist Deep Dive" component group with notes, and a prompt example.

- [ ] **Step 2: Add documentation to prompt.ts**

Add ArtistProfile signature and usage rules.

- [ ] **Step 3: Add /artist slash command to chat-utils.ts**

```typescript
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
  ].join("\n");
}
```

Session title:
```typescript
case "artist":
  return arg ? `Artist: ${arg}` : "Artist";
```

- [ ] **Step 4: Add /artist to autocomplete**

```typescript
{ command: "/artist", description: "Full artist deep dive with discography and connections", usage: "/artist [name]", example: "/artist MF DOOM" },
```

- [ ] **Step 5: Add /artist to research command detection**

```typescript
const isSlashResearch = /^\/(?:influence|show-prep|prep|news|story|track|artist)\b/i.test(rawMessage.trim());
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/lib/openui/library.ts src/lib/openui/prompt.ts src/lib/chat-utils.ts src/components/workspace/chat-panel.tsx src/app/api/chat/route.ts
git commit -m "feat: register ArtistProfile, add /artist command, autocomplete, and research detection"
```

---

## Part 3: Verification

### Task 5: Build verification and deploy

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
npx vercel --prod
```

---

## Verification checklist

### TrackCard
- [ ] `/track So What Miles Davis` → renders TrackCard with hero, tabs
- [ ] Credits tab shows musicians with photos and Deep Dive links
- [ ] Samples tab shows "sampled from" and "sampled by" with play buttons
- [ ] Lyrics tab shows Genius snippet with link (hidden if no lyrics)
- [ ] Vinyl tab shows Discogs pressing info (hidden if no data)
- [ ] Action buttons: Spotify, Slack, Influence →, Story → all work
- [ ] Mobile: horizontal pill tabs, responsive layout

### ArtistProfile
- [ ] `/artist MF DOOM` → renders ArtistProfile with hero, tabs
- [ ] Overview tab: known for, labels, collaborators with Deep Dive, talking point
- [ ] Discography tab: album list with covers, play buttons, story links
- [ ] Connections tab: tappable influence chips, "Map chain →" button
- [ ] Media tab: YouTube embed, external links
- [ ] Action buttons work
- [ ] Mobile: horizontal pill tabs, responsive layout

### Cross-component linking
- [ ] Tapping a collaborator in ArtistProfile → injects chat message
- [ ] Tapping an album in ArtistProfile → injects `/story [album]`
- [ ] Tapping influence chip → injects `/influence [name]`
- [ ] Tapping sample in TrackCard → injects `/track [sample]`
