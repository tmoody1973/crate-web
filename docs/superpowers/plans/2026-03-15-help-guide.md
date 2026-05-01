# Unified Help Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/docs` and `/guide` with a single persona-adaptive `/help` page accessible via sidebar, chat header, and `/help` slash command.

**Architecture:** Static Next.js page with sidebar nav and scrollable sections. Persona selection persisted in Convex (authenticated) or localStorage (anonymous). Domain-based defaults for team accounts. All content in focused React components — no new dependencies.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind CSS v4, Convex, Clerk

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `convex/schema.ts` | Modify | Add `helpPersona` field to users table |
| `convex/users.ts` | Modify | Add `setHelpPersona` mutation + `getConfiguredKeyNames` query |
| `src/app/help/page.tsx` | Create | Help page route — layout shell with sidebar + main content |
| `src/components/help/help-sidebar.tsx` | Create | Sidebar nav with persona badge, section links, scroll tracking |
| `src/components/help/persona-picker.tsx` | Create | 6-card persona selection with domain defaults |
| `src/components/help/getting-started.tsx` | Create | 3-step onboarding section |
| `src/components/help/persona-guides.tsx` | Create | Workflow guides per persona (show prep, sample digging, etc.) |
| `src/components/help/commands-reference.tsx` | Create | Slash command reference table |
| `src/components/help/sources-list.tsx` | Create | 19 data source cards grid |
| `src/components/help/api-keys-guide.tsx` | Create | Collapsible API key walkthroughs with direct links |
| `src/components/help/prompt-examples.tsx` | Create | Persona-filtered prompt cards |
| `src/components/help/faq.tsx` | Create | Collapsible FAQ section |
| `src/components/workspace/chat-panel.tsx` | Modify | Intercept `/help` client-side, navigate to help page |
| `src/components/sidebar/sidebar-footer.tsx` | Modify | Add Help link before Settings button |
| `src/app/docs/page.tsx` | Modify | Redirect to `/help#commands` |
| `src/app/guide/page.tsx` | Modify | Redirect to `/help` |
| `src/components/landing/nav.tsx` | Modify | Change "Docs" link to "Help" pointing to `/help` |

---

## Chunk 1: Database + Persona Picker

### Task 1: Add helpPersona to Convex schema and users

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/users.ts`

- [ ] **Step 1: Add helpPersona field to users table**

In `convex/schema.ts`, add to the users table definition:

```typescript
helpPersona: v.optional(v.string()),
```

- [ ] **Step 2: Add setHelpPersona mutation to users.ts**

```typescript
export const setHelpPersona = mutation({
  args: {
    clerkId: v.string(),
    helpPersona: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { helpPersona: args.helpPersona });
  },
});
```

- [ ] **Step 3: Note on API key checkmarks**

The spec mentions showing green checkmarks for configured keys. However, keys are stored as an encrypted blob in Convex — individual key names cannot be inspected without decryption (which happens in the API route, not in Convex queries). Skip `getConfiguredKeyNames` for now. The API key cards will show setup instructions without checkmarks. This can be added later by storing a `configuredKeyNames` string array field that gets updated when keys are saved.

- [ ] **Step 4: Push schema changes**

Run: `npx convex dev --once`
Expected: Schema deployed without errors.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat: add helpPersona field and setHelpPersona mutation"
```

---

### Task 2: Create persona picker component

**Files:**
- Create: `src/components/help/persona-picker.tsx`

- [ ] **Step 1: Create the persona picker component**

```tsx
"use client";

// No Convex/Clerk imports needed — persona selection delegated to parent via onSelect prop

export type PersonaId =
  | "new-user"
  | "radio-host"
  | "dj"
  | "collector"
  | "music-lover"
  | "journalist";

interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  icon: string;
}

const PERSONAS: Persona[] = [
  { id: "new-user", name: "New User", description: "Just getting started with Crate", icon: "👋" },
  { id: "radio-host", name: "Radio Host / Music Director", description: "Show prep, interview research, on-air talking points", icon: "🎙️" },
  { id: "dj", name: "DJ / Producer", description: "Sample digging, genre exploration, playlist building", icon: "🎧" },
  { id: "collector", name: "Record Collector", description: "Album research, discographies, collection management", icon: "📀" },
  { id: "music-lover", name: "Music Lover", description: "Artist discovery, playlists, genre deep dives", icon: "🎵" },
  { id: "journalist", name: "Music Journalist", description: "Artist research, influence mapping, publishing", icon: "✍️" },
];

const DOMAIN_PERSONAS: Record<string, PersonaId[]> = {
  "radiomilwaukee.org": ["radio-host", "dj", "journalist"],
};

function getRecommendedPersonas(email: string | undefined): PersonaId[] {
  if (!email) return [];
  const domain = email.split("@")[1];
  if (!domain) return [];
  return DOMAIN_PERSONAS[domain] ?? [];
}

interface PersonaPickerProps {
  onSelect: (persona: PersonaId) => void;
  userEmail?: string;
}

export function PersonaPicker({ onSelect, userEmail }: PersonaPickerProps) {
  const recommended = getRecommendedPersonas(userEmail);

  return (
    <div className="mx-auto max-w-3xl py-12 px-6">
      <h2
        className="text-[48px] font-bold tracking-[-2px] mb-2"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        HOW DO YOU <span style={{ color: "#E8520E" }}>USE MUSIC</span>?
      </h2>
      <p className="text-[16px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Pick your role and we&apos;ll tailor the guide to your workflow.
      </p>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {PERSONAS.map((p) => {
          const isRecommended = recommended.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group relative rounded-xl border p-5 text-left transition-colors hover:border-[#E8520E]"
              style={{
                backgroundColor: "#0f1a2e",
                borderColor: isRecommended ? "#E8520E" : "rgba(245,240,232,0.06)",
              }}
            >
              {isRecommended && (
                <span
                  className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#E8520E", color: "#0A1628" }}
                >
                  Recommended
                </span>
              )}
              <div className="text-2xl mb-2">{p.icon}</div>
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: "#F5F0E8" }}>
                {p.name}
              </h3>
              <p className="text-[13px]" style={{ color: "#7a8a9a" }}>
                {p.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to read/write persona from localStorage for anonymous users
const STORAGE_KEY = "crate-help-persona";

export function getStoredPersona(): PersonaId | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) as PersonaId | null;
}

export function setStoredPersona(persona: PersonaId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, persona);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/help/persona-picker.tsx
git commit -m "feat: create persona picker component with domain defaults"
```

---

## Chunk 2: Help Page Shell + Sidebar

### Task 3: Create help sidebar component

**Files:**
- Create: `src/components/help/help-sidebar.tsx`

- [ ] **Step 1: Create the sidebar component**

```tsx
"use client";

import { useEffect, useState } from "react";
import type { PersonaId } from "./persona-picker";

interface SidebarSection {
  id: string;
  label: string;
}

const PERSONA_SECTIONS: Record<PersonaId, SidebarSection[]> = {
  "new-user": [
    { id: "getting-started", label: "Getting Started" },
  ],
  "radio-host": [
    { id: "getting-started", label: "Getting Started" },
    { id: "show-prep", label: "Show Prep" },
    { id: "interview-research", label: "Interview Research" },
    { id: "influence-mapping", label: "Influence Mapping" },
    { id: "publishing", label: "Publishing" },
  ],
  "dj": [
    { id: "getting-started", label: "Getting Started" },
    { id: "sample-digging", label: "Sample Digging" },
    { id: "genre-exploration", label: "Genre Exploration" },
    { id: "playlist-building", label: "Playlist Building" },
    { id: "bandcamp-discovery", label: "Bandcamp Discovery" },
  ],
  "collector": [
    { id: "getting-started", label: "Getting Started" },
    { id: "collection-management", label: "Collection Management" },
    { id: "album-research", label: "Album Research" },
    { id: "discography-dives", label: "Discography Deep Dives" },
  ],
  "music-lover": [
    { id: "getting-started", label: "Getting Started" },
    { id: "artist-discovery", label: "Artist Discovery" },
    { id: "playlist-creation", label: "Playlist Creation" },
    { id: "genre-exploration", label: "Genre Exploration" },
  ],
  "journalist": [
    { id: "getting-started", label: "Getting Started" },
    { id: "artist-research", label: "Artist Research" },
    { id: "influence-mapping", label: "Influence Mapping" },
    { id: "publishing", label: "Publishing" },
    { id: "source-citations", label: "Source Citations" },
  ],
};

const REFERENCE_SECTIONS: SidebarSection[] = [
  { id: "commands", label: "All Commands" },
  { id: "sources", label: "Data Sources" },
  { id: "api-keys", label: "API Keys Setup" },
  { id: "prompts", label: "Example Prompts" },
  { id: "faq", label: "FAQ" },
];

const PERSONA_LABELS: Record<PersonaId, string> = {
  "new-user": "New User",
  "radio-host": "Radio Host",
  "dj": "DJ / Producer",
  "collector": "Record Collector",
  "music-lover": "Music Lover",
  "journalist": "Journalist",
};

interface HelpSidebarProps {
  persona: PersonaId;
  onChangePersona: () => void;
}

export function HelpSidebar({ persona, onChangePersona }: HelpSidebarProps) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const personaSections = PERSONA_SECTIONS[persona];

  // Track scroll position to highlight active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px" },
    );

    const allSections = [...personaSections, ...REFERENCE_SECTIONS];
    for (const s of allSections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [persona, personaSections]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  return (
    <nav
      className="w-[220px] shrink-0 overflow-y-auto border-r px-4 pb-4 pt-6 max-md:hidden"
      style={{ backgroundColor: "#111", borderColor: "rgba(245,240,232,0.06)" }}
    >
      {/* Persona badge */}
      <div
        className="mb-5 rounded-lg border p-3"
        style={{ backgroundColor: "#1c1917", borderColor: "#44403c" }}
      >
        <div className="text-[10px] uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
          Your role
        </div>
        <div className="mt-0.5 text-[13px] font-semibold" style={{ color: "#E8520E" }}>
          {PERSONA_LABELS[persona]}
        </div>
        <button
          onClick={onChangePersona}
          className="mt-1 text-[11px] hover:underline"
          style={{ color: "#71717a" }}
        >
          Change
        </button>
      </div>

      {/* For You */}
      <SidebarGroup label="For You" sections={personaSections} active={activeSection} onSelect={scrollTo} />

      {/* Reference */}
      <SidebarGroup label="Reference" sections={REFERENCE_SECTIONS} active={activeSection} onSelect={scrollTo} />
    </nav>
  );
}

function SidebarGroup({
  label,
  sections,
  active,
  onSelect,
}: {
  label: string;
  sections: SidebarSection[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <div
        className="mb-2 px-2 text-[10px] uppercase tracking-wider"
        style={{ color: "#71717a" }}
      >
        {label}
      </div>
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="block w-full rounded px-2 py-1.5 text-left text-[13px] transition-colors"
          style={{
            color: active === s.id ? "#fff" : "#d4d4d8",
            backgroundColor: active === s.id ? "#1c1917" : "transparent",
            borderLeft: active === s.id ? "2px solid #E8520E" : "2px solid transparent",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/help/help-sidebar.tsx
git commit -m "feat: create help sidebar with persona sections and scroll tracking"
```

---

### Task 4: Create the help page shell

**Files:**
- Create: `src/app/help/page.tsx`

- [ ] **Step 1: Create the help page route**

```tsx
"use client";

import { useAuth, useUser } from "@clerk/nextjs";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { useState, useEffect } from "react";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { HelpSidebar } from "@/components/help/help-sidebar";
import {
  PersonaPicker,
  getStoredPersona,
  setStoredPersona,
  type PersonaId,
} from "@/components/help/persona-picker";
import { GettingStarted } from "@/components/help/getting-started";
import { PersonaGuides } from "@/components/help/persona-guides";
import { CommandsReference } from "@/components/help/commands-reference";
import { SourcesList } from "@/components/help/sources-list";
import { ApiKeysGuide } from "@/components/help/api-keys-guide";
import { PromptExamples } from "@/components/help/prompt-examples";
import { HelpFaq } from "@/components/help/faq";

export default function HelpPage() {
  const { userId: clerkId } = useAuth();
  const { user: clerkUser } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const setHelpPersona = useMutation(api.users.setHelpPersona);

  const [persona, setPersona] = useState<PersonaId | null>(null);
  const [showPicker, setShowPicker] = useState(false);

  // Load persona on mount
  useEffect(() => {
    if (convexUser?.helpPersona) {
      setPersona(convexUser.helpPersona as PersonaId);
    } else {
      const stored = getStoredPersona();
      if (stored) {
        setPersona(stored);
        // Sync localStorage to Convex if authenticated
        if (clerkId && convexUser && !convexUser.helpPersona) {
          setHelpPersona({ clerkId, helpPersona: stored });
        }
      } else {
        setShowPicker(true);
      }
    }
  }, [convexUser, clerkId, setHelpPersona]);

  // Scroll to hash on load
  useEffect(() => {
    if (persona && window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [persona]);

  function handleSelectPersona(selected: PersonaId) {
    setPersona(selected);
    setShowPicker(false);
    setStoredPersona(selected);
    if (clerkId) {
      setHelpPersona({ clerkId, helpPersona: selected });
    }
  }

  const userEmail = clerkUser?.primaryEmailAddress?.emailAddress;

  // Show picker if no persona selected
  if (showPicker || !persona) {
    return (
      <main style={{ backgroundColor: "#0A1628", minHeight: "100vh" }}>
        <Nav />
        <PersonaPicker onSelect={handleSelectPersona} userEmail={userEmail} />
      </main>
    );
  }

  return (
    <main style={{ backgroundColor: "#0A1628", minHeight: "100vh" }}>
      <Nav />
      <div className="flex" style={{ minHeight: "calc(100vh - 64px)" }}>
        <HelpSidebar
          persona={persona}
          onChangePersona={() => setShowPicker(true)}
        />
        <div className="flex-1 overflow-y-auto px-10 py-10 max-md:px-5">
          <GettingStarted persona={persona} />
          <PersonaGuides persona={persona} />
          <CommandsReference />
          <SourcesList />
          <ApiKeysGuide clerkId={clerkId ?? undefined} />
          <PromptExamples persona={persona} />
          <HelpFaq />
        </div>
      </div>
      <Footer />
    </main>
  );
}
```

- [ ] **Step 2: Create stub components so the page compiles**

Create minimal stubs for each component that doesn't exist yet. Each stub is a `<section>` with an `id` and placeholder text:

For each of these files, create a stub:
- `src/components/help/getting-started.tsx`
- `src/components/help/persona-guides.tsx`
- `src/components/help/commands-reference.tsx`
- `src/components/help/sources-list.tsx`
- `src/components/help/api-keys-guide.tsx`
- `src/components/help/prompt-examples.tsx`
- `src/components/help/faq.tsx`

Stub pattern (example for getting-started.tsx):
```tsx
import type { PersonaId } from "./persona-picker";

export function GettingStarted({ persona }: { persona: PersonaId }) {
  return (
    <section id="getting-started" className="mb-16">
      <h2 className="text-[28px] font-bold mb-4" style={{ color: "#F5F0E8" }}>
        Getting Started
      </h2>
      <p style={{ color: "#7a8a9a" }}>Coming soon.</p>
    </section>
  );
}
```

For `api-keys-guide.tsx`, use props `{ clerkId?: string }`.
For `prompt-examples.tsx` and `persona-guides.tsx`, use props `{ persona: PersonaId }`.
For `commands-reference.tsx`, `sources-list.tsx`, and `faq.tsx`, use no props.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Run dev server and verify page loads**

Run: `npm run dev` and navigate to `http://localhost:3000/help`
Expected: Persona picker shows. Clicking a card shows sidebar + stub sections.

- [ ] **Step 5: Commit**

```bash
git add src/app/help/page.tsx src/components/help/
git commit -m "feat: create help page shell with persona picker and sidebar navigation"
```

---

## Chunk 3: Content Sections

### Task 5: Implement Getting Started section

**Files:**
- Modify: `src/components/help/getting-started.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
import type { PersonaId } from "./persona-picker";

const PERSONA_PROMPTS: Record<PersonaId, string> = {
  "new-user": "Tell me about Flying Lotus — who is he and what should I listen to first?",
  "radio-host": "Prep a 4-track set for my evening show — start with Khruangbin and build from there",
  "dj": "Find what samples Madlib used on Shades of Blue and show me related tracks",
  "collector": "Show me the full Stones Throw Records discography from 2000-2010",
  "music-lover": "Create a playlist of artists similar to Hiatus Kaiyote",
  "journalist": "/influence Flying Lotus — map his musical influences with sources",
};

export function GettingStarted({ persona }: { persona: PersonaId }) {
  const examplePrompt = PERSONA_PROMPTS[persona];

  const steps = [
    {
      number: 1,
      title: "Add your API key",
      description:
        "Open Settings (click the gear icon or press Shift+S) and paste your Anthropic API key. This is the only required key — everything else is optional.",
      link: { label: "Get an Anthropic key", url: "https://console.anthropic.com" },
    },
    {
      number: 2,
      title: "Ask your first question",
      description: "Try something like:",
      prompt: examplePrompt,
    },
    {
      number: 3,
      title: "Explore the results",
      description:
        "Crate generates interactive components — track lists with play buttons, artist cards, influence chains, album grids. Click to play, save to playlists, or publish your research.",
    },
  ];

  return (
    <section id="getting-started" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        GETTING STARTED
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Set up Crate and run your first research query in under 3 minutes.
      </p>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-xl border p-5"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold"
                style={{ backgroundColor: "#E8520E", color: "#0A1628" }}
              >
                {step.number}
              </div>
              <h3 className="text-[17px] font-semibold" style={{ color: "#F5F0E8" }}>
                {step.title}
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed mb-3" style={{ color: "#a1a1aa" }}>
              {step.description}
            </p>
            {step.prompt && (
              <div
                className="rounded-lg border px-4 py-3 font-mono text-[13px]"
                style={{
                  backgroundColor: "#0a0a0a",
                  borderColor: "rgba(245,240,232,0.1)",
                  color: "#d4d4d8",
                }}
              >
                &ldquo;{step.prompt}&rdquo;
              </div>
            )}
            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[13px] hover:underline"
                style={{ color: "#E8520E" }}
              >
                {step.link.label} &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/help/getting-started.tsx
git commit -m "feat: implement Getting Started section with persona-specific prompts"
```

---

### Task 6: Implement Commands Reference section

**Files:**
- Modify: `src/components/help/commands-reference.tsx`

- [ ] **Step 1: Replace stub with full implementation**

```tsx
const COMMANDS = [
  {
    name: "/show-prep",
    aliases: ["/prep", "/showprep"],
    description: "Generate a full show prep package with track context, talk breaks, and social copy.",
    example: "/show-prep 4 tracks starting with Khruangbin for HYFIN evening show",
  },
  {
    name: "/influence",
    aliases: [],
    description: "Map musical influences for an artist using review co-mentions and source citations.",
    example: "/influence Flying Lotus",
  },
  {
    name: "/publish",
    aliases: [],
    description: "Publish the last research response to Telegraph or Tumblr.",
    example: "/publish",
  },
  {
    name: "/published",
    aliases: [],
    description: "View your published research articles.",
    example: "/published",
  },
  {
    name: "/radio",
    aliases: [],
    description: "Play a live radio stream by genre, country, or station name.",
    example: "/radio jazz",
  },
  {
    name: "/news",
    aliases: [],
    description: "Get the latest music news from multiple sources.",
    example: "/news hip-hop",
  },
  {
    name: "/help",
    aliases: [],
    description: "Open this help guide. Supports deep linking to sections.",
    example: "/help api-keys",
  },
];

export function CommandsReference() {
  return (
    <section id="commands" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        ALL COMMANDS
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Type these in the chat input. Start with / to see the autocomplete menu.
      </p>

      <div className="space-y-3">
        {COMMANDS.map((cmd) => (
          <div
            key={cmd.name}
            className="rounded-xl border p-4 transition-colors hover:border-[#E8520E]"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-baseline gap-3 mb-2">
              <code className="text-[15px] font-bold" style={{ color: "#E8520E" }}>
                {cmd.name}
              </code>
              {cmd.aliases.length > 0 && (
                <span className="text-[11px]" style={{ color: "#71717a" }}>
                  aliases: {cmd.aliases.join(", ")}
                </span>
              )}
            </div>
            <p className="text-[14px] mb-2" style={{ color: "#a1a1aa" }}>
              {cmd.description}
            </p>
            <div
              className="rounded border px-3 py-2 font-mono text-[12px]"
              style={{
                backgroundColor: "#0a0a0a",
                borderColor: "rgba(245,240,232,0.1)",
                color: "#E8520E",
              }}
            >
              {cmd.example}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/help/commands-reference.tsx
git commit -m "feat: implement commands reference section"
```

---

### Task 7: Implement Sources List section

**Files:**
- Modify: `src/components/help/sources-list.tsx`

- [ ] **Step 1: Replace stub with full implementation**

Use the 19 data sources from the spec. Each card shows: name, what it provides, and whether a key is needed (with badge).

```tsx
const SOURCES = [
  { name: "Discogs", data: "Releases, labels, credits, cover art", key: "Embedded (free)" },
  { name: "MusicBrainz", data: "Artist metadata, relationships, recordings", key: "No key needed" },
  { name: "Last.fm", data: "Similar artists, tags, listening stats", key: "Embedded (free)" },
  { name: "Genius", data: "Lyrics, annotations, song metadata", key: "User key" },
  { name: "Bandcamp", data: "Album search, tag exploration, related tags", key: "No key needed" },
  { name: "WhoSampled", data: "Sample origins, covers, remixes", key: "Embedded (Kernel)" },
  { name: "Wikipedia", data: "Artist bios, discography context", key: "No key needed" },
  { name: "Ticketmaster", data: "Concert listings, ticket availability", key: "Embedded (free)" },
  { name: "Spotify", data: "Album/artist artwork (640x640)", key: "User key" },
  { name: "fanart.tv", data: "HD artist backgrounds, logos, album covers", key: "User key" },
  { name: "iTunes", data: "Album artwork (600x600), track search", key: "No key needed" },
  { name: "AllMusic", data: "Reviews, ratings, style classifications", key: "No key needed" },
  { name: "Pitchfork", data: "Reviews (via 26-publication search)", key: "No key needed" },
  { name: "Rate Your Music", data: "Community ratings and lists", key: "No key needed" },
  { name: "Setlist.fm", data: "Live setlist history", key: "No key needed" },
  { name: "YouTube", data: "Music videos, live performances", key: "Embedded" },
  { name: "Exa.ai", data: "Semantic web search", key: "User key" },
  { name: "Tavily", data: "AI-optimized web search", key: "User key" },
  { name: "Mem0", data: "Cross-session user memory", key: "User key" },
];

function keyBadgeColor(key: string): string {
  if (key.startsWith("No key")) return "#22c55e";
  if (key.startsWith("Embedded")) return "#3b82f6";
  return "#f59e0b";
}

export function SourcesList() {
  return (
    <section id="sources" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        DATA SOURCES
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        The agent queries these 19 sources during research. Most work without any setup.
      </p>

      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {SOURCES.map((s) => (
          <div
            key={s.name}
            className="rounded-lg border p-4"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[15px] font-semibold" style={{ color: "#F5F0E8" }}>
                {s.name}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: keyBadgeColor(s.key), color: "#0A1628" }}
              >
                {s.key}
              </span>
            </div>
            <p className="text-[13px]" style={{ color: "#7a8a9a" }}>
              {s.data}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/help/sources-list.tsx
git commit -m "feat: implement data sources grid with key requirement badges"
```

---

### Task 8: Implement API Keys Guide section

**Files:**
- Modify: `src/components/help/api-keys-guide.tsx`

- [ ] **Step 1: Replace stub with full implementation**

Collapsible cards grouped by tier. Each card has a "Get key" link and expandable steps.

```tsx
"use client";

import { useState } from "react";

interface KeyGuide {
  name: string;
  providerUrl: string;
  steps: string[];
  unlocks: string;
}

const REQUIRED: KeyGuide[] = [
  {
    name: "Anthropic",
    providerUrl: "https://console.anthropic.com",
    steps: [
      "Go to console.anthropic.com and sign in (or create an account).",
      "Click \"API Keys\" in the left sidebar.",
      "Click \"Create Key\", give it a name, and copy the key.",
      "In Crate, open Settings (Shift+S) and paste the key into the Anthropic field.",
    ],
    unlocks: "Required to use Crate. Powers the AI research agent.",
  },
];

const RECOMMENDED: KeyGuide[] = [
  {
    name: "OpenRouter",
    providerUrl: "https://openrouter.ai/keys",
    steps: [
      "Go to openrouter.ai/keys and sign in.",
      "Click \"Create Key\" and copy it.",
      "In Crate Settings, paste into the OpenRouter field.",
    ],
    unlocks: "Unlocks GPT-4o, Gemini 2.5, Llama 4, DeepSeek R1, Mistral Large.",
  },
  {
    name: "Genius",
    providerUrl: "https://genius.com/api-clients",
    steps: [
      "Go to genius.com/api-clients and sign in.",
      "Click \"New API Client\" and fill in any app name and URL.",
      "Copy the \"Client Access Token\" (not the secret).",
    ],
    unlocks: "Lyrics, song annotations, and artist metadata.",
  },
  {
    name: "Spotify",
    providerUrl: "https://developer.spotify.com/dashboard",
    steps: [
      "Go to developer.spotify.com/dashboard and sign in.",
      "Click \"Create App\" — name it anything, set redirect URI to http://localhost.",
      "Copy both the Client ID and Client Secret.",
    ],
    unlocks: "High-resolution album and artist artwork (640x640).",
  },
  {
    name: "Mem0",
    providerUrl: "https://app.mem0.ai/dashboard",
    steps: [
      "Go to app.mem0.ai and sign in.",
      "Copy the API key from your dashboard.",
    ],
    unlocks: "Cross-session memory — the agent remembers your preferences between sessions.",
  },
];

const OPTIONAL: KeyGuide[] = [
  {
    name: "Tavily",
    providerUrl: "https://tavily.com",
    steps: [
      "Go to tavily.com and create an account.",
      "Copy the API key from your dashboard.",
    ],
    unlocks: "AI-optimized web search for deeper research.",
  },
  {
    name: "Exa",
    providerUrl: "https://exa.ai",
    steps: [
      "Go to exa.ai and create an account.",
      "Go to Settings and copy your API key.",
    ],
    unlocks: "Semantic web search — finds content by meaning, not just keywords.",
  },
  {
    name: "Tumblr",
    providerUrl: "https://www.tumblr.com/oauth/apps",
    steps: [
      "Go to tumblr.com/oauth/apps and sign in.",
      "Click \"Register application\" and fill in the form.",
      "Copy the OAuth consumer key.",
    ],
    unlocks: "Publish research directly to your Tumblr blog.",
  },
  {
    name: "fanart.tv",
    providerUrl: "https://fanart.tv/get-an-api-key/",
    steps: [
      "Go to fanart.tv/get-an-api-key and register.",
      "Copy your personal API key.",
    ],
    unlocks: "HD artist backgrounds, logos, and album covers.",
  },
];

export function ApiKeysGuide({ clerkId }: { clerkId?: string }) {
  return (
    <section id="api-keys" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        API KEYS SETUP
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Add keys to unlock more data sources and models. Only Anthropic is required.
      </p>

      <KeyTier label="Required" color="#ef4444" keys={REQUIRED} />
      <KeyTier label="Recommended" color="#f59e0b" keys={RECOMMENDED} />
      <KeyTier label="Optional" color="#71717a" keys={OPTIONAL} />
    </section>
  );
}

function KeyTier({ label, color, keys }: { label: string; color: string; keys: KeyGuide[] }) {
  return (
    <div className="mb-8">
      <div
        className="mb-3 text-[12px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      <div className="space-y-3">
        {keys.map((k) => (
          <KeyCard key={k.name} guide={k} tierColor={color} />
        ))}
      </div>
    </div>
  );
}

function KeyCard({ guide, tierColor }: { guide: KeyGuide; tierColor: string }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="text-[15px] font-semibold" style={{ color: "#F5F0E8" }}>
            {guide.name}
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "#7a8a9a" }}>
            {guide.unlocks}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={guide.providerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] font-semibold hover:underline"
            style={{ color: "#E8520E" }}
          >
            Get key &rarr;
          </a>
          <span
            className="text-[14px] transition-transform"
            style={{ color: "#71717a", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            &#9660;
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "rgba(245,240,232,0.06)" }}>
          <ol className="space-y-2">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[13px]" style={{ color: "#a1a1aa" }}>
                <span className="font-bold shrink-0" style={{ color: "#E8520E" }}>
                  {i + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify and commit**

Run: `npx tsc --noEmit 2>&1 | head -20`

```bash
git add src/components/help/api-keys-guide.tsx
git commit -m "feat: implement API keys guide with collapsible walkthroughs and direct links"
```

---

### Task 9: Implement Persona Guides, Prompt Examples, and FAQ

**Files:**
- Modify: `src/components/help/persona-guides.tsx`
- Modify: `src/components/help/prompt-examples.tsx`
- Modify: `src/components/help/faq.tsx`

- [ ] **Step 1: Implement persona-guides.tsx**

Each persona gets 3-4 workflow guides. Each guide: title, description, example prompt, what the agent does, tips. Content is organized as a data structure at the top of the file. Use the same card style (`#18181b` bg, `rgba(245,240,232,0.06)` border, `#E8520E` accent). Only show guides for the current persona. Each guide is a `<section>` with its own `id` matching the sidebar links (e.g., `id="show-prep"`, `id="sample-digging"`).

Guide content to write for each persona:
- **Radio Host**: Show Prep (how /show-prep works), Interview Research (deep background queries), Influence Mapping (/influence command), Publishing (/publish to Telegraph/Tumblr)
- **DJ**: Sample Digging (WhoSampled queries), Genre Exploration (Bandcamp tags), Playlist Building (TrackList generation), Bandcamp Discovery (search_bandcamp deep dives)
- **Collector**: Collection Management (AlbumGrid + save), Album Research (full album deep dives), Discography Deep Dives (label/era exploration)
- **Music Lover**: Artist Discovery (ArtistCard generation), Playlist Creation (TrackList), Genre Exploration (tag-based discovery)
- **Journalist**: Artist Research (comprehensive profiles), Influence Mapping (/influence), Publishing (/publish), Source Citations (ReviewSourceCard)

- [ ] **Step 2: Implement prompt-examples.tsx**

12+ example prompts as clickable cards. Each card has a prompt string and a one-line description. Filter by persona relevance — show matching prompts first, then "More examples" section with the rest. Copy to clipboard on click with brief toast/feedback.

- [ ] **Step 3: Implement faq.tsx**

Collapsible Q&A cards. Questions:
1. What models can I use?
2. Is my API key stored securely?
3. Can I share keys with my team?
4. What data sources are free?
5. How does influence mapping work?
6. Can I publish my research?
7. How do playlists work?
8. What is a Crate (project)?
9. Does the agent remember previous conversations?
10. How do I get help?

Use the same expand/collapse pattern as API keys.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/components/help/persona-guides.tsx src/components/help/prompt-examples.tsx src/components/help/faq.tsx
git commit -m "feat: implement persona guides, prompt examples, and FAQ sections"
```

---

## Chunk 4: Entry Points + Redirects

### Task 10: Wire /help command in chat and add sidebar link

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx`
- Modify: `src/components/sidebar/sidebar.tsx`
- Modify: `src/components/landing/nav.tsx`

- [ ] **Step 1: Intercept /help in chat-panel.tsx**

Find the section where `/setup` is intercepted (around lines 598-648). Add the same pattern for `/help`:

```typescript
// In the input handler where slash commands are intercepted:
if (trimmedInput === "/help" || trimmedInput.startsWith("/help ")) {
  const arg = trimmedInput.replace("/help", "").trim();
  const hash = arg ? `#${arg.replace(/\s+/g, "-")}` : "";
  window.location.href = `/help${hash}`;
  setInput("");
  return;
}
```

Also add `/help` to the `SlashCommandMenu` entries so it appears in autocomplete:

```typescript
{ name: "/help", description: "Open the help guide" }
```

- [ ] **Step 2: Add Help link to sidebar footer**

In `src/components/sidebar/sidebar-footer.tsx` (NOT `sidebar.tsx`), add a Help link before the Settings button. Find the `{!collapsed && (` block and add the Help link before the settings button:

```tsx
{!collapsed && (
  <div className="flex items-center gap-1">
    <a
      href="/help"
      target="_blank"
      rel="noopener noreferrer"
      className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
      aria-label="Help"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 17h.01" />
      </svg>
    </a>
    <button ... > {/* existing Settings button */}
  </div>
)}
```

- [ ] **Step 3: Update nav links**

In `src/components/landing/nav.tsx`, replace both "DOCS" and "GUIDE" links with a single "HELP" link:

Find:
```typescript
  { label: "DOCS", href: "/docs" },
  { label: "GUIDE", href: "/guide" },
```
Replace with:
```typescript
  { label: "HELP", href: "/help" },
```

- [ ] **Step 4: Change ChatHeader "?" button to navigate to /help by default**

The spec says: "?" button navigates to `/help` by default, but still opens QuickStartWizard when triggered by a 400 "no API key" error.

In `src/components/workspace/chat-panel.tsx`, modify the `ChatHeader` component. The current `onOpenSetup` always opens the wizard. Change the button's `onClick` to navigate to `/help` instead:

```tsx
function ChatHeader({ onOpenSetup }: { onOpenSetup?: () => void }) {
  // ... existing hasOpenRouter logic ...

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
      <ModelSelector hasOpenRouter={hasOpenRouter} />
      <button
        type="button"
        onClick={() => window.open("/help", "_blank")}
        title="Help guide"
        className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-800 hover:text-zinc-300"
      >
        {/* existing ? icon SVG */}
      </button>
    </div>
  );
}
```

The `onOpenSetup` prop remains available — it's still called from the error-recovery flow in the main component (the `handleOpenSetup` function triggered by 400 errors). The ChatHeader just no longer uses it for the default click.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/components/workspace/chat-panel.tsx src/components/sidebar/sidebar-footer.tsx src/components/landing/nav.tsx
git commit -m "feat: wire /help command, sidebar link, and nav link"
```

---

### Task 11: Add redirects for /docs and /guide

**Files:**
- Modify: `src/app/docs/page.tsx`
- Modify: `src/app/guide/page.tsx`

- [ ] **Step 1: Redirect /docs to /help#commands**

Hash fragments are client-side only — `redirect()` from `next/navigation` won't preserve them. Use a client component instead:

Replace `src/app/docs/page.tsx` content with:

```tsx
"use client";

import { useEffect } from "react";

export default function DocsPage() {
  useEffect(() => {
    window.location.href = "/help#commands";
  }, []);
  return null;
}
```

- [ ] **Step 2: Redirect /guide to /help**

Replace `src/app/guide/page.tsx` content with:

```tsx
import { redirect } from "next/navigation";

export default function GuidePage() {
  redirect("/help");
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/app/docs/page.tsx src/app/guide/page.tsx
git commit -m "feat: redirect /docs and /guide to unified /help page"
```

---

### Task 12: Build, verify, and push

- [ ] **Step 1: Full build check**

Run: `npx next build 2>&1 | tail -20`
Expected: Build succeeds. `/help` listed as a dynamic route.

- [ ] **Step 2: Manual verification checklist**

Start dev server and verify:
1. `/help` shows persona picker on first visit
2. Selecting a persona shows sidebar + all content sections
3. Clicking sidebar items scrolls to correct section
4. `/docs` redirects to `/help#commands`
5. `/guide` redirects to `/help`
6. Typing `/help` in chat navigates to help page
7. Typing `/help api-keys` navigates to `/help#api-keys`
8. API key cards expand/collapse with direct provider links
9. Mobile: sidebar hidden, content fills width

- [ ] **Step 3: Push**

```bash
git push origin main
```

---

## Verification Summary

1. `npx tsc --noEmit` — clean compile after each task
2. `npx next build` — full build succeeds
3. Persona picker shows for new visitors, persists selection
4. Domain defaults work for `@radiomilwaukee.org`
5. All 7 content sections render with correct data
6. Sidebar scroll tracking highlights active section
7. `/docs` and `/guide` redirect correctly
8. `/help` command works from chat
9. API key walkthroughs have working provider links
10. Mobile responsive — sidebar collapses
