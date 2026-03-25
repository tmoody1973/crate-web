# PRESS RELEASE

**FOR IMMEDIATE RELEASE**
**March 25, 2026**

**Contact:** Tarik Moody | tarikjmoody@gmail.com | Milwaukee, WI

---

## Milwaukee radio executive — not a software engineer — builds AI music research platform that outpaces Spotify's new SongDNA

*Crate, currently in beta, is the first AI platform built for understanding music, not generating it. It connects to Spotify, Slack, and Google Docs through Auth0 Token Vault. Built in two weeks by a non-technical builder using Claude Code.*

---

**MILWAUKEE, WI** — The same week Spotify launched SongDNA, a feature showing connections behind songs for Premium subscribers, a radio executive in Milwaukee shipped something that does the same thing and goes further.

Crate is an AI music research workspace. It pulls from 20+ live databases — Discogs, MusicBrainz, Last.fm, Genius, WhoSampled, Bandcamp, and Spotify's own API — and returns interactive components instead of text. Type `/track Unfinished Sympathy Massive Attack` and Crate shows you every person who played on it, every track that sampled it, the vinyl pressing history from Discogs, and a narrative about how the song was recorded at Abbey Road with a 42-piece orchestra. Type `/influence Flying Lotus` and it maps the full influence network with cited sources from 26 music publications.

SongDNA shows you that Song A sampled Song B. Crate tells you why.

**The first AI platform for music intelligence, not music generation**

Most AI products in music are about generation — tools like Suno and Udio that create new music from prompts. Crate does the opposite. It helps people understand music that already exists.

The distinction matters. Radio DJs preparing a show need to know who played bass on a 1971 Alice Coltrane record and how that connects to Flying Lotus in 2010. They need that research delivered to their Slack channel before airtime. They don't need a new song.

Through Auth0's Token Vault, users connect their Spotify, Slack, and Google accounts once. The AI agent then reads your Spotify library, creates playlists from research, sends formatted show prep to Slack, and saves deep dives as Google Docs. No API keys. No OAuth management. The agent acts on your behalf.

**Influence mapping with academic methodology**

Crate's influence mapping is based on Badillo-Goicoechea's 2025 paper in the Harvard Data Science Review on network-based music recommendation. The system searches for co-mentions across 26 music publications — Pitchfork, The Guardian, DownBeat, AllMusic, and others. When a review of Artist B mentions Artist A, that creates a weighted edge in the influence graph. Each connection includes pull quotes, sonic elements, and the specific works that demonstrate the influence. Every claim is cited and verifiable.

Spotify recently acquired data from WhoSampled to power SongDNA's sample connections. Crate's influence chains are the layer above samples — they capture stylistic lineage, not just audio reuse.

**Built by a radio executive, not a software engineer**

Tarik Moody is not a traditional developer. He is Director of Strategy and Innovation at Radio Milwaukee, an NPR member public radio station he has been with since its launch in 2007. Before radio, he practiced architecture. He has no computer science degree.

Moody built Crate in two weeks using Claude Code, Anthropic's AI coding tool. It evolved from an earlier terminal application he built to speed up his own research workflow. He has been building AI products with Claude Code for months, winning multiple hackathons along the way.

"I'm building AI products for the rest of us," Moody said. "People who have deep domain expertise but aren't software engineers. Claude Code lets someone who knows music inside and out build a product that a traditional engineering team would need months to deliver."

Radio Milwaukee is currently testing Crate across its stations: 88Nine (eclectic/community), HYFIN (hip-hop/neo-soul/Afrobeats), and the syndicated Rhythm Lab Radio, a show Moody has hosted and produced for over 20 years.

"I was spending hours every week researching artists across a dozen different websites, copying information into documents, then reformatting it for air," Moody said. "Now I type one command and get everything — cited, formatted, and ready to send to the team on Slack."

**What's in the beta**

Crate is live at digcrate.app with a free tier and a Pro tier ($15/month). Four features show what separates it from SongDNA:

- **Influence chains** — `/influence Flying Lotus` maps the full influence network with weighted connections, pull quotes, sonic elements, and cited sources from 26 publications. Exportable as a Spotify playlist.
- **Story cards** — `/story Donuts` produces a magazine-style narrative with chapters, embedded YouTube documentaries, playable tracks, and key people with photos. Works for albums, artists, genres, labels, and events.
- **Track deep dives** — `/track Unfinished Sympathy` shows tabbed credits (MusicBrainz + Discogs), sample history (WhoSampled), and vinyl pressing data. The direct SongDNA competitor, with more data.
- **Connected services** — research exports directly to Spotify playlists, Slack channels (with Block Kit formatting), and Google Docs. Published "Deep Cuts" are shareable links with audio playback at digcrate.app/cuts/.

The Auth0 Token Vault integration was built for the Auth0 "Authorized to Act" hackathon (submission deadline April 6, 2026).

**About Tarik Moody**

Director of Strategy and Innovation at Radio Milwaukee since the station's 2007 launch. Host and producer of Rhythm Lab Radio, a syndicated music show now in its 20th year. Former architect. Builds AI-powered products using Claude Code. Multiple hackathon winner. Milwaukee, WI.

**About Radio Milwaukee**

Public radio station and NPR member serving Milwaukee, WI. Three formats: 88Nine (eclectic/community), HYFIN (hip-hop/neo-soul/Afrobeats), Rhythm Lab Radio (global beats/electronic/jazz). Currently testing Crate for daily show prep and music research.

**About Crate**

AI music research workspace. 20+ databases. 27 interactive components. Connected to Spotify, Slack, and Google Docs. Currently in beta at digcrate.app.

---

**Media resources:**
- Live app: https://digcrate.app
- Published research examples: https://digcrate.app/cuts/
- Demo video: [coming soon]
- GitHub: https://github.com/tmoody1973/crate-web
- Screenshots and b-roll available on request

###
