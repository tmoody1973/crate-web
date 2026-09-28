# I built a music research platform that does what Spotify won't

## From a terminal experiment to a full browser app — here's the story of Crate

I spend a lot of time thinking about music. Not just listening — researching. Who produced that track? Where did that sample come from? How does a DJ in Milwaukee connect Ethiopian jazz to UK broken beat in a 90-minute set? These are real questions I deal with as a radio broadcaster, and none of the existing tools answer them well.

Spotify tells you what to listen to. It doesn't tell you why it matters.

So I built Crate.

---

## What Crate actually is

Crate is a music research workspace powered by an AI agent that can query 20+ music databases simultaneously. You ask it a question — about an artist, a genre, a production technique, a radio show — and it goes and finds the answer. Not from one source. From Discogs, MusicBrainz, Last.fm, Genius, Spotify, Wikipedia, Pitchfork, Bandcamp, and about a dozen more. It cross-references what it finds, cites its sources, and gives you the results as interactive cards you can save, share, and publish.

It also plays music. YouTube playback built right into the app. 30,000+ live radio stations you can stream while you research. A persistent player bar at the bottom, like Spotify, that follows you around while you work.

But the real thing that makes it different: it understands context. Ask it about Flying Lotus and it won't just give you a discography. It'll trace the influence chain from Alice Coltrane through his aunt to Brainfeeder Records, pull the Pitchfork review that first made the connection, and show you the whole network as an interactive visualization. Every claim backed by a source you can click.

---

## The CLI origin story

Crate didn't start in the browser. It started in the terminal.

I built Crate CLI first — a command-line tool using the Claude Agent SDK (now called the Anthropic SDK) that connected to 19 MCP servers. MCP stands for Model Context Protocol. Think of each server as a specialist. One knows Discogs. One knows Genius. One knows Last.fm. The agent orchestrates them — decides which sources to query, in what order, and how to combine the results.

The CLI worked well for me personally. I'd type a question, the agent would fire off tool calls to multiple databases, and I'd get back deep research in under a minute. But nobody else was going to install a command-line tool and configure API keys in a terminal. The music people I wanted to reach — DJs, producers, radio programmers — they need a browser.

So I ported the whole thing to the web. Same agent, same 19 research servers, same depth. Just wrapped in a Next.js app with a real UI.

---

## How the agent works

When you send a message in Crate, here's what actually happens:

1. Your message hits a Next.js API route on Vercel
2. The route creates a CrateAgent instance — the same agent class from the CLI, imported as an npm package
3. The agent reads your message and decides which tools to use. It has access to 19 MCP servers, each with multiple tools. Discogs alone has search, release lookup, artist lookup, and credits tools.
4. The agent starts making tool calls. For a question like "map the influences of Madlib," it might call Last.fm for similar artists, search 26 music publications for review co-mentions, check MusicBrainz for collaboration credits, and pull images from Spotify — all in one research session.
5. Each tool call streams back to the browser as a Server-Sent Event. You see the tools firing in real time — "Searching Discogs... Checking Genius... Querying Last.fm..."
6. When the agent has enough information, it generates the response using OpenUI Lang — a structured format that renders as interactive cards instead of plain text. An influence map becomes a clickable visualization. A playlist becomes a list with play buttons. Show prep becomes a package with talk breaks and social copy.
7. Everything saves to Convex (real-time cloud database) so you can come back to it later.

The agent isn't just a chatbot wrapper. It has a personality — part obsessive record store clerk, part Gilles Peterson. It follows influence chains, prioritizes deep cuts over obvious picks, and treats genre as a filing system rather than a fence.

For the AI model, you bring your own key — either Anthropic (for Claude directly) or OpenRouter (for access to Claude, GPT-4, Gemini, and others through one API). You pick your model in settings. The data source keys (Discogs, Last.fm, Spotify, etc.) are embedded — those just work.

---

## How we built it — the Superpowers workflow

Here's something I want to be transparent about: I built most of Crate Web using AI-assisted development. Specifically, I used Claude Code with a plugin called Superpowers that structures how you go from idea to shipped code.

The workflow looks like this:

**Brainstorming phase.** I'd describe what I wanted — "I need radio streaming in the browser with live metadata" — and the brainstorming skill would ask me questions one at a time. What stations? What metadata format? How should it handle switching between radio and YouTube? We'd go back and forth until the design was clear, then it would write a spec document.

**Planning phase.** The spec gets turned into a detailed implementation plan. Every file that needs to be created or modified, every function signature, every test case. The plan is granular — each step takes 2-5 minutes. Write the failing test, run it, write the implementation, run the test again, commit.

**Execution phase.** This is where it gets interesting. Superpowers uses subagent-driven development — it dispatches a fresh AI agent for each task in the plan. Each subagent gets exactly the context it needs (not the whole conversation history) and works in isolation. After each task, two review agents check the work: one for spec compliance (did you build what was asked?) and one for code quality (is it well-written?).

**The review loop.** If a reviewer finds issues, the implementer agent fixes them and gets reviewed again. This cycle repeats until both reviewers approve. Then the next task starts. It's like having a junior developer with two senior reviewers, except nobody gets tired and the reviews are consistent.

For example, the radio feature went through this pipeline:
- Brainstorm: figured out we needed to replace the CLI's mpv player with HTML5 Audio, add ICY metadata parsing, and wire play_radio events through the streaming pipeline
- Plan: 10 files, 5 tasks, each with tests
- Execute: subagents wrote the code, reviewers caught an SSRF vulnerability (the metadata proxy was fetching user-supplied URLs without checking for private IPs), caught a re-rendering bug in the metadata polling, and flagged an accessibility issue on the seek bar

CodeRabbit (automated GitHub reviewer) then does a final pass on the PR. Between Superpowers and CodeRabbit, most bugs get caught before I even look at the diff.

I still make every design decision. I still review every PR. But the mechanical work — writing boilerplate, catching edge cases, maintaining consistency across files — that's handled by the agents.

---

## The tech stack (plain English)

**Frontend:** Next.js 16 with React 19. This is a modern web framework that handles both the UI and the server-side API routes. Tailwind CSS for styling — utility classes instead of writing CSS files. OpenUI for rendering the agent's structured output as interactive components.

**Backend:** Convex for the database. It's a real-time cloud database where data syncs instantly between server and browser. No SQL, no migrations, no ORM. You define your schema in TypeScript and write queries as functions. Authentication through Clerk — handles sign-in, OAuth, user management.

**AI layer:** The Anthropic SDK talks directly to Claude. OpenAI SDK routes through OpenRouter for multi-model support. The CrateAgent class from crate-cli orchestrates 19 MCP tool servers. Zod validates all the data schemas.

**Deployment:** Vercel hosts the app. Push to main, it deploys automatically. Convex runs the database in the cloud. No servers to manage.

**The agent's brain:** Claude (Anthropic's model) with a custom system prompt that gives it the record-store-clerk-meets-Gilles-Peterson personality. The prompt includes rules for how to research, how to cite sources, how to generate interactive components, and how to handle influence mapping using a methodology based on an actual academic paper (Badillo-Goicoechea 2025 — network-based music recommendation through review co-mentions).

---

## Influence mapping — the thing nobody else does

This is probably the feature I'm most proud of, and it's grounded in actual academic research.

Most music recommendation works on behavior data. Spotify looks at what you've listened to and finds people with similar listening patterns. That's fine for "more of the same." But it can't answer "why does this artist sound like that?" or "how did Detroit techno end up influencing Berlin minimal?" Those are questions about influence — who came before whom, who cited whom, who sampled whom.

In Fall 2025, Elena Badillo-Goicoechea published a paper in the Harvard Data Science Review called "Modeling Artist Influence for Music Selection and Recommendation: A Purely Network-Based Approach." The core idea: you can build a knowledge graph of artistic influence by analyzing music criticism. When a reviewer mentions two artists in the same review, that's a signal. If Pitchfork reviews a Thundercat album and mentions J Dilla three times, that co-mention carries weight. Do that across 26 publications — Pitchfork, NME, Rolling Stone, Stereogum, The Wire, Tiny Mix Tapes, and more — and you get a network of influence that's based on expert critical analysis, not algorithmic guessing.

That's what Crate's influence mapping does. When you type `/influence Flying Lotus`, the agent:

1. Checks the Convex-backed graph cache first — if we've already mapped this artist, you get instant results
2. If the cache is thin, it runs discovery: searching across 26 publications for review co-mentions, pulling similar artists from Last.fm, checking MusicBrainz for collaboration credits, and running web searches for documented influence
3. Each connection gets a weight (0 to 1) based on how many independent sources confirm it and how strong the signal is. A single blog mention scores lower than repeated co-mentions across multiple publications.
4. Every connection includes context ("Reviewed in Pitchfork alongside X, producer credits on Y's 2019 album") and clickable source links so you can verify the claim yourself
5. Results save to the graph cache. Next time anyone asks about the same artist, the network is already there — and it grows over time as more queries add more edges

The paper calls this approach "emulating exhaustively reading through linked sequences of reviews, discovering new artists mentioned in each piece." That's exactly what the agent does, except it reads hundreds of reviews in seconds instead of weeks.

The result is an interactive visualization — the InfluenceChain component — that shows you a vertical timeline of connections sorted by weight, with artist images, relationship types (influenced, collaborated, sampled, co-mentioned), and evidence cards. You can trace paths between artists: "How are J Dilla and Thundercat connected?" and get back a chain showing the intermediary nodes and the evidence for each hop.

This is different from "similar artists" or "fans also like." It's a cited, verifiable map of artistic lineage. The kind of thing a music journalist would spend weeks building by reading archives. Crate builds it in under a minute.

Reference: Badillo-Goicoechea, E. (2025). "Modeling Artist Influence for Music Selection and Recommendation: A Purely Network-Based Approach." *Harvard Data Science Review*, 7(4). [hdsr.mitpress.mit.edu/pub/t4txmd81](https://hdsr.mitpress.mit.edu/pub/t4txmd81/release/2)

---

## What you can do with it

### If you're a radio DJ

Type `/show-prep HYFIN` and paste your setlist. Crate researches every track — who produced it, where it was recorded, what it samples, why it matters right now — and generates a complete show prep package. Talk breaks in three lengths (10-second quick hit, 30-second standard, 2-minute deep dive). Social copy for Instagram, X, and Bluesky. Local Milwaukee events from Ticketmaster. Interview prep if you have a guest.

Before Crate, this took me 2-3 hours of Googling, cross-referencing, and writing. Now it takes about 90 seconds.

### If you're a music producer or crate digger

Type `/influence Madlib` and watch the agent trace connections across decades. It checks 26 music publications for co-mentions (when two artists appear in the same review, that's an influence signal), pulls similar artists from Last.fm, verifies collaboration credits on MusicBrainz, and builds a weighted network graph. Each connection has a strength score, context explaining why the link exists, and source citations you can verify.

Or just ask it: "What Ethiopian jazz records from the 1970s influenced UK broken beat producers in the 2000s?" It'll go find out.

### If you're a music journalist or researcher

Ask questions you'd normally spend a day on. "How many times has Pitchfork mentioned J Dilla in reviews of other artists?" The agent searches across publications, extracts mentions, and gives you a cited answer. Then publish your findings to Telegraph with `/publish telegraph` — one command, instant web article with a shareable URL.

### If you're a casual listener who wants to go deeper

This is the "Spotify for the curious" use case. You heard a song you liked. Instead of just hitting "Radio" and getting algorithm suggestions, ask Crate why that song exists. Who made it, what tradition it comes from, what else you should hear if you liked it, and why. Every recommendation comes with context, not just a playlist.

### If you're running a radio station

`/news hyfin 5` generates a daily music news segment with 5 stories, researched from RSS feeds and web sources, formatted for your specific station's voice. HYFIN gets culturally sharp hip-hop angles. 88Nine gets community-forward discovery stories. Rhythm Lab gets global-beats crate-digging finds. Same tool, different voice.

---

## The 20+ sources

This is what makes Crate different from a chatbot that just talks about music. The agent doesn't guess. It queries real databases:

**For metadata:** Discogs (credits, pressings, labels), MusicBrainz (canonical IDs, relationships), Last.fm (tags, similarity scores)

**For context:** Genius (lyrics, annotations, artist commentary), Wikipedia (bios, career timelines), 26 music publications (reviews, co-mentions for influence mapping)

**For audio and images:** Spotify (artwork, audio features), YouTube (playback, live performances), Bandcamp (independent releases), iTunes (high-res artwork), fanart.tv (HD backgrounds, logos)

**For events:** Ticketmaster (concerts, tours), Setlist.fm (historical setlists)

**For radio:** Radio Browser (30,000+ live stations worldwide with ICY metadata)

Here's how keys work: You need to bring your own AI key — either an Anthropic API key (for Claude directly) or an OpenRouter key (which gives you access to Claude, GPT-4, Gemini, and others through one API). This is the brain of the agent, and it runs on your account so you control costs and model selection.

For the data sources, most work out of the box. Discogs, Last.fm, Ticketmaster, Spotify, Exa, Tavily, and fanart.tv all have embedded keys that every user shares — you don't need to configure anything. For Genius, Tumblr publishing, and a few others, you can optionally add your own keys in Settings for higher rate limits or additional features.

---

## What's next

I'm still building. The influence graph cache (backed by Convex) is getting smarter — it remembers connections the agent has already discovered so repeat queries are instant instead of requiring fresh research. The image pipeline now pulls from Spotify and fanart.tv for HD artist photos. There's a Gemini-powered infographic generator in the plan for visual influence maps.

But the core idea stays the same: music is a network, not a list. Every artist is connected to every other artist through influence, collaboration, sampling, geography, and shared history. Crate is the tool that makes those connections visible, verifiable, and useful.

If you want to try it: [digcrate.app](https://digcrate.app)

If you want to see the code: [github.com/tmoody1973/crate-web](https://github.com/tmoody1973/crate-web)

If you want the CLI: [crate-cli.dev](https://crate-cli.dev)

---

*Built in Milwaukee by Tarik Moody. Powered by Claude, Convex, Vercel, and 20+ music databases. The records in the header image are real — that's my local shop.*
