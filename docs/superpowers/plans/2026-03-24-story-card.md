# StoryCard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `StoryCard` OpenUI component that renders rich narrative music stories with hero images, YouTube embeds, chapter navigation, key people with deep dive links, and responsive desktop/mobile layouts — directly competing with Spotify's SongDNA.

**Architecture:** Single OpenUI component with two layout paths (magazine for desktop, accordion for mobile) gated by `useIsMobile()`. The agent chooses to render `StoryCard` when research produces narrative content. YouTube embeds use lazy-loaded iframes triggered by thumbnail tap. Key people images auto-fetch from the existing artwork API. All action buttons use the existing `injectChatMessage` and `SlackSendButton` helpers.

**Tech Stack:** React, Tailwind CSS, OpenUI (`@openuidev/react-lang` with `defineComponent`), Zod

**Spec:** `docs/superpowers/specs/2026-03-24-story-card-design.md`

**Working directory:** `/Users/tarikmoody/Documents/Projects/crate-web`

---

## File Structure

### Modified Files
| File | Change |
|------|--------|
| `src/lib/openui/components.tsx` | Add `StoryCard` component (~250 lines) with desktop magazine + mobile accordion layouts |
| `src/lib/openui/library.ts` | Register `StoryCard`, add to "Stories & Deep Dives" component group, add prompt example |
| `src/lib/openui/prompt.ts` | Add StoryCard usage rules to the system prompt |

---

## Task 1: Add StoryCard component to components.tsx

**Files:**
- Modify: `src/lib/openui/components.tsx`

This is the main task — the full component with both layouts.

- [ ] **Step 1: Add useIsMobile import**

At the top of `src/lib/openui/components.tsx`, add after the existing React imports:

```typescript
import { useIsMobile } from "@/hooks/use-is-mobile";
```

- [ ] **Step 2: Add the StoryCard component**

Add at the end of the file (after `SlackChannelPicker`). The component has these internal parts:

1. **YouTubeThumbnail** — lazy-loading YouTube embed
2. **PersonCard** — key people with auto-fetched images and deep dive links
3. **StoryCard** — main component with desktop/mobile branching

```typescript
// ── Story Card Component ────────────────────────────────────────

function YouTubeThumbnail({ videoId, videoTitle }: { videoId: string; videoTitle?: string }) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative w-full overflow-hidden rounded-lg" style={{ paddingBottom: "56.25%" }}>
        <iframe
          className="absolute inset-0 h-full w-full"
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
          allow="autoplay; encrypted-media"
          allowFullScreen
          title={videoTitle || "Video"}
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setPlaying(true)}
      className="relative w-full overflow-hidden rounded-lg group"
      style={{ paddingBottom: "56.25%" }}
    >
      <img
        src={`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`}
        alt={videoTitle || "Video thumbnail"}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* Play button overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg">
          <svg className="h-6 w-6 text-white ml-1" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
      </div>
      {videoTitle && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3">
          <p className="text-sm text-white">{videoTitle}</p>
        </div>
      )}
    </button>
  );
}

function StoryPersonCard({ name, role, imageUrl }: { name: string; role?: string; imageUrl?: string }) {
  const autoImage = useAutoImage(name, imageUrl);
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex flex-col items-center gap-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="relative"
      >
        {autoImage ? (
          <img src={autoImage} alt={name} className="h-12 w-12 rounded-full object-cover ring-2 ring-zinc-700" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-700 text-sm font-bold text-white">
            {name.charAt(0)}
          </div>
        )}
        <div className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-600 text-[8px] text-white">
          i
        </div>
      </button>
      <p className="text-xs text-zinc-300 text-center max-w-[64px] truncate">{name}</p>
      {role && <p className="text-[10px] text-zinc-600 text-center">{role}</p>}
      <button
        onClick={() => injectChatMessage(`Tell me about ${name}`)}
        className="text-[9px] text-cyan-500 hover:text-cyan-400"
      >
        Deep Dive →
      </button>
    </div>
  );
}

export const StoryCard = defineComponent({
  name: "StoryCard",
  description:
    "Rich narrative music story with hero image, key facts, chapter navigation, YouTube embed, key people, and sources. Use for album histories, artist origin stories, genre creation stories. NOT for simple facts (use ArtistCard) or connections (use InfluenceChain).",
  props: z.object({
    title: z.string().describe("Story subject — album name, artist, genre, event"),
    subtitle: z.string().describe("Context line — artist · year · label"),
    heroImageUrl: z.string().describe("Hero image URL — album cover, artist photo, or contextual image"),
    category: z.string().describe("Story type: 'The Story Behind', 'The Making Of', 'The History Of'"),
    keyFacts: z.preprocess(jsonPreprocess, z.array(z.object({
      label: z.string(),
      value: z.string(),
    }))).describe("Key stats: [{label:'tracks', value:'31'}, ...]"),
    chapters: z.preprocess(jsonPreprocess, z.array(z.object({
      title: z.string(),
      subtitle: z.string().optional(),
      content: z.string(),
    }))).describe("Story chapters: [{title, subtitle?, content}]"),
    videoId: z.string().optional().describe("YouTube video ID for documentary/interview"),
    videoTitle: z.string().optional().describe("YouTube video title"),
    keyPeople: z.preprocess(jsonPreprocess, z.array(z.object({
      name: z.string(),
      role: z.string().optional(),
      imageUrl: z.string().optional(),
    }))).optional().describe("Key people: [{name, role?, imageUrl?}]"),
    sources: z.preprocess(jsonPreprocess, z.array(z.object({
      name: z.string(),
      url: z.string(),
    }))).describe("Sources: [{name, url}]"),
  }),
  component: ({ props }) => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const isMobile = useIsMobile();
    const [activeChapter, setActiveChapter] = useState(0);
    const [mobileOpenSection, setMobileOpenSection] = useState<number | null>(0);

    const chapters = ensureArray<{ title: string; subtitle?: string; content: string }>(props.chapters);
    const keyFacts = ensureArray<{ label: string; value: string }>(props.keyFacts);
    const keyPeople = ensureArray<{ name: string; role?: string; imageUrl?: string }>(props.keyPeople);
    const sources = ensureArray<{ name: string; url: string }>(props.sources);

    // Extract main artist from subtitle for Influence button
    const mainArtist = props.subtitle.split("·")[0]?.trim() || props.title;
    const spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(props.title + " " + mainArtist)}`;

    // ── Mobile: Accordion layout ──
    if (isMobile) {
      return (
        <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
          {/* Compact header */}
          <div className="flex gap-3 p-3 border-b border-zinc-800">
            <SafeImage src={props.heroImageUrl} alt={props.title} className="h-20 w-20 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-[#E8520E]">{props.category}</p>
              <h3 className="text-base font-bold text-white truncate">{props.title}</h3>
              <p className="text-xs text-zinc-400">{props.subtitle}</p>
              <div className="flex flex-wrap gap-1 mt-1.5">
                {keyFacts.map((f, i) => (
                  <span key={i} className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    <span className="text-[#E8520E] font-semibold">{f.value}</span> {f.label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Accordion sections */}
          <div className="divide-y divide-zinc-800">
            {chapters.map((ch, i) => (
              <div key={i}>
                <button
                  onClick={() => setMobileOpenSection(mobileOpenSection === i ? null : i)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-white">{ch.title}</p>
                    {ch.subtitle && <p className="text-xs text-zinc-500">{ch.subtitle}</p>}
                  </div>
                  <span className={`text-zinc-500 text-xs transition-transform ${mobileOpenSection === i ? "rotate-180" : ""}`}>▾</span>
                </button>
                {mobileOpenSection === i && (
                  <div className="px-4 pb-4 text-sm leading-relaxed text-zinc-300">
                    {ch.content}
                  </div>
                )}
              </div>
            ))}

            {/* YouTube section */}
            {props.videoId && (
              <div>
                <button
                  onClick={() => setMobileOpenSection(mobileOpenSection === 100 ? null : 100)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-5 w-7 items-center justify-center rounded bg-red-600 text-[8px] text-white">▶</div>
                    <p className="text-sm font-medium text-white">Watch</p>
                  </div>
                  <span className={`text-zinc-500 text-xs transition-transform ${mobileOpenSection === 100 ? "rotate-180" : ""}`}>▾</span>
                </button>
                {mobileOpenSection === 100 && (
                  <div className="px-4 pb-4">
                    <YouTubeThumbnail videoId={props.videoId} videoTitle={props.videoTitle} />
                  </div>
                )}
              </div>
            )}

            {/* Key people section */}
            {keyPeople.length > 0 && (
              <div>
                <button
                  onClick={() => setMobileOpenSection(mobileOpenSection === 101 ? null : 101)}
                  className="flex w-full items-center justify-between px-4 py-3 text-left"
                >
                  <p className="text-sm font-medium text-white">Key People</p>
                  <span className={`text-zinc-500 text-xs transition-transform ${mobileOpenSection === 101 ? "rotate-180" : ""}`}>▾</span>
                </button>
                {mobileOpenSection === 101 && (
                  <div className="flex gap-4 overflow-x-auto px-4 pb-4">
                    {keyPeople.map((p, i) => (
                      <StoryPersonCard key={i} name={p.name} role={p.role} imageUrl={p.imageUrl} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Sources + Actions */}
          <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
            {sources.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-cyan-500 hover:underline">{s.name}</a>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-md border border-green-800 bg-green-900/30 px-2.5 py-1.5 text-[11px] text-green-400">▶ Spotify</a>
              <SlackSendButton label={`"${props.title}" story`} />
              <button onClick={() => injectChatMessage(`/influence ${mainArtist}`)} className="inline-flex items-center gap-1 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-[11px] text-zinc-400">Influence →</button>
            </div>
          </div>
        </div>
      );
    }

    // ── Desktop: Magazine layout ──
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden">
        {/* Hero */}
        <div className="relative h-48 overflow-hidden">
          <img src={props.heroImageUrl} alt={props.title} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-zinc-900/60 to-transparent" />
          <div className="relative flex h-full flex-col justify-end p-5">
            <p className="text-[10px] uppercase tracking-[2px] text-[#E8520E] mb-1">{props.category}</p>
            <h2 className="text-2xl font-bold text-white drop-shadow">{props.title}</h2>
            <p className="text-sm text-zinc-300">{props.subtitle}</p>
          </div>
        </div>

        {/* Key facts bar */}
        <div className="flex border-b border-zinc-800 bg-zinc-800/30">
          {keyFacts.map((f, i) => (
            <div key={i} className="flex-1 py-2 text-center border-r border-zinc-800 last:border-r-0">
              <div className="text-lg font-bold text-[#E8520E]">{f.value}</div>
              <div className="text-[10px] text-zinc-500">{f.label}</div>
            </div>
          ))}
        </div>

        <div className="p-5">
          {/* Chapter tabs */}
          {chapters.length > 1 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto">
              {chapters.map((ch, i) => (
                <button
                  key={i}
                  onClick={() => setActiveChapter(i)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs transition-colors ${
                    activeChapter === i ? "bg-[#E8520E] text-white" : "bg-zinc-800 text-zinc-400 hover:text-white"
                  }`}
                >
                  {ch.title}
                </button>
              ))}
            </div>
          )}

          {/* Active chapter content */}
          {chapters[activeChapter] && (
            <div className="mb-5">
              {chapters[activeChapter].subtitle && (
                <p className="text-xs text-zinc-500 mb-2">{chapters[activeChapter].subtitle}</p>
              )}
              <div className="text-sm leading-relaxed text-zinc-300 whitespace-pre-line">
                {chapters[activeChapter].content}
              </div>
            </div>
          )}

          {/* YouTube */}
          {props.videoId && (
            <div className="mb-5">
              <YouTubeThumbnail videoId={props.videoId} videoTitle={props.videoTitle} />
            </div>
          )}

          {/* Key people */}
          {keyPeople.length > 0 && (
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-3">Key People</p>
              <div className="flex gap-6">
                {keyPeople.map((p, i) => (
                  <StoryPersonCard key={i} name={p.name} role={p.role} imageUrl={p.imageUrl} />
                ))}
              </div>
            </div>
          )}

          {/* Sources */}
          {sources.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Sources</p>
              <div className="flex flex-wrap gap-3">
                {sources.map((s, i) => (
                  <a key={i} href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:underline">{s.name}</a>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 border-t border-zinc-800 pt-4">
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-md border border-green-800 bg-green-900/30 px-2.5 py-1 text-[11px] text-green-400 hover:bg-green-900/50 transition-colors">▶ Spotify</a>
            <SlackSendButton label={`"${props.title}" story`} />
            <button onClick={() => injectChatMessage(`/influence ${mainArtist}`)} className="inline-flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] text-zinc-400 hover:border-zinc-500 transition-colors">Influence →</button>
          </div>
        </div>
      </div>
    );
  },
});
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/openui/components.tsx
git commit -m "feat: add StoryCard OpenUI component with magazine desktop + accordion mobile layouts"
```

---

## Task 2: Register StoryCard in library and add prompt example

**Files:**
- Modify: `src/lib/openui/library.ts`

- [ ] **Step 1: Add import**

Add `StoryCard` to the import from `"./components"`:

```typescript
  StoryCard,
```

- [ ] **Step 2: Add to components array**

Add `StoryCard` to the `components` array in `createLibrary`:

```typescript
    StoryCard,
```

- [ ] **Step 3: Add component group**

Add a new component group after the "Connected Services" group:

```typescript
    {
      name: "Stories & Deep Dives",
      components: ["StoryCard"],
      notes: [
        "Use StoryCard when the user asks about the story, history, making, or origin of an album, artist, genre, event, or label.",
        "StoryCard is for NARRATIVE content — stories with chapters, context, and human interest. NOT for simple facts (use ArtistCard) or connections (use InfluenceChain).",
        "Include a YouTube videoId when you find a relevant documentary, interview, or performance video.",
        "Include keyPeople for anyone mentioned who the user might want to explore further.",
        "Each chapter should be 2-4 paragraphs. 3-5 chapters is ideal.",
      ],
    },
```

- [ ] **Step 4: Add prompt example**

Add to the `examples` array:

```typescript
    `root = StoryCard("Donuts", "J Dilla · 2006 · Stones Throw Records", "https://upload.wikimedia.org/wikipedia/en/5/54/J_Dilla_-_Donuts.jpg", "The Story Behind", "[{\\"label\\":\\"tracks\\",\\"value\\":\\"31\\"},{\\"label\\":\\"samples\\",\\"value\\":\\"34\\"},{\\"label\\":\\"minutes\\",\\"value\\":\\"43\\"},{\\"label\\":\\"RS 500\\",\\"value\\":\\"#386\\"}]", "[{\\"title\\":\\"The Health Crisis\\",\\"subtitle\\":\\"How TTP changed everything\\",\\"content\\":\\"In early 2002, J Dilla was diagnosed with TTP, a rare blood disease. His condition deteriorated over three years, eventually confining him to Cedars-Sinai Medical Center.\\"},{\\"title\\":\\"The Recording\\",\\"subtitle\\":\\"Hospital bed, Boss SP-303\\",\\"content\\":\\"Despite his declining health, Dilla recorded using a portable sampler brought to his hospital room. His mother Ma Dukes brought vinyl records and massaged his swollen hands so he could work.\\"}]", "aiqK2rFEXHc", "J Dilla — Still Shining Documentary", "[{\\"name\\":\\"Ma Dukes\\",\\"role\\":\\"Mother\\"},{\\"name\\":\\"Madlib\\",\\"role\\":\\"Collaborator\\"},{\\"name\\":\\"Questlove\\",\\"role\\":\\"Advocate\\"}]", "[{\\"name\\":\\"Wikipedia\\",\\"url\\":\\"https://en.wikipedia.org/wiki/Donuts_(album)\\"},{\\"name\\":\\"Classic Album Sundays\\",\\"url\\":\\"https://classicalbumsundays.com/j-dilla-donuts/\\"}]")`,
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 6: Commit**

```bash
git add src/lib/openui/library.ts
git commit -m "feat: register StoryCard in OpenUI library with component group and prompt example"
```

---

## Task 3: Add StoryCard rules to system prompt

**Files:**
- Modify: `src/lib/openui/prompt.ts`

- [ ] **Step 1: Add StoryCard usage rules**

Find the `### Rules` section in the prompt string. Add after the existing rules:

```typescript
`- Use StoryCard when the user asks about the story, history, making, or origin of an album, artist, genre, event, or label. StoryCard is for NARRATIVE content with chapters and human interest.`,
`- Do NOT use StoryCard for simple factual lookups (use ArtistCard) or connection mapping (use InfluenceChain).`,
`- For StoryCard: include a YouTube videoId when you find a documentary or interview. Include keyPeople for anyone the user might want to explore. 3-5 chapters, 2-4 paragraphs each.`,
```

- [ ] **Step 2: Add StoryCard to the component documentation section**

Find where components are documented in the prompt (the section listing each component with its signature). Add:

```typescript
`**StoryCard(title, subtitle, heroImageUrl, category, keyFacts, chapters, videoId?, videoTitle?, keyPeople?, sources)**`,
`Rich narrative music story. \`keyFacts\`, \`chapters\`, \`keyPeople\`, and \`sources\` are JSON string arrays. Use for "what's the story behind...", "tell me about the making of...", "history of..." queries.`,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/openui/prompt.ts
git commit -m "feat: add StoryCard usage rules and documentation to system prompt"
```

---

## Task 4: Build verification and deploy

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 3: Push and deploy**

```bash
git push origin main
npx vercel --prod
```

---

## Verification checklist

### Desktop (magazine layout)
- [ ] Hero image renders with gradient overlay and title
- [ ] Category label shows in orange uppercase
- [ ] Key facts bar shows stats
- [ ] Chapter tabs switch content
- [ ] YouTube thumbnail shows with play button overlay
- [ ] Tapping play loads the iframe
- [ ] Key people show with auto-fetched images
- [ ] "Deep Dive →" injects chat message
- [ ] Sources are clickable links
- [ ] Spotify, Slack, Influence buttons work

### Mobile (accordion layout)
- [ ] Compact header with album art + title + fact chips
- [ ] Chapters expand/collapse one at a time
- [ ] YouTube section expands with thumbnail
- [ ] Key people section expands with horizontal scroll
- [ ] Action buttons have touch-friendly sizing

### Agent behavior
- [ ] "What's the story behind Donuts?" → agent renders StoryCard
- [ ] "Tell me about Madlib" → agent renders ArtistCard (not StoryCard)
- [ ] "/influence Flying Lotus" → agent renders InfluenceChain (not StoryCard)
