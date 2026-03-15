<p align="center">
  <a href="https://crate-web.vercel.app">
    <img src="public/branding/crate-logo_Dark.svg" alt="Crate" width="280" />
  </a>
</p>

<p align="center">
  AI-powered music research for DJs, producers, and crate diggers.<br />
  19 sources. One agent. Zero tabs.
</p>

<p align="center">
  <a href="https://crate-web.vercel.app">Live App</a> &middot;
  <a href="https://crate-web.vercel.app/docs">Docs</a> &middot;
  <a href="https://github.com/tmoody1973/crate-cli">CLI</a> &middot;
  <a href="https://crate-web.vercel.app/guide">Guide</a>
</p>

<p align="center">
  <img src="public/crate_web_social.jpg" alt="Crate — DIG DEEPER." width="720" />
</p>

---

Crate Web is a browser workspace where an AI agent researches music across Discogs, MusicBrainz, Last.fm, Genius, Bandcamp, WhoSampled, Wikipedia, Ticketmaster, Spotify, and more. Ask about any artist, track, sample, or genre and get back interactive components, not just text.

## Features

- **Agentic research** — Claude-powered agent with tool-use across 19+ MCP data sources. Conversation history maintained within sessions.
- **Influence mapping** — Network-based artist influence discovery using review co-mentions, Last.fm similarity, and MusicBrainz credits. Results cached in a Convex-backed graph database.
- **Dynamic components** — Agent generates interactive album grids, track lists with play buttons, influence chains, sample trees, and show prep packages at runtime via OpenUI.
- **Bandcamp deep dives** — Tag exploration, related tag discovery, and album search with direct Bandcamp links.
- **WhoSampled integration** — Sample search, track sample details, and artist connection mapping via Kernel.sh.
- **Album artwork pipeline** — Spotify, fanart.tv, iTunes, Discogs, Bandcamp, and Genius with automatic fallback chain.
- **Publishing** — Publish research to Telegraph or Tumblr directly from chat.
- **Multi-model** — Claude Sonnet 4.6, GPT-4o, GPT-4.1, Gemini 2.5, Llama 4, DeepSeek R1, Mistral Large via OpenRouter.
- **Audio player** — Persistent bottom bar with YouTube playback.
- **Team key sharing** — Admins share encrypted API keys with `@domain` teammates.
- **Response actions** — Copy, Slack, email, and share buttons on every response (Perplexity-style).
- **Sidebar** — Crates (projects), starred/recent sessions, playlists, published research, full-text search.
- **Show prep** — Generate track context cards, talk break scripts, social media copy, and interview prep for radio DJs.
- **Keyboard shortcuts** — `Cmd+K` search, `Cmd+N` new chat, `Cmd+B` toggle sidebar, `Shift+S` settings.

## Tech stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | SSR, API routes, Turbopack dev |
| Deployment | Vercel | Serverless functions, zero-config deploys |
| Auth | Clerk | OAuth (Google, GitHub), user management |
| Database | Convex | Real-time sessions, messages, playlists, collections, influence graph |
| Dynamic UI | OpenUI (`@openuidev/react-lang`) | Agent-generated interactive components |
| Agent | Anthropic SDK + manual agentic loop | Tool-use loop with crate-cli MCP servers |
| Web tools | Custom handlers | WhoSampled, Bandcamp tags, browser, Spotify artwork, influence cache |
| Styling | Tailwind CSS v4 + `@tailwindcss/typography` | Dark theme, prose rendering |
| Audio | YouTube IFrame API | Persistent player bar |
| Email | AgentMail REST API | Send research to Slack or email |

## Quick start

### Prerequisites

- Node.js 20+
- npm 10+
- [Clerk](https://clerk.com) account (free tier)
- [Convex](https://convex.dev) account (free tier)
- [Anthropic](https://console.anthropic.com) API key (or [OpenRouter](https://openrouter.ai) key for multi-model)

### Install

```bash
git clone https://github.com/tmoody1973/crate-web.git
cd crate-web
npm install
```

### Environment variables

Copy the example and fill in your keys:

```bash
cp .env.local.example .env.local
```

Required variables:

```bash
# Clerk (https://dashboard.clerk.com → API Keys)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_...
CLERK_SECRET_KEY=sk_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
CLERK_WEBHOOK_SECRET=whsec_...

# Convex (https://dashboard.convex.dev)
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
CONVEX_DEPLOYMENT=dev:...

# Encryption key for API key storage
# Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=<64-char hex string>
```

Optional embedded keys (free for all users):

```bash
EMBEDDED_DISCOGS_KEY=
EMBEDDED_DISCOGS_SECRET=
EMBEDDED_LASTFM_KEY=
EMBEDDED_TICKETMASTER_KEY=
EMBEDDED_KERNEL_KEY=          # Kernel.sh — unlocks WhoSampled + browser tools
YOUTUBE_API_KEY=
AGENTMAIL_API_KEY=am_...
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
FANART_API_KEY=
```

### Run

```bash
# Terminal 1 — Convex dev server
npx convex dev

# Terminal 2 — Next.js dev server
npm run dev
```

Open [localhost:3000](http://localhost:3000), sign in, add your Anthropic key in Settings, and start digging.

## Project structure

```
crate-web/
├── convex/                              # Convex backend
│   ├── schema.ts                        # Database schema
│   ├── sessions.ts                      # Chat session CRUD
│   ├── messages.ts                      # Message persistence
│   ├── playlists.ts                     # Playlist management
│   ├── collection.ts                    # Vinyl collection
│   ├── crates.ts                        # Research project groups
│   ├── influence.ts                     # Influence graph cache
│   ├── published.ts                     # Published research
│   ├── users.ts                         # User sync (Clerk → Convex)
│   ├── keys.ts                          # Encrypted API key storage
│   └── orgKeys.ts                       # Team shared key storage
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts            # SSE streaming — agentic loop + direct chat
│   │   │   ├── keys/route.ts            # User API key management
│   │   │   ├── org-keys/route.ts        # Team key sharing
│   │   │   ├── email/route.ts           # AgentMail integration
│   │   │   ├── artwork/route.ts         # Spotify artwork proxy
│   │   │   ├── youtube/route.ts         # YouTube search
│   │   │   └── webhooks/clerk/          # Clerk user sync webhook
│   │   ├── w/[sessionId]/               # Workspace (authenticated)
│   │   ├── sign-in/                     # Clerk sign-in
│   │   └── sign-up/                     # Clerk sign-up
│   ├── components/
│   │   ├── landing/                     # Landing page
│   │   ├── workspace/
│   │   │   ├── chat-panel.tsx           # Chat with OpenUI rendering + history
│   │   │   ├── artifact-slide-in.tsx    # Artifact panel
│   │   │   ├── model-selector.tsx       # Multi-model dropdown
│   │   │   ├── response-actions.tsx     # Copy/Slack/Email/Share bar
│   │   │   └── workspace-shell.tsx      # Layout orchestration
│   │   ├── sidebar/                     # Sidebar sections
│   │   ├── player/                      # YouTube audio player
│   │   └── settings/                    # API key management
│   └── lib/
│       ├── openui/
│       │   ├── components.tsx           # 19 OpenUI component definitions
│       │   ├── library.ts              # Component registry
│       │   └── prompt.ts               # System prompt for agent → OpenUI
│       ├── web-tools/
│       │   ├── whosampled.ts           # WhoSampled search, samples, connections
│       │   ├── bandcamp.ts             # Bandcamp related tags
│       │   ├── browser.ts             # URL browsing and screenshots
│       │   ├── images.ts              # Spotify + fanart.tv artwork
│       │   ├── influence-cache.ts     # Convex-backed influence graph tools
│       │   ├── radio.ts               # Radio stream playback
│       │   ├── telegraph.ts           # Telegraph publishing
│       │   ├── tumblr.ts              # Tumblr publishing
│       │   └── infographic.ts         # Gemini image generation
│       ├── agentic-loop.ts             # Manual agentic loop (Anthropic + OpenRouter)
│       ├── tool-adapter.ts             # CrateToolDef → SDK tool conversion
│       ├── chat-utils.ts               # Slash commands, prompt routing
│       ├── resolve-user-keys.ts        # API key resolution chain
│       └── encryption.ts               # AES-256-GCM key encryption
└── docs/superpowers/                    # Design specs + implementation plans
```

## API key tiers

| Tier | How it works | Examples |
|------|-------------|----------|
| **Embedded** | Platform keys in Vercel env vars — free for all users | Discogs, Last.fm, Ticketmaster, Kernel.sh |
| **Required** | User adds their own key in Settings | Anthropic (or OpenRouter) |
| **Optional** | User adds to unlock extra sources | Genius, Tavily, Exa, Tumblr, Mem0, Spotify |

Resolution order: **User key > Org shared key > Embedded key**

## Multi-model support

With an OpenRouter key, switch models in the chat header:

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

## Data sources

The agent queries these MCP servers via crate-cli:

| Source | Data |
|--------|------|
| Discogs | Releases, labels, credits, cover art |
| MusicBrainz | Artist metadata, relationships, recordings |
| Last.fm | Similar artists, tags, listening stats |
| Genius | Lyrics, annotations, song metadata |
| Bandcamp | Album search, tag exploration, related tags |
| WhoSampled | Sample origins, covers, remixes |
| Wikipedia | Artist bios, discography context |
| Ticketmaster | Concert listings, ticket availability |
| Spotify | Album/artist artwork (640x640) |
| fanart.tv | HD artist backgrounds, logos, album covers |
| iTunes | Album artwork (600x600), track search |
| AllMusic | Reviews, ratings, style classifications |
| Pitchfork | Reviews via 26-publication review search |
| Rate Your Music | Community ratings and lists |
| Setlist.fm | Live setlist history |
| YouTube | Music videos, live performances |
| Exa.ai | Semantic web search |
| Tavily | AI-optimized web search |
| Mem0 | Cross-session user memory |

## Deploy

```bash
npm i -g vercel
vercel
```

Set all environment variables in Vercel dashboard → Settings → Environment Variables.

## Related

- [Crate CLI](https://github.com/tmoody1973/crate-cli) — Terminal-based AI music research agent. 19 MCP servers, autonomous workflows, TUI.
- [OpenUI](https://github.com/thesysdev/openui) — Dynamic UI generation framework for agent-created components.
- [Convex](https://convex.dev) — Real-time database for sessions, messages, and collections.

## License

MIT
