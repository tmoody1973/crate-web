# Crate Web — Project Brief

## Who is this for?
Music researchers, DJs, producers, and crate diggers who want an AI-powered music research agent but won't use a terminal CLI.

## What problem does it solve?
Crate CLI is powerful but locked behind a terminal interface. Most music people — even technically curious ones — won't install Node.js and configure API keys in a `.env` file. Crate Web brings the same multi-source research agent to the browser with a collaborative workspace feel (like Claude Cowork, but for music).

## What does "done" look like? (v1 Success Criteria)
1. **User signs in, adds API keys, runs research** — streams back with visible tool progress showing which sources the agent is querying
2. **Split-pane collaborative workspace** — chat/conversation on the left, dynamic artifacts canvas on the right (Cowork feel)
3. **Agent generates visual artifacts** — sample lineage trees, album grids, track comparisons rendered via OpenUI, not just markdown text
4. **Persistent audio player** — bottom bar (Spotify/SoundCloud style) with YouTube IFrame API as primary source, Bandcamp embeds as secondary. Agent can trigger playback contextually during research.
5. **Sessions saved and shareable** — Convex stores research sessions, shareable via URL

## PM Competencies Demonstrated
- **Product Strategy** — Translating a developer tool into a consumer-facing product; scope decisions on what makes v1 vs v2
- **Technical Fluency** — Multi-API orchestration, real-time streaming architecture, dynamic UI generation via LLM
- **Scale Product** — Designed for real users with auth, persistence, and sharing from day one

## Anchor Project
**Data-Driven (Crate)** — This is Crate's web surface. The data strategy (19 MCP servers, multi-source orchestration) IS the product.

## Tech Stack Decisions
| Layer | Choice | Why |
|-------|--------|-----|
| Framework | Next.js (App Router) | Vercel deployment, RSC for streaming |
| Deployment | Vercel | Zero-config, edge functions, built-in analytics |
| Auth | Clerk | Fast integration, handles OAuth, fits Vercel ecosystem |
| Real-time DB | Convex | Real-time subscriptions for live sessions, no SQL to manage |
| Dynamic UI | OpenUI (@thesysdev/openui) | Agent generates contextual UI components at runtime |
| Agent | Claude Agent SDK via crate-cli npm dep | Same CrateAgent + MCP servers as CLI, streamed via SSE |
| MCP Servers | Import from `crate-cli` npm package | Reuse all 19 servers without duplication |
| Audio | YouTube IFrame API + Bandcamp embeds | Widest catalog coverage, no user OAuth required |

## What is NOT v1
- Spotify/Apple Music integration (requires user OAuth)
- Collaborative multi-user sessions
- Mobile-native app
- User-uploaded audio analysis
- Social features (following, feeds)

## Architecture Overview
```
Browser (Next.js)
  ├── Clerk (auth)
  ├── Split-pane workspace
  │   ├── Chat panel (streaming conversation)
  │   └── Artifacts canvas (OpenUI dynamic components)
  ├── Persistent audio player (YouTube/Bandcamp)
  └── Settings (API key management)
        │
        ▼
Vercel Edge / Serverless
  ├── Claude API (Vercel AI SDK)
  │   └── Tool calls → MCP server functions
  ├── Convex (sessions, collections, user keys)
  └── crate-cli MCP servers (imported as npm dep)
```

## Key Risks
1. **OpenUI maturity** — relatively new library, may need fallbacks to standard React components
2. **API key security** — user keys stored in Convex must be encrypted at rest
3. **Streaming complexity** — tool progress + answer tokens + artifact updates all flowing simultaneously
4. **Cost** — Claude API calls on user's key, but Convex/Vercel have free tiers
