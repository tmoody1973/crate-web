# Architecture Decision Records

## ADR-001: Separate repo from crate-cli
**Date:** 2026-03-11 | **Status:** Accepted

### Context
Crate Web is a web interface for the same research agent that powers Crate CLI. We needed to decide whether to build within the existing crate-cli repo, fork it, or create a new repo.

### Options Considered
1. **Monorepo (add to crate-cli)** — Shared code easy, but pollutes CLI project with Next.js/Convex/Clerk deps
2. **Fork crate-cli** — Quick start, but diverges immediately; CLI code (pi-tui, SQLite) is irrelevant
3. **New repo, import crate-cli as npm dep** — Clean separation, reuse MCP servers via package import

### Decision
Option 3. New repo (`crate-web`) that imports `crate-cli` as an npm dependency for the MCP server modules. The two products have different deployment targets, UI frameworks, data layers, and auth models.

### Consequences
- Enables: Independent deployment cycles, clean dependency tree
- Limits: MCP server changes require publishing a new crate-cli version first
- Revisit if: We need to extract MCP servers into a standalone `@crate/core` package

---

## ADR-002: Convex over Supabase for real-time data
**Date:** 2026-03-11 | **Status:** Accepted

### Context
Need real-time session state (research progress, artifact updates, audio queue) plus persistent storage (saved sessions, user API keys, collections).

### Options Considered
1. **Supabase** — Familiar (used in Hakivo), Postgres-backed, real-time via subscriptions
2. **Convex** — Purpose-built real-time DB, TypeScript-native, no SQL, automatic reactivity
3. **Firebase** — Google ecosystem, real-time DB, but vendor lock-in concerns

### Decision
Convex. The research workspace needs sub-second reactivity for streaming tool progress, artifact updates, and audio state. Convex's reactive queries are a better fit than polling Supabase subscriptions. TypeScript-native schema also eliminates the ORM layer.

### Consequences
- Enables: Real-time artifact canvas, live session sharing, reactive audio queue
- Limits: Less ecosystem maturity than Supabase, smaller community
- Revisit if: Convex pricing becomes prohibitive at scale or we need raw SQL for analytics

---

## ADR-003: OpenUI for agent-generated dynamic components
**Date:** 2026-03-11 | **Status:** Accepted

### Context
The key differentiator from a plain chatbot is that the agent generates contextual UI — sample trees, album grids, track comparisons — not just markdown text.

### Options Considered
1. **Pre-built component library** — Build every possible visualization upfront, agent picks from a menu
2. **OpenUI (@thesysdev/openui)** — Agent generates UI specifications, OpenUI renders them dynamically
3. **Artifacts as markdown/HTML** — Agent outputs rich markdown, render with custom components

### Decision
OpenUI as primary with pre-built fallback components. OpenUI lets the agent decide what visualization fits the data, which is more flexible than a fixed component menu. Pre-built components (sample tree, album grid) serve as reliable fallbacks.

### Consequences
- Enables: Agent creativity in presentation, novel visualizations we didn't anticipate
- Limits: OpenUI is early-stage, generated UI quality may vary
- Revisit if: OpenUI quality is too inconsistent for production use

---

## ADR-004: YouTube IFrame API as primary audio source
**Date:** 2026-03-11 | **Status:** Accepted

### Context
The persistent audio player needs to play tracks the agent references during research. Need widest possible catalog coverage with minimal user friction.

### Options Considered
1. **Spotify Web Playback SDK** — Best UX but requires Spotify Premium + OAuth
2. **YouTube IFrame API** — Widest catalog, no auth required, free
3. **Bandcamp embeds** — Supports independent artists, no auth, but limited catalog

### Decision
YouTube IFrame API as primary, Bandcamp embeds as secondary. YouTube has the widest catalog and requires zero user authentication. Bandcamp fills the indie gap. Spotify/Apple Music deferred to v2 since they require user OAuth flows.

### Consequences
- Enables: Immediate playback for any track the agent finds, zero setup
- Limits: YouTube audio quality varies, ads on free tier, no offline
- Revisit if: Users strongly request Spotify integration (add as v2 feature)
