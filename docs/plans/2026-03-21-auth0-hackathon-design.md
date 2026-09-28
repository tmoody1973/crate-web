# Auth0 Hackathon: Token Vault Integration for Crate

> Replace Crate's manual API key pasting with Auth0 Token Vault OAuth connections. Add Spotify library access, playlist export, Slack delivery, and Google Docs saving.

## Hackathon

- **Name:** Authorized to Act: Auth0 for AI Agents
- **Deadline:** April 6, 2026 @ 11:45pm PDT
- **Requirement:** Must use Token Vault feature of Auth0 for AI Agents
- **Prize:** $5,000 grand prize + blog feature on auth0.com
- **Submission:** Text description, 3-min demo video, public repo, published link, optional blog post ($250 bonus)

## Overview

Crate is an AI music research agent that connects to 20+ data sources. Today, users paste API keys manually in Settings. Auth0 Token Vault replaces that with "click to Connect" OAuth flows for services that support it, while keeping the existing key system for services that don't.

The hackathon integration adds four capabilities powered by Token Vault:

1. **Read user's Spotify library** — "What in my library connects to the LA beat scene?"
2. **Export playlists to Spotify** — influence chain becomes a real Spotify playlist
3. **Send research to Slack** — show prep delivered to the team's channel
4. **Save research to Google Docs** — shareable doc with one command

## Architecture

### Auth Strategy: Clerk + Auth0 Side-by-Side

Clerk stays for user sign-in (no migration). Auth0 handles ONLY Token Vault OAuth connections to third-party services. Two auth systems, zero overlap.

```
CLERK                           AUTH0 TOKEN VAULT
─────                           ─────────────────
User sign-in                    "Connect Spotify" OAuth flow
Session management              "Connect Slack" OAuth flow
Convex user identity            "Connect Google" OAuth flow
Stripe billing link             Token storage + refresh
Radio Milwaukee domain          Per-user, personal connections
```

### Resolution Flow

```
Agent needs Spotify token:

1. Check Token Vault → user connected Spotify?
   YES → get OAuth token from Auth0 → use it
   NO  → fall back to embedded platform key (existing behavior)

Agent needs Slack token:

1. Check Token Vault → user connected Slack?
   YES → get OAuth token from Auth0 → use it
   NO  → "Connect Slack in Settings to send research to your team"
```

The key principle: Token Vault is an upgrade path, not a replacement. Everything that works today keeps working. Non-OAuth services (Discogs API key, MusicBrainz, Last.fm, Bandcamp) stay on the existing key system.

### What Doesn't Change

- Clerk authentication (sign-in, sessions, middleware)
- Convex schema and user records
- Stripe billing and subscription system
- Custom skills system
- Agentic loop and tool orchestration
- Radio Milwaukee domain detection and org key sharing
- Embedded platform keys for non-OAuth services
- The `/influence`, `/prep`, `/news` commands

## Token Vault Connections

| Service | Token Vault Type | OAuth Scopes | What Crate Does With It |
|---|---|---|---|
| Spotify | Pre-built | `user-library-read`, `user-top-read`, `playlist-read-private`, `playlist-modify-public` | Read library, read top artists, create playlists |
| Slack | Pre-built | `chat:write`, `channels:read` | Send research/show prep to channels |
| Google | Pre-built (Workspace) | `docs`, `drive.file` | Create Google Docs with research output |

### Services NOT Using Token Vault (stay on existing key system)

| Service | Why |
|---|---|
| Anthropic / OpenRouter | LLM key, not OAuth-based |
| Discogs | OAuth 1.0a (not supported by Token Vault) |
| MusicBrainz | Open API, no auth needed |
| Last.fm | API key only, no OAuth |
| Bandcamp | No public API |
| Genius | Could use custom OAuth2, but not needed for hackathon |
| Ticketmaster | API key only |
| Perplexity | API key only |

## New Agent Tools

### Tool 1: `read_spotify_library`

```typescript
read_spotify_library(type: "saved_tracks" | "top_artists" | "playlists", limit?: number)

// Token Vault provides Spotify OAuth token
// Returns: user's saved tracks, top artists, or playlists
// Agent uses this for personalized research:
//   "What in my library connects to the LA beat scene?"
```

### Tool 2: `export_to_spotify`

```typescript
export_to_spotify(
  name: string,           // "Ezra Collective: The Influence Chain"
  description: string,    // "Afrobeat Roots → Jazz Foundations → Hip-Hop Swing"
  trackQueries: string[]  // ["Fela Kuti Zombie", "Herbie Hancock Cantaloupe Island", ...]
)

// Token Vault provides Spotify OAuth token
// Step 1: Search Spotify for each track query → get track URIs
// Step 2: Create playlist via Spotify API
// Step 3: Add tracks to playlist
// Returns: Spotify playlist URL
```

Note: the agent passes track queries (artist + title), not Spotify URIs. The tool searches Spotify's catalog to find the right URI for each track. This avoids hallucinated Spotify URIs.

### Tool 3: `send_to_slack`

```typescript
send_to_slack(
  channel: string,    // "#hyfin-evening" or "general"
  content: string,    // Formatted research/show prep text
  title?: string      // "HYFIN Evening Show Prep — Thursday"
)

// Token Vault provides Slack OAuth token
// POST to Slack API → message appears in channel
// Returns: message permalink
```

### Tool 4: `save_to_google_doc`

```typescript
save_to_google_doc(
  title: string,      // "Flying Lotus Influence Chain"
  content: string     // Research output as formatted text
)

// Token Vault provides Google OAuth token
// Google Docs API → create new doc with content
// Returns: shareable doc URL
```

## Settings UI: Connected Services

New section in Settings drawer, above existing API keys:

```
┌─────────────────────────────────────┐
│  CONNECTED SERVICES                  │
│                                      │
│  🟢 Spotify          Connected       │
│     Library, playlists, export       │
│     [Disconnect]                     │
│                                      │
│  ⚪ Slack            [Connect]       │
│     Send research to your team       │
│                                      │
│  ⚪ Google           [Connect]       │
│     Save research to Google Docs     │
│                                      │
├──────────────────────────────────────┤
│  YOUR PLAN                           │
│  [existing plan section]             │
├──────────────────────────────────────┤
│  CUSTOM SKILLS                       │
│  [existing skills section]           │
├──────────────────────────────────────┤
│  API KEYS                            │
│  [existing key entry — Anthropic,    │
│   Discogs, Last.fm, etc.]            │
└──────────────────────────────────────┘
```

When user clicks "Connect Spotify":
1. Auth0 Token Vault OAuth flow opens in popup
2. User authorizes Crate on Spotify
3. Token stored in Auth0
4. Status updates to green "Connected"
5. Agent now has Spotify access for this user

"Disconnect" revokes the Token Vault connection. Agent falls back to embedded keys.

## Files to Create/Modify

### New Files
| File | Purpose |
|---|---|
| `src/lib/web-tools/spotify-connected.ts` | `read_spotify_library` + `export_to_spotify` tools |
| `src/lib/web-tools/slack.ts` | `send_to_slack` tool |
| `src/lib/web-tools/google-docs.ts` | `save_to_google_doc` tool |
| `src/lib/auth0-token-vault.ts` | Token Vault client — get tokens for connected services |
| `src/app/api/auth0/callback/route.ts` | Auth0 OAuth callback handler |
| `src/components/settings/connected-services.tsx` | "Connected Services" UI section |

### Modified Files
| File | Change |
|---|---|
| `src/lib/resolve-user-keys.ts` | Add Token Vault resolution alongside Convex decryption |
| `src/app/api/chat/route.ts` | Register new tool servers (spotify-connected, slack, google-docs) |
| `src/components/settings/settings-drawer.tsx` | Add ConnectedServices section above existing sections |
| `package.json` | Add `@auth0/ai-vercel` and `googleapis` dependencies |
| `.env.local.example` | Add Auth0 Token Vault env vars |

### Files That Don't Change
| File | Why |
|---|---|
| `convex/schema.ts` | No schema changes — Token Vault stores tokens in Auth0, not Convex |
| `src/lib/plans.ts` | No plan limit changes |
| `convex/subscriptions.ts` | Stripe billing unaffected |
| `convex/userSkills.ts` | Custom skills unaffected |
| `src/lib/agentic-loop.ts` | Agentic loop doesn't change — tools handle their own auth |
| All Clerk auth files | Clerk stays for user sign-in |

## Demo Script (3 minutes)

```
0:00 - 0:15  INTRO
"I'm Tarik Moody, a radio broadcaster at Radio Milwaukee.
I built Crate — an AI music research agent that connects to
20+ data sources. Today I'm showing how Auth0 Token Vault
makes that secure and seamless."

0:15 - 0:45  CONNECT
Show Settings → Connected Services section.
Click "Connect Spotify" → Auth0 OAuth popup → authorize.
Click "Connect Slack" → Auth0 OAuth popup → authorize.
Both show green "Connected" status.
"No API keys. Click Connect, you're done."

0:45 - 1:30  RESEARCH FROM YOUR LIBRARY
Type: "What in my Spotify library connects to the LA beat scene?"
Agent reads Spotify library via Token Vault.
Finds Flying Lotus, Thundercat, Knxwledge in saved tracks.
Runs influence mapping, builds the chain.
Shows InfluenceChain with pull quotes, sonic DNA chips.
"Crate read my library, found my artists, and mapped the
full influence network with cited sources."

1:30 - 2:15  EXPORT PLAYLIST
Agent: "Want me to save this as a Spotify playlist?"
Type: "yes"
Agent exports → playlist appears in Spotify.
Click the link, show it in Spotify.
"23 tracks, organized by influence lineage, in my Spotify."

2:15 - 2:45  SEND TO SLACK
Type: "/prep HYFIN" with a setlist.
Agent generates show prep.
Type: "send this to #hyfin-evening on Slack"
Agent sends via Token Vault.
"Show prep delivered to my team's Slack."

2:45 - 3:00  CLOSE
"Token Vault handles Spotify, Slack, and Google OAuth tokens
securely. Users click Connect instead of managing API keys.
digcrate.app — built with Claude Code by a radio broadcaster."
```

## Judging Criteria Alignment

| Criteria | How Crate Scores |
|---|---|
| Security Model | Token Vault manages all OAuth tokens. Agent never sees raw credentials. Users connect via standard OAuth flows with explicit scope consent. |
| User Control | Users choose which services to connect. Each connection shows what access it grants. Disconnect anytime. Personal connections only (no team-wide credential sharing). |
| Technical Execution | Token Vault integrated into an existing 20+ data source agentic system. Clean separation: Token Vault for OAuth services, existing key system for non-OAuth services. |
| Design | Three-panel UI with interactive artifacts. "Connected Services" section with clear status indicators. Agent outputs are interactive cards, not plain text. |
| Potential Impact | Music professionals connecting their actual accounts instead of managing raw API keys. Research personalized to their listening history. Show prep delivered to team Slack channels. |
| Insight Value | Pattern surfaced: AI agents that need MANY external services (20+) on behalf of ONE user. Token Vault managing a subset (OAuth-capable) while existing credential systems handle the rest. Real-world hybrid approach. |

## Blog Post Outline (bonus $250)

**Title:** "How a Radio Broadcaster Used Auth0 Token Vault to Connect an AI Agent to 20+ Music APIs"

1. The problem: music professionals research across 5-10 fragmented platforms, each requiring separate API credentials
2. What Crate is: AI music research agent with 20+ data sources
3. The old way: users paste API keys manually in Settings
4. The Token Vault way: click "Connect Spotify" and the agent reads your library, exports playlists, sends show prep to Slack
5. The hybrid approach: Token Vault for OAuth services, existing key system for non-OAuth services
6. The non-coder founder story: built with Claude Code, not engineering experience
7. What's next: WordPress publishing, Google Calendar for show scheduling, team-shared connections

## Timeline

| Day | Task | Effort |
|---|---|---|
| 1 | Set up Auth0 account, configure Token Vault connections (Spotify, Slack, Google) | 2 hours |
| 2 | Build `auth0-token-vault.ts` client + callback route | CC: 30 min |
| 3 | Build Spotify tools (read library, export playlist) | CC: 1 hour |
| 4 | Build Slack tool + Google Docs tool | CC: 1 hour |
| 5 | Build Connected Services UI in Settings | CC: 30 min |
| 6 | Wire tools into chat route + resolve-user-keys | CC: 30 min |
| 7 | Test full flow end-to-end | 2 hours |
| 8 | Record demo video | 2 hours |
| 9 | Write submission text + blog post | 2 hours |
| 10 | Submit | 30 min |

Total engineering: ~4 hours of Claude Code work + ~8 hours of setup/testing/content.

## Future (Post-Hackathon)

- WordPress.com publishing via custom OAuth2 connection
- Apple Music library access via MusicKit JS (not Token Vault — no OAuth2 support)
- Team-shared connections (one Slack workspace for all @radiomilwaukee.org users)
- Google Calendar integration for show scheduling
- Full Clerk → Auth0 migration (single auth system)
