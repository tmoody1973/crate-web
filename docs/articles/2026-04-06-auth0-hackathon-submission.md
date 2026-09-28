# Auth0 Hackathon Submission — Crate

## Inspiration

I've been a radio DJ at Radio Milwaukee for 20 years. Every show requires hours of research — tracing how artists connect across genres, building playlists, writing show prep, then getting all of that to my team on Slack, archived in Google Docs, shared on my blog. That workflow touches a dozen tabs and four different services, each with its own login.

When Auth0 announced Token Vault for AI agents, I saw the missing piece. I was already building Crate — an AI music research agent that searches 19 sources in one conversation. But research is only half the job. The other half is getting it where it needs to go. Token Vault meant my AI agent could finally reach into Spotify, Tumblr, Slack, and Google Docs on my behalf — with one OAuth layer handling everything.

## What it does

Crate is an AI music research agent for DJs, producers, and serious music lovers. Through Auth0 Token Vault, a single agent connects to four OAuth services:

- **Spotify** — reads your library, finds genre connections, exports influence chains as playlists
- **Tumblr** — publishes research to your blog, discovers music by tag across all of Tumblr
- **Slack** — sends show prep to your team channel with rich Block Kit formatting
- **Google Docs** — saves research as permanent, searchable documents

Each service is one click to connect. The agent chains tools autonomously — read library, build influence chain, create playlist, publish to blog, send to team, save to docs — all from natural language.

## How we built it

**Auth0 Token Vault integration:**
- Each connected service (Spotify, Tumblr, Slack, Google) is configured as an Auth0 social connection with Token Vault enabled
- User clicks "Connect" in Crate's Settings → Auth0 handles the OAuth popup → token stored in Token Vault → per-service cookie maps the user to their Auth0 identity
- When the AI agent needs to call a service, it retrieves the OAuth bearer token via Auth0's Management API (`getTokenVaultToken("spotify", auth0UserId)`)
- Token refresh is automatic — Auth0 handles it transparently

**The connect flow (`/api/auth0/connect`):**
- HMAC-signed CSRF state cookie for security
- `connection_scope` parameter passes service-specific OAuth scopes to the IdP
- Separate handling for Slack's `user_scope` (comma-separated) vs standard space-separated scopes
- Per-service cookies (`auth0_user_id_spotify`, `auth0_user_id_tumblr`, etc.) so multiple services don't conflict

**Tumblr custom social connection:**
- Auth0 doesn't have a built-in Tumblr connector, so we built a custom social connection
- OAuth 2.0 with `https://www.tumblr.com/oauth2/authorize` and `https://api.tumblr.com/v2/oauth2/token`
- Custom Fetch User Profile script that calls Tumblr's `/v2/user/info` endpoint
- Markdown-to-NPF converter for publishing rich posts (headings, bold, italic, links, lists, blockquotes)

**Tech stack:**
- Next.js 14 (App Router) + TypeScript
- Auth0 Token Vault (OAuth token management for all 4 services)
- Convex (real-time database)
- Anthropic Claude Sonnet 4.6 (AI agent with tool use)
- Clerk (user authentication)
- Vercel (deployment)
- OpenUI Lang (interactive component rendering in chat)

## Challenges we ran into

**Tumblr OAuth 2.0 setup was undocumented territory.** Auth0's built-in Tumblr connection uses OAuth 1.0a, but Token Vault needs OAuth 2.0 bearer tokens. We had to build a custom social connection from scratch — discovering that Tumblr requires the "OAuth2 redirect URLs" field to be set separately from the default callback URL, and that the Fetch User Profile script needed the 2-argument signature `(accessToken, callback)` instead of 3.

**Tumblr post IDs are 64-bit integers.** JavaScript's `JSON.parse()` truncates them because they exceed `Number.MAX_SAFE_INTEGER`. Posts created successfully but returned 404 links because the ID was wrong. Fix: parse the ID from raw response text with regex instead of JSON.parse.

**Tumblr's NPF format rejects unicode.** Markdown tables, arrow symbols (→), filled circles (●), and emoji all cause 400 errors from Tumblr's API. We built a sanitizer that converts unicode to plain text equivalents and transforms markdown tables into list items (NPF has no table block type).

**Scope separation for Auth0 authorize URL.** Auth0 treats the `scope` parameter as OIDC-only (openid, profile, email). Service-specific scopes like Spotify's `streaming` or `user-library-read` must go in `connection_scope`, which gets forwarded to the IdP's OAuth endpoint. This took debugging to discover.

**AI agent hallucination.** When the Tumblr tool returned a "choose blog" action instead of posting directly, the agent fabricated fake success responses instead of asking the user. Fix: hardcode the blog name in the action button flow and add explicit anti-hallucination instructions ("If you respond without calling the tool, you are hallucinating").

**Model routing for action buttons.** The Docs/Tumblr/Slack action buttons send natural language messages that were routing to Haiku (the fast, cheap model) instead of Sonnet (which has the tools). Haiku would claim it didn't have the tools and hallucinate. Fix: pattern match action button messages to force Sonnet routing.

## Accomplishments that we're proud of

- **Four OAuth services through one integration pattern.** The same `getTokenVaultToken(service, userId)` call works for Spotify, Tumblr, Slack, and Google Docs. Adding a new service is ~10 lines of config.

- **Custom Tumblr OAuth 2.0 connection.** Built from scratch when the built-in Auth0 connector didn't support Token Vault. Full OAuth 2.0 flow with bearer tokens, custom profile script, and NPF publishing.

- **One-click action buttons.** Under every Crate response, users can click Tumblr, Slack, Docs, or Copy to instantly route research to any connected service. The agent handles everything.

- **Real, live results.** Every demo moment is real — the Spotify playlist exists, the Tumblr post is published, the Slack message lands in the channel, the Google Doc is saved. No mocks, no fakes.

- **Markdown-to-NPF converter.** Converts the agent's markdown output to Tumblr's Neue Post Format with headings, bold, italic, links, lists, blockquotes, and code blocks — plus unicode sanitization and table-to-list conversion.

## What we learned

- **Token Vault is the right abstraction for agentic OAuth.** Instead of each tool managing its own token lifecycle, Token Vault centralizes it. The agent just asks for a bearer token and calls the API. Refresh, storage, consent — all handled by Auth0.

- **Custom social connections unlock services Auth0 doesn't cover.** Tumblr isn't in Auth0's built-in list, but the custom connection framework let us add it with full Token Vault support. Any OAuth 2.0 service can be added this way.

- **AI agents need guardrails around tool use.** The biggest challenge wasn't the OAuth plumbing — it was preventing the agent from hallucinating tool calls. Explicit instructions, model routing, and hardcoded parameters were all necessary to make the agent reliably call real tools.

- **The `connection_scope` parameter is essential.** Without it, service-specific scopes never reach the IdP. This is easy to miss and hard to debug because Auth0 doesn't error — it just doesn't pass the scopes.

## What's next for Crate

- **Apple Music via MusicKit JS** — Apple doesn't use OAuth for music access (it uses a proprietary Developer Token + Music User Token system), so it can't go through Token Vault. We'll integrate MusicKit JS client-side as a parallel path.

- **Inline Slack channel picker** — Currently the agent lists channels as text. We want a dropdown picker form inline in the chat, similar to the show prep form.

- **More connected services** — SoundCloud, Bandcamp, Discord, Notion. Each one is ~10 lines of Token Vault config plus a tool file.

- **Cross-service workflows** — "Find what's trending on Tumblr #jazz, add the best tracks to my Spotify playlist, and send a summary to my team on Slack." Multi-service chains that show the full power of agentic Token Vault.

- **Token Vault for team workspaces** — Radio stations have teams. Token Vault could manage shared OAuth connections so the whole team's agents access the same Spotify, Slack, and Docs without individual setup.

## How Crate Meets the Judging Criteria

### Security Model

Crate's agent operates within explicit permission boundaries at every layer:

- **Tokens never touch Crate's database.** Auth0 Token Vault stores and refreshes all OAuth tokens. The agent retrieves them at runtime via Auth0's Management API through `getTokenVaultToken()`. If Crate's database were compromised, no OAuth credentials would be exposed.
- **HMAC-signed CSRF protection** on the OAuth connect flow. A cryptographic nonce is stored in a signed HttpOnly cookie and verified on callback. The state parameter never contains user data.
- **Per-service HttpOnly cookies** (`auth0_user_id_spotify`, `auth0_user_id_tumblr`, etc.) isolate each service's Auth0 identity. Compromising one cookie doesn't grant access to other services.
- **Minimal, explicit scopes per service.** Spotify gets `user-library-read` + `playlist-modify-public` + `streaming`, not blanket access. Tumblr gets `basic` + `write` + `offline_access`. Slack gets `chat:write` + `channels:read`. Google gets `documents` + `drive.file` (only files Crate creates, not the entire Drive). Each scope is chosen for the specific tools the agent needs.
- **Credentials encrypted at rest.** User-provided API keys (BYOK) are encrypted with a 64-character hex key before storage.

### User Control

Users understand and control what the agent can access:

- **Settings page** shows all four connected services with clear Connected/Disconnected badges and one-click Connect/Disconnect buttons.
- **OAuth consent screens** display exactly what Crate requests. Spotify's screen shows "Read your library" and "Create playlists." Tumblr shows "Read and write on your behalf." Users grant permissions explicitly through their service's native consent UI.
- **Independent disconnection.** Users can disconnect Spotify without affecting Tumblr, or disconnect all four services individually. Disconnection removes the per-service cookie immediately.
- **BYOK (Bring Your Own Key).** Users who provide their own Anthropic or OpenRouter API key bypass platform quotas entirely. No vendor lock-in.
- **Scopes defined in code and visible in Auth0 Dashboard.** The `SERVICE_CONFIG` in `auth0-token-vault.ts` maps each service to its exact OAuth scopes. These are passed transparently via `connection_scope` to the identity provider.

### Technical Execution

The Token Vault integration is production-grade and deployed live:

- **Clean, replicable pattern.** `SERVICE_CONFIG` maps service names to Auth0 connections and scopes. `getTokenVaultToken(service, userId)` retrieves any service's token. Adding a new service is ~10 lines of config. This pattern works for any OAuth 2.0 provider.
- **Management API token cached** with 23-hour TTL (refreshes 1 hour early). Not hitting Auth0 on every agent tool call.
- **Custom Tumblr social connection** built from scratch. Auth0's built-in Tumblr connector uses OAuth 1.0a, but Token Vault needs OAuth 2.0 bearer tokens. We created a custom connection with OAuth 2.0 authorize/token endpoints and a custom Fetch User Profile script.
- **Edge cases handled:** CSRF nonce verification, missing id_token fallback to /userinfo, Slack's comma-separated `user_scope` vs space-separated `connection_scope`, 64-bit post ID preservation via regex (JSON.parse truncates IDs exceeding Number.MAX_SAFE_INTEGER).
- **Production deployed.** Live at digcrate.app on Vercel. Real users, real Spotify libraries, real Tumblr posts, real Slack messages. Not a localhost demo.

### Design

The user experience blends frontend interactivity with backend agent infrastructure:

- **27+ interactive OpenUI components** render in the chat at runtime. The agent generates artist profiles, influence chains, show prep packages, Spotify playlist browsers, Tumblr feeds, and Slack channel pickers as React components, not just text.
- **Action buttons under every response.** Copy, Slack, Email, Docs, Tumblr, Share. One click to route any research to any connected service. The buttons send a clean one-line message while the preprocessor injects detailed tool instructions the agent follows.
- **TumblrFeed component** with post type filters (Audio, Text, Photo, Link, Video, Quote), blog attribution, tag pills, note counts, and "View on Tumblr" links. Handles all Tumblr post types with type-specific rendering.
- **Dark theme** consistent across all surfaces: chat, settings, landing page, components, published shares.
- **Mobile responsive.** Full mobile UX with hamburger sidebar, touch-optimized inputs, mini player bar, speech-to-text.
- **Backend architecture matches frontend quality.** The agentic loop, tool registry, OpenUI prompt generation, and Token Vault integration are all well-structured TypeScript with clear separation of concerns.

### Potential Impact

**For AI developers:**
- The Token Vault integration pattern (`SERVICE_CONFIG` + `getTokenVaultToken()` + per-service cookies) is directly replicable. Any AI agent builder can copy this architecture to connect their agent to OAuth services.
- The custom Tumblr social connection proves that services not in Auth0's built-in list can still use Token Vault. This extends Token Vault's reach to any OAuth 2.0 provider.
- The anti-hallucination patterns we discovered (model routing for action buttons, explicit tool instructions, "if you respond without calling the tool, you are hallucinating") are hard-won lessons applicable to any agentic tool-use system.

**Beyond AI developers:**
- Crate serves a real professional community. Radio DJs, producers, and music journalists spend hours on research that Crate condenses to minutes. The Token Vault integration means that research flows directly to Spotify playlists, team Slack channels, published blogs, and archived docs.
- The "one prompt, four services" demo shows non-technical users what agentic AI looks like when the auth layer is solved. This is the kind of workflow that makes AI tangible and useful, not theoretical.

### Insight Value

Building Crate with Token Vault surfaced patterns, pain points, and gaps that directly inform how agent authorization should evolve:

**Patterns:**
- **`connection_scope` vs `scope` is critical and underdocumented.** Auth0's authorize endpoint treats `scope` as OIDC-only. Service-specific scopes (Spotify's `streaming`, Tumblr's `write`) must go in `connection_scope`. We burned hours learning this. Clearer docs would save every developer this pain.
- **Custom social connections unlock the long tail.** Tumblr isn't in Auth0's built-in list, but the custom connection framework let us add it with full Token Vault support in an afternoon. This is a powerful pattern that deserves more visibility.
- **Per-service cookies solve multi-identity.** Each Auth0 social connection creates a separate Auth0 user. Storing per-service Auth0 user IDs in separate HttpOnly cookies prevents cross-contamination and supports users who connect multiple services.

**Pain points:**
- **64-bit integer truncation.** Tumblr post IDs exceed `Number.MAX_SAFE_INTEGER`. `JSON.parse()` silently truncates them, producing valid-looking but wrong IDs. Any service with large numeric IDs will hit this. Token Vault or the Management API could return IDs as strings.
- **Tumblr OAuth 2.0 activation is hidden.** The "OAuth2 redirect URLs" field in Tumblr's app settings must be filled for OAuth 2.0 to activate. Without it, OAuth 2.0 is silently disabled and users see the login page but no consent screen. Not documented clearly anywhere.
- **AI agents hallucinate tool calls.** When the agent receives an intermediate response (e.g., "choose a blog"), it sometimes fabricates a success message instead of following up. Agentic workflows need explicit guardrails, model routing, and anti-hallucination instructions.

**Gaps that should inform Token Vault's evolution:**
- **No agent audit log.** Users can't see "Crate read your Spotify library at 3:42pm" or "Crate created a playlist at 3:45pm." Token Vault handles the auth, but the actions performed with those tokens aren't logged visibly. An agent activity log would build user trust and enable debugging.
- **No token health visibility.** "Is my Spotify token still valid?" requires calling the API and seeing if it 401s. Token Vault could expose a status endpoint or webhook for token expiry/refresh events.
- **No differentiated risk levels.** Reading a library vs creating a playlist vs publishing to a blog are different risk levels. Token Vault treats them identically. Step-up authentication for write operations would add a meaningful security layer for agentic workflows.
- **No multi-step OAuth in a single agent turn.** If the user hasn't connected a service, the agent can't initiate the OAuth flow mid-conversation. The user must leave the chat, go to Settings, connect, and return. A "connect inline" flow would make the agent experience seamless.

## Bonus Blog Post

### The Moment I Stopped Managing Tokens

There's a specific moment during this hackathon that changed how I think about building AI tools.

I was debugging why Tumblr kept returning 400 errors. The markdown-to-NPF converter was choking on unicode arrows and filled circles from the influence chain output. I'd spent an hour on it. And then it hit me — I was debugging *content formatting*, not authentication. Not token refresh. Not OAuth scopes.

That's the whole point of Token Vault. I never once debugged a token expiry. Never wrote a refresh flow. Never stored a credential in my database. I just called `getTokenVaultToken("tumblr")` and got a bearer token back. Same call for Spotify, Slack, Google Docs. Four services, one pattern, zero token plumbing.

The wildest challenge was Tumblr itself. Auth0 doesn't have a built-in Tumblr connector for Token Vault, so I built a custom social connection from scratch — OAuth 2.0 authorize URL, token endpoint, custom profile script. The Fetch User Profile script needed a specific two-argument function signature that took three attempts to get right. And Tumblr post IDs are 64-bit integers that JavaScript silently truncates, so every post link was a 404 until I parsed the ID from raw text instead of JSON.

But through all of that, the OAuth layer just worked. Token Vault earned its name. I spent my time on the product — influence chains, show prep, music discovery — instead of reinventing auth infrastructure. For a solo developer building an AI agent that touches four different services, that's everything.
