# Auth0 Hackathon Submission: Crate

## Project Name
Crate — AI Music Research Agent with Auth0 Token Vault

## One-Line Description
An AI music research agent that uses Auth0 Token Vault to securely read users' Spotify libraries, export playlists, send show prep to Slack, and save research to Google Docs — all through natural language conversation.

## Description

Crate is an AI music research agent that connects to 20+ data sources — Spotify, MusicBrainz, Discogs, Genius, Last.fm, AllMusic, Pitchfork, and more. It maps artist influence networks, generates show prep for radio broadcasters, and provides cited, interactive research about any artist, track, genre, or label.

**The problem**: Music professionals research across 5-10 fragmented platforms, each requiring separate API credentials. Users shouldn't have to navigate developer portals to connect their accounts.

**How Token Vault solves it**: Auth0 Token Vault replaces manual API key management with one-click OAuth connections. Users click "Connect Spotify" in Settings, authorize via Auth0's OAuth flow, and the agent can immediately read their library and export playlists. Same for Slack and Google Docs.

**What makes it agentic**: A single natural language prompt can chain all connected services. "What in my Spotify library connects to Afrobeat? Build the influence chain, export it as a playlist, send the prep to Slack, and save a copy to Google Docs." The agent orchestrates tool calls across all three Token Vault connections in one conversation — reading Spotify via OAuth, running influence mapping across six databases, creating the playlist, formatting and delivering the Slack message, and saving the Google Doc.

**The hybrid approach**: Token Vault manages OAuth services (Spotify, Slack, Google). Non-OAuth services (Discogs, Last.fm, MusicBrainz) continue using API keys or open APIs. The agent resolves tokens at the tool layer — it doesn't care which system provides access.

**Architecture**: Clerk handles user authentication. Auth0 handles only Token Vault connections. Two auth systems, zero overlap. The Management API client caches tokens with 23-hour TTL. Per-service Auth0 user IDs stored in httpOnly cookies. HMAC-signed CSRF state for OAuth flows.

## Tech Stack
- Next.js 15 (App Router)
- Auth0 Token Vault (Management API for IdP token retrieval)
- Clerk (user authentication)
- Convex (database)
- Anthropic Claude (AI agent)
- Vercel (deployment)

## Links
- **Live app**: https://digcrate.app
- **Repo**: https://github.com/tmoody1973/crate-web
- **Blog post**: included in submission

## Builder
Tarik Moody — Radio broadcaster and producer at Radio Milwaukee. Built Crate with Claude Code as a solo developer.
