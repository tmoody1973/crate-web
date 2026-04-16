# LinkedIn Post: Crate Custom Skills

---

## Post

I'm building something I've never seen in a music app before.

It's called Custom Skills, and it makes Crate (my AI music research tool) extensible. You teach it new commands by describing what you want in plain English. It's still in development, but the core is working and I wanted to share what it does.

You tell it "I want a command that pulls upcoming shows from The Rave Milwaukee." It figures out how to do it, runs it once to prove it works, and saves it as /rave-events. Type that anytime and you get fresh results.

The part I keep thinking about: it remembers what it found last time. So the second time you run /rave-events, it doesn't just give you a list. It tells you what's different. "3 new shows added. The Roots on April 5 is new." A lookup becomes a diff.

And when something goes wrong, say the venue website throws up a login wall, the skill records that and works around it next time. They get better the more you use them.

Here's what that looks like for different people.

If you're into music but tired of algorithms, you'd make /vinyl-drops to check Discogs for new jazz pressings every Friday. Or /sample-alert to see if anyone sampled Madlib this week. Or /trending-bandcamp for whatever's moving in electronic right now. Takes 30 seconds to set up, works forever.

If you write about music, you'd make /label-roster to pull every artist on a label from Discogs while you're working on a piece. Or /mke-music-news to scan Milwaukee Record and Journal Sentinel each morning. It remembers last week's stories, so you only see what's new. An hour of morning research becomes one command.

If you're on air, you'd make /rave-events to check venue listings before your show. Or /new-releases-hyfin to see what dropped this week from artists in your station's rotation. Or /tour-watch for Milwaukee tour announcements. Behind the scenes it's pulling from 20+ sources (Discogs, Bandcamp, Ticketmaster, web scraping). You describe what you want, the agent figures out the how.

If you're the type of person who goes down rabbit holes about producers, samples, and who influenced who, you'd build skills around the way you think about music. /deep-dive for an artist's full production history. /playlist-export to turn a research session into something shareable. /weekly-roundup to compile everything you dug into this week.

I should mention: I'm not a software engineer. I'm a radio broadcaster at Radio Milwaukee. I built this with Claude Code, Anthropic's AI coding tool. I directed the architecture, the AI wrote the code. The skills system, the memory layer, the self-correcting failure notes, the natural language matching, all of it built in a day. Still testing and polishing before it goes live, but the core works. That still doesn't feel real to me.

The idea came from an Anthropic blog post about how their engineering team uses "skills" in Claude Code internally. They described nine categories, from data fetching to runbooks. I read it and my first thought was: what if a radio host could build one of these just by typing a sentence?

So I'm building that.

Crate is something like StoryGraph but for music. For the people who want to know why music sounds the way it does, not just have an algorithm guess what they'd like. Custom Skills is what will make it personal.

I'm looking for early testers, especially DJs, radio hosts, music journalists, and serious crate diggers. If you want to try it before it launches, DM me.

And I'd genuinely like to know: if you could create one custom command for your music workflow, what would it do?

digcrate.app

#MusicTech #AI #RadioMilwaukee #ClaudeCode #MusicResearch #BuildInPublic

---

## Shorter version

I'm building Custom Skills for Crate, my AI music research tool. It makes Crate extensible, meaning anyone can add new capabilities just by describing what they need.

You describe what you want in plain English. The AI builds it. You get a reusable command.

"Pull upcoming shows from The Rave" becomes /rave-events.
"Check for new jazz vinyl on Discogs" becomes /vinyl-drops.
"Scan Milwaukee music news" becomes /mke-music-news.

Here's the thing: it remembers what it found last time. Next run, it tells you what changed. And when something breaks (venue website login wall, Discogs rate limit), the skill records the failure and works around it next time.

Music lovers build commands around their taste. Journalists automate their morning research. Radio DJs get custom commands for venue events, new releases, tour dates.

I'm not an engineer. I'm a radio broadcaster who built this with Claude Code. The memory system, the self-correcting failures, the natural language triggers, all built in a day. Still in development, but the core works.

Crate is something like StoryGraph for music. Custom Skills is what will make it extensible and personal.

DM me if you want early access. And tell me: what command would you build first?

digcrate.app

#MusicTech #AI #BuildInPublic
