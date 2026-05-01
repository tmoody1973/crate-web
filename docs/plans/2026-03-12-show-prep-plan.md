# Crate Show Prep — Phase 1 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a show prep skill that turns a pasted setlist into a structured, station-voiced prep package rendered as a single OpenUI artifact with track context, talk breaks, social copy, and interview prep.

**Architecture:** A SKILL.md in crate-cli defines the research workflow and triggers. Three YAML station profiles configure voice/tone. Five new OpenUI components in crate-web render the prep package as an artifact. A `/show-prep` slash command in crate-web's chat route preprocesses input. The existing `/news` command gains station-aware customization using the same YAML profiles.

**Tech Stack:** TypeScript, Crate CLI skill system (SKILL.md + YAML), OpenUI Lang (`@openuidev/react-lang` + `defineComponent` + Zod), React (client components), Vitest (tests), Tailwind CSS.

---

### Task 1: Station YAML Profiles

**Files:**
- Create: `crate-cli/src/skills/show-prep/stations/88nine.yaml`
- Create: `crate-cli/src/skills/show-prep/stations/hyfin.yaml`
- Create: `crate-cli/src/skills/show-prep/stations/rhythmlab.yaml`

**Step 1: Create the directory structure**

```bash
mkdir -p /Users/tarikmoody/Documents/Projects/crate-cli/src/skills/show-prep/stations
```

**Step 2: Create `88nine.yaml`**

```yaml
name: 88Nine
tagline: "Discover the sound of Milwaukee"
color: "#3B82F6"

voice:
  tone: "Warm, eclectic, community-forward"
  perspective: "Discovery-oriented, 'let me tell you about this artist'"
  music_focus: "Indie, alternative, world, electronic, hip-hop"
  vocabulary:
    prefer: ["discover", "connect", "community", "eclectic", "homegrown"]
    avoid: ["mainstream", "generic", "commercial"]

defaults:
  break_length: medium
  depth: standard
  audience: "Milwaukee music lovers who value discovery and local culture"

social:
  hashtags: ["#88Nine", "#RadioMilwaukee", "#MKE", "#DiscoverMusic"]
  tone: "Warm, inviting, curious"

recurring_features:
  - name: "Deep Cut Daily"
    description: "One overlooked track from an artist currently in rotation, with backstory"
    frequency: daily
  - name: "Milwaukee Made Monday"
    description: "Local artist spotlight to start the week"
    frequency: weekly
  - name: "Sample Source"
    description: "Trace a sample back to its origin"
    frequency: weekly

local:
  venues: ["Turner Hall Ballroom", "Vivarium", "The Cooperage", "Cactus Club", "Riverside Theatre", "Pabst Theater"]
  neighborhoods: ["Bay View", "Riverwest", "Walker's Point", "East Side", "Third Ward"]
  market: "Milwaukee, WI"
  sources: ["milwaukeerecord.com", "jsonline.com", "urbanmilwaukee.com", "onmilwaukee.com", "radiomilwaukee.org", "shepherdexpress.com"]
```

**Step 3: Create `hyfin.yaml`**

```yaml
name: HYFIN
tagline: "Black alternative radio"
color: "#D4A843"

voice:
  tone: "Bold, culturally sharp, unapologetic"
  perspective: "Cultural context, movement-building, 'here's why this matters'"
  music_focus: "Urban alternative, neo-soul, progressive hip-hop, Afrobeats"
  vocabulary:
    prefer: ["culture", "movement", "lineage", "vibration", "frequency"]
    avoid: ["urban (standalone)", "exotic", "ethnic"]

defaults:
  break_length: medium
  depth: deep_cultural_context
  audience: "Young, culturally aware Milwaukee listeners invested in Black art and music"

social:
  hashtags: ["#HYFIN", "#MKE", "#BlackAlternative"]
  tone: "Confident, community-first"

recurring_features:
  - name: "The Lineage"
    description: "Influence chain connecting today's new release to its roots"
    frequency: daily
  - name: "Culture Check"
    description: "Arts/culture moment from Black and brown communities locally and globally"
    frequency: daily

local:
  venues: ["Turner Hall Ballroom", "Vivarium", "The Cooperage", "Cactus Club"]
  neighborhoods: ["Bronzeville", "Riverwest", "Bay View", "Walker's Point"]
  market: "Milwaukee, WI"
  sources: ["milwaukeerecord.com", "jsonline.com", "urbanmilwaukee.com", "onmilwaukee.com"]
```

**Step 4: Create `rhythmlab.yaml`**

```yaml
name: Rhythm Lab
tagline: "Where the crates run deep"
color: "#8B5CF6"

voice:
  tone: "Curated, global perspective, deep knowledge"
  perspective: "Influence tracing, crate-digging stories, 'the thread connecting these sounds'"
  music_focus: "Global beats, electronic, jazz fusion, experimental, Afrobeats, dub"
  vocabulary:
    prefer: ["lineage", "crate", "connection", "thread", "sonic", "palette"]
    avoid: ["world music (reductive)", "niche", "obscure (dismissive)"]

defaults:
  break_length: long
  depth: deep_music_history
  audience: "Dedicated music heads, DJs, producers, and crate diggers who value context and connection"

social:
  hashtags: ["#RhythmLab", "#CrateDigging", "#GlobalBeats", "#MKE"]
  tone: "Knowledgeable, passionate, collegial"

recurring_features:
  - name: "Crate Connection"
    description: "How two seemingly unrelated tracks share DNA"
    frequency: daily
  - name: "Global Dispatch"
    description: "Music from a specific city/region with cultural context"
    frequency: weekly
  - name: "The Remix Tree"
    description: "Track a song through its remix/cover/sample ecosystem"
    frequency: weekly

local:
  venues: ["Turner Hall Ballroom", "Vivarium", "The Cooperage", "Cactus Club", "Jazz Estate"]
  neighborhoods: ["Riverwest", "Bay View", "Bronzeville", "Walker's Point"]
  market: "Milwaukee, WI"
  sources: ["milwaukeerecord.com", "jsonline.com", "urbanmilwaukee.com", "onmilwaukee.com"]
```

**Step 5: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-cli
git add src/skills/show-prep/stations/
git commit -m "feat(show-prep): add station YAML profiles for 88Nine, HYFIN, Rhythm Lab"
```

---

### Task 2: Show Prep SKILL.md

**Files:**
- Create: `crate-cli/src/skills/show-prep/SKILL.md`

**Step 1: Create the skill file**

The skill follows the exact same frontmatter + body pattern as `artist-deep-dive/SKILL.md`. The registry auto-discovers it from `src/skills/show-prep/SKILL.md`.

```markdown
---
name: show-prep
description: Radio show preparation — generates station-voiced track context, talk breaks, social copy, and interview prep from a pasted setlist
triggers:
  - "show prep"
  - "prep my show"
  - "prepare my show"
  - "prep my set"
  - "show preparation"
  - "dj prep"
  - "radio prep"
tools_priority: [musicbrainz, discogs, genius, bandcamp, lastfm, ticketmaster, websearch, news]
---

## Station Profiles

Load the station YAML profile matching the user's request (88nine, hyfin, or rhythmlab).
If no station is specified, ask which station before proceeding.
The profile defines voice tone, vocabulary, break length defaults, social hashtags, recurring features, and local context.

Available stations:
- **88Nine** — Warm, eclectic, community-forward. Indie, alternative, world, electronic, hip-hop.
- **HYFIN** — Bold, culturally sharp, unapologetic. Urban alternative, neo-soul, progressive hip-hop, Afrobeats.
- **Rhythm Lab** — Curated, global perspective, deep knowledge. Global beats, electronic, jazz fusion, experimental.

## Input Parsing

Parse the user's message for:
1. **Station name** — "for HYFIN", "for 88nine", "for rhythm lab"
2. **Shift** — morning, midday, afternoon, evening, overnight (default: evening)
3. **DJ name** — "DJ [name]" or infer from user context
4. **Track list** — Lines matching "Artist - Title" or "Artist — Title" pattern
5. **Interview guest** — "interviewing [artist]" or "guest: [artist]"

If tracks are provided, proceed with full prep. If not, ask for the setlist.

## Workflow

### Per-Track Research (parallel for each track)

1. **MusicBrainz** `search_recording` + `get_recording_credits` — canonical metadata, producer, engineer, studio
2. **Discogs** `search_discogs` + `get_release_full` — release year, label, catalog number, album context
3. **Genius** `search_songs` + `get_song` — annotations, verified artist commentary, production context
4. **Bandcamp** `search_bandcamp` + `get_album` — artist statements, liner notes, community tags, independent status
5. **Last.fm** `get_track_info` + `get_similar_tracks` — listener stats, similar tracks, top tags

### Synthesis (per track)

From the raw data, generate:
- **Origin story** — 2-3 sentences on how this track came to be. Not Wikipedia summary — the interesting backstory.
- **Production notes** — Key production details (studio, producer, notable instruments, sonic signature).
- **Connections** — Influences, samples, collaborations, genre lineage. Use influence tracer if available.
- **Lesser-known fact** — The detail listeners can't easily Google. Dig into Genius annotations and Discogs credits.
- **Why it matters** — One sentence answering: why should THIS audience care about this track RIGHT NOW? (Rule 1)
- **Audience relevance** — high / medium / low based on how well the track fits the station's audience profile (Rule 6)
- **Local tie-in** — Check Ticketmaster for upcoming Milwaukee shows by this artist. Search Milwaukee sources for any local connection.

### Talk Break Generation

For each transition point between tracks, generate talk breaks in the station's voice:
- **Short (10-15 sec)** — Quick context before the vocal kicks in
- **Medium (30-60 sec)** — "That was..." with a compelling detail plus segue to next track
- **Long (60-120 sec)** — Fuller backstory connecting the two tracks, with local tie-in if available

Bold the key phrases — the parts that really land on air.
Include pronunciation guides for unfamiliar artist/track names.

### Social Copy

For each track (or the show overall), generate platform-specific posts:
- **Instagram** — Visual-first, 1-2 sentences, station hashtags
- **X/Twitter** — Punchy, single line + hashtag
- **Bluesky** — Conversational, community-oriented

Never reproduce lyrics. Tone matches the station profile.

### Interview Prep (only if guest mentioned)

If the DJ mentions interviewing a guest:
1. Pull comprehensive artist data from all sources
2. Generate questions in three categories: warm-up, music deep-dive, Milwaukee connection
3. Flag common overasked questions to avoid

## Output Format

Output a SINGLE ShowPrepPackage OpenUI component containing all TrackContextCards, TalkBreakCards, SocialPostCards, and InterviewPrepCards as children. This renders as one browsable artifact in the slide-in panel.

## Radio Milwaukee Show Prep Rules

Apply these rules to ALL generated content:
1. Every piece must answer "why does the listener care?" — no slot filling
2. Content is shaped by the station's audience profile
3. Talk breaks are starting points for DJs to develop — not scripts to read
4. Prep is tied to the actual setlist the DJ will play
5. Content is modular — DJs can skip, swap, or reorder cards
6. Rank content by audience relevance — surface the best angles first
```

**Step 2: Verify the skill loads**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-cli
npx tsx -e "
import { SkillRegistry } from './src/skills/registry.js';
const reg = new SkillRegistry();
await reg.loadAll();
const match = reg.matchQuery('prep my show for HYFIN');
console.log('Matched:', match?.name);
console.log('Triggers:', match?.triggers?.length);
console.log('All skills:', reg.listSkills().map(s => s.name));
"
```

Expected: `Matched: show-prep`, triggers count of 7, listed among all skills.

**Step 3: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-cli
git add src/skills/show-prep/SKILL.md
git commit -m "feat(show-prep): add show-prep skill with research workflow and station-aware voice"
```

---

### Task 3: OpenUI Components — TrackContextCard

**Files:**
- Modify: `crate-web/src/lib/openui/components.tsx`
- Test: `crate-web/tests/show-prep-components.test.tsx` (create)

**Step 1: Add TrackContextCard component**

Add to the bottom of `crate-web/src/lib/openui/components.tsx`, before the closing of the file:

```tsx
// ── Show Prep Components ────────────────────────────────────────

export const TrackContextCard = defineComponent({
  name: "TrackContextCard",
  description:
    "Show prep context card for a single track — origin story, production notes, talk break suggestions, local tie-in, and audience relevance.",
  props: z.object({
    artist: z.string().describe("Artist name"),
    title: z.string().describe("Track title"),
    originStory: z.string().describe("2-3 sentence backstory of how this track came to be"),
    productionNotes: z.string().describe("Key production details — studio, producer, notable instruments"),
    connections: z.string().describe("Influences, samples, collaborations, genre lineage"),
    influenceChain: z.string().optional().describe("Musical lineage chain, e.g. 'Thai funk → Khruangbin → modern psych-soul'"),
    lesserKnownFact: z.string().describe("Detail listeners can't easily Google"),
    whyItMatters: z.string().describe("One sentence: why should the listener care about this right now?"),
    audienceRelevance: z.enum(["high", "medium", "low"]).describe("How well this track fits the station's audience"),
    localTieIn: z.string().optional().describe("Milwaukee-specific connection — upcoming shows, local artist tie-in"),
    pronunciationGuide: z.string().optional().describe("Pronunciation help for unfamiliar names"),
    imageUrl: z.string().optional().describe("Album art URL"),
  }),
  component: ({ props }) => {
    const [expanded, setExpanded] = useState(false);
    const relevanceColor = {
      high: "bg-green-500/20 text-green-400",
      medium: "bg-yellow-500/20 text-yellow-400",
      low: "bg-zinc-500/20 text-zinc-400",
    }[props.audienceRelevance];

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-start gap-3">
          {props.imageUrl && (
            <img src={props.imageUrl} alt="" className="h-16 w-16 shrink-0 rounded object-cover" />
          )}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <PlayButton name={props.title} artist={props.artist} />
              <h3 className="font-bold text-white">{props.artist} — {props.title}</h3>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${relevanceColor}`}>
                {props.audienceRelevance}
              </span>
            </div>
            <p className="mt-1 text-sm font-medium text-cyan-400">{props.whyItMatters}</p>
            {props.pronunciationGuide && (
              <p className="mt-0.5 text-xs italic text-zinc-500">🗣 {props.pronunciationGuide}</p>
            )}
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          {expanded ? "▼ Collapse" : "► Origin · Production · Connections"}
        </button>

        {expanded && (
          <div className="mt-2 space-y-3 border-t border-zinc-700 pt-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Origin Story</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.originStory}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Production Notes</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.productionNotes}</p>
            </div>
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Connections</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.connections}</p>
            </div>
            {props.influenceChain && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Influence Chain</p>
                <p className="mt-0.5 text-sm text-zinc-300">{props.influenceChain}</p>
              </div>
            )}
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Lesser-Known Fact</p>
              <p className="mt-0.5 text-sm text-zinc-300">{props.lesserKnownFact}</p>
            </div>
            {props.localTieIn && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Milwaukee Connection</p>
                <p className="mt-0.5 text-sm text-cyan-400/80">{props.localTieIn}</p>
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
});
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/components.tsx
git commit -m "feat(show-prep): add TrackContextCard OpenUI component"
```

---

### Task 4: OpenUI Components — TalkBreakCard

**Files:**
- Modify: `crate-web/src/lib/openui/components.tsx`

**Step 1: Add TalkBreakCard component**

Add after TrackContextCard in the same file:

```tsx
export const TalkBreakCard = defineComponent({
  name: "TalkBreakCard",
  description:
    "Talk break card with short/medium/long variants. Type badge shows intro, back-announce, transition, or feature.",
  props: z.object({
    type: z.enum(["intro", "back-announce", "transition", "feature"]).describe("Break type"),
    beforeTrack: z.string().describe("Track playing before this break"),
    afterTrack: z.string().describe("Track playing after this break"),
    shortVersion: z.string().describe("10-15 second version — quick hook"),
    mediumVersion: z.string().describe("30-60 second version — fuller context"),
    longVersion: z.string().describe("60-120 second version — deep backstory"),
    keyPhrases: z.string().describe("Comma-separated key phrases to emphasize on air"),
    timingCue: z.string().optional().describe("e.g. 'Hit this before the vocal at 0:08'"),
    pronunciationGuide: z.string().optional().describe("Pronunciation help for names"),
  }),
  component: ({ props }) => {
    const [tab, setTab] = useState<"short" | "medium" | "long">("medium");
    const [copied, setCopied] = useState(false);

    const typeBadge = {
      intro: "bg-blue-500/20 text-blue-400",
      "back-announce": "bg-green-500/20 text-green-400",
      transition: "bg-purple-500/20 text-purple-400",
      feature: "bg-amber-500/20 text-amber-400",
    }[props.type];

    const content = { short: props.shortVersion, medium: props.mediumVersion, long: props.longVersion }[tab];

    const handleCopy = async () => {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${typeBadge}`}>
              {props.type}
            </span>
            <span className="text-xs text-zinc-500">
              {props.beforeTrack} → {props.afterTrack}
            </span>
          </div>
          <button onClick={handleCopy} className="text-[10px] text-zinc-500 hover:text-white">
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-2 flex gap-1">
          {(["short", "medium", "long"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded px-2 py-0.5 text-[10px] ${tab === t ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {t === "short" ? "15s" : t === "medium" ? "60s" : "120s"}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-zinc-300">{content}</p>

        {props.keyPhrases && (
          <div className="mt-2 flex flex-wrap gap-1">
            {props.keyPhrases.split(",").map((phrase) => (
              <span key={phrase.trim()} className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] font-medium text-white">
                {phrase.trim()}
              </span>
            ))}
          </div>
        )}

        {props.timingCue && (
          <p className="mt-1 text-[10px] text-amber-400/70">⏱ {props.timingCue}</p>
        )}
        {props.pronunciationGuide && (
          <p className="mt-0.5 text-[10px] italic text-zinc-500">🗣 {props.pronunciationGuide}</p>
        )}
      </div>
    );
  },
});
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/components.tsx
git commit -m "feat(show-prep): add TalkBreakCard OpenUI component with short/medium/long tabs"
```

---

### Task 5: OpenUI Components — SocialPostCard

**Files:**
- Modify: `crate-web/src/lib/openui/components.tsx`

**Step 1: Add SocialPostCard component**

```tsx
export const SocialPostCard = defineComponent({
  name: "SocialPostCard",
  description:
    "Social media copy card with platform tabs (Instagram, X, Bluesky). Copy button per platform. Station-specific hashtags.",
  props: z.object({
    trackOrTopic: z.string().describe("Track name or topic this post is about"),
    instagram: z.string().describe("Instagram post copy"),
    twitter: z.string().describe("X/Twitter post copy"),
    bluesky: z.string().describe("Bluesky post copy"),
    hashtags: z.string().describe("Comma-separated hashtags"),
  }),
  component: ({ props }) => {
    const [tab, setTab] = useState<"instagram" | "twitter" | "bluesky">("instagram");
    const [copied, setCopied] = useState(false);

    const content = { instagram: props.instagram, twitter: props.twitter, bluesky: props.bluesky }[tab];

    const handleCopy = async () => {
      const hashtagStr = props.hashtags.split(",").map((h) => h.trim()).join(" ");
      await navigator.clipboard.writeText(`${content}\n\n${hashtagStr}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-400">{props.trackOrTopic}</span>
          <button onClick={handleCopy} className="text-[10px] text-zinc-500 hover:text-white">
            {copied ? "✓ Copied" : "Copy"}
          </button>
        </div>

        <div className="mt-1.5 flex gap-1">
          {(["instagram", "twitter", "bluesky"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`rounded px-2 py-0.5 text-[10px] ${tab === p ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
            >
              {p === "twitter" ? "X" : p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>

        <p className="mt-2 text-sm text-zinc-300">{content}</p>

        <div className="mt-2 flex flex-wrap gap-1">
          {props.hashtags.split(",").map((tag) => (
            <span key={tag.trim()} className="rounded-full bg-zinc-700/50 px-2 py-0.5 text-[10px] text-zinc-400">
              {tag.trim()}
            </span>
          ))}
        </div>
      </div>
    );
  },
});
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/components.tsx
git commit -m "feat(show-prep): add SocialPostCard OpenUI component with platform tabs"
```

---

### Task 6: OpenUI Components — InterviewPrepCard

**Files:**
- Modify: `crate-web/src/lib/openui/components.tsx`

**Step 1: Add InterviewPrepCard component**

```tsx
export const InterviewPrepCard = defineComponent({
  name: "InterviewPrepCard",
  description:
    "Interview preparation card with warm-up, deep-dive, and local questions. Flags overasked questions to avoid.",
  props: z.object({
    guestName: z.string().describe("Guest artist or interviewee name"),
    warmUpQuestions: z.string().describe("Easy personality-revealing openers, one per line"),
    deepDiveQuestions: z.string().describe("Questions about craft, process, specific tracks, one per line"),
    localQuestions: z.string().describe("Milwaukee connection angles, one per line"),
    avoidQuestions: z.string().describe("Common overasked questions to skip, one per line"),
  }),
  component: ({ props }) => {
    const [section, setSection] = useState<"warmup" | "deep" | "local" | "avoid">("warmup");

    const renderQuestions = (text: string, color: string) => (
      <ul className="mt-2 space-y-1.5">
        {text.split("\n").filter(Boolean).map((q, i) => (
          <li key={i} className={`text-sm ${color}`}>• {q.replace(/^[-•]\s*/, "")}</li>
        ))}
      </ul>
    );

    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4">
        <h3 className="font-bold text-white">Interview Prep: {props.guestName}</h3>

        <div className="mt-2 flex gap-1">
          {([
            ["warmup", "Warm-up"],
            ["deep", "Deep Dive"],
            ["local", "Milwaukee"],
            ["avoid", "Avoid"],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSection(key)}
              className={`rounded px-2 py-0.5 text-[10px] ${
                section === key
                  ? key === "avoid" ? "bg-red-900/30 text-red-400" : "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {section === "warmup" && renderQuestions(props.warmUpQuestions, "text-zinc-300")}
        {section === "deep" && renderQuestions(props.deepDiveQuestions, "text-zinc-300")}
        {section === "local" && renderQuestions(props.localQuestions, "text-cyan-400/80")}
        {section === "avoid" && renderQuestions(props.avoidQuestions, "text-red-400/70")}
      </div>
    );
  },
});
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/components.tsx
git commit -m "feat(show-prep): add InterviewPrepCard OpenUI component"
```

---

### Task 7: OpenUI Components — ShowPrepPackage (container)

**Files:**
- Modify: `crate-web/src/lib/openui/components.tsx`

**Step 1: Add ShowPrepPackage container component**

```tsx
export const ShowPrepPackage = defineComponent({
  name: "ShowPrepPackage",
  description:
    "Top-level show prep container. Station badge, date, DJ name, shift. Children are TrackContextCards, TalkBreakCards, SocialPostCards, and optionally InterviewPrepCards.",
  props: z.object({
    station: z.string().describe("Station name: 88Nine, HYFIN, or Rhythm Lab"),
    date: z.string().describe("Show date, e.g. 'Wednesday, March 12'"),
    dj: z.string().describe("DJ name"),
    shift: z.string().describe("Shift: morning, midday, afternoon, evening, overnight"),
    tracks: z.array(TrackContextCard.ref).describe("Track context cards"),
    talkBreaks: z.array(TalkBreakCard.ref).describe("Talk break cards"),
    socialPosts: z.array(SocialPostCard.ref).describe("Social media post cards"),
    interviewPreps: z.array(InterviewPrepCard.ref).optional().describe("Interview prep cards (if guest mentioned)"),
  }),
  component: ({ props, renderNode }) => {
    const stationColor: Record<string, string> = {
      "88Nine": "bg-blue-500/20 text-blue-400 border-blue-500/30",
      "HYFIN": "bg-amber-500/20 text-amber-400 border-amber-500/30",
      "Rhythm Lab": "bg-purple-500/20 text-purple-400 border-purple-500/30",
    };
    const colorClass = stationColor[props.station] || "bg-zinc-500/20 text-zinc-400 border-zinc-500/30";

    return (
      <div className="space-y-4 rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div>
            <span className={`rounded-full border px-3 py-1 text-sm font-bold ${colorClass}`}>
              {props.station}
            </span>
            <span className="ml-3 text-sm text-zinc-400">{props.shift} shift</span>
          </div>
          <div className="text-right">
            <p className="text-sm text-white">{props.dj}</p>
            <p className="text-xs text-zinc-500">{props.date}</p>
          </div>
        </div>

        {props.tracks && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Track Context</h2>
            <div className="space-y-3">{renderNode(props.tracks)}</div>
          </div>
        )}

        {props.talkBreaks && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Talk Breaks</h2>
            <div className="space-y-3">{renderNode(props.talkBreaks)}</div>
          </div>
        )}

        {props.socialPosts && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Social Copy</h2>
            <div className="space-y-2">{renderNode(props.socialPosts)}</div>
          </div>
        )}

        {props.interviewPreps && (
          <div>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Interview Prep</h2>
            <div className="space-y-3">{renderNode(props.interviewPreps)}</div>
          </div>
        )}
      </div>
    );
  },
});
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/components.tsx
git commit -m "feat(show-prep): add ShowPrepPackage container OpenUI component"
```

---

### Task 8: OpenUI Prompt Additions

**Files:**
- Modify: `crate-web/src/lib/openui/prompt.ts`

**Step 1: Add show prep component documentation to the OpenUI Lang prompt**

Add the following section before the `### Rules` section in the `OPENUI_LANG_PROMPT` string:

```
**TrackContextCard(artist, title, originStory, productionNotes, connections, influenceChain?, lesserKnownFact, whyItMatters, audienceRelevance, localTieIn?, pronunciationGuide?, imageUrl?)**
Show prep context for one track. audienceRelevance is "high", "medium", or "low".

**TalkBreakCard(type, beforeTrack, afterTrack, shortVersion, mediumVersion, longVersion, keyPhrases, timingCue?, pronunciationGuide?)**
Talk break with short/medium/long variants. type is "intro", "back-announce", "transition", or "feature". keyPhrases is comma-separated.

**SocialPostCard(trackOrTopic, instagram, twitter, bluesky, hashtags)**
Social media copy with platform tabs. hashtags is comma-separated.

**InterviewPrepCard(guestName, warmUpQuestions, deepDiveQuestions, localQuestions, avoidQuestions)**
Interview prep with question categories. Each question field has one question per line.

**ShowPrepPackage(station, date, dj, shift, tracks, talkBreaks, socialPosts, interviewPreps?)**
Top-level show prep container. `tracks` is array of TrackContextCard refs. `talkBreaks` is array of TalkBreakCard refs. `socialPosts` is array of SocialPostCard refs. `interviewPreps` is optional array of InterviewPrepCard refs.
```

Also add to the `### Rules` section:

```
- For show prep requests, ALWAYS output a ShowPrepPackage containing TrackContextCards, TalkBreakCards, and SocialPostCards. Generate one TrackContextCard per track in the setlist, talk breaks for each transition, and one SocialPostCard per track or for the show overall.
- When show prep includes an interview or guest mention, add InterviewPrepCards inside the ShowPrepPackage.
```

And add an example to `### Examples`:

```
Example 6 — Show prep package:
\`\`\`
root = ShowPrepPackage("HYFIN", "Wednesday, March 12", "Jordan Lee", "evening", [tc1, tc2], [tb1], [sp1], [])
tc1 = TrackContextCard("Khruangbin", "Time (You and I)", "Born from the trio's deep immersion in 1960s Thai funk...", "Recorded at their rural Texas barn studio with vintage Fender Rhodes...", "Thai funk → surf rock → psychedelic soul", "Thai funk cassettes → Khruangbin → modern psych-soul revival", "The band learned Thai from their Houston neighbor who introduced them to the music", "Khruangbin proves that the deepest musical connections cross every border — exactly what HYFIN is about", "high", "Playing Riverside Theatre March 22 — tickets still available", "crew-ANG-bin")
tc2 = TrackContextCard("Little Simz", "Gorilla", "Written during the sessions that would become her Mercury Prize-winning album...", "Produced by Inflo, the anonymous producer behind SAULT...", "UK hip-hop → grime → conscious rap", "Lauryn Hill → Ms. Dynamite → Little Simz", "Simz turned down every major label twice before signing on her own terms", "An independent Black woman in hip-hop who bet on herself and won the Mercury Prize — the HYFIN frequency personified", "high")
tb1 = TalkBreakCard("transition", "Time (You and I)", "Gorilla", "From Texas barn funk to London grime — two artists who built it themselves.", "That was Khruangbin taking you to Thailand via Texas. Now we're crossing the Atlantic to London where Little Simz turned down every major label — twice — to make the music she wanted. This is Gorilla.", "Khruangbin learned their sound from Thai funk cassettes a Houston neighbor shared with them. Little Simz learned hers by watching Lauryn Hill and deciding she'd rather own everything than compromise anything. Two completely different paths to the same place — uncompromising art on their own terms. That's the frequency.", "Texas barn funk, Thai cassettes, turned down every label, Mercury Prize", "Hit 'uncompromising art' before the beat drops at 0:04")
sp1 = SocialPostCard("Khruangbin → Little Simz", "From Thai funk to London grime. Tonight's HYFIN evening set traces the line from Khruangbin's Texas barn sessions to Little Simz's Mercury Prize-winning independence. Tune in.", "Thai funk cassettes → Texas barn → London grime → Mercury Prize. The thread connecting tonight's HYFIN set. 📻", "Tonight on HYFIN: how a Houston neighbor's Thai funk cassettes and a London rapper's refusal to sign connect across oceans. The frequency is real.", "#HYFIN, #MKE, #BlackAlternative, #Khruangbin, #LittleSimz")
\`\`\`
```

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/lib/openui/prompt.ts
git commit -m "feat(show-prep): add show prep components to OpenUI Lang prompt"
```

---

### Task 9: Slash Command — `/show-prep` and Customizable `/news`

**Files:**
- Modify: `crate-web/src/app/api/chat/route.ts`

**Step 1: Add `/show-prep` and enhance `/news` in `preprocessSlashCommand()`**

Add these cases to the switch statement in `preprocessSlashCommand()`:

```typescript
    case "show-prep":
    case "showprep":
    case "prep": {
      // Pass through with skill trigger prefix so the show-prep skill activates
      // The skill parses station, shift, and tracks from the message body
      if (!arg) {
        return "Show prep — which station (88Nine, HYFIN, or Rhythm Lab) and what's your setlist?";
      }
      return `Prep my show: ${arg}`;
    }
```

For `/news`, enhance the existing case to support station customization:

Replace the existing `case "news"` block with:

```typescript
    case "news": {
      const parts = arg?.split(/\s+/) ?? [];
      let count = 5;
      let station = "";

      for (const part of parts) {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= 5) {
          count = num;
        } else if (["88nine", "hyfin", "rhythmlab"].includes(part.toLowerCase().replace(/\s+/g, ""))) {
          station = part;
        }
      }

      const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const day = days[new Date().getDay()];

      const stationContext = station
        ? [
            ``,
            `STATION VOICE: This segment is for ${station}. Match the station's voice, music focus, and audience:`,
            station.toLowerCase().includes("hyfin")
              ? `- HYFIN: Bold, culturally sharp. Focus on hip-hop, neo-soul, Afrobeats, cultural context. Audience: young, culturally aware Milwaukee listeners.`
              : station.toLowerCase().includes("rhythm")
                ? `- Rhythm Lab: Curated, global perspective, deep knowledge. Focus on global beats, electronic, jazz fusion. Audience: dedicated music heads and crate diggers.`
                : `- 88Nine: Warm, eclectic, community-forward. Focus on indie, alternative, world, electronic. Audience: Milwaukee music lovers who value discovery.`,
            `- Prioritize stories relevant to this station's audience and music focus.`,
            `- Use Milwaukee local sources (milwaukeerecord.com, jsonline.com, urbanmilwaukee.com) for local angles.`,
          ].join("\n")
        : "";

      return [
        `Generate a Radio Milwaukee daily music news segment for ${day}.`,
        `Find ${count} current music stories from TODAY or the past 24-48 hours.`,
        ``,
        `RESEARCH STEPS:`,
        `1. Use search_music_news to scan RSS feeds for breaking stories`,
        `2. Use search_web (Tavily, topic="news", time_range="day") to find additional breaking music news not in RSS`,
        `3. Use search_web (Exa) for any trending music stories or scene coverage the keyword search missed`,
        `4. Cross-reference and pick the ${count} most compelling, newsworthy stories`,
        `5. For each story, verify facts using available tools (MusicBrainz, Discogs, Bandcamp, etc.)`,
        stationContext,
        ``,
        `FORMAT — follow the Music News Segment Format rules in your instructions exactly.`,
        `Output "For ${day}:" then ${count} numbered stories with source citations.`,
      ].join("\n");
    }
```

This enables:
- `/news` — 5 stories, general voice
- `/news hyfin` — 5 stories, HYFIN voice
- `/news rhythmlab 3` — 3 stories, Rhythm Lab voice
- `/news 88nine` — 5 stories, 88Nine voice

**Step 2: Commit**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git add src/app/api/chat/route.ts
git commit -m "feat: add /show-prep slash command, make /news station-customizable"
```

---

### Task 10: Build Verification

**Step 1: Verify crate-cli skill loads**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-cli
npx tsx -e "
import { SkillRegistry } from './src/skills/registry.js';
const reg = new SkillRegistry();
await reg.loadAll();
console.log('Skills:', reg.listSkills().map(s => s.name));
const match = reg.matchQuery('prep my show for HYFIN');
console.log('show-prep match:', match?.name);
"
```

Expected: `show-prep` in skills list, matched by query.

**Step 2: Verify crate-web builds**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
npx next build 2>&1 | tail -20
```

Expected: Build succeeds with no TypeScript errors.

**Step 3: Manual smoke test**

1. Start crate-web dev server: `npm run dev`
2. Open http://localhost:3000
3. Type: `Prep my evening show for Rhythm Lab: Khruangbin - Time (You and I)`
4. Verify: The show-prep skill activates, the agent researches the track, and a ShowPrepPackage artifact appears in the slide-in panel.
5. Type: `/news hyfin`
6. Verify: News segment is generated with HYFIN voice and cultural context.

**Step 4: Commit and push**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
git push origin main
cd /Users/tarikmoody/Documents/Projects/crate-cli
git push origin main
```
