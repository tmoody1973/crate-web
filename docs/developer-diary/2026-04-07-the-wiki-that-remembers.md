# Developer Diary: The Wiki That Remembers

**Date:** April 7, 2026
**Entry:** #1
**Working on:** Crate Music Wiki design — applying Karpathy's LLM Wiki pattern to music intelligence
**Related:** Design doc at `~/.gstack/projects/tmoody1973-crate-web/tarikmoody-main-design-20260407-223755.md`

---

## What Happened

Andrej Karpathy dropped a gist called "LLM Wiki" and the internet lost its mind. 16 million views. Everyone rushing to build personal knowledge bases with Claude Code. And I'm sitting here looking at Crate thinking... we already have 18 ingestion pipelines. We already synthesize from Spotify, WhoSampled, Bandcamp, YouTube, radio metadata. We already build influence chains and cross-reference sources.

We just throw it all away after every chat session.

That's the realization that hit tonight. Crate isn't missing a wiki feature. Crate is missing a *memory*.

## Technical Observations

### The "Exhaust" Pattern

The most interesting architectural insight from tonight: **the chat is the editor, the wiki is the exhaust.**

Every tool call in `src/app/api/chat/route.ts` already returns structured artist data. Spotify gives us genres, popularity, related artists. WhoSampled gives us sample relationships. Bandcamp gives us tags and discography. The data is right there, flowing through the system, doing its job in the conversation, and then... gone.

The wiki layer is a post-tool-call hook. A background Convex mutation that captures what the tools already produce. No new UI for writing. No editor. No markdown files. Just a persistence layer that catches what Crate already generates.

```
User asks about Khruangbin
  -> spotify-connected returns genres, popularity, related artists
  -> whosampled returns sample relationships  
  -> influence-cache returns influence chain
  -> [NEW] post-hook: upsert wiki page for Khruangbin with all of the above
  -> user gets their answer
  -> wiki gets smarter (silently, in the background)
```

The marginal cost of adding persistence to an existing intelligence pipeline is dramatically lower than building a wiki from scratch. Everyone on Twitter is writing CLAUDE.md files to configure their generic knowledge bases. We'd just... turn on a hook.

### Convex Data Model Gotcha

The spec reviewer caught something I would have shipped and regretted: unbounded arrays in Convex documents. My first instinct was a single `wikiIndex` doc per user with an `entries` array listing all their wiki pages. Fine at 50 pages. Hits the 1MB document limit at a few hundred.

The fix is obvious in hindsight — one `wikiIndexEntries` document per wiki page, indexed by `userId`. Classic denormalization. But I'd absolutely have built the array version first and hit the wall a month later.

### Synthesis on Write, Not Read

First instinct: synthesize (merge, deduplicate, flag contradictions) when the user views a wiki page. Sounds elegant. But it means every page view triggers an LLM call. That's slow and expensive.

Better: synthesize on write, debounced. When new source data arrives from a tool call, wait 5 seconds (in case multiple tools fire in sequence), then run Haiku to merge the new data with existing sections. Cache the result. Page views are always fast reads.

This is the kind of decision that feels boring but determines whether the product feels snappy or sluggish.

## Personal Insights

### The "Export My Brain" Moment

The independent reviewer (Claude subagent, running cold with no conversation context) read my session transcript and came back with this:

> "Knowledge lives in my head and scattered across tools" — This isn't a software problem. It's 20 years of institutional knowledge trapped in a human brain with no succession plan.

That reframe landed. I've been thinking about Crate as a research tool. But the wiki makes it something else: a mechanism for making tacit expertise explicit. When Tarik researches Khruangbin and the wiki captures the influence chain back through Thai funk and Lee Perry, that's not just "saving a query result." That's encoding knowledge that previously existed only in one person's head.

The wiki is how taste becomes transferable.

### Sources Disagree, and That's the Feature

Music metadata is a mess. Spotify says Khruangbin is "psychedelic" and "funk." Bandcamp tags include "surf rock." WhoSampled connects them to dub. AllMusic might say something else entirely.

Most systems try to reconcile this. Pick one source of truth. Normalize.

The wiki does the opposite: it surfaces the contradictions. "Spotify lists dub as a genre; WhoSampled and Bandcamp do not." That's not a bug. That's the interesting part. Music genre is contested, contextual, evolving. Showing where sources disagree is more honest and more useful than pretending there's one right answer.

This feels like a principle worth remembering: **contradictions in your data are often more valuable than consensus.**

### The Public Wiki as Growth Engine

Tarik's instinct to add "option to make it public" was the best product insight of the session. It transforms the wiki from a personal tool into a content platform. Every public artist page is a landing page. Every influence chain is SEO bait. Someone Googling "who influenced Khruangbin" could land on a Crate wiki page with cited sources, cross-references, and a visual influence graph.

The growth loop writes itself: research compounds your wiki, your wiki attracts visitors, visitors become users, their research compounds their wikis, their wikis attract more visitors.

## Future Considerations

### Wiki-Aware Chat

Open question from the design doc that I keep thinking about: when a user asks about an artist that already has a wiki page, should Crate read the wiki first?

The argument for: it's faster, it's richer (accumulated context from multiple past sessions), and it makes the product feel like it actually *knows* you.

The argument against: the wiki might be stale. Music data changes. New albums drop. Collaborations happen.

Best answer is probably both: read wiki first for instant context, offer a "refresh from sources" button to pull fresh data and update the wiki. The wiki becomes a cache with intelligence, not a static archive.

### The Graph Visualization Rabbit Hole

Phase 2 includes a visual node graph for influence chains. D3.js force-directed? Cytoscape.js? Custom SVG?

My gut says start simpler than you think. The mockup (V2-C) shows a clean node-and-arrow diagram, not a full interactive force graph. Ship the simple version first. If people love it, make it interactive later. If they don't engage with the visual, you saved yourself weeks of D3 debugging.

### Entity Types Beyond Artists

The schema supports `"artist" | "genre" | "era" | "label" | "producer"` but Phase 1 is artist-only. The interesting question is what happens when genre pages and era pages exist. An "era" page for "Thai Funk in the 1960s-70s" that cross-references Lee Perry, The Meters, Khruangbin, and links to a genre page for "psychedelic dub"... that starts to look like a real music encyclopedia.

But that's Phase 2+. Don't get seduced by the vision before proving the foundation.

## Shower Thoughts

The whole Karpathy LLM Wiki thing is basically what Wikipedia would be if you had a dedicated AI librarian who read every source, updated every cross-reference, and flagged every contradiction... but just for your interests. A personal Wikipedia that grows from what you actually care about, not what volunteer editors decided was notable.

For music specifically, this fills a gap that's genuinely weird. We have:
- **Streaming services** that know what you listen to but not why
- **Wikipedia** that has facts but no taste
- **Rate Your Music** that has opinions but no connections
- **WhoSampled** that has samples but not broader influence
- **AllMusic** that has editorial reviews but is stuck in 2010

Nobody has the *connected intelligence layer*. The thing that says "you like Khruangbin, and here's the entire influence tree that explains why, with sources from five different databases, and by the way Spotify and Bandcamp disagree about whether they're surf rock."

Crate with a wiki becomes that thing.

## Code Quality Opinion

Looking at the existing codebase — 18 web tools in `src/lib/web-tools/`, each returning structured data — the infrastructure for the wiki layer is genuinely already there. The `chat/route.ts` is the natural place to add post-tool-call hooks. The Convex patterns from `tinydesk` companions and Deep Cuts sharing give us the template for public/private content.

The cleanest path forward is not a rewrite. It's an additive layer. A few Convex tables, a background mutation hook, one new route, and a Haiku synthesis step. The hardest part won't be the code. It'll be tuning the LLM synthesis to produce wiki pages that feel curated rather than auto-generated.

That's the real craft challenge: making the exhaust beautiful.

---

*Next entry: after running the Khruangbin -> Meters -> Lee Perry research session to test the thesis.*
