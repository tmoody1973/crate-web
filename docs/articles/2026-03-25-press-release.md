# PRESS RELEASE

**FOR IMMEDIATE RELEASE**
**March 25, 2026**

**Contact:** Tarik Moody | tarikjmoody@gmail.com | Milwaukee, WI

---

## Milwaukee DJ builds AI music research platform that outpaces Spotify's new SongDNA feature

*Crate, currently in beta, connects to Spotify, Slack, and Google Docs through Auth0 Token Vault — letting an AI agent act on a user's behalf across services. Built by a non-technical radio executive using Claude Code.*

---

**MILWAUKEE, WI** — The same week Spotify launched SongDNA, a feature showing connections behind songs for Premium subscribers, a developer and DJ in Milwaukee shipped something that does the same thing and goes further.

Crate is an AI music research workspace. It pulls from 20+ live databases — Discogs, MusicBrainz, Last.fm, Genius, WhoSampled, Bandcamp, and Spotify's own API — and returns interactive components instead of text. Type `/track Unfinished Sympathy Massive Attack` and Crate shows you every person who played on it, every track that sampled it, the vinyl pressing history from Discogs, and a narrative about how the song was recorded at Abbey Road with a 42-piece orchestra. Type `/influence Flying Lotus` and it maps the full influence network with cited sources from 26 music publications.

SongDNA shows you that Song A sampled Song B. Crate tells you why.

**What separates Crate from other AI music tools**

Most AI products in music are about generation — tools like Suno and Udio that create new music from prompts. Crate does the opposite. It helps people understand music that already exists. The distinction matters: radio DJs preparing a show need to know who played bass on a 1971 Alice Coltrane record and how that connects to Flying Lotus in 2010. They need that research delivered to their Slack channel before airtime. They don't need a new song.

Crate is the first platform to combine AI agent research with connected services. Through Auth0's Token Vault, users connect their Spotify, Slack, and Google accounts once. After that, the AI agent can read your Spotify library, create playlists from research findings, send formatted show prep to a Slack channel, and save deep dives as Google Docs — all without the user managing any OAuth tokens or API keys.

**The influence methodology**

Crate's influence mapping is based on a methodology from Badillo-Goicoechea's 2025 paper in the Harvard Data Science Review on network-based music recommendation. The system searches for co-mentions across 26 music publications — Pitchfork, The Guardian, DownBeat, AllMusic, and others. When a review of Artist B mentions Artist A, that creates a weighted edge in the influence graph. Each connection includes pull quotes, sonic elements, and the specific works that demonstrate the influence. Every claim is cited and verifiable.

Spotify recently acquired data from WhoSampled to power SongDNA's sample connections. Crate's influence chains are the layer above samples — they capture stylistic lineage, not just audio reuse.

**Built by a radio executive, not a software engineer**

Tarik Moody is not a traditional developer. He is Director of Strategy and Innovation at Radio Milwaukee, an NPR member public radio station he has been with since its launch in 2007. Before radio, he practiced architecture. He has no computer science degree.

Moody built Crate in two weeks using Claude Code, Anthropic's AI coding tool. Crate evolved from an earlier terminal application — the Crate CLI — that Moody built to speed up his own research workflow. The web version adds connected services, interactive components, and a workspace designed for teams.

Moody has been building AI products with Claude Code for months, winning multiple hackathons along the way. He sees AI as a productivity layer for non-technical people. "I'm building AI products for the rest of us," Moody said. "People who have deep domain expertise but aren't software engineers. AI tools like Claude Code let someone who knows music inside and out build a product that a traditional engineering team would need months to deliver."

Radio Milwaukee is currently testing Crate across its stations: 88Nine (eclectic/community), HYFIN (hip-hop/neo-soul/Afrobeats), and the syndicated Rhythm Lab Radio, a show Moody has hosted and produced for over 20 years.

"I was spending hours every week researching artists across a dozen different websites, copying information into documents, then reformatting it for air," Moody said. "Now I type one command and get everything — cited, formatted, and ready to send to the team on Slack."

The platform includes 27 interactive components — influence chains with artist photos and cited sources, story cards with chapters and embedded YouTube documentaries, track deep dives with credits from MusicBrainz and Discogs, playable playlists that export directly to Spotify, and more. Each component renders dynamically from the AI agent's research using OpenUI, an open framework for agent-generated interfaces.

**What's in the beta**

Crate is live at digcrate.app with a free tier (10 research queries/month) and a Pro tier ($15/month). The connected services — Spotify, Slack, and Google Docs — are available on all plans. The Auth0 Token Vault integration was built for the Auth0 "Authorized to Act" hackathon (submission deadline April 6, 2026).

Current capabilities:
- `/influence [artist]` — Mapped influence networks with weighted connections and cited sources
- `/story [topic]` — Narrative deep dives with chapters, YouTube embeds, playable tracks, and key people. Works for albums, genres, labels, and events
- `/track [song] [artist]` — Single-track deep dive with full credits, sample history, and vinyl pressing data
- `/artist [name]` — Full artist profile with tabbed discography, connections, and media
- `/prep [station]: [setlist]` — Radio show prep with talk breaks, social copy, and interview questions
- `/news [station]` — Daily music news segments from RSS feeds and web search
- Spotify library access — read playlists, create new playlists from research
- Slack delivery — send research to any channel with Block Kit formatting
- Google Docs export — save research as shareable documents
- Published Deep Cuts — shareable links at digcrate.app/cuts/ with audio playback

**About Tarik Moody**

Tarik Moody is Director of Strategy and Innovation at Radio Milwaukee, where he has worked since the station's launch in 2007. He hosts and produces Rhythm Lab Radio, a syndicated music show now in its 20th year. Before radio, he practiced architecture. He builds AI-powered products using Claude Code and has won multiple hackathons. He lives in Milwaukee, WI.

**About Radio Milwaukee**

Radio Milwaukee is a public radio station and NPR member serving Milwaukee, WI. It operates three distinct formats: 88Nine (eclectic/community), HYFIN (hip-hop/neo-soul/Afrobeats), and Rhythm Lab Radio (global beats/electronic/jazz). The station is currently testing Crate for daily show prep and music research.

**About Crate**

Crate is an AI-powered music research workspace for DJs, radio producers, playlist curators, music journalists, and crate diggers. It queries 20+ live databases through an AI agent and renders interactive, publishable research components. Evolved from the Crate CLI terminal application. Currently in beta at digcrate.app.

---

**Media resources:**
- Live app: https://digcrate.app
- Example published research: https://digcrate.app/cuts/ (see published Deep Cuts)
- GitHub: https://github.com/tmoody1973/crate-web
- Screenshots available on request

###
