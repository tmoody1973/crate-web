# Quick Start Guide Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quick start wizard modal that walks new users through API key setup, with a Radio Milwaukee variant for team members.

**Architecture:** Client-side modal component in `src/components/onboarding/` renders on the workspace page. Convex tracks onboarding state via an `onboardingCompleted` field on the users table. A verify-key API route checks key validity server-side. The chat panel intercepts "no key" errors and opens the wizard instead of showing the error.

**Tech Stack:** Next.js App Router, React, Convex, Clerk auth, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-14-quick-start-guide-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `convex/schema.ts` | Add `onboardingCompleted` optional boolean to users table |
| `convex/users.ts` | Add `completeOnboarding` mutation |
| `src/components/onboarding/quick-start-wizard.tsx` | Main wizard modal: 3-step flow + Radio Milwaukee variant |
| `src/app/api/verify-key/route.ts` | Clerk-authenticated endpoint that reads saved key from Convex and pings the provider |
| `src/components/workspace/chat-panel.tsx` | Render wizard, intercept "no key" 400 errors, re-send pending message |

---

## Chunk 1: Backend (Convex schema + verify-key endpoint)

### Task 1: Add `onboardingCompleted` to Convex schema and users

**Files:**
- Modify: `convex/schema.ts:5-11` (users table definition)
- Modify: `convex/users.ts` (add mutation)

- [ ] **Step 1: Add `onboardingCompleted` field to users table in schema**

In `convex/schema.ts`, add `onboardingCompleted` to the users table definition:

```typescript
// convex/schema.ts — users table (line 5-11)
users: defineTable({
  clerkId: v.string(),
  email: v.string(),
  name: v.optional(v.string()),
  encryptedKeys: v.optional(v.bytes()),
  onboardingCompleted: v.optional(v.boolean()),
  createdAt: v.number(),
}).index("by_clerk_id", ["clerkId"]),
```

- [ ] **Step 2: Add `completeOnboarding` mutation to `convex/users.ts`**

Append this mutation to the end of `convex/users.ts`:

```typescript
export const completeOnboarding = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
    if (!user) throw new Error("User not found");
    await ctx.db.patch(user._id, { onboardingCompleted: true });
  },
});
```

- [ ] **Step 3: Push schema to Convex dev**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx convex dev --once`
Expected: Schema pushed successfully with the new `onboardingCompleted` field.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts convex/users.ts
git commit -m "feat: add onboardingCompleted field to users schema"
```

---

### Task 2: Create verify-key API route

**Files:**
- Create: `src/app/api/verify-key/route.ts`

- [ ] **Step 1: Create the verify-key route**

```typescript
// src/app/api/verify-key/route.ts
import { auth } from "@clerk/nextjs/server";
import { resolveUserKeys } from "@/lib/resolve-user-keys";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { provider?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { provider } = body;
  if (provider !== "anthropic" && provider !== "openrouter") {
    return NextResponse.json(
      { error: "provider must be 'anthropic' or 'openrouter'" },
      { status: 400 },
    );
  }

  let resolved;
  try {
    resolved = await resolveUserKeys(clerkId);
  } catch {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const { rawKeys, hasAnthropic, hasOpenRouter } = resolved;

  if (provider === "anthropic" && !hasAnthropic) {
    return NextResponse.json({
      valid: false,
      error: "No Anthropic key found. Save your key first.",
    });
  }
  if (provider === "openrouter" && !hasOpenRouter) {
    return NextResponse.json({
      valid: false,
      error: "No OpenRouter key found. Save your key first.",
    });
  }

  // Ping the provider with a minimal request
  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": rawKeys.anthropic,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
      });

      if (res.ok) {
        return NextResponse.json({ valid: true });
      }

      const detail = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        return NextResponse.json({
          valid: false,
          error: "This key was rejected. Double-check that you copied the full key.",
        });
      }
      if (res.status === 429) {
        return NextResponse.json({
          valid: false,
          error: "Key works, but your account has no credits. Add credits at console.anthropic.com and try again.",
        });
      }
      return NextResponse.json({
        valid: false,
        error: `Verification failed (${res.status}). ${detail.slice(0, 200)}`,
      });
    }

    // OpenRouter
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rawKeys.openrouter}`,
      },
      body: JSON.stringify({
        model: "anthropic/claude-haiku-4.5",
        max_tokens: 1,
        messages: [{ role: "user", content: "hi" }],
      }),
    });

    if (res.ok) {
      return NextResponse.json({ valid: true });
    }

    const detail = await res.text().catch(() => "");
    if (res.status === 401 || res.status === 403) {
      return NextResponse.json({
        valid: false,
        error: "This key was rejected. Double-check that you copied the full key.",
      });
    }
    if (res.status === 402) {
      return NextResponse.json({
        valid: false,
        error: "Key works, but your account has no credits. Add credits at openrouter.ai/credits and try again.",
      });
    }
    return NextResponse.json({
      valid: false,
      error: `Verification failed (${res.status}). ${detail.slice(0, 200)}`,
    });
  } catch (err) {
    return NextResponse.json({
      valid: false,
      error: `Could not reach ${provider}. Check your connection and try again.`,
    });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `verify-key/route.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/verify-key/route.ts
git commit -m "feat: add verify-key API route for onboarding wizard"
```

---

## Chunk 2: Quick Start Wizard Component

### Task 3: Create the quick-start-wizard component

**Files:**
- Create: `src/components/onboarding/quick-start-wizard.tsx`

This is the main component. It handles both the standard 3-step wizard and the Radio Milwaukee variant, since they share the modal shell, overlay, and completion logic.

- [ ] **Step 1: Create the onboarding directory**

Run: `mkdir -p /Users/tarikmoody/Documents/Projects/crate-web/src/components/onboarding`

- [ ] **Step 2: Create quick-start-wizard.tsx**

```typescript
// src/components/onboarding/quick-start-wizard.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";

// --- Types ---
type Provider = "anthropic" | "openrouter";

interface QuickStartWizardProps {
  /** Start on a specific step (1-indexed). Used when error-intercepted to jump to step 2. */
  initialStep?: number;
  /** User's email for Radio Milwaukee detection */
  userEmail: string;
  /** Whether the user already has a valid key saved */
  hasExistingKey: boolean;
  /** Called when wizard completes or is skipped */
  onComplete: () => void;
  /** Called when wizard completes with a verified key (for re-sending pending message) */
  onKeyVerified?: () => void;
}

// --- Provider step data ---
const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    recommended: true,
    description:
      "Direct access to Claude \u2014 the model Crate was built for. Best tool use and research quality.",
    price: "Pay-as-you-go \u00b7 ~$0.01\u20130.05 per research query",
    prefix: "sk-ant-",
    steps: [
      {
        text: "Go to console.anthropic.com and create an account",
        link: "https://console.anthropic.com/signup",
        linkText: "console.anthropic.com",
      },
      { text: "Add a payment method (credit card required, $5 minimum)" },
      {
        text: "Go to Settings \u2192 API Keys \u2192 Create Key",
        link: "https://console.anthropic.com/settings/keys",
        linkText: "Settings \u2192 API Keys",
      },
      { text: "Copy the key (starts with sk-ant-)" },
    ],
  },
  openrouter: {
    name: "OpenRouter",
    recommended: false,
    description:
      "Access Claude, GPT-4o, Gemini, Llama, and more through one key. Swap models anytime.",
    price: "Pay-as-you-go \u00b7 Prices vary by model",
    prefix: "sk-or-",
    steps: [
      {
        text: "Go to openrouter.ai and create an account",
        link: "https://openrouter.ai/signup",
        linkText: "openrouter.ai",
      },
      {
        text: "Add credits ($5 minimum)",
        link: "https://openrouter.ai/credits",
        linkText: "Credits page",
      },
      {
        text: "Go to Keys \u2192 Create Key",
        link: "https://openrouter.ai/keys",
        linkText: "Keys",
      },
      { text: "Copy the key (starts with sk-or-)" },
    ],
  },
} as const;

const BUILT_IN_SOURCES = [
  { name: "Discogs", what: "Credits & releases" },
  { name: "MusicBrainz", what: "Metadata & IDs" },
  { name: "Last.fm", what: "Tags & similarity" },
  { name: "Spotify", what: "Artwork & audio" },
  { name: "Wikipedia", what: "Artist bios" },
  { name: "YouTube", what: "Video & audio" },
  { name: "Ticketmaster", what: "Live events" },
  { name: "Setlist.fm", what: "Concert setlists" },
  { name: "Bandcamp", what: "Independent music" },
  { name: "iTunes", what: "Album artwork" },
  { name: "fanart.tv", what: "HD artist images" },
  { name: "Radio Browser", what: "30K+ live stations" },
  { name: "Tavily", what: "Web search" },
  { name: "Exa.ai", what: "Deep web search" },
  { name: "26 Publications", what: "Review co-mentions" },
];

const OPTIONAL_SOURCES = [
  { name: "Genius", what: "Lyrics & annotations" },
  { name: "Tumblr", what: "Publish research" },
  { name: "Mem0", what: "Memory persistence" },
  { name: "AgentMail", what: "Email & Slack" },
];

const RM_COMMANDS = [
  {
    command: "/show-prep HYFIN",
    description:
      "Paste your setlist. Crate researches every track and generates talk breaks, social copy, and interview prep.",
  },
  {
    command: "/news hyfin 5",
    description:
      "Generate a 5-story music news segment, researched from RSS feeds and formatted for your station's voice.",
  },
  {
    command: "/influence [artist]",
    description:
      "Map an artist's influence network \u2014 who they were influenced by, who they influenced, with cited evidence.",
  },
  {
    command: "/radio [genre or station]",
    description:
      'Stream any of 30,000+ live radio stations while you research. Try /radio jazz or /radio KEXP.',
  },
];

// --- Detect Radio Milwaukee ---
function isRadioMilwaukee(email: string): boolean {
  return email.toLowerCase().endsWith("@radiomilwaukee.org");
}

// --- Detect provider from key prefix ---
function detectProvider(key: string): Provider | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  return null;
}

// --- Main Component ---
export function QuickStartWizard({
  initialStep = 1,
  userEmail,
  hasExistingKey,
  onComplete,
  onKeyVerified,
}: QuickStartWizardProps) {
  const isRM = isRadioMilwaukee(userEmail);

  // If user already has a key, start at step 3 (or wherever initialStep says)
  const startStep = hasExistingKey ? 3 : initialStep;
  const [step, setStep] = useState(startStep);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [verifyState, setVerifyState] = useState<
    "idle" | "saving" | "verifying" | "verified" | "error"
  >(hasExistingKey ? "verified" : "idle");
  const [errorMessage, setErrorMessage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Escape key to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onComplete]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleSaveAndVerify = useCallback(
    async (key: string) => {
      const provider = detectProvider(key);
      if (!provider) {
        setVerifyState("error");
        setErrorMessage(
          "Key should start with sk-ant- (Anthropic) or sk-or- (OpenRouter)",
        );
        return;
      }

      // Save key
      setVerifyState("saving");
      try {
        const saveRes = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: provider, value: key }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({ error: "Save failed" }));
          setVerifyState("error");
          setErrorMessage(err.error || "Failed to save key");
          return;
        }
      } catch {
        setVerifyState("error");
        setErrorMessage("Network error saving key. Check your connection.");
        return;
      }

      // Verify key
      setVerifyState("verifying");
      try {
        const verifyRes = await fetch("/api/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const result = await verifyRes.json();
        if (result.valid) {
          setVerifyState("verified");
          onKeyVerified?.();
        } else {
          setVerifyState("error");
          setErrorMessage(result.error || "Verification failed");
        }
      } catch {
        setVerifyState("error");
        setErrorMessage("Could not verify key. Check your connection.");
      }
    },
    [onKeyVerified],
  );

  // Auto-verify on paste (when input looks complete)
  useEffect(() => {
    if (keyInput.length > 20 && verifyState === "idle") {
      handleSaveAndVerify(keyInput);
    }
  }, [keyInput, verifyState, handleSaveAndVerify]);

  const handleFinish = () => {
    onComplete();
  };

  // --- Radio Milwaukee variant ---
  if (isRM) {
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        {/* Modal */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className="fixed inset-0 z-[51] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-[520px] rounded-xl border border-zinc-700 bg-[#1a1a1a] shadow-2xl">
            {/* Header */}
            <div className="p-8 pb-0">
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[22px] font-bold text-white">
                  Welcome, Radio Milwaukee
                </h2>
                <span className="rounded bg-[#E8520E] px-3 py-1 text-[11px] font-bold tracking-wider text-white">
                  TEAM
                </span>
              </div>
              <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Your API keys are already configured by your team admin. You're
                ready to go. Here's what Crate can do for your shows:
              </p>

              {/* Command cards */}
              <div className="space-y-2.5">
                {RM_COMMANDS.map((cmd) => (
                  <div
                    key={cmd.command}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-3.5"
                  >
                    <code className="rounded bg-zinc-900 px-2 py-0.5 text-[13px] font-semibold text-[#E8520E]">
                      {cmd.command}
                    </code>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      {cmd.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tip */}
              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/80 p-3.5">
                <p className="text-xs leading-relaxed text-zinc-400">
                  <strong className="text-zinc-300">Tip:</strong> You can also
                  just ask questions naturally &mdash; &quot;What Ethiopian jazz
                  records influenced UK broken beat?&quot; Crate searches across
                  20+ databases and cites everything.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-700 px-8 py-4 mt-6">
              <button
                onClick={onComplete}
                className="text-[13px] text-zinc-500 hover:text-zinc-300"
              >
                Got it
              </button>
              <button
                onClick={handleFinish}
                className="rounded-md bg-[#E8520E] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Start Digging &rarr;
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // --- Standard 3-step wizard ---
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="fixed inset-0 z-[51] flex items-center justify-center p-4"
      >
        <div className="flex w-full max-w-[520px] max-h-[90vh] flex-col rounded-xl border border-zinc-700 bg-[#1a1a1a] shadow-2xl overflow-hidden">
          {/* Step tabs */}
          <div className="flex border-b border-zinc-700">
            {["WELCOME", "GET YOUR KEY", "CONNECT"].map((label, i) => {
              const n = i + 1;
              const isActive = step === n;
              const isDone = step > n;
              return (
                <button
                  key={label}
                  onClick={() => n <= step && setStep(n)}
                  className={`flex-1 py-3.5 text-center text-xs tracking-wide transition ${
                    isActive
                      ? "border-b-2 border-[#E8520E] text-[#E8520E]"
                      : isDone
                        ? "text-green-400"
                        : "text-zinc-600"
                  }`}
                >
                  <span
                    className={`mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-5 ${
                      isActive
                        ? "border-[#E8520E] bg-[#E8520E] text-white"
                        : isDone
                          ? "border-green-400 bg-green-400 text-black"
                          : "border-current"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Step content — scrollable */}
          <div className="flex-1 overflow-y-auto p-7">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Welcome to Crate
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Your AI music research workspace. Ask any question &mdash;
                  Crate queries 20+ databases and gives you cited, verified
                  answers.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: "\uD83D\uDD0D",
                      title: "Deep Research",
                      desc: "Discogs, MusicBrainz, Genius, Last.fm, Spotify, and more \u2014 all at once.",
                    },
                    {
                      icon: "\uD83C\uDFB5",
                      title: "Built-in Player",
                      desc: "YouTube playback and 30,000+ live radio stations while you research.",
                    },
                    {
                      icon: "\uD83C\uDF10",
                      title: "Influence Mapping",
                      desc: "Trace artist connections across decades with cited evidence from 26 publications.",
                    },
                    {
                      icon: "\uD83D\uDCE1",
                      title: "Show Prep",
                      desc: "Generate talk breaks, social copy, and news segments for your radio show.",
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-4"
                    >
                      <div className="mb-2 text-2xl">{card.icon}</div>
                      <h4 className="mb-1 text-[13px] font-semibold text-white">
                        {card.title}
                      </h4>
                      <p className="text-[11px] leading-snug text-zinc-400">
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Get Your Key */}
            {step === 2 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Get your AI key
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Crate needs an AI key to power the research agent. All 20+
                  music data sources are already built in &mdash; you just need
                  one of these:
                </p>

                {/* Provider cards */}
                {(["anthropic", "openrouter"] as Provider[]).map((id) => {
                  const p = PROVIDERS[id];
                  const isSelected = selectedProvider === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedProvider(id)}
                      className={`mb-3 w-full rounded-xl border-2 p-5 text-left transition ${
                        isSelected
                          ? "border-[#E8520E] bg-[#E8520E]/5"
                          : "border-zinc-700 bg-zinc-800/80 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">
                          {p.name}
                        </h3>
                        {p.recommended && (
                          <span className="rounded bg-[#E8520E] px-2 py-0.5 text-[10px] font-semibold text-white">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] text-zinc-400">
                        {p.description}
                      </p>
                      <p className="mt-3 text-xs font-medium text-[#E8520E]">
                        {p.price}
                      </p>
                      <ol className="mt-3 list-decimal space-y-2 pl-4">
                        {p.steps.map((s, i) => (
                          <li
                            key={i}
                            className="text-[13px] leading-relaxed text-zinc-300"
                          >
                            {s.link ? (
                              <>
                                {s.text.split(s.linkText!)[0]}
                                <a
                                  href={s.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#E8520E] underline"
                                >
                                  {s.linkText}
                                </a>
                                {s.text.split(s.linkText!)[1]}
                              </>
                            ) : (
                              s.text
                            )}
                          </li>
                        ))}
                      </ol>
                    </button>
                  );
                })}

                {/* Expandable extras */}
                <button
                  type="button"
                  onClick={() => setExtrasOpen(!extrasOpen)}
                  className="mt-5 flex w-full items-center gap-2 rounded-lg border border-zinc-700 bg-[#1a1a1a] px-4 py-3.5 text-left text-[13px] text-white transition hover:border-zinc-600"
                >
                  <span
                    className={`text-[10px] text-zinc-500 transition-transform ${extrasOpen ? "rotate-90" : ""}`}
                  >
                    &#9654;
                  </span>
                  <span>Already included &amp; optional extras</span>
                  <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    20+ ACTIVE
                  </span>
                </button>

                {extrasOpen && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-zinc-700">
                    {/* Built-in */}
                    <div className="p-4">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-400">
                        Built in &mdash; no key needed
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BUILT_IN_SOURCES.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 rounded bg-[#1a1a1a] px-2 py-1.5"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                            <div>
                              <div className="text-[11px] font-semibold text-zinc-300">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {s.what}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <hr className="border-zinc-700" />
                    {/* Optional */}
                    <div className="p-4">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E8520E]">
                        Optional &mdash; add your own key in Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {OPTIONAL_SOURCES.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 rounded bg-[#1a1a1a] px-2 py-1.5"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8520E]" />
                            <div>
                              <div className="text-[11px] font-semibold text-zinc-300">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {s.what}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                        These services are free or have free tiers. Add keys
                        anytime in Settings to unlock them.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Connect */}
            {step === 3 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Paste your key
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Paste the API key you just created. Your key is encrypted and
                  never shared.
                </p>

                {/* Key input */}
                {!hasExistingKey && (
                  <div className="mb-4">
                    <label htmlFor="api-key-input" className="mb-1.5 block text-xs uppercase tracking-wide text-zinc-400">
                      API Key
                    </label>
                    <input
                      id="api-key-input"
                      type="text"
                      value={keyInput}
                      onChange={(e) => {
                        setKeyInput(e.target.value);
                        if (verifyState === "error") setVerifyState("idle");
                      }}
                      placeholder="sk-ant-... or sk-or-..."
                      className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3.5 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-[#E8520E]"
                      autoFocus
                    />
                  </div>
                )}

                {/* Verification status */}
                {verifyState === "saving" && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 p-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                    <span className="text-[13px] text-yellow-400">
                      Saving key...
                    </span>
                  </div>
                )}
                {verifyState === "verifying" && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 p-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                    <span className="text-[13px] text-yellow-400">
                      Verifying key...
                    </span>
                  </div>
                )}
                {verifyState === "verified" && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/30 p-3"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-[13px] text-green-400">
                      Key verified &mdash; you&apos;re all set!
                    </span>
                  </div>
                )}
                {verifyState === "error" && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/30 p-3"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-[13px] text-red-400">
                      {errorMessage}
                    </span>
                  </div>
                )}

                {/* Try your first query */}
                {verifyState === "verified" && (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-4">
                    <h4 className="mb-2 text-[13px] font-semibold text-white">
                      Try your first query:
                    </h4>
                    <p className="text-[13px] leading-relaxed text-zinc-400">
                      Type something like{" "}
                      <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[#E8520E]">
                        &quot;Who influenced Flying Lotus?&quot;
                      </code>{" "}
                      or use{" "}
                      <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[#E8520E]">
                        /influence Madlib
                      </code>{" "}
                      for a deep dive.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-700 px-7 py-4">
            <button
              onClick={onComplete}
              className="text-[13px] text-zinc-500 hover:text-zinc-300"
            >
              I&apos;ll set up later
            </button>
            <button
              onClick={step === 3 ? handleFinish : handleNext}
              className="rounded-md bg-[#E8520E] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {step === 3 ? "Start Digging \u2192" : "Next \u2192"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 3: Verify it compiles**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/onboarding/quick-start-wizard.tsx
git commit -m "feat: add QuickStartWizard onboarding component"
```

---

## Chunk 3: Integration into ChatPanel

### Task 4: Wire wizard into chat-panel.tsx with error intercept

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx`

The integration points:
1. Lift user query into ChatPanel (currently in ChatPersistence at line 737) to share it for both onboarding and message persistence
2. Show wizard on first sign-in or when API returns "no key" error
3. Store pending message and re-send after key verified (via React state, not DOM events)

- [ ] **Step 1: Add imports and wizard state to `ChatPanel` component**

At the top of `chat-panel.tsx`, add the import (after the existing imports around line 26):

```typescript
import { QuickStartWizard } from "@/components/onboarding/quick-start-wizard";
```

- [ ] **Step 2: Lift user query into `ChatPanel` and add wizard state**

In the `ChatPanel` function (starts at line 820), add `useAuth` + `useQuery` for the user record. This replaces the duplicate calls in `ChatPersistence` (which will receive `user` as a prop instead). Add wizard state after the player refs:

```typescript
export function ChatPanel() {
  const [steps, setSteps] = useState<ToolStep[]>([]);
  const { play } = usePlayer();
  const playRef = useRef(play);

  // --- User query (shared by onboarding wizard + ChatPersistence) ---
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");

  // --- Onboarding wizard state ---
  const completeOnboarding = useMutation(api.users.completeOnboarding);
  const [showWizard, setShowWizard] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const pendingMessageRef = useRef<string | null>(null);
  const keyVerifiedRef = useRef(false);
  // Message to re-send after wizard completes with a verified key
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  // Show wizard on first sign-in (user loaded, onboarding not completed)
  useEffect(() => {
    if (user && user.onboardingCompleted !== true) {
      setShowWizard(true);
    }
  }, [user]);

  // Check if user already has keys saved
  const [hasExistingKey, setHasExistingKey] = useState(false);
  useEffect(() => {
    if (!showWizard) return;
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => {
        const keys = data.keys || {};
        setHasExistingKey(
          Boolean(keys.anthropic || keys.openrouter),
        );
      })
      .catch(() => {});
  }, [showWizard]);
```

- [ ] **Step 2b: Update `ChatPersistence` to receive `user` as a prop**

Modify the `ChatPersistence` function signature and remove its duplicate `useAuth`/`useQuery` calls. Change:

```typescript
// Before (lines 732-737):
function ChatPersistence() {
  const { messages, isRunning } = useThread();
  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");

// After:
function ChatPersistence({ user }: { user: { _id: Id<"users"> } | null | undefined }) {
  const { messages, isRunning } = useThread();
  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
```

And update the `<ChatPersistence />` usage in the return JSX to pass the user prop:

```typescript
<ChatPersistence user={user} />
```

- [ ] **Step 3: Modify `processMessage` to intercept "no key" errors**

Replace the existing `processMessage` callback (lines 864-887) with one that intercepts 400 "key required" errors:

```typescript
  const processMessage = useCallback(
    async ({ messages, abortController }: { threadId: string; messages: Array<{ role: string; content?: unknown }>; abortController: AbortController }) => {
      setSteps([]);

      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const parts = getContentParts(lastUserMsg?.content);
      const messageText = parts
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      const model = getStoredModel();

      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, model }),
        signal: abortController.signal,
      });

      // Intercept "no API key" error — open wizard instead of showing error
      if (res.status === 400) {
        try {
          const cloned = res.clone();
          const body = await cloned.json();
          if (body.error && body.error.includes("API key is required")) {
            pendingMessageRef.current = messageText;
            setWizardInitialStep(2);
            setShowWizard(true);
            // Return a synthetic empty response so ChatProvider doesn't error
            return new Response(
              `data: ${JSON.stringify({ type: "done", totalMs: 0, toolsUsed: [], toolCallCount: 0, costUsd: 0 })}\n\ndata: "[DONE]"\n\n`,
              { headers: { "Content-Type": "text/event-stream" } },
            );
          }
        } catch {
          // If we can't parse, fall through to normal error handling
        }
      }

      return res;
    },
    [],
  );
```

- [ ] **Step 4: Add wizard rendering and completion handlers**

In the `ChatPanel` return JSX, wrap the existing content and add the wizard overlay. The return block (around line 889) becomes:

```typescript
  const handleWizardComplete = useCallback(async () => {
    setShowWizard(false);
    // Only re-send pending message if key was actually verified
    if (keyVerifiedRef.current && pendingMessageRef.current) {
      setResendMessage(pendingMessageRef.current);
      pendingMessageRef.current = null;
      keyVerifiedRef.current = false;
    } else {
      pendingMessageRef.current = null;
    }
    if (clerkId) {
      try {
        await completeOnboarding({ clerkId });
      } catch {
        // Non-critical — wizard still dismisses
      }
    }
  }, [clerkId, completeOnboarding]);

  const handleKeyVerified = useCallback(() => {
    keyVerifiedRef.current = true;
  }, []);

  return (
    <ToolActivityContext.Provider value={{ steps }}>
      <ChatProvider processMessage={processMessage} streamProtocol={adapter}>
        <div className="flex h-full flex-col bg-zinc-950">
          <ChatHeader />
          <ChatHydration />
          <ChatMessages />
          <ChatInput resendMessage={resendMessage} onResendConsumed={() => setResendMessage(null)} />
          <ChatPersistence user={user} />
        </div>
        {showWizard && user && (
          <QuickStartWizard
            initialStep={wizardInitialStep}
            userEmail={user.email}
            hasExistingKey={hasExistingKey}
            onComplete={handleWizardComplete}
            onKeyVerified={handleKeyVerified}
          />
        )}
      </ChatProvider>
    </ToolActivityContext.Provider>
  );
```

- [ ] **Step 5: Add resend props to ChatInput**

Update the `ChatInput` function signature to accept `resendMessage` and `onResendConsumed` props, and add an effect to auto-submit when a resend message arrives:

```typescript
function ChatInput({ resendMessage, onResendConsumed }: { resendMessage?: string | null; onResendConsumed?: () => void }) {
```

Then add this effect after the existing `useEffect` calls (around line 567):

```typescript
  // Re-send a pending message after wizard completion
  useEffect(() => {
    if (resendMessage) {
      processMessage({
        role: "user",
        content: [{ type: "text", text: resendMessage }],
      });
      onResendConsumed?.();
    }
  }, [resendMessage, processMessage, onResendConsumed]);
```

- [ ] **Step 6: Verify it compiles**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add src/components/workspace/chat-panel.tsx
git commit -m "feat: integrate quick start wizard into chat panel with error intercept"
```

---

## Chunk 4: Manual testing checklist

### Task 5: Manual verification

- [ ] **Step 1: Start dev server**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npm run dev`

- [ ] **Step 2: Test first sign-in flow**

1. Open the app in an incognito window or with a new user account
2. After signing in, the wizard should appear immediately
3. Step through Welcome → Get Your Key → Connect
4. Verify the expandable extras section works on Step 2
5. Paste a valid API key on Step 3 — should show "Key verified"
6. Click "Start Digging" — wizard closes, `onboardingCompleted` is set in Convex
7. Refresh — wizard should NOT appear again

- [ ] **Step 3: Test error intercept flow**

1. Sign in with a user who has `onboardingCompleted: true` but no API keys
2. Type a message and send it
3. The wizard should open at Step 2 (not Step 1)
4. Add a key and verify
5. After closing, the original message should re-send automatically

- [ ] **Step 4: Test Radio Milwaukee flow**

1. Sign in with a `@radiomilwaukee.org` email
2. The Radio Milwaukee variant should appear (single screen, TEAM badge, slash commands)
3. Both "Got it" and "Start Digging" should dismiss the modal

- [ ] **Step 5: Test skip behavior**

1. Click "I'll set up later" — wizard closes
2. User can still use the app (will get error on first message if no key)
3. Refresh — wizard should NOT appear again (`onboardingCompleted` was set)

- [ ] **Step 6: Final build check**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npm run build 2>&1 | tail -20`
Expected: Build succeeds.

- [ ] **Step 7: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found during manual testing"
```
