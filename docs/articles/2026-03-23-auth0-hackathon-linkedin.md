# I built an AI music agent that connects to your Spotify, Slack, and Google Docs. Here's why that matters.

I've been building Crate for the past two weeks. It's an AI research assistant for people who work in music — DJs, radio producers, playlist curators, anyone who needs to dig deep into artist histories, influence chains, and sample lineages without drowning in browser tabs.

Crate pulls from 20+ live data sources (Discogs, Genius, MusicBrainz, Last.fm, Bandcamp, Spotify, and more) and synthesizes everything into one conversation. Ask it to map the influence chain from Fela Kuti to Beyonce, and it actually traces the path — through Afrobeat, through Wizkid, through Burna Boy's grandfather who managed Fela — with real citations from real sources.

But until last week, there was a gap. Crate could research anything, but it couldn't *do* anything with what it found outside of the app. You'd get a beautiful influence map, then have to screenshot it and paste it into Slack yourself. You'd discover the perfect playlist, but there was no way to push it to Spotify.

## What changed

I entered the Auth0 "Authorized to Act" hackathon, and the timing was perfect. Auth0 recently launched something called Token Vault — a way for AI agents to securely act on behalf of users across third-party services. Instead of asking users to paste API keys or manage OAuth tokens themselves, the agent handles it through Auth0's infrastructure.

So I wired it up. Here's what Crate can do now:

**Spotify.** Connect your account, and Crate pulls in your full library — saved tracks, top artists, every playlist you've built. It uses what you actually listen to as context for research. Ask "who are my top artists?" and it knows. Say "deep dive into the artists on my HYFIN playlist" and it pulls the tracks, researches every artist, maps their connections, and finds samples you didn't know existed. Found an influence chain you love? One click and Crate creates a new playlist in your Spotify account, searches for each track, and adds them. The playlist shows up in your Spotify app immediately.

**Slack.** After running a show prep research session (Crate was originally built for Radio Milwaukee), you can send the results directly to a Slack channel. The message arrives formatted with Block Kit — proper headers, bullet lists, dividers. No more copy-pasting research into chat.

**Google Docs.** Save any research output as a Google Doc with a shareable link. Useful for archiving deep dives or sharing with collaborators who aren't in Crate.

## Why this matters beyond my app

Here's the thing I keep coming back to: the "connect your account" pattern is going to be everywhere in the next year.

Right now, most AI tools are isolated. They can generate text, analyze data, search the web. But they can't touch your actual stuff. Your playlists, your team's Slack channels, your Google Drive. The moment an AI agent can act on your behalf across services you already use, the whole dynamic shifts from "AI as a search engine" to "AI as a collaborator."

Auth0's Token Vault makes this possible without each developer having to build their own OAuth infrastructure from scratch. I didn't have to store any Spotify tokens in my database. I didn't have to handle token refresh logic. Auth0 manages the token lifecycle, and my agent just asks for access when it needs it.

For non-developers reading this: imagine your AI tools could actually push a button for you, not just tell you which button to push. That's what this enables.

## What Crate actually is

If you haven't seen it before: Crate is an AI workspace for music research. You type questions in natural language and an agent goes out and queries real databases in real time.

Some things people use it for:

- Show prep for radio DJs (origin stories, talk break suggestions, social media copy for each track in a set)
- Influence mapping — tracing how artists connect through samples, collaborations, and stylistic lineage
- Vinyl discovery — searching Discogs and Bandcamp for pressings and releases
- Playlist creation from a theme or vibe, backed by actual research
- Custom skills — you can teach Crate to scrape any website and turn it into a reusable command

The new connected services (Spotify, Slack, Google Docs) mean the research doesn't stay trapped in the app. It goes where you need it.

## The hackathon

I built this for the Auth0 "Authorized to Act" hackathon (deadline April 6, 2026). The whole integration — OAuth flows, token exchange, three sets of API tools, the settings UI, the Block Kit Slack formatting — took about a week of focused work.

If you're building AI agents and want your users to connect their own accounts without you managing credentials, Auth0 Token Vault is worth looking at. The setup was straightforward once I understood the OAuth flow, and the security model is right: my app never sees or stores the raw Spotify/Slack/Google tokens.

You can try Crate at [digcrate.app](https://digcrate.app). The connected services are live now.

---

*Tarik Moody is a developer, DJ, and the creator of Crate. He builds tools for people who take music seriously.*
