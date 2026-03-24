# StoryCard component guide

## What it does

StoryCard renders rich narrative music stories inside Crate. It's the component the agent uses when someone asks about the history, making, or origin of something in music — not just facts (that's ArtistCard) or connections (that's InfluenceChain), but the actual story.

## How to trigger it

Type `/story` followed by a topic:

```
/story Donuts
/story Kind of Blue
/story The history of Detroit techno
/story Blue Note Records
/story What happened at Woodstock
```

Or ask naturally: "What's the story behind Donuts?" — the agent should use StoryCard, though `/story` is more reliable.

## What it renders

### Desktop (magazine layout)
1. Hero image with gradient overlay, category label, title, subtitle
2. Key facts bar (stats in orange)
3. Chapter pill tabs (click to switch)
4. Key tracks with play buttons + Export to Spotify
5. YouTube documentary embed (click thumbnail to play)
6. Key people with photos and Deep Dive links
7. Sources (cited links)
8. Action buttons: Spotify, Slack, Influence

### Mobile (accordion layout)
Same content but as collapsible sections — tap to expand one at a time.

## Story types and what the agent should find

### Album stories
- `/story Donuts` or `/story Kind of Blue`
- Hero image: album cover (from iTunes search)
- Key facts: track count, samples, sales, chart positions
- Tracks: songs from the album
- Key people: producer, musicians, collaborators
- Video: album documentary or making-of

### Artist origin stories
- `/story How Fela Kuti created Afrobeat`
- Hero image: artist photo (from Spotify artwork API)
- Key facts: years active, albums, signature achievements
- Tracks: signature songs
- Key people: bandmates, collaborators, family
- Video: artist documentary or interview

### Genre/movement histories
- `/story The history of Detroit techno`
- Hero image: iconic album cover from the genre, or gradient fallback
- Key facts: founding year, founding city, key labels, subgenres
- Tracks: foundational tracks that defined the genre
- Key people: founders, key producers, DJs
- Video: genre documentary

### Label stories
- `/story Blue Note Records` or `/story Stones Throw Records`
- Hero image: label logo or iconic release cover
- Key facts: years active, total releases, key artists signed
- Tracks: iconic releases from the label
- Key people: founders, A&R, marquee artists
- Video: label documentary

### Event stories
- `/story Woodstock 1969` or `/story Live Aid 1985`
- Hero image: event photo
- Key facts: date, location, attendance, number of acts
- Tracks: standout performances
- Key people: performers, organizers
- Video: event footage or documentary

## How the data flows

1. User types `/story Detroit Techno`
2. `preprocessSlashCommand` expands it into a detailed prompt telling the agent exactly what to research and output
3. Agent uses Perplexity/web search to get the narrative in 1-2 calls
4. Agent searches for images (iTunes, Perplexity results, artwork API)
5. Agent searches YouTube for a documentary
6. Agent outputs OpenUI Lang: `root = StoryCard("title", "subtitle", ...)`
7. The Renderer parses it and renders the StoryCard component
8. StoryCard appears in the Deep Cuts panel (desktop) or full-screen (mobile)

## Props reference

```
StoryCard(
  title,          "Donuts" or "The History of Detroit Techno"
  subtitle,       "J Dilla · 2006 · Stones Throw" or "Belleville Three · 1981–present"
  heroImageUrl,   Album cover URL, artist photo, or "" for gradient fallback
  category,       "The Story Behind" | "The Making Of" | "The History Of"
  keyFacts,       Array of stats — strings like "31 tracks" or objects {label, value}
  chapters,       Array of story sections — pipe-delimited "Title|Content" or objects {title, content}
  tracks,         Array of key tracks — {name, artist, album?, year?} or "Artist — Track"
  videoId,        YouTube video ID (optional, must be real — never hallucinated)
  videoTitle,     Video title
  keyPeople,      Array of people — {name, role} or "Name — Role"
  sources         Array of citations — {name, url} or "[Name](url)" markdown links
)
```

## Flexible input formats

The component handles whatever format the LLM produces:

| Prop | Object format | String format |
|------|--------------|---------------|
| chapters | `{title: "Crisis", content: "In 2002..."}` | `"Crisis\|In 2002..."` (pipe-delimited) or `'{"title":"Crisis","content":"..."}' ` (JSON string) |
| keyFacts | `{label: "tracks", value: "31"}` | `"31 tracks"` (number + label) or `"Best-selling jazz album"` (full string) |
| keyPeople | `{name: "Ma Dukes", role: "Mother"}` | `"Ma Dukes — Mother"` (dash-separated) |
| sources | `{name: "Wikipedia", url: "https://..."}` | `"[Wikipedia](https://...)"` (markdown link) |
| tracks | `{name: "So What", artist: "Miles Davis"}` | `"So What — Miles Davis"` (dash-separated) |

## Image fallbacks

- If hero image URL is broken or empty: orange-to-dark gradient background
- If key people photos aren't provided: auto-fetched from Spotify via artwork API
- If auto-fetch fails: circle with first letter of name

## Action buttons

- **Spotify**: opens Spotify search for the title + artist
- **Slack**: injects "Send the story to Slack" into chat
- **Influence →**: injects `/influence [main artist]` into chat
- **Export to Spotify** (on tracks): creates a playlist from the key tracks

## Compared to Spotify SongDNA

| Feature | SongDNA | Crate StoryCard |
|---------|---------|----------------|
| Sample connections | Yes | Yes (via InfluenceChain) |
| Narrative storytelling | No | Yes — chapters with human stories |
| Video integration | No | Yes — YouTube embeds |
| Connected research | No | Yes — tap people to deep dive |
| Playable tracks | No | Yes — play buttons + Export to Spotify |
| Export to Spotify | No | Yes |
| Send to Slack | No | Yes |
| Publish/share | No | Yes — shareable Deep Cut links |
| Works for genres/labels/events | No (songs only) | Yes |
