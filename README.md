<p align="center">
  <img src="public/branding/crate-logo_Dark.svg" alt="Crate" width="280" />
</p>

<p align="center">
  <strong>AI-powered music research workspace in the browser</strong><br />
  The web companion to <a href="https://github.com/tmoody1973/crate-cli">Crate CLI</a>
</p>

<p align="center">
  <a href="https://crate-web.vercel.app">Live Site</a> · <a href="https://crate-web.vercel.app/docs">Documentation</a> · <a href="https://crate-cli.dev">CLI</a>
</p>

---

Crate Web brings the same multi-source research agent from Crate CLI to a collaborative browser workspace. Ask about any artist, track, sample, or genre and the AI agent queries up to 19 MCP data sources in real time, generating dynamic visual components alongside conversational answers.

## Features

- **AI Research Agent** — Claude-powered agent with tool-use across Discogs, MusicBrainz, Last.fm, Genius, Bandcamp, Wikipedia, Ticketmaster, and more
- **Influence Mapping** — Network-based artist influence discovery using review co-mentions, Last.fm similarity, and MusicBrainz credits with Convex-backed graph cache
- **Dynamic OpenUI Components** — Agent generates interactive album grids, track lists, influence chains, sample trees, and collection buttons at runtime
- **Publishing** — Publish research to Telegraph or Tumblr directly from the chat
- **Persistent Chat** — Sessions, messages, and artifacts saved to Convex with real-time sync
- **Multi-Model Support** — Switch between Claude Sonnet 4.6, GPT-4o, Gemini 2.5, Llama 4, DeepSeek R1, and more via OpenRouter
- **Album Artwork** — Cover art from Spotify, fanart.tv, iTunes, Discogs, Bandcamp, and Genius with automatic fallback chain
- **Audio Player** — Persistent bottom bar with YouTube playback (Spotify-style)
- **Team Key Sharing** — Admins share encrypted API keys with `@domain` teammates so the whole team can research without individual setup
- **AgentMail + Slack** — Send any research response to Slack or email with one click (Perplexity-style action bar)
- **Sidebar** — Crates (projects), starred/recent sessions, playlists, artifacts browser, full-text search
- **Keyboard Shortcuts** — `Cmd+K` search, `Cmd+N` new chat, `Cmd+B` toggle sidebar, `Shift+S` settings

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 15 (App Router) | SSR, API routes, Turbopack dev |
| Deployment | Vercel | Edge functions, zero-config deploys |
| Auth | Clerk | OAuth (Google, GitHub), user management |
| Real-time DB | Convex | Sessions, messages, artifacts, playlists, collections |
| Dynamic UI | OpenUI (`@openuidev/react-lang`) | Agent-generated interactive components |
| Agent | Claude Agent SDK via `crate-cli` | Same CrateAgent + 19 MCP servers as CLI |
| Styling | Tailwind CSS + `@tailwindcss/typography` | Dark theme, prose rendering |
| Audio | YouTube IFrame API | Persistent player bar |
| Email | AgentMail REST API | Send research to Slack or any email |

## Quick Start

### Prerequisites

- Node.js 20+
- npm 10+
- A [Clerk](https://clerk.com) account (free tier)
- A [Convex](https://convex.dev) account (free tier)
- An [Anthropic](https://console.anthropic.com) API key (or [OpenRouter](https://openrouter.ai) key for multi-model)

### Installation

```bash
git clone https://github.com/tmoody1973/crate-web.git
cd crate-web
npm install
```

Crate Web imports MCP servers from the sibling `crate-cli` directory. Clone it alongside:

```bash
cd ..
git clone https://github.com/tmoody1973/crate-cli.git
cd crate-cli && npm install && npm run build
cd ../crate-web
```

### Environment Variables

Create `.env.local` with:

```bash
# Clerk (https://dashboard.clerk.com → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_WEBHOOK_SECRET=whsec_...          # Clerk dashboard → Webhooks

# Convex (https://dashboard.convex.dev)
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
NEXT_PUBLIC_CONVEX_SITE_URL=https://...convex.site
CONVEX_DEPLOYMENT=dev:...

# Encryption (generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
ENCRYPTION_KEY=<64-char hex string>

# Tier 1 embedded keys — shared across all users (optional but recommended)
EMBEDDED_DISCOGS_KEY=
EMBEDDED_DISCOGS_SECRET=
EMBEDDED_LASTFM_KEY=
EMBEDDED_TICKETMASTER_KEY=

# YouTube (https://console.cloud.google.com → APIs → YouTube Data API v3)
YOUTUBE_API_KEY=

# AgentMail (https://console.agentmail.to — for Slack/email integration)
AGENTMAIL_API_KEY=am_...
```

### Development

```bash
# Terminal 1: Convex dev server
npx convex dev

# Terminal 2: Next.js dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Sign in with Clerk, add your Anthropic API key in Settings, and start researching.

## Project Structure

```
crate-web/
├── convex/                            # Convex backend
│   ├── schema.ts                      # Database schema
│   ├── sessions.ts                    # Chat session CRUD
│   ├── messages.ts                    # Message persistence
│   ├── artifacts.ts                   # OpenUI artifact storage
│   ├── playlists.ts                   # Playlist management
│   ├── collection.ts                  # Vinyl collection
│   ├── crates.ts                      # Research project groups
│   ├── influence.ts                   # Influence graph cache (artists, edges, sources)
│   ├── published.ts                   # Published research (Telegraph, Tumblr)
│   ├── users.ts                       # User sync (Clerk → Convex)
│   ├── keys.ts                        # Encrypted API key storage
│   └── orgKeys.ts                     # Team shared key storage
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts          # SSE streaming — CrateAgent research
│   │   │   ├── keys/route.ts          # User API key management
│   │   │   ├── org-keys/route.ts      # Team key sharing
│   │   │   ├── email/route.ts         # AgentMail — send to Slack/email
│   │   │   ├── artwork/route.ts       # iTunes album artwork lookup
│   │   │   ├── youtube/route.ts       # YouTube search
│   │   │   └── webhooks/clerk/        # Clerk user sync webhook
│   │   ├── w/[sessionId]/             # Workspace (authenticated)
│   │   ├── sign-in/                   # Clerk sign-in
│   │   └── sign-up/                   # Clerk sign-up
│   ├── components/
│   │   ├── landing/                   # Landing page (Blue Note-inspired)
│   │   │   ├── hero.tsx               # DIG DEEPER. headline + photo + orange accent
│   │   │   ├── nav.tsx                # Sticky navigation
│   │   │   ├── marquee.tsx            # Scrolling source ticker
│   │   │   ├── app-showcase.tsx       # App screenshot section
│   │   │   ├── features.tsx           # 9-card feature grid
│   │   │   ├── sources-grid.tsx       # 16 data source cards
│   │   │   ├── dj-showcase.tsx        # Station use case cards
│   │   │   ├── comparison.tsx         # Crate vs alternatives
│   │   │   └── footer.tsx             # Footer with links
│   │   ├── docs/                      # Documentation page (/docs)
│   │   │   ├── commands.tsx           # Slash command reference
│   │   │   ├── prompt-examples.tsx    # 12 example prompts
│   │   │   ├── use-cases.tsx          # Station workflow case studies
│   │   │   ├── data-sources.tsx       # 16 source descriptions
│   │   │   ├── api-keys.tsx           # API key configuration guide
│   │   │   └── docs-faq.tsx           # FAQ section
│   │   ├── workspace/
│   │   │   ├── chat-panel.tsx         # Main chat with OpenUI rendering
│   │   │   ├── artifact-slide-in.tsx  # Artifact panel (Claude-style)
│   │   │   ├── artifact-provider.tsx  # Artifact state + Convex persistence
│   │   │   ├── model-selector.tsx     # Multi-model dropdown
│   │   │   ├── response-actions.tsx   # Copy/Slack/Email/Share bar
│   │   │   └── workspace-shell.tsx    # Layout orchestration
│   │   ├── sidebar/
│   │   │   ├── sidebar.tsx            # Main sidebar container
│   │   │   ├── recents-section.tsx    # Recent chat sessions
│   │   │   ├── playlists-section.tsx  # Saved playlists
│   │   │   ├── artifacts-section.tsx  # Browsable artifacts
│   │   │   └── search-bar.tsx         # Full-text search
│   │   ├── player/
│   │   │   ├── player-provider.tsx    # Audio state context
│   │   │   ├── player-bar.tsx         # Persistent bottom bar
│   │   │   └── youtube-player.tsx     # YouTube IFrame integration
│   │   └── settings/
│   │       ├── settings-drawer.tsx    # API key management drawer
│   │       ├── key-entry.tsx          # Individual key input
│   │       └── team-sharing.tsx       # Team key sharing UI
│   ├── hooks/
│   │   ├── use-crate-agent.ts         # CrateAgent SSE hook
│   │   ├── use-keyboard-shortcuts.ts  # Cmd+K/N/B shortcuts
│   │   └── use-session.ts            # Session management
│   └── lib/
│       ├── openui/
│       │   ├── components.tsx         # OpenUI component definitions
│       │   ├── library.ts            # Component registry
│       │   ├── prompt.ts             # System prompt for AI → OpenUI
│       │   └── stream-adapter.ts     # SSE → OpenUI bridge
│       ├── agent.ts                   # CrateAgent factory
│       ├── encryption.ts             # AES-256-GCM key encryption
│       └── tool-labels.ts            # Human-readable tool names
├── PROJECT_BRIEF.md                   # Product brief
├── ADR.md                             # Architecture decision records
└── docs/plans/                        # Design + implementation plans
```

## API Key Tiers

Crate Web uses a three-tier key system:

| Tier | How it works | Examples |
|------|-------------|----------|
| **Embedded** | Platform keys in Vercel env vars — all users get these free | Discogs, Last.fm, Ticketmaster |
| **Required** | User must add their own key in Settings | Anthropic (or OpenRouter) |
| **Optional** | User adds to unlock extra sources | Genius, Tavily, Exa, Tumblr, Mem0, AgentMail |

Priority chain: **User key > Org shared key > Embedded key**

## Team Key Sharing

Admins can share their API keys with anyone signing in with a specific email domain:

1. Go to Settings → Team Sharing
2. Enter the domain (e.g., `radiomilwaukee.org`)
3. Click Share — your keys are encrypted and stored per-domain
4. Any team member signing in with that domain automatically gets access

Team members' own keys always take priority over shared keys.

## Multi-Model Support

With an OpenRouter key, users can switch between models in the chat header:

| Model | Provider |
|-------|----------|
| Claude Sonnet 4.6 | Anthropic (direct) |
| Claude Haiku 4.5 | Anthropic (direct) |
| GPT-4o | OpenAI via OpenRouter |
| GPT-4.1 | OpenAI via OpenRouter |
| Gemini 2.5 Flash | Google via OpenRouter |
| Gemini 2.5 Pro | Google via OpenRouter |
| Llama 4 Scout | Meta via OpenRouter |
| DeepSeek R1 | DeepSeek via OpenRouter |
| Mistral Large | Mistral via OpenRouter |

## Response Actions

Every AI response includes a Perplexity-style action bar:

- **Copy** — Copy full response to clipboard
- **Slack** — One-click send to your Slack channel via AgentMail email bridge
- **Email** — Send to any email address
- **Share** — Copy for sharing

## Related

- **[Crate CLI](https://github.com/tmoody1973/crate-cli)** — The terminal-based AI music research agent that powers Crate Web's backend. 19 MCP servers, autonomous research workflows, and a TUI interface.
- **[OpenUI](https://github.com/thesysdev/openui)** — Dynamic UI generation framework used for agent-created components.
- **[Convex](https://convex.dev)** — Real-time database powering sessions, messages, artifacts, and collections.

## Deploy on Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Set all environment variables in Vercel dashboard → Settings → Environment Variables.

## License

MIT
