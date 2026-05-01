# Spotify just launched what I've been building for two weeks

Spotify announced SongDNA today. It shows you the writers, producers, and samples behind a song. Tap a creator, see what else they've worked on. It's a nice feature. Premium-only, mobile-only, rolling out through April.

I've been building something in the same space. It goes further. Here's why that matters and what I learned.

## What SongDNA does

SongDNA adds an interactive card to Spotify's Now Playing view. You're listening to a track, you tap, and you see who wrote it, who produced it, what it sampled, and what covers exist. You can follow those connections to discover other songs. Spotify describes it as "an interactive way to follow the connections between tracks and see how artists, eras, and genres intersect."

It's useful. It's also limited to individual songs, locked inside the Spotify app, and doesn't tell you *why* those connections exist.

## What I built

Crate is an AI music research workspace I've been building for the past two weeks. It uses an agent that searches 20+ live databases (Discogs, MusicBrainz, Last.fm, Genius, Bandcamp, Spotify's own API, and more) and returns interactive components, not text walls.

Two features overlap directly with SongDNA:

**Influence chains.** Type `/influence Adrian Younge` and Crate maps the full influence network: who shaped their sound, who they shaped, weighted by evidence. Each connection comes with pull quotes from actual reviews, sonic elements that transferred, and key works. The methodology is based on Badillo-Goicoechea's 2025 paper in the Harvard Data Science Review on network-based music recommendation using review co-mentions. Every connection is cited. You can verify it.

*[Screenshot: Adrian Younge & Ali Shaheed Muhammad influence chain showing Marvin Gaye connection with 0.92 weight, Pitchfork review quote, and sonic DNA]*

**Story cards.** Type `/story Detroit Techno` and Crate researches the full narrative, then renders it as an interactive magazine-style article with chapters you can click through, a YouTube documentary you can watch inline, key people with photos you can deep dive into, and a playlist of foundational tracks you can play right there. It works for albums, genres, labels, and events, not just songs.

*[Screenshot: Detroit Techno story card showing chapter tabs, key people collage header, and Belleville Three history]*

## Where this goes past SongDNA

SongDNA shows you data. Crate tells you stories.

SongDNA says "this song samples that song." Crate says "J Dilla recorded Donuts from a hospital bed at Cedars-Sinai. His mother brought vinyl records and massaged his swollen hands so he could work the pads. Three days after the album came out on his birthday, he died."

Some specific differences:

SongDNA is song-only. Crate works for anything. Ask about a genre, a label, an era, a movement. "The history of Blue Note Records" produces a full narrative with chapters and embedded video. SongDNA can't do that because it's tied to Spotify's track metadata.

SongDNA stays inside Spotify. Crate connects to Spotify (via Auth0 Token Vault), reads your library, creates playlists from research, and also sends to Slack and Google Docs. I built the connected services integration for the Auth0 "Authorized to Act" hackathon. You research an influence chain and with one click, it becomes a playlist in your Spotify account.

SongDNA has no audio in context. Crate has a built-in player. When a story card mentions "Strings of Life" by Derrick May, you can play it right there. The key tracks section has play buttons. Published deep cuts at digcrate.app/cuts/ work for anyone with audio playback, no login required.

SongDNA doesn't cite sources. Crate cites everything. Every influence connection links to the review, interview, or database entry it came from. The influence chain methodology uses co-mention analysis across 26 music publications (Pitchfork, The Guardian, DownBeat, AllMusic, etc.) following the direction convention from Badillo-Goicoechea 2025: from=influencer, to=influenced. If a review of Artist B mentions Artist A, that's an edge from A to B.

## What I actually think about SongDNA

I'm not annoyed that Spotify built this. I'm relieved. It validates the idea that music listeners want to understand connections, not just consume streams. SongDNA reaching 200+ million Premium users means the appetite for this kind of exploration is real.

What SongDNA can't do is go deep. It's a feature inside a player. Crate is a research workspace. When a radio DJ needs to prep a four-track set for tonight's show with talk breaks, social copy, and local event tie-ins, SongDNA doesn't help. When a journalist is writing about the lineage from Alice Coltrane to Flying Lotus, they need cited sources and narrative, not a metadata card.

Different tools for different depths. SongDNA is the shallow end. Crate is the deep end. Both are needed.

## The tech

For anyone curious about how this works under the hood: Crate is a Next.js app with an AI agent harness. The agent (Claude) has access to 20+ tool servers via the Model Context Protocol. When you ask a question, it makes real API calls to real databases, synthesizes the results, and outputs structured UI components via OpenUI. The influence chain doesn't use a pre-built graph. It builds one in real time from review co-mentions, Last.fm similarity scores, and MusicBrainz credits, then enriches each connection via Perplexity with pull quotes and sonic analysis.

The connected services (Spotify, Slack, Google Docs) use Auth0's Token Vault, which handles OAuth token management so my app never stores raw credentials. I wrote about that integration in a separate post.

You can try it at [digcrate.app](https://digcrate.app). The influence chains, story cards, and playlists are all live.

---

*Tarik Moody builds tools for people who take music seriously. He's a developer, DJ, and the creator of Crate.*

*Built for the Auth0 "Authorized to Act" Hackathon (deadline April 6, 2026).*
