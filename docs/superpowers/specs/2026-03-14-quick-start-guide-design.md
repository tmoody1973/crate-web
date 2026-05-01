# Quick Start Guide Modal — Design Spec

## Goal

Help new users get from sign-up to first research query by walking them through API key setup in a 3-step wizard modal. Provide a separate domain-specific experience for Radio Milwaukee team members whose keys are pre-configured.

## Architecture

A client-side modal component rendered on the workspace page. It checks Convex for an `onboardingCompleted` flag on the user record and shows the wizard on first sign-in or when the chat API returns a "no key" error. Radio Milwaukee users (identified by `@radiomilwaukee.org` email domain) get a different single-screen modal focused on show prep commands instead of key setup.

**Note on Radio Milwaukee detection**: Email domain detection relies on the email stored in the Convex `users` table, which is populated from Clerk at user creation time. Users who sign up via social providers may have a different email than their work email. This is acceptable for v1 since Radio Milwaukee team members will be directed to sign up with their work email.

## When the modal appears

1. **First sign-in**: User has no `onboardingCompleted` flag in Convex
2. **Error intercept**: Chat API returns the "API key required" error (400 response with the key-required message)
3. **Manual trigger**: Settings or help menu link (future, not in v1)

For Radio Milwaukee users, the modal always shows the team variant regardless of trigger.

**Edge case -- user already has a key but `onboardingCompleted` is false**: If the user already has a valid API key saved (e.g., they used the Settings drawer before the wizard existed), skip to Step 3 with the key pre-verified and show the "Try your first query" prompt. The wizard still shows so they see the welcome content, but the friction is minimal.

## Modal structure

### Standard flow (3-step wizard)

Width: 520px, max-height 90vh with scroll. Dark theme matching workspace (#1a1a1a background, #333 borders).

**Step tabs**: Horizontal tab bar at top with numbered circles: WELCOME, GET YOUR KEY, CONNECT. Active tab highlighted in brand orange (#E8520E). Completed tabs turn green (#4ade80).

**Step 1 -- Welcome**
- Heading: "Welcome to Crate"
- Subtext: "Your AI music research workspace. Ask any question -- Crate queries 20+ databases and gives you cited, verified answers."
- 4 feature cards in a 2x2 grid:
  - Deep Research: "Discogs, MusicBrainz, Genius, Last.fm, Spotify, and more -- all at once."
  - Built-in Player: "YouTube playback and 30,000+ live radio stations while you research."
  - Influence Mapping: "Trace artist connections across decades with cited evidence from 26 publications."
  - Show Prep: "Generate talk breaks, social copy, and news segments for your radio show."

**Step 2 -- Get Your Key**
- Heading: "Get your AI key"
- Subtext: "Crate needs an AI key to power the research agent. All 20+ music data sources are already built in -- you just need one of these:"
- Two selectable provider cards (only one selected at a time):

  **Anthropic** (selected by default, RECOMMENDED badge):
  - Description: "Direct access to Claude -- the model Crate was built for. Best tool use and research quality."
  - Price: "Pay-as-you-go ~ $0.01-0.05 per research query"
  - Steps:
    1. Go to console.anthropic.com and create an account (link to signup)
    2. Add a payment method (credit card required, $5 minimum)
    3. Go to Settings -> API Keys -> Create Key (link to keys page)
    4. Copy the key (starts with `sk-ant-`)

  **OpenRouter**:
  - Description: "Access Claude, GPT-4o, Gemini, Llama, and more through one key. Swap models anytime."
  - Price: "Pay-as-you-go, prices vary by model"
  - Steps:
    1. Go to openrouter.ai and create an account (link to signup)
    2. Add credits (link to credits page, $5 minimum)
    3. Go to Keys -> Create Key (link to keys page)
    4. Copy the key (starts with `sk-or-`)

- **Expandable extras section** (collapsed by default):
  - Toggle button: "Already included & optional extras" with "20+ ACTIVE" badge
  - When expanded, shows two sections:
    - "Built in -- no key needed" (green header, green dots): Discogs, MusicBrainz, Last.fm, Spotify, Wikipedia, YouTube, Ticketmaster, Setlist.fm, Bandcamp, iTunes, fanart.tv, Radio Browser, Tavily, Exa.ai, 26 Publications
    - "Optional -- add your own key in Settings" (orange header, orange dots): Genius, Tumblr, Mem0, AgentMail
    - Footer text: "These services are free or have free tiers. Add keys anytime in Settings to unlock them."

**Step 3 -- Connect**
- Heading: "Paste your key"
- Subtext: "Paste the API key you just created. Your key is encrypted and never shared."
- Input field with placeholder `sk-ant-... or sk-or-...`
- Auto-detect provider from key prefix (`sk-ant-` = Anthropic, `sk-or-` = OpenRouter)
- On paste: save the key via `POST /api/keys` with body `{ service: "anthropic", value: "sk-ant-..." }` or `{ service: "openrouter", value: "sk-or-..." }`, then verify via `POST /api/verify-key`
- Verification status: green banner "Key verified -- you're all set!" (or error state, see Verification Failure Modes below)
- "Try your first query" card with example: `"Who influenced Flying Lotus?"` and `/influence Madlib`
- Button text changes to "Start Digging ->"

### Radio Milwaukee flow (single screen)

Triggered when user's email domain is `radiomilwaukee.org`. No step tabs shown.

- Header: "Welcome, Radio Milwaukee" with orange TEAM badge
- Subtext: "Your API keys are already configured by your team admin. You're ready to go. Here's what Crate can do for your shows:"
- 4 command cards:
  - `/show-prep HYFIN`: "Paste your setlist. Crate researches every track and generates talk breaks, social copy, and interview prep."
  - `/news hyfin 5`: "Generate a 5-story music news segment, researched from RSS feeds and formatted for your station's voice."
  - `/influence [artist]`: "Map an artist's influence network -- who they were influenced by, who they influenced, with cited evidence."
  - `/radio [genre or station]`: "Stream any of 30,000+ live radio stations while you research. Try `/radio jazz` or `/radio KEXP`."
- Tip box: "You can also just ask questions naturally -- 'What Ethiopian jazz records influenced UK broken beat?' Crate searches across 20+ databases and cites everything."
- Button: "Start Digging ->"

### Footer

- Standard flow: Left: "I'll set up later" skip button (sets `onboardingCompleted: true` without saving a key). Right: "Next ->" button (or "Start Digging ->" on final step).
- Radio Milwaukee flow: Left: "Got it" dismiss button. Right: "Start Digging ->" button.

## Schema changes

### Convex `users` table

Add field: `onboardingCompleted` (optional boolean, default undefined/false)

When the wizard is dismissed (skip or complete), set `onboardingCompleted: true` via a Convex mutation.

## Key saving and verification

### Saving the key

On Step 3, after the user pastes a key:

1. Detect provider from key prefix:
   - `sk-ant-` prefix -> service name `"anthropic"`
   - `sk-or-` prefix -> service name `"openrouter"`
   - No recognized prefix -> show inline error "Key should start with sk-ant- (Anthropic) or sk-or- (OpenRouter)"
2. Save key via `POST /api/keys` with body `{ service: "<service>", value: "<key>" }` (this is the existing endpoint used by the settings drawer)

### Verification endpoint

New endpoint: `POST /api/verify-key`

- **Auth**: Requires Clerk authentication (same as other API routes)
- **Request body**: `{ provider: "anthropic" | "openrouter" }` -- no raw key in request
- **Behavior**: Reads the user's saved key from Convex (via `resolveUserKeys`), then makes a minimal API call:
  - Anthropic: `POST https://api.anthropic.com/v1/messages` with `max_tokens: 1`, system: "Say hi", message: "hi"
  - OpenRouter: `POST https://openrouter.ai/api/v1/chat/completions` with `max_tokens: 1`, messages: [{role: "user", content: "hi"}], model: "anthropic/claude-haiku-4.5"
- **Response**: `{ valid: true }` or `{ valid: false, error: "<message>" }`
- **Rate limiting**: Not needed for v1 since the endpoint requires auth and only reads from the user's own saved keys

### Verification failure modes

| Scenario | User-facing message |
|----------|-------------------|
| Invalid key format (no recognized prefix) | "Key should start with sk-ant- (Anthropic) or sk-or- (OpenRouter)" |
| Key rejected by provider (401/403) | "This key was rejected. Double-check that you copied the full key." |
| Key has no credits/balance | "Key works, but your account has no credits. Add credits at [provider link] and try again." |
| Network error | "Could not reach [provider]. Check your connection and try again." |
| Unknown error | "Verification failed. You can still try using Crate -- if the key works, you're good." |

## Onboarding check ownership

The `chat-panel.tsx` component already has access to the Convex user record via the workspace context. The onboarding check works as follows:

1. `chat-panel.tsx` reads `user.onboardingCompleted` from the existing Convex user query (no new query needed)
2. If `onboardingCompleted` is falsy, render the `QuickStartWizard` modal
3. If the user's email ends with `@radiomilwaukee.org`, render the Radio Milwaukee variant instead
4. The wizard receives an `onComplete` callback that calls the `completeOnboarding` Convex mutation

**Loading state**: While the Convex user query is loading, render the workspace without the modal. Once the query resolves and `onboardingCompleted` is falsy, overlay the modal. This avoids a flash of loading state on return visits.

## Error intercept flow

When the chat API returns `{ error: "An Anthropic or OpenRouter API key is required..." }`:

1. In `chat-panel.tsx`'s `processMessage` function, check the response status before returning
2. If status is 400 and the body contains the key-required error message, set a React state flag (`showWizard: true`, `wizardInitialStep: 2`)
3. Store the original message text in a React ref (`pendingMessageRef`)
4. Instead of returning the error response to the stream adapter, return early and open the wizard
5. When the wizard completes (key saved and verified), close the wizard and re-submit the message from `pendingMessageRef` via the existing `processMessage` flow

## Component structure

### New files
- `src/components/onboarding/quick-start-wizard.tsx` -- main modal component with step management, also contains the Radio Milwaukee variant as a conditional branch (single file since the variants share the modal shell, footer, and completion logic)
- `src/app/api/verify-key/route.ts` -- lightweight key verification endpoint (Clerk-authenticated, reads key from Convex)

### Modified files
- `convex/schema.ts` -- add `onboardingCompleted` to users table
- `convex/users.ts` -- add `completeOnboarding` mutation
- `src/components/workspace/chat-panel.tsx` -- render wizard modal, handle error intercept trigger, store pending message for re-send

## Accessibility

- Modal traps focus when open
- Escape key closes modal (same as skip button behavior)
- Tab order follows visual layout
- Provider cards are keyboard-selectable (Enter/Space to toggle)
- Input has proper label association
- Verification status announced to screen readers via `aria-live="polite"` region

## Visual reference

Interactive mockup: `.superpowers/brainstorm/98023-1773508849/wizard-mockup-v2.html`
