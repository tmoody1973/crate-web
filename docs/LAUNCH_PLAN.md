# Crate Launch & Outreach Plan

**Purpose:** Product Hunt launch strategy, community building, outreach plan to get Crate in front of the right people
**Companion docs:** [PRODUCT_ANALYSIS.md](./PRODUCT_ANALYSIS.md) | [DEMO_SCRIPT.md](./DEMO_SCRIPT.md)
**Target launch window:** Q2 2026

---

## Part 1: Product Hunt Launch

### Why Product Hunt

Product Hunt is the right launchpad for Crate because:
- AI agents and music tools are both high-engagement categories on PH
- The dev/prosumer audience overlaps with Crate's early adopter profile
- A strong PH launch creates a permanent landing page with social proof
- Press and investors monitor PH for interesting products

### Pre-Launch Timeline (6 Weeks Before)

#### Weeks 6-4: Community Groundwork

- [ ] **Create a Product Hunt maker account** (if not already active)
- [ ] **Start engaging on Product Hunt daily** — upvote products you genuinely use, leave thoughtful comments on AI tools and music products. 5-10 minutes/day. The community notices who's been around.
- [ ] **Create the "Coming Soon" page** — Product Hunt allows pre-launch pages where people can follow and get notified. Set this up early.
- [ ] **Write your maker story** — PH rewards authenticity. Your story is compelling: radio broadcaster → built CLI in terminal → ported to web → deployed at Radio Milwaukee. Write a draft of your maker comment (see template below).
- [ ] **Identify 3-5 Product Hunt "hunters"** — active community members with large followings who might hunt your product. Reach out personally, offer early access.

#### Weeks 3-2: Assets & Outreach

- [ ] **Record the 90-second demo video** (see [DEMO_SCRIPT.md](./DEMO_SCRIPT.md), Video 2)
- [ ] **Create 5-6 gallery images** (1270x760px, Product Hunt standard):
  1. Hero shot — Crate chat with influence map results visible
  2. Show prep in action — `/show-prep` results rendering
  3. Data sources grid — "20+ databases, zero config"
  4. Influence mapping — the chain visualization with source citations
  5. Live radio + research — split view showing radio player active during research
  6. Publishing — `/publish` result with Telegraph article URL
- [ ] **Write the tagline** (60 characters max): `AI music research agent — 20+ databases, every answer cited`
- [ ] **Write the description** (260 characters max): `Ask any music question. Crate queries Discogs, Spotify, Pitchfork, Genius & 16 more databases at once. Get cited answers as interactive cards. Built for DJs, radio hosts, and anyone who takes music seriously.`
- [ ] **Notify your existing network** — email Radio Milwaukee team, personal contacts, music industry connections. Ask them to follow the Coming Soon page and be ready to comment on launch day.
- [ ] **Prep your social posts** — pre-write launch day posts for X, LinkedIn, and any music communities you're in.

#### Week 1: Final Prep

- [ ] **Confirm launch date** — Tuesday, Wednesday, or Thursday (highest traffic). Avoid holidays and major tech announcements.
- [ ] **Set launch time** — 12:01 AM PT (Product Hunt resets at midnight Pacific). You want the full 24 hours.
- [ ] **Brief your supporters** — send a personal message to 20-30 people who you know will show up. Ask them to leave genuine comments (not just upvotes). Comments weigh more than upvotes in the algorithm.
- [ ] **Test the product** — make sure sign-up flow, onboarding wizard, and first query all work flawlessly. First impressions are everything.
- [ ] **Assign launch day roles:**
  - You: respond to every PH comment within 30 minutes
  - Backup: someone monitoring for bugs/issues

### Launch Day

#### Hour 0-1 (Midnight - 1 AM PT)
- [ ] Publish the product on Product Hunt
- [ ] Post your maker comment immediately (see template below)
- [ ] Share on X with the PH link
- [ ] Share on LinkedIn
- [ ] Send the "we're live" email/DM to your 20-30 supporters

#### Hours 1-6 (Early Morning)
- [ ] Respond to every comment — genuine, detailed responses
- [ ] Share real-time engagement on X ("We just hit #3 on Product Hunt — here's what Crate does...")
- [ ] Post in relevant communities (see Part 2)

#### Hours 6-18 (Daytime)
- [ ] Continue responding to every comment
- [ ] Share interesting comments/feedback on social
- [ ] If press interest comes in, respond immediately
- [ ] Post the demo video as a standalone X thread

#### Hours 18-24 (Evening)
- [ ] Thank supporters
- [ ] Screenshot the final ranking
- [ ] Draft a "what we learned from our PH launch" post for the next day

### Maker Comment Template

```
Hey Product Hunt! I'm Tarik — I host and program music for Radio Milwaukee.

I built Crate because I got tired of spending 3 hours prepping for a
90-minute show. I'd have 15 tabs open — Discogs, Wikipedia, Pitchfork,
AllMusic, YouTube — copy-pasting into a Google Doc.

Crate started as a terminal tool (crate-cli) that connected to 19 MCP
servers — each one a specialist for a different music database. The agent
orchestrates them: decides which sources to query, in what order, and
how to combine the results.

Then I ported the whole thing to the web. Same agent, same depth, real UI.

What makes it different from "just asking ChatGPT about music":
→ It actually queries the databases (Discogs, MusicBrainz, Last.fm, etc.)
→ Every claim has a source you can click and verify
→ Results render as interactive cards, not walls of text
→ /show-prep generates a complete radio prep package in 90 seconds
→ /influence traces artist connections across 26 music publications

Radio Milwaukee is already using it for daily show prep.

Try it free — you just need an Anthropic or OpenRouter API key to power
the agent. All 20+ data sources are built in.

I'm here all day — ask me anything about the architecture, the music
research methodology, or how it works for radio.
```

### Post-Launch (Week After)

- [ ] **Write a launch retrospective** — post on X/LinkedIn: what worked, what you learned, metrics
- [ ] **Follow up with everyone who signed up** — personal email or DM to the first 50 users
- [ ] **Collect and share testimonials** — if anyone posts about Crate, amplify it
- [ ] **Submit to "Best of" collections** — Product Hunt has weekly/monthly roundups. Engage with the PH team.

---

## Part 2: Community & Outreach Strategy

### Tier 1: Music Professional Communities (Highest Value)

These are the people who need Crate the most and will become your most vocal advocates.

| Community | Platform | How to Engage | Timing |
|---|---|---|---|
| **DJ TechTools** | Forum + newsletter | Write a guest post: "How I use AI to prep DJ sets" | Pre-launch |
| **Digital DJ Tips** | Blog + YouTube + forum | Pitch a review/demo to Phil Morse | Launch week |
| **r/DJs** | Reddit (500K+ members) | Post a genuine "I built this" story, not an ad | Launch day |
| **r/vinyl** | Reddit (900K+ members) | Share a deep album research example | Post-launch |
| **r/LetsTalkMusic** | Reddit (330K+) | Share an influence mapping result as a discussion starter | Post-launch |
| **Radio Survivors** | Blog + podcast | Pitch the Radio Milwaukee story | Pre-launch |
| **Current (public media)** | Newsletter + site | Pitch the story: "How Radio Milwaukee is using AI for show prep" | Launch week |
| **All Access Music Group** | Industry newsletter | Pitch to radio trade press | Launch week |
| **DJ Mag** | Magazine + online | Pitch a feature: "The AI tool that researches music like a crate digger" | Post-launch |
| **Resident Advisor** | Magazine + online | Pitch the influence mapping angle for electronic music | Post-launch |
| **Bandcamp Daily** | Blog | Pitch: "An AI tool that actually sends people to Bandcamp" | Post-launch |

### Tier 2: Tech & AI Communities (Developer Attention)

These audiences drive Product Hunt votes, Hacker News visibility, and tech press interest.

| Community | Platform | How to Engage | Content Angle |
|---|---|---|---|
| **Hacker News** | Show HN | "Show HN: I built a music research agent with 19 MCP servers" | Architecture + demo |
| **r/ClaudeAI** | Reddit | Share as a real-world agentic application | Technical architecture |
| **r/LocalLLaMA** | Reddit | Multi-model support angle (Claude, GPT-4o, Gemini, Llama) | Model flexibility |
| **X (AI Twitter)** | Twitter/X | Thread: "I built a music research agent. Here's how it works." | Demo video + architecture |
| **Dev.to** | Blog | Technical post: "Building an agentic app with MCP servers and OpenUI" | Developer tutorial |
| **Anthropic Discord** | Discord | Share as MCP server showcase | MCP architecture |
| **Claude Code community** | Various | Share as a Superpowers-built product | Build process story |

### Tier 3: Music Industry Press (Broader Awareness)

| Publication | Angle | Contact Strategy |
|---|---|---|
| **Billboard** | "Music intelligence is the next battleground — Spotify's WhoSampled acquisition proves it" | Email music tech reporter |
| **Music Business Worldwide** | Business angle: radio automation market + AI disruption | Email editor |
| **Pitchfork** | Meta angle: "An AI tool that reads Pitchfork reviews to map influence" | Social DM |
| **NPR Digital** | Public radio innovation story — Radio Milwaukee using AI | Email through NPR contacts |
| **Milwaukee Journal Sentinel** | Local angle: Milwaukee company building the future of music research | Email tech/culture reporter |

### Tier 4: Podcast Appearances

| Podcast | Audience | Pitch Angle |
|---|---|---|
| **Song Exploder** | Music enthusiasts | How AI traces the stories behind songs |
| **Broken Record** (Rick Rubin) | Music industry | The future of music research and discovery |
| **Heat Check** (Radio Milwaukee) | Your own station | Behind the scenes of Crate |
| **Latent Space** | AI engineers | Building real agentic apps with MCP |
| **Indie Hackers** | Builders/founders | From radio host to AI product builder |
| **Lenny's Podcast** | Product managers | Music intelligence as a product category |
| **My First Million** | Entrepreneurs | The $3B music research market nobody talks about |
| **All Songs Considered** (NPR) | Music fans | AI-powered music discovery beyond algorithms |

---

## Part 3: Content Calendar

### Pre-Launch Content (Weeks 6-1)

| Week | Content | Platform | Purpose |
|---|---|---|---|
| 6 | "Why I'm building a music research agent" — the origin story | X thread + LinkedIn | Establish narrative |
| 5 | Demo clip: influence mapping Flying Lotus (35 sec) | X + Instagram Reels | Visual hook |
| 4 | "How Radio Milwaukee uses AI for show prep" — case study post | LinkedIn + radio communities | Social proof |
| 3 | Technical post: "19 MCP servers, one agentic loop" | Dev.to + Hacker News | Developer credibility |
| 2 | Demo clip: show prep in 90 seconds (40 sec) | X + DJ communities | Workflow demonstration |
| 1 | "Launching next week — here's what I built" teaser | X + LinkedIn + PH coming soon | Build anticipation |

### Launch Week Content

| Day | Content | Platform |
|---|---|---|
| Launch Day | Product Hunt live + "We're live" posts | PH + X + LinkedIn |
| Day 2 | Behind-the-scenes thread: "What happened in the first 24 hours" | X |
| Day 3 | Full workflow demo video (2:30) | YouTube + X + LinkedIn |
| Day 4 | Radio Milwaukee story video (2:00) | YouTube + radio communities |
| Day 5 | "What we learned from launching on Product Hunt" | LinkedIn + Indie Hackers |

### Post-Launch Content (Ongoing)

| Frequency | Content Type | Platform |
|---|---|---|
| 2x/week | Interesting research results (influence maps, deep dives) | X + LinkedIn |
| 1x/week | "How to use Crate for [specific workflow]" tutorial | X thread or blog post |
| 2x/month | Case studies from real users | LinkedIn + blog |
| 1x/month | Product update: new features, new data sources | X + PH update |
| As they happen | Interesting discoveries made with Crate | X (viral potential) |

---

## Part 4: Direct Outreach Targets

### Radio Stations to Contact (After Radio Milwaukee Success)

| Station | Market | Why They'd Care |
|---|---|---|
| **KEXP** | Seattle | Known for music curation + discovery — natural fit |
| **WXPN** | Philadelphia | Strong music research culture, NPR member |
| **WFMU** | New Jersey | Freeform radio, deep crate-digging culture |
| **KUTX** | Austin | Music city, SXSW connection |
| **KCRW** | Los Angeles | Influential music programming, Morning Becomes Eclectic |
| **The Current (MPR)** | Minneapolis | Music-forward public radio, similar to Radio Milwaukee |
| **WNYC / New Sounds** | New York | Experimental music programming, deep research needs |
| **BBC Radio 6 Music** | UK | Largest alternative music station globally |

**Outreach template:**
> Subject: How Radio Milwaukee cut show prep from 3 hours to 90 seconds
>
> Hi [Name],
>
> I'm Tarik Moody — I host and program music at Radio Milwaukee. We've been using
> a tool I built called Crate that searches 20+ music databases at once and generates
> show prep packages from a single command.
>
> Our hosts type `/show-prep [show name] [tracks]` and get talk breaks, social copy,
> and interview research in about 90 seconds. Everything is cited — Discogs, Pitchfork,
> MusicBrainz, Wikipedia, etc.
>
> Would love to show you a quick demo. It's free to try.
>
> [Demo video link]

### DJ Tool Companies to Contact (Partnership)

| Company | Product | Partnership Angle |
|---|---|---|
| **AlphaTheta (Pioneer DJ)** | Rekordbox | Integrate Crate research into track preparation workflow |
| **Serato** | Serato DJ | Track research + metadata enrichment |
| **Native Instruments** | Traktor | Research companion for track selection |
| **Algoriddim** | djay Pro | AI research layer for Apple ecosystem DJs |

### Streaming Platforms to Contact (Strategic)

Don't pitch cold. Build visibility first (PH launch, press, community), then approach through warm introductions. Target:

| Company | Team | Why |
|---|---|---|
| **Spotify** | Music Intelligence / SongDNA team | Crate extends what SongDNA does — professional workflows, multi-source research |
| **Qobuz** | Product / Partnerships | Natural editorial + AI fit, growing audiophile market |
| **Apple Music** | Editorial / Machine Learning | Crate could power enhanced artist pages and editorial tools |

---

## Part 5: Metrics to Track

### Launch Metrics

| Metric | Target | Why It Matters |
|---|---|---|
| Product Hunt ranking | Top 5 of the day | Social proof, press attention |
| PH upvotes | 500+ | Community validation |
| Sign-ups (launch week) | 500+ | User acquisition |
| First queries completed | 200+ | Activation rate |
| Demo video views | 5,000+ | Content reach |
| Press mentions | 3+ | Earned media |

### Growth Metrics (Ongoing)

| Metric | Target (Month 3) | Target (Month 6) |
|---|---|---|
| Registered users | 2,000 | 10,000 |
| Monthly active users | 500 | 3,000 |
| Paid conversions | 50 | 400 |
| Team/Station accounts | 3 | 10 |
| Influence graph nodes | 10,000 | 100,000 |
| Published articles | 200 | 2,000 |

### Qualitative Signals

- [ ] Someone tweets "I can't go back to researching music without Crate"
- [ ] A DJ Mag, Resident Advisor, or Pitchfork writer uses it publicly
- [ ] A radio station signs up without being contacted
- [ ] A Spotify/Apple employee follows the product
- [ ] Inbound partnership inquiry from a platform or label

---

## Part 6: Budget (Bootstrap-Friendly)

| Item | Cost | Notes |
|---|---|---|
| Product Hunt launch | $0 | Free to launch |
| Demo video production | $0 | Screen recording + voiceover (OBS, Audacity) |
| Gallery images | $0 | Screenshots + Figma/Canva |
| Domain + hosting | Already covered | Vercel + Convex free tiers |
| AI API costs for demo prep | ~$5-10 | A few research sessions for demo content |
| Press outreach | $0 | Direct email, no PR agency needed |
| Community engagement | $0 | Your time (30 min/day) |
| **Total** | **~$10** | Sweat equity, not dollars |

---

*The best launch strategy is a product worth talking about. Everything in this plan amplifies the product — it doesn't substitute for it.*
