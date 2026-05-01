# How a Radio Broadcaster Used Auth0 Token Vault to Connect an AI Agent to 20+ Music APIs

I'm Tarik Moody. I've been a radio broadcaster at Radio Milwaukee for 20 years. I am not a software engineer. But I built Crate — an AI music research agent that connects to over 20 data sources — using Claude Code.

This is the story of how Auth0 Token Vault solved the hardest UX problem in my app: getting users connected to their own accounts without making them manage API keys.

## The Problem: Fragmented Music Data

Music professionals live across a dozen platforms. Spotify for listening. Discogs for vinyl. MusicBrainz for metadata. Genius for lyrics. Last.fm for listening history. AllMusic for reviews. Pitchfork for criticism. Bandcamp for independent releases.

When I started building Crate, the agent needed access to all of these. For some — MusicBrainz, Bandcamp — no authentication is required. For others — Discogs, Last.fm — you need an API key. But for the services where Crate is most powerful — reading your Spotify library, sending show prep to your team's Slack, saving research to Google Docs — you need OAuth.

OAuth means tokens. Tokens mean complexity. And for a non-engineer building an AI agent, that complexity was the wall.

## The Old Way: Paste Your API Key

Before Token Vault, Crate's Settings page had a section called "API Keys." Users would go to Spotify's developer portal, create an app, copy the client ID, paste it into Crate. Same for Discogs. Same for Last.fm. Every service, another portal, another key, another paste.

It worked. But it was terrible UX. The people who use Crate — radio DJs, music journalists, playlist curators — are not the kind of people who want to navigate developer portals. They want to type "What in my library connects to Afrobeat?" and get an answer.

## The Token Vault Way: Click Connect

Auth0 Token Vault replaced all of that with three buttons: **Connect Spotify**, **Connect Slack**, **Connect Google**.

Click the button. Auth0 opens the OAuth popup. Authorize Crate. Done. The token is stored securely in Auth0 — not in my database, not in a cookie, not in localStorage. Auth0 manages the entire lifecycle: storage, refresh, revocation.

From the user's perspective, it's a one-click connection. From the agent's perspective, it's a function call:

```typescript
const token = await getTokenVaultToken("spotify", auth0UserId);
```

That single line reaches into Auth0's Management API, finds the user's linked Spotify identity, and returns a fresh OAuth access token. The agent never sees credentials. The user never sees a developer portal.

## The Architecture: Clerk + Auth0 Side-by-Side

Here's what makes this interesting: I didn't replace my existing auth system. Crate uses Clerk for user sign-in, session management, and billing. Auth0 handles only the Token Vault connections to third-party services.

Two auth systems, zero overlap:

- **Clerk**: User sign-in, sessions, Convex user identity, Stripe billing
- **Auth0 Token Vault**: Spotify OAuth, Slack OAuth, Google OAuth, token storage and refresh

This hybrid approach works because Token Vault solves a specific problem — securely storing and refreshing third-party OAuth tokens — that my existing auth system doesn't handle. I didn't need to migrate users or change my sign-in flow. I added Token Vault alongside what already worked.

## What the Agent Can Do Now

With Token Vault connected, Crate's agent has four new tools:

**1. Read your Spotify library.** "What in my saved tracks connects to the LA beat scene?" The agent reads your library, finds Flying Lotus, Thundercat, and Knxwledge in your saved tracks, then maps the full influence network with cited sources from MusicBrainz, Discogs, Genius, and AllMusic.

**2. Export playlists to Spotify.** The influence chain becomes a real Spotify playlist. The agent searches Spotify's catalog for each track, creates a playlist in your account, and adds the tracks. 23 songs, organized by influence lineage, in your Spotify.

**3. Send research to Slack.** Type "/prep HYFIN" and the agent generates show prep — tonight's setlist with artist context, influence chains, talking points. Then "send this to #hyfin-evening on Slack" and it's delivered with Block Kit formatting: headers, bullet lists, tables, dividers.

**4. Save to Google Docs.** Any research output can be saved as a shareable Google Doc with one command. The agent creates the document, inserts the content, and returns the link.

The key insight: these aren't four separate features. They're tools in an agentic loop. A single prompt can chain all four:

> "What in my Spotify library connects to Afrobeat? Build the influence chain, export it as a playlist, send the prep to #music-research on Slack, and save a copy to Google Docs."

The agent reads Spotify, runs influence mapping across six databases, exports the playlist, formats and sends the Slack message, creates the Google Doc — all in one conversation. Token Vault provides the secure access at each step.

## The Hybrid Approach: Token Vault + Existing Keys

Not every service supports OAuth. Discogs uses OAuth 1.0a (not supported by Token Vault). Last.fm and Ticketmaster use API keys only. MusicBrainz requires no auth at all.

So Crate runs a hybrid model:

- **Token Vault** for OAuth services: Spotify, Slack, Google
- **User-managed API keys** for non-OAuth services: Discogs, Last.fm, Genius
- **Embedded platform keys** for open APIs: MusicBrainz, Bandcamp, Pitchfork
- **No auth** for web scraping: AllMusic, Wikipedia, Rate Your Music

The agent doesn't care which system provides the token. It calls `getTokenVaultToken("spotify")` for Token Vault services and reads environment keys for the rest. The resolution happens at the tool layer, not the agent layer.

## The Non-Engineer Story

I built all of this with Claude Code. Not with a team of engineers. Not with years of backend experience. I'm a radio DJ who wanted a better way to research music.

Auth0 Token Vault made the OAuth integration approachable because it abstracted the hardest parts: token storage, refresh logic, revocation handling, and multi-provider management. I didn't write a token refresh loop. I didn't build a credential database. I called an API.

If you're building an AI agent that needs to act on behalf of users across multiple services, Token Vault is the difference between "paste your API key" and "click Connect." For the kind of users I serve — music professionals who want to research, not configure — that difference is everything.

## What's Next

- **Apple Music** library access via MusicKit JS
- **WordPress** publishing for music blogs
- **Google Calendar** integration for show scheduling
- **Team-shared connections** so all @radiomilwaukee.org users share one Slack workspace connection

Crate is live at [digcrate.app](https://digcrate.app). The repo is public at [github.com/tmoody1973/crate-web](https://github.com/tmoody1973/crate-web).

---

*Tarik Moody is a radio broadcaster and producer at Radio Milwaukee. He built Crate as an AI research tool for music professionals.*
