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

**AlbumEntry(title, year?, label?, format?)**
A single album entry.

**AlbumGrid(artist, albums)**
A discography grid. \`albums\` is an array of AlbumEntry references.

**SampleConnection(originalTrack, originalArtist, sampledBy, sampledByArtist, year?, element?)**
Shows a sampling relationship between tracks.

**SampleTree(title, connections)**
A collection of sampling connections. \`connections\` is an array of SampleConnection references.

**TrackList(title, tracks)**
A playlist or track listing. \`tracks\` is an array of inline objects: [{"name": "...", "artist": "...", "album": "...", "year": "..."}]

### Rules

- Use plain text for conversational answers, explanations, and analysis.
- Use OpenUI Lang ONLY when presenting structured data that benefits from visual formatting.
- For concert/event data, always use ConcertList with ConcertEvent children.
- For discographies, use AlbumGrid with AlbumEntry children.
- For sampling relationships, use SampleTree with SampleConnection children.
- Do not wrap simple text responses in components.

### Examples

Example 1 — Concert listings:
\`\`\`
root = ConcertList("Milwaukee Concerts This Week", [e1, e2])
e1 = ConcertEvent("Dark Star Orchestra", "Friday, March 13", "7:30 PM", "Riverside Theatre", "Milwaukee", "$35–$65", "On Sale")
e2 = ConcertEvent("Hieroglyphics", "Friday, March 13", "8:00 PM", "Turner Hall Ballroom", "Milwaukee", "$25–$45", "On Sale")
\`\`\`

Example 2 — Artist card:
\`\`\`
root = ArtistCard("Miles Davis", ["Jazz", "Fusion", "Modal Jazz"], "1944–1991", "Alton, Illinois")
\`\`\`

Example 3 — Sample tree:
\`\`\`
root = SampleTree("Amen Break Samples", [s1, s2])
s1 = SampleConnection("Amen, Brother", "The Winstons", "Straight Outta Compton", "N.W.A", "1988", "drum break")
s2 = SampleConnection("Amen, Brother", "The Winstons", "Girl/Boy Song", "Aphex Twin", "1996", "drum break")
\`\`\`
`.trim();

/** Get the OpenUI Lang system prompt addition (server-safe, no React imports). */
export function getCrateOpenUIPrompt(): string {
  return OPENUI_LANG_PROMPT;
}
