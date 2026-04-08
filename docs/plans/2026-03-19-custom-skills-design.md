# Custom Skills System — Design Spec

> Users describe what they want, Crate builds a reusable command from existing tools.

## Overview

Crate's custom skills system lets users create personal slash commands by describing what they need in natural language. The agent discovers which tools can fulfill the request, runs a dry run to prove it works, and saves the result as a reusable command. No code, no config.

Example: A user says "create a command that pulls events from The Rave Milwaukee." The agent browses therave.com/events using Kernel's browser tool, extracts the events, shows the result, and offers to save it as `/rave-events`. Next time the user types `/rave-events`, they get fresh results in seconds.

## Architecture

### Prompt Template Approach

Each skill is a saved prompt that gets injected into the agentic loop at execution time. The agent picks tools dynamically — the skill doesn't hard-code a workflow. This means:

- Skills adapt if a site changes layout or a tool is unavailable
- The agentic loop handles retries and fallbacks naturally
- No workflow engine needed

Tool hints (discovered during the creation dry run) bias the agent toward tools that worked before, but it can deviate if needed. Hybrid reliability without brittleness.

## Data Model

New `userSkills` table in Convex:

```
userSkills
  userId         → id("users")
  command        → string           // "rave-events" (no slash, lowercase, alphanumeric + hyphens)
  name           → string           // "The Rave Events"
  description    → string           // "Pull upcoming events from The Rave Milwaukee"
  triggerPattern → optional string  // "upcoming shows, concerts, or events at The Rave, Riverside, or Milwaukee venues"
  promptTemplate → string           // Full prompt injected into the agentic loop
  toolHints      → string[]         // ["browse_url", "search_web"] — discovered at creation
  sourceUrl      → optional string  // "therave.com/events" if URL-based
  lastResults    → optional string  // JSON snapshot of last execution results (for change detection)
  gotchas        → optional string  // Accumulated failure notes — appended when execution fails
  runCount       → number           // Times executed (0 on creation)
  visibility     → "private"        // Future: "team", "public"
  isEnabled      → boolean          // User can disable without deleting
  schedule       → optional string  // Future: "weekly:monday:9am", "daily:8am"
  lastRunAt      → optional number  // Timestamp of last execution (manual or scheduled)
  createdAt      → number
  updatedAt      → number

  index: by_user ["userId"]
  index: by_user_command ["userId", "command"]
```

### Example Prompt Template

```
Browse therave.com/events using browse_url. Extract all upcoming events with:
event name, date, time, price, and ticket link. Format as a clean list sorted
by date. If browse_url fails, fall back to search_web for "The Rave Milwaukee
upcoming events".
```

## Skill Creation Flow

Creation happens conversationally in chat — no special UI.

### Step 1: Detect Intent

The agent recognizes the user wants to create a skill. Triggered by:
- Natural language: "make me a command that..." / "create a skill to..." / "save this as a command"
- Explicit command: `/create-skill`

### Step 2: Clarify

The agent asks 1-2 questions if needed:
- "What should the command be called?" (if not obvious from the request)
- "What URL or source?" (if the request involves scraping a specific site)

### Step 3: Dry Run

The agent runs the task once using the standard agentic loop. This:
- Proves it works and shows the user real results
- Discovers which tools succeeded (saved as `toolHints`)
- Generates the `promptTemplate` from what worked

### Step 4: Confirm and Save

The agent shows:
> "Here are the events I found. Want me to save this as `/rave-events`? You can run it anytime."

User confirms → Convex mutation saves the skill.

## Skill Execution

### Recognition

Two trigger paths:

**Slash command (explicit):**
1. Check built-in commands first (`/news`, `/prep`, `/influence`, etc.)
2. If no match → query Convex for a `userSkill` matching that command + user
3. If found → inject the `promptTemplate` as the message, pass `toolHints`

**Natural language (implicit):**
When a message doesn't match any slash command and isn't chat-tier, the agent sees the user's installed skills (via `list_user_skills`) in its tool list. If the user says "what's coming up at The Rave?", the agent can match it against a skill's `triggerPattern` ("upcoming shows, concerts, or events at The Rave") and run that skill's prompt template.

This works because the `triggerPattern` is included in the `list_user_skills` response, and the agent naturally matches user intent to available tools. No special routing logic needed — the agent figures it out.

### Prompt Injection

The template gets wrapped with context, memory, and gotchas:

```
[Running custom skill: The Rave Events]

{promptTemplate}

{if gotchas}
KNOWN ISSUES (from previous runs):
{gotchas}
{endif}

{if lastResults}
PREVIOUS RESULTS (from last run):
{lastResults}
Compare with current results and highlight what's NEW, CHANGED, or REMOVED.
{endif}

{if userArg}
User specified: "{userArg}"
{endif}
```

This turns every skill into a **change detector** — the agent doesn't just fetch data, it tells you what's different since last time.

### Arguments

Skills accept optional arguments naturally. `/rave-events this weekend` becomes the `userArg` above. The agent scopes its output accordingly. No argument parsing logic needed.

### Post-Execution Updates

After each skill execution, the chat route:
1. Increments `runCount` and sets `lastRunAt`
2. Saves a summary of results to `lastResults` (agent extracts key data points)
3. If the execution failed or produced poor results, appends to `gotchas`

The `save_skill_results` tool handles steps 2-3 — the agent calls it at the end of a skill execution.

### Slash Command Menu

The autocomplete menu in `ChatInput` currently shows hardcoded `SLASH_COMMANDS`. Custom skills get appended from Convex on component mount. They appear below built-in commands with a subtle "custom" label.

## Skill Management

### Settings Drawer

A new "Custom Skills" section in the Settings drawer (below "Your Plan"):
- List of skills with command name, description, and enabled/disabled toggle
- Click to expand: prompt template, tool hints, source URL
- Edit button for manual prompt tweaking
- Delete button with confirmation
- "Create Skill" button that drops a hint into chat

### `/skills` Command

Typing `/skills` in chat lists active custom skills with descriptions. Quick reference without opening Settings.

### Plan Limits

| Plan | Custom Skills | Scheduled Skills (future) |
|------|--------------|--------------------------|
| Free | 3 | 0 |
| Pro | 20 | 3 |
| Team | 50 | 10 |

Stored as `maxCustomSkills` and `maxScheduledSkills` in `PLAN_LIMITS`.

## Skill Memory & Self-Improvement

Inspired by [Anthropic's lessons from building Claude Code skills](https://www.anthropic.com/engineering/claude-code-skills).

### Memory (lastResults)

Every skill execution saves a summary of its results. On the next run, the agent sees what changed:

- `/rave-events` → "3 new shows added since last week. The Roots on April 5 is new."
- `/vinyl-drops` → "12 new jazz releases on Discogs. 3 match artists in your collection."
- `/tour-watch` → "No new Milwaukee dates for Flying Lotus. Last checked: 2 days ago."

The `lastResults` field stores a JSON summary (not the full output — just key data points the agent extracts). This is capped at 2000 characters to avoid bloating the prompt.

### Self-Improving Gotchas

When a skill execution fails or produces poor results, the agent appends a note to the `gotchas` field:

- "therave.com returned a login wall on 2026-03-15. browse_url failed, fell back to search_web."
- "Discogs rate-limited after 3 rapid calls. Space out requests."

On subsequent runs, these gotchas are injected into the prompt so the agent avoids known pitfalls. Skills get more reliable over time without manual editing.

The agent calls `save_skill_results` with `gotcha` parameter when something goes wrong. The gotchas field is append-only, capped at 1000 characters (oldest entries trimmed).

### Description as Trigger Condition

Per Anthropic: "The description field is not a summary — it's when to trigger."

The `triggerPattern` field captures this. During skill creation, the agent generates both:
- `description`: human-readable ("Pull upcoming events from The Rave Milwaukee")
- `triggerPattern`: model-readable ("when user asks about upcoming shows, concerts, events at The Rave, Riverside, Pabst, Turner Hall, or Milwaukee music venues")

### Skill Composition

Skills can reference other skills in their prompt templates:

```
Browse therave.com/events... [extract events]

After listing events, check if any performing artists have been researched
before by calling list_user_skills and running any matching artist monitoring skills.
```

No special infrastructure — the agent already handles multi-tool orchestration.

## Scheduled Triggers (Future)

Not in v1. The data model includes `schedule` and `lastRunAt` fields to avoid future migration.

When built:
- A Convex cron job runs hourly, queries skills with a `schedule` set
- If due, calls the chat API internally with the prompt template
- Results delivered to the user's most recent session or via notification
- The agentic loop handles execution identically to manual triggers

## Case Studies & Skill Categories

### Venue & Events
| Command | What It Does | Tools Used |
|---------|-------------|------------|
| `/rave-events` | Scrape The Rave Milwaukee for upcoming shows | browse_url, search_web |
| `/pabst-shows` | Pull Pabst Theater group events this month | browse_url |
| `/fest-lineup` | Get Summerfest daily lineups during festival season | browse_url, search_web |

### Artist Monitoring
| Command | What It Does | Tools Used |
|---------|-------------|------------|
| `/new-releases-hyfin` | Check new releases from HYFIN-rotation artists | search_web, search_discogs |
| `/tour-watch` | Check if a specific artist announced Milwaukee dates | search_events, search_web |

### Radio & DJ Workflow
| Command | What It Does | Tools Used |
|---------|-------------|------------|
| `/mke-music-news` | Scan Milwaukee Record + Journal Sentinel for local stories | search_web |
| `/trending-bandcamp` | Pull trending albums from Bandcamp editorial picks | search_bandcamp, browse_url |
| `/vinyl-drops` | Check Discogs marketplace for new arrivals in a genre | search_discogs |

### Publishing & Social
| Command | What It Does | Tools Used |
|---------|-------------|------------|
| `/weekly-roundup` | Compile this week's research into a Telegraph draft | view_my_page, post_to_page |
| `/playlist-export` | Format a session's tracks as a shareable playlist | search_itunes_songs |

### Data & Research
| Command | What It Does | Tools Used |
|---------|-------------|------------|
| `/sample-alert` | Check WhoSampled for new sample credits on a tracked artist | search_whosampled |
| `/label-roster` | Pull all artists on a specific label from Discogs | search_discogs, get_release_full |

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `convex/userSkills.ts` | Convex queries/mutations for skill CRUD |
| `src/components/settings/skills-section.tsx` | Skills list in Settings drawer |

### Modified Files
| File | Change |
|------|--------|
| `convex/schema.ts` | Add `userSkills` table |
| `src/lib/plans.ts` | Add `maxCustomSkills`, `maxScheduledSkills` to `PlanLimits` |
| `src/app/api/chat/route.ts` | Resolve custom skills before agentic loop |
| `src/lib/chat-utils.ts` | Add `/skills` and `/create-skill` to slash commands |
| `src/components/workspace/chat-panel.tsx` | Append custom skills to autocomplete menu |
| `src/components/settings/settings-drawer.tsx` | Add SkillsSection |
