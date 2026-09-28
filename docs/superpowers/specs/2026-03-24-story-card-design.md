# StoryCard Component — Design Spec

> **Date:** March 24, 2026
> **Status:** Approved
> **Goal:** Add a new OpenUI component that renders rich narrative music stories with images, embedded YouTube, key facts, interactive people cards, and chapter navigation — competing directly with Spotify's SongDNA by adding narrative depth, video, and cross-platform export.

## Overview

`StoryCard` is an OpenUI component the agent renders when research produces a narrative worth telling. It goes beyond data display (which InfluenceChain and ArtistCard handle) into storytelling — the "why" and "how" behind music, not just the "what."

Triggers: "What's the story behind Donuts?", "Tell me about the making of Kind of Blue", "How did Fela Kuti create Afrobeat?", "The history of Detroit techno."

## Two layouts, one component

- **Desktop (>= md):** Magazine layout — hero image with overlay text, key facts bar, narrative with chapter pill tabs, YouTube thumbnail, key people row, action buttons. Reads like a Pitchfork feature.
- **Mobile (< md):** Accordion layout — compact album art + title header, collapsible story sections, YouTube section, action buttons.

Both render from the same props. Uses `useIsMobile()` to switch.

## Props

```typescript
StoryCard(
  title: string,           // "Donuts"
  subtitle: string,        // "J Dilla · 2006 · Stones Throw Records"
  heroImageUrl: string,    // Album cover or contextual photo URL
  category: string,        // "The Story Behind" | "The Making Of" | "The History Of"
  keyFacts: JSON array,    // [{label:"tracks", value:"31"}, {label:"samples", value:"34"}]
  chapters: JSON array,    // [{title:"The Health Crisis", subtitle:"How TTP changed everything", content:"In early 2002..."}]
  videoId?: string,        // YouTube video ID (optional)
  videoTitle?: string,     // "J Dilla — The Shining Documentary"
  keyPeople?: JSON array,  // [{name:"Ma Dukes", role:"Mother", imageUrl?:""}, {name:"Madlib", role:"Collaborator"}]
  sources: JSON array,     // [{name:"Wikipedia", url:"https://..."}, {name:"TechCrunch", url:"..."}]
)
```

All JSON array props use the existing `jsonPreprocess` pattern from other OpenUI components.

## Desktop layout (Magazine)

### Hero section
- Full-width image (heroImageUrl) with gradient overlay (transparent top → dark bottom)
- Category label top-left in orange uppercase ("THE STORY BEHIND")
- Title large and bold bottom-left over the gradient
- Subtitle (artist · year · label) below title in muted text

### Key facts bar
- Horizontal row below hero
- Each fact: large value (orange) + small label (gray) — e.g. "31 tracks", "34 samples", "43 minutes", "#386 RS 500"
- Dark background strip, subtle border

### Narrative chapters
- Horizontal pill tabs below facts bar (similar to InfluenceChain's Roots/Built With/Legacy tabs)
- Each pill: chapter title, active pill highlighted
- Content area below shows the active chapter's text
- Text renders as prose (14px, relaxed line-height, zinc-300)

### YouTube embed
- Below narrative
- Shows thumbnail from `https://img.youtube.com/vi/{videoId}/hqdefault.jpg`
- Red play button overlay centered
- Video title text below
- Tapping replaces thumbnail with actual YouTube iframe (lazy load)
- If no videoId provided, section hidden entirely

### Key people row
- Below video (or narrative if no video)
- Section header "Key People" in uppercase muted text
- Horizontal row of circular photos (auto-fetched from `/api/artwork?q={name}&type=artist&source=spotify` if no imageUrl)
- Name + role below each photo
- Small "i" icon on each person — tapping expands an inline mini ArtistCard below the row (research happens client-side via the artwork API, not a full agent call)
- "Deep Dive →" text link below each person — injects chat message to research them

### Sources
- Below key people
- Small "Sources" label, then horizontal list of linked source names

### Action buttons
- Bottom bar using `injectChatMessage` and `SlackSendButton` helpers (same pattern as InfluenceChain and SpotifyPlaylist)
- **Open in Spotify** — link to `https://open.spotify.com/search/{title} {subtitle artist}` (plain URL, works for everyone)
- **Slack** — uses `SlackSendButton` with label, injects "Send the [title] story to Slack"
- **Publish** — calls `/api/cuts/publish` with the artifact ID (same flow as DeepCutsPanel publish button). Disabled while `id === "pending"`.
- **Influence →** — injects `/influence {main artist}` into chat via `injectChatMessage`

## Mobile layout (Accordion)

### Header
- Compact: album art thumbnail (80x80, rounded) + title/subtitle/category + key fact chips
- No hero image overlay (too cramped on small screens)

### Collapsible sections
- Each chapter is a tappable row: title + subtitle + chevron
- Tap to expand/collapse — one section open at a time (iOS Settings pattern). Opening a new section auto-closes the previous one.
- YouTube is its own collapsible section with red play icon indicator
- Key people is a collapsible section

### Action buttons
- Same as desktop but at the bottom, slightly larger touch targets

## YouTube lazy loading

- On initial render: thumbnail image from YouTube + play button overlay
- On tap: replace with `<iframe src="https://www.youtube.com/embed/{videoId}?autoplay=1" ...>`
- No YouTube tracking/scripts until user explicitly taps play
- If video is unavailable, hide the section gracefully

## Key people interactions

### Inline preview ("i" icon)
- Tapping the info icon on a person expands a mini card below the people row
- Shows: name, genres, active years, one-line bio (fetched from artwork/Wikipedia API)
- Closes when tapping again or tapping another person
- Does NOT call the agent — this is a lightweight client-side fetch

### Deep dive ("Deep Dive →" link)
- Injects a chat message: "Tell me about {person name}"
- Agent researches and returns a new response (could be another StoryCard, ArtistCard, or InfluenceChain)
- On mobile, this closes the StoryCard and returns to chat

## Agent prompt rules

Add to the OpenUI system prompt:

```
- Use StoryCard when the user asks about the story, history, making, or origin of an album, artist, genre, event, or label.
- StoryCard is for NARRATIVE content — stories with chapters, context, and human interest.
- Do NOT use StoryCard for simple factual lookups (use ArtistCard) or connection mapping (use InfluenceChain).
- Include a YouTube videoId when you find a relevant documentary, interview, or performance video.
- Include keyPeople for anyone mentioned in the story who the user might want to explore further.
- Each chapter should be 2-4 paragraphs. 3-5 chapters is ideal.
```

## Files

### Modified files
| File | Change |
|------|--------|
| `src/lib/openui/components.tsx` | Add `StoryCard` component with desktop/mobile variants |
| `src/lib/openui/library.ts` | Register `StoryCard`, add to component group, add prompt example |
| `src/lib/openui/prompt.ts` | Add StoryCard usage rules |

### No new files
The component lives in the existing components file following the established pattern. No new API routes or Convex tables needed.

## Implementation notes

### useIsMobile import
`src/lib/openui/components.tsx` does not currently import `useIsMobile`. Add `import { useIsMobile } from "@/hooks/use-is-mobile"` at the top of the file alongside the existing React imports.

### Artwork API
Key people images use `/api/artwork?q={name}&type=artist&source=spotify`. The `source` param is used by the existing `useAutoImage` hook throughout `components.tsx` and works by convention. Follow the same pattern.

### OpenUI Lang prompt example
```
root = StoryCard("Donuts", "J Dilla · 2006 · Stones Throw Records", "https://upload.wikimedia.org/wikipedia/en/5/54/J_Dilla_-_Donuts.jpg", "The Story Behind", "[{\\"label\\":\\"tracks\\",\\"value\\":\\"31\\"},{\\"label\\":\\"samples\\",\\"value\\":\\"34\\"},{\\"label\\":\\"minutes\\",\\"value\\":\\"43\\"},{\\"label\\":\\"RS 500\\",\\"value\\":\\"#386\\"}]", "[{\\"title\\":\\"The Health Crisis\\",\\"subtitle\\":\\"How TTP changed everything\\",\\"content\\":\\"In early 2002, J Dilla was diagnosed with TTP, a rare blood disease...\\"},{\\"title\\":\\"The Recording\\",\\"subtitle\\":\\"Hospital bed, Boss SP-303\\",\\"content\\":\\"Despite deteriorating health, he recorded using a portable sampler...\\"}]", "dQw4w9WgXcQ", "J Dilla — Still Shining Documentary", "[{\\"name\\":\\"Ma Dukes\\",\\"role\\":\\"Mother\\"},{\\"name\\":\\"Madlib\\",\\"role\\":\\"Collaborator\\"},{\\"name\\":\\"Questlove\\",\\"role\\":\\"Friend & advocate\\"}]", "[{\\"name\\":\\"Wikipedia\\",\\"url\\":\\"https://en.wikipedia.org/wiki/Donuts_(album)\\"},{\\"name\\":\\"Classic Album Sundays\\",\\"url\\":\\"https://classicalbumsundays.com/j-dilla-donuts/\\"}]")
```

## What SongDNA can't do (Crate differentiators)

| Feature | SongDNA | Crate StoryCard |
|---------|---------|----------------|
| Sample connections | Yes | Yes (via InfluenceChain) |
| Narrative storytelling | No | Yes — chapters with human stories |
| Video integration | No | Yes — YouTube embeds |
| Connected research | No | Yes — tap people to deep dive |
| Export to Spotify | No | Yes — create playlists from mentioned tracks |
| Send to Slack | No | Yes — Block Kit formatted |
| Publish/share | No | Yes — shareable Deep Cut links |
| Custom for any topic | No (song-only) | Yes — albums, genres, labels, events |
