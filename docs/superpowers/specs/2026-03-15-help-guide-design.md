# Unified Help Guide for Crate Web

**Goal:** Replace the separate `/docs` and `/guide` pages with a single `/help` page that adapts content to the user's persona, includes API key setup walkthroughs with direct links, and is accessible via sidebar button, chat header button, and `/help` slash command.

**Architecture:** A static Next.js page with a sidebar nav and scrollable main content area. Persona selection stored in Convex with domain-based defaults. All content in focused React components — no CMS, no MDX, no new dependencies.

**Tech Stack:** Next.js App Router, React, Tailwind CSS, Convex (persona persistence), Clerk (domain detection)

---

## Context

Help content is split across two pages: `/docs` (7 sections: commands, prompts, use cases, sources, API keys, FAQ) and `/guide` (5 persona-based prompt guides). There's also a QuickStartWizard behind the "?" button. Users don't know which page to visit. API key setup instructions exist but lack direct links to provider dashboards.

The `/help` command doesn't exist — there's no way to access help from within the chat.

### What this replaces

- `/docs` page and all components in `src/components/docs/`
- `/guide` page and its persona content
- QuickStartWizard (content absorbed into "Getting Started" section)
- The "?" button behavior (currently opens QuickStartWizard → now navigates to `/help`)

---

## Design

### 1. Page layout

Sidebar + main content, matching the Stripe/Tailwind docs pattern.

**Sidebar (left, fixed):**
- Persona badge at top — shows current role, "Change" link to reopen picker
- "For You" section — persona-specific workflow guides
- "Reference" section — commands, sources, API keys, prompts, FAQ (same for everyone)
- "More Guides" section — links to other persona guides (collapsed)

**Main content (right, scrollable):**
- Each section is an `<section id="section-name">` for hash navigation
- Clicking sidebar items smooth-scrolls to the section and updates the URL hash
- Direct links work: `crate-web.vercel.app/help#api-keys`

### 2. Personas (6)

| Persona | "For You" workflow guides |
|---------|--------------------------|
| New User | What is Crate?, Your First Session, Understanding Results, Next Steps |
| Radio Host / Music Director | Show Prep, Interview Research, Influence Mapping, Publishing |
| DJ / Producer | Sample Digging, Genre Exploration, Playlist Building, Bandcamp Discovery |
| Record Collector | Collection Management, Album Research, Discography Deep Dives |
| Music Lover | Artist Discovery, Playlist Creation, Genre Exploration |
| Music Journalist | Artist Research, Influence Mapping, Publishing, Source Citations |

### 3. Persona selection and persistence

**First visit:**
1. User lands on `/help`
2. Persona picker renders at top — 6 cards with title, one-line description, and icon
3. Domain-based default: if Clerk email domain is in the config map, matching personas get a "Recommended for your team" badge and are pre-highlighted
4. User clicks a card to confirm
5. Selection saved to Convex `users` table as `helpPersona` field (string)
6. Page re-renders with sidebar adapted to chosen persona

**Domain config** (hardcoded object in help page):
```typescript
const DOMAIN_PERSONAS: Record<string, string[]> = {
  "radiomilwaukee.org": ["radio-host", "dj", "journalist"],
};
```

**Return visits:** Persona loaded from Convex on page load. No picker shown.

**Changing persona:** "Change" link in sidebar persona badge reopens the picker inline. New selection saved immediately.

### 4. Entry points

**Sidebar button:** Permanent "Help" link in the workspace sidebar, below search. Navigates to `/help`.

**Chat header button:** The existing "?" button in ChatHeader navigates to `/help` instead of opening QuickStartWizard.

**`/help` slash command:** Typing `/help` in chat navigates to `/help`. Supports deep linking: `/help commands` → `/help#commands`, `/help api-keys` → `/help#api-keys`.

**Redirects:**
- `/docs` → redirect to `/help#commands`
- `/guide` → redirect to `/help`

### 5. Content sections

#### Getting Started (all personas)
Three numbered step cards:
1. **Add your API key** — instructions to open Settings, paste Anthropic key, with "Get an Anthropic key →" link to `console.anthropic.com`
2. **Ask your first question** — persona-specific example prompt in a code block
3. **Explore the results** — explanation of interactive components (play buttons, save, publish)

#### Persona workflow guides (persona-specific)
Each guide is 200-300 words covering:
- What the workflow does
- Example prompt to try (copy-paste ready)
- What the agent will do (which tools it calls, what components it generates)
- Tips for follow-up prompts

#### All Commands
Table of all slash commands with name, description, and example usage:
`/show-prep`, `/influence`, `/publish`, `/published`, `/radio`, `/news`, `/help`

#### Data Sources
Grid of all 19 data sources. Each card shows: source name, icon/logo, what data it provides, whether it requires a user API key.

#### API Keys Setup
Collapsible cards grouped into three tiers:

**Required:**
| Key | Provider URL | Steps |
|-----|-------------|-------|
| Anthropic | console.anthropic.com | Go to API Keys → Create key → Copy → Paste in Settings |

**Recommended:**
| Key | Provider URL | Steps |
|-----|-------------|-------|
| OpenRouter | openrouter.ai/keys | Create key → Paste in Settings. Unlocks GPT-4o, Gemini, Llama, DeepSeek, Mistral. |
| Genius | genius.com/api-clients | Create new app → Copy "Client Access Token" |
| Spotify | developer.spotify.com/dashboard | Create app → Copy Client ID + Client Secret. Enables HD artwork. |
| Mem0 | app.mem0.ai/dashboard | Copy API key. Enables cross-session memory. |

**Optional:**
| Key | Provider URL | Steps |
|-----|-------------|-------|
| Tavily | tavily.com | Sign up → Copy API key from dashboard |
| Exa | exa.ai | Sign up → Settings → Copy API key |
| Tumblr | tumblr.com/oauth/apps | Register app → Copy OAuth consumer key |
| fanart.tv | fanart.tv/get-an-api-key | Register → Copy personal API key |

Each card: title + tier badge + "Get key →" link always visible. Expand for 3-4 numbered steps. Keys already configured (detected via Convex) show a green checkmark.

#### Example Prompts
12+ prompts organized by use case. Persona filter shows relevant prompts first. Each prompt is a clickable card that copies to clipboard.

#### FAQ
Collapsible Q&A. Covers: "What models can I use?", "Is my API key stored securely?", "Can I share keys with my team?", "What data sources are free?", "How does influence mapping work?", etc.

### 6. Mobile responsiveness
- Sidebar collapses to a hamburger menu on mobile
- Main content fills full width
- Persona picker stacks cards vertically

---

## Files

### New files
| File | Purpose |
|------|---------|
| `src/app/help/page.tsx` | Unified help page route |
| `src/components/help/help-sidebar.tsx` | Sidebar nav with persona badge and section links |
| `src/components/help/persona-picker.tsx` | First-visit persona selection (6 cards, domain defaults) |
| `src/components/help/getting-started.tsx` | 3-step onboarding section |
| `src/components/help/api-keys-guide.tsx` | Collapsible API key setup walkthroughs with direct links |
| `src/components/help/commands-reference.tsx` | All slash commands with descriptions and examples |
| `src/components/help/sources-list.tsx` | 19 data sources grid |
| `src/components/help/prompt-examples.tsx` | Persona-filtered example prompts |
| `src/components/help/persona-guides.tsx` | Workflow guides per persona |
| `src/components/help/faq.tsx` | Collapsible FAQ section |

### Modified files
| File | Change |
|------|--------|
| `convex/schema.ts` | Add optional `helpPersona` string field to users table |
| `convex/users.ts` | Add `setHelpPersona` mutation |
| `src/lib/chat-utils.ts` | Add `/help` command with optional deep-link argument |
| `src/components/workspace/chat-panel.tsx` | `/help` navigates to help page |
| `src/components/sidebar/sidebar.tsx` | Add Help link |
| `src/app/docs/page.tsx` | Redirect to `/help#commands` |
| `src/app/guide/page.tsx` | Redirect to `/help` |

### No changes to
- Landing page (keeps its own "How it works" section)
- Chat API routes
- OpenUI components
- Existing Convex queries/mutations (except users)

---

## Constraints

- No new dependencies — React + Tailwind only
- No CMS or MDX — content lives in components
- Content updates require deploys (acceptable for a product this size)
- Persona preference is per-user, not per-session
- Old `/docs` and `/guide` URLs must redirect (don't break bookmarks)
- API key walkthrough steps must not include screenshots (break when providers update UI)

---

## Verification

1. `npx tsc --noEmit` — clean compile
2. `npx next build` — full build succeeds
3. Navigate to `/help` — persona picker shows on first visit
4. Select a persona — sidebar adapts, selection persists on refresh
5. `@radiomilwaukee.org` user sees Radio Host pre-highlighted
6. Click each sidebar section — smooth scrolls to correct content
7. `/docs` redirects to `/help#commands`
8. `/guide` redirects to `/help`
9. Type `/help` in chat — navigates to help page
10. Type `/help api-keys` in chat — navigates to `/help#api-keys`
11. Click "?" button in chat header — navigates to `/help`
12. Click "Help" in sidebar — navigates to `/help`
13. API key cards show green checkmarks for configured keys
14. Mobile: sidebar collapses, content fills width
