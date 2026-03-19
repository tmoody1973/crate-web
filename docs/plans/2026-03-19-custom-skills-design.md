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
  promptTemplate → string           // Full prompt injected into the agentic loop
  toolHints      → string[]         // ["browse_url", "search_web"] — discovered at creation
  sourceUrl      → optional string  // "therave.com/events" if URL-based
  visibility     → "private"        // Future: "team", "public"
  isEnabled      → boolean          // User can disable without deleting
  schedule       → optional string  // Future: "weekly:monday:9am", "daily:8am"
  lastRunAt      → optional number  // Future: timestamp of last scheduled execution
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

When a user types a slash command:

1. Check built-in commands first (`/news`, `/prep`, `/influence`, etc.)
2. If no match → query Convex for a `userSkill` matching that command + user
3. If found → inject the `promptTemplate` as the message, pass `toolHints`

### Prompt Injection

The template gets wrapped with context:

```
[Running custom skill: The Rave Events]

{promptTemplate}
```

### Arguments

Skills accept optional arguments naturally. `/rave-events this weekend` becomes:

```
{promptTemplate}

User specified: "this weekend"
```

The agent scopes its output accordingly. No argument parsing logic needed.

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
