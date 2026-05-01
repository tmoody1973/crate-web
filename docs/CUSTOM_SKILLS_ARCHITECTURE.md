# Custom Skills Architecture Diagram

Use this to generate a visual diagram in Nano Banana or any diagramming tool.

---

## Diagram 1: How a Skill Gets Created

```
User types in chat:
"Create a command that pulls upcoming shows from The Rave Milwaukee"

         │
         ▼

┌─────────────────────────────┐
│     1. UNDERSTAND           │
│                             │
│  Crate's AI agent reads     │
│  the request and figures    │
│  out what tools to use      │
│                             │
│  Available tools:           │
│  • Web scraper (Kernel)     │
│  • Ticketmaster API         │
│  • Discogs / Bandcamp       │
│  • Web search (Exa/Tavily)  │
│  • 16+ more data sources    │
└──────────┬──────────────────┘
           │
           ▼

┌─────────────────────────────┐
│     2. DRY RUN              │
│                             │
│  Agent actually runs the    │
│  task using real tools:     │
│                             │
│  browse_url("therave.com")  │
│       → scrapes events      │
│       → formats results     │
│       → shows to user       │
│                             │
│  "Here's what I found.      │
│   Want to save this as      │
│   /rave-events?"            │
└──────────┬──────────────────┘
           │
           ▼

┌─────────────────────────────┐
│     3. SAVE                 │
│                             │
│  User confirms → saved to   │
│  database (Convex):         │
│                             │
│  command: "rave-events"     │
│  prompt: "Browse therave    │
│    .com/events, extract     │
│    name, date, price..."    │
│  toolHints: [browse_url]    │
│  triggerPattern: "upcoming  │
│    shows at The Rave"       │
│  runCount: 0                │
└─────────────────────────────┘
```

---

## Diagram 2: How a Skill Runs (with Memory)

```
User types: /rave-events

         │
         ▼

┌─────────────────────────────┐
│     RESOLVE                 │
│                             │
│  Chat route checks:         │
│  1. Built-in command?  No   │
│  2. Custom skill?     Yes!  │
│     → loads prompt template │
└──────────┬──────────────────┘
           │
           ▼

┌─────────────────────────────────────────────┐
│     INJECT CONTEXT                          │
│                                             │
│  The prompt gets wrapped with memory:       │
│                                             │
│  ┌─ PROMPT TEMPLATE ──────────────────┐     │
│  │ "Browse therave.com/events..."     │     │
│  └────────────────────────────────────┘     │
│                                             │
│  ┌─ PREVIOUS RESULTS ────────────────┐     │
│  │ Last run (March 14):              │     │
│  │ • Pixies - March 22              │     │
│  │ • Thundercat - April 1            │     │
│  │                                    │     │
│  │ "Compare and highlight what's     │     │
│  │  NEW, CHANGED, or REMOVED"        │     │
│  └────────────────────────────────────┘     │
│                                             │
│  ┌─ KNOWN ISSUES (GOTCHAS) ──────────┐     │
│  │ "therave.com sometimes returns    │     │
│  │  a login wall. If so, fall back   │     │
│  │  to search_web."                  │     │
│  └────────────────────────────────────┘     │
└──────────────┬──────────────────────────────┘
               │
               ▼

┌─────────────────────────────┐
│     EXECUTE                 │
│                             │
│  Agent runs the task with   │
│  full context:              │
│                             │
│  → Browses therave.com      │
│  → Gets current events      │
│  → Compares to last results │
│  → Outputs:                 │
│                             │
│  "3 new shows since last    │
│   check. The Roots on       │
│   April 5 is new."          │
└──────────┬──────────────────┘
           │
           ▼

┌─────────────────────────────┐
│     SAVE RESULTS            │
│                             │
│  Agent calls                │
│  save_skill_results:        │
│                             │
│  • lastResults → updated    │
│  • runCount → incremented   │
│  • gotcha → added if        │
│    something went wrong     │
│                             │
│  Next run will see these    │
│  results as "previous"      │
└─────────────────────────────┘
```

---

## Diagram 3: What's Stored in the Database

```
┌─────────────────────────────────────────────────────┐
│                    userSkills                        │
│                   (Convex DB)                        │
├─────────────────────────────────────────────────────┤
│                                                     │
│  userId ──────────── who owns this skill            │
│  command ─────────── "rave-events"                  │
│  name ────────────── "The Rave Events"              │
│  description ─────── "Pull upcoming shows"          │
│  triggerPattern ──── "upcoming shows at The Rave,   │
│                       Milwaukee music venues"       │
│                                                     │
│  promptTemplate ──── The full instructions the      │
│                      AI agent follows each run       │
│                                                     │
│  toolHints ───────── ["browse_url", "search_web"]   │
│                      (tools that worked before)     │
│                                                     │
│  lastResults ─────── JSON snapshot of previous      │
│                      run (for change detection)     │
│                                                     │
│  gotchas ─────────── Accumulated failure notes       │
│                      (self-improving over time)     │
│                                                     │
│  runCount ────────── 12 (times executed)             │
│  lastRunAt ───────── March 21, 2026                  │
│  isEnabled ───────── true                            │
│                                                     │
│  sourceUrl ───────── "therave.com/events"            │
│  visibility ──────── "private"                       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## Diagram 4: The Full System (How Everything Connects)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│              │     │              │     │              │
│   CHAT UI    │────▶│  CHAT ROUTE  │────▶│  AGENTIC     │
│              │     │  (Next.js)   │     │  LOOP        │
│  User types  │     │              │     │  (Claude)    │
│  /rave-events│     │  Resolves    │     │              │
│              │     │  custom      │     │  Runs tools, │
│  or asks     │     │  skills,     │     │  generates   │
│  "what's at  │     │  injects     │     │  output      │
│  The Rave?"  │     │  memory +    │     │              │
│              │     │  gotchas     │     │              │
└──────────────┘     └──────┬───────┘     └──────┬───────┘
                            │                     │
                            │                     │ uses
                            │                     ▼
                     ┌──────┴───────┐     ┌──────────────┐
                     │              │     │              │
                     │   CONVEX     │     │  20+ TOOLS   │
                     │   DATABASE   │     │              │
                     │              │     │  • Discogs   │
                     │  userSkills  │     │  • Bandcamp  │
                     │  (prompt,    │     │  • Kernel    │
                     │   memory,    │     │    browser   │
                     │   gotchas,   │     │  • Ticketm.  │
                     │   results)   │     │  • Last.fm   │
                     │              │     │  • Genius    │
                     │  influence   │     │  • Spotify   │
                     │  cache       │     │  • Perplexity│
                     │              │     │  • Exa/Tavily│
                     │  sessions    │     │  • YouTube   │
                     │  messages    │     │  • + more    │
                     │              │     │              │
                     └──────────────┘     └──────────────┘


         ┌─────────────────────────────────────────┐
         │           SKILL LIFECYCLE               │
         │                                         │
         │  CREATE ──▶ RUN ──▶ REMEMBER ──▶ LEARN  │
         │                                         │
         │  User       Agent    Saves      Records │
         │  describes  executes results    gotchas  │
         │  intent     task     for next   when     │
         │                     comparison  things   │
         │                                 break    │
         │                                         │
         │  Each run makes the skill smarter       │
         └─────────────────────────────────────────┘
```

---

## Diagram 5: Plan Limits

```
┌────────────────────────────────────────────┐
│              PLAN LIMITS                   │
├────────────┬───────────┬───────────────────┤
│            │  Custom   │  Scheduled Skills │
│   Plan     │  Skills   │  (future)         │
├────────────┼───────────┼───────────────────┤
│  Free      │    3      │       0           │
│  Pro $15   │   20      │       3           │
│  Team $25  │   50      │      10           │
└────────────┴───────────┴───────────────────┘
```

---

## Diagram 6: Skill Memory (Change Detection)

```
RUN 1 (March 14)                    RUN 2 (March 21)
─────────────────                   ─────────────────

Results:                            Results:
• Pixies - March 22                 • Pixies - March 22
• Thundercat - April 1              • Thundercat - April 1
• Beach House - April 10            • Beach House - April 10
                                    • The Roots - April 5    ← NEW
                                    • Khruangbin - April 18  ← NEW

     │                                   │
     │  saved to lastResults             │  compared against lastResults
     ▼                                   ▼

Output: "Here are 3                 Output: "2 new shows since
upcoming shows at                   last check. The Roots on
The Rave."                          April 5 and Khruangbin on
                                    April 18 are new."
```

---

## Diagram 7: Self-Improving Gotchas

```
RUN 3 (March 28)
─────────────────

Agent tries browse_url("therave.com/events")
     │
     ▼
ERROR: Site returned login wall (403)
     │
     ▼
Agent falls back to search_web("The Rave Milwaukee events")
     │
     ▼
SUCCESS: Got events from web search
     │
     ▼
Gotcha recorded:
"therave.com returned login wall on 2026-03-28.
 browse_url failed, fell back to search_web."


RUN 4 (April 4)
─────────────────

Agent sees gotcha in prompt:
"KNOWN ISSUES: therave.com returned login wall..."
     │
     ▼
Agent skips browse_url, goes straight to search_web
     │
     ▼
SUCCESS: Faster, no error

     Skill got smarter without anyone editing it.
```
