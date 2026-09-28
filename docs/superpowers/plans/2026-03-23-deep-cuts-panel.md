# Deep Cuts Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the basic artifact slide-in with a resizable Deep Cuts panel featuring dropdown navigation, context-aware action buttons, and public share/publish functionality.

**Architecture:** Split the workspace into two resizable panes (chat + Deep Cuts) with a drag handle. Deep Cuts panel has a dropdown selector for switching between items, contextual action buttons (Spotify, Slack, Publish), and a public share page at `/cuts/[shareId]`. Type detection determines which actions are available per Deep Cut.

**Tech Stack:** Next.js 14 (App Router), React, Convex, Clerk, OpenUI (`@openuidev/react-lang`), nanoid, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-23-deep-cuts-panel-design.md`

**Working directory:** `/Users/tarikmoody/Documents/Projects/crate-web`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/deep-cut-utils.ts` | `detectDeepCutType()` and type color map — shared utility |
| `src/components/workspace/deep-cuts-panel.tsx` | Resizable panel with header, dropdown selector, action bar, content renderer |
| `convex/shares.ts` | Share CRUD: create, getByShareId, getByArtifact, listByUser, unpublish |
| `src/app/api/cuts/publish/route.ts` | Publish API — creates share record, returns public URL |
| `src/app/cuts/[shareId]/page.tsx` | Public share page — renders Deep Cut with smart buttons + CTA |

### Modified Files
| File | Change |
|------|--------|
| `convex/schema.ts` | Add `shares` table with indexes |
| `src/components/workspace/artifact-provider.tsx` | Add `publish`, `isSaving`, `currentType` to context |
| `src/app/w/[sessionId]/page.tsx` | Replace `ArtifactSlideIn` with `DeepCutsPanel`, update toggle button text |
| `package.json` | Add `nanoid` dependency |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/workspace/artifact-slide-in.tsx` | Replaced by `deep-cuts-panel.tsx` |

---

## Chunk 1: Foundation

### Task 1: Install nanoid and Add Shares Schema

**Files:**
- Modify: `package.json`
- Modify: `convex/schema.ts`

- [ ] **Step 1: Install nanoid**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
npm install nanoid
```

- [ ] **Step 2: Add shares table to Convex schema**

In `convex/schema.ts`, add after the `userSkills` table definition:

```typescript
  shares: defineTable({
    shareId: v.string(),
    artifactId: v.id("artifacts"),
    userId: v.id("users"),
    label: v.string(),
    type: v.string(),
    data: v.string(),
    isPublic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_share_id", ["shareId"])
    .index("by_user", ["userId"])
    .index("by_artifact", ["artifactId"]),
```

- [ ] **Step 3: Deploy Convex**

```bash
npx convex deploy --yes
```

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json convex/schema.ts
git commit -m "chore: add nanoid, add shares table to Convex schema"
```

---

### Task 2: Create Deep Cut Utils

**Files:**
- Create: `src/lib/deep-cut-utils.ts`

- [ ] **Step 1: Create the utility file**

```typescript
/**
 * Shared utilities for Deep Cuts (saved research artifacts).
 * Used by both the panel component and the artifact provider.
 */

export type DeepCutType = "influence" | "playlist" | "showprep" | "artist" | "other";

/** Detect the Deep Cut type from OpenUI Lang content. */
export function detectDeepCutType(content: string): DeepCutType {
  if (content.includes("InfluenceChain(") || content.includes("InfluencePathTrace(")) return "influence";
  if (content.includes("TrackList(") || content.includes("SpotifyPlaylist(") || content.includes("SpotifyPlaylists(")) return "playlist";
  if (content.includes("ShowPrepPackage(")) return "showprep";
  if (content.includes("ArtistCard(") || content.includes("ArtistProfileCard(")) return "artist";
  return "other";
}

/** Color map for Deep Cut type dots. */
export const DEEP_CUT_COLORS: Record<DeepCutType, string> = {
  influence: "#8b5cf6",
  playlist: "#22c55e",
  showprep: "#f59e0b",
  artist: "#06b6d4",
  other: "#71717a",
};

/** Tailwind classes for Deep Cut type dots. */
export const DEEP_CUT_DOT_CLASSES: Record<DeepCutType, string> = {
  influence: "bg-violet-500",
  playlist: "bg-green-500",
  showprep: "bg-amber-500",
  artist: "bg-cyan-500",
  other: "bg-zinc-500",
};

/** Human-readable labels for Deep Cut types. */
export const DEEP_CUT_LABELS: Record<DeepCutType, string> = {
  influence: "Influence",
  playlist: "Playlist",
  showprep: "Show Prep",
  artist: "Artist",
  other: "Research",
};

/**
 * Action buttons that should appear for each Deep Cut type.
 * - spotify: "Open in Spotify" link (always safe)
 * - spotifyExport: "Export to Spotify" (auth required)
 * - slack: "Send to Slack" (auth required)
 * - publish: "Publish" share link
 */
export type ActionKey = "spotify" | "spotifyExport" | "slack" | "publish";

export const DEEP_CUT_ACTIONS: Record<DeepCutType, ActionKey[]> = {
  influence: ["spotifyExport", "slack", "publish"],
  playlist: ["spotify", "slack", "publish"],
  showprep: ["slack", "publish"],
  artist: ["spotify", "slack", "publish"],
  other: ["publish"],
};
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/deep-cut-utils.ts
git commit -m "feat: add Deep Cut type detection and action mapping utilities"
```

---

### Task 3: Create Convex Shares Functions

**Files:**
- Create: `convex/shares.ts`

- [ ] **Step 1: Create the shares module**

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    shareId: v.string(),
    artifactId: v.id("artifacts"),
    userId: v.id("users"),
    label: v.string(),
    type: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("shares", {
      ...args,
      isPublic: true,
      createdAt: Date.now(),
    });
  },
});

export const getByShareId = query({
  args: { shareId: v.string() },
  handler: async (ctx, { shareId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_share_id", (q) => q.eq("shareId", shareId))
      .first();
  },
});

export const getByArtifact = query({
  args: { artifactId: v.id("artifacts") },
  handler: async (ctx, { artifactId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_artifact", (q) => q.eq("artifactId", artifactId))
      .first();
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("shares")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const unpublish = mutation({
  args: { shareId: v.id("shares") },
  handler: async (ctx, { shareId }) => {
    await ctx.db.patch(shareId, {
      isPublic: false,
    });
  },
});
```

- [ ] **Step 2: Deploy Convex**

```bash
npx convex deploy --yes
```

- [ ] **Step 3: Commit**

```bash
git add convex/shares.ts
git commit -m "feat: add Convex shares CRUD for Deep Cuts publish/share"
```

---

## Chunk 2: Panel Component

### Task 4: Update Artifact Provider

**Files:**
- Modify: `src/components/workspace/artifact-provider.tsx`

- [ ] **Step 1: Add imports and type detection**

Add at the top, after existing imports:

```typescript
import { detectDeepCutType, type DeepCutType } from "@/lib/deep-cut-utils";
```

- [ ] **Step 2: Add `currentType` and `isSaving` to the context interface**

Update the `ArtifactContextValue` interface:

```typescript
interface ArtifactContextValue {
  current: Artifact | null;
  currentType: DeepCutType;
  history: Artifact[];
  setArtifact: (content: string) => void;
  selectArtifact: (id: string) => void;
  clear: () => void;
  showPanel: boolean;
  dismissPanel: () => void;
  openPanel: () => void;
  isSaving: boolean;
}
```

- [ ] **Step 3: Add state and derive type**

Inside `ArtifactProvider`, add:

```typescript
const [isSaving, setIsSaving] = useState(false);
```

Add after the `current` state is used:

```typescript
const currentType = current ? detectDeepCutType(current.content) : "other";
```

- [ ] **Step 4: Update `setArtifact` to track saving state**

Replace the `setArtifact` callback to wrap the save with `isSaving`:

```typescript
const setArtifact = useCallback(
  (content: string) => {
    const label = extractLabel(content);
    setCurrent({ id: "pending", label, content, timestamp: Date.now() });
    setShowPanel(true);
    setIsSaving(true);

    if (sessionId && user) {
      hashContent(content).then((contentHash) => {
        if (savedHashesRef.current.has(contentHash)) {
          setIsSaving(false);
          return;
        }
        savedHashesRef.current.add(contentHash);
        createArtifact({
          sessionId,
          userId: user._id,
          type: "openui",
          label,
          data: content,
          contentHash,
        }).then(() => setIsSaving(false));
      });
    } else {
      setIsSaving(false);
    }
  },
  [sessionId, user, createArtifact],
);
```

- [ ] **Step 5: Update the provider value**

```typescript
value={{ current, currentType, history, setArtifact, selectArtifact, clear, showPanel, dismissPanel, openPanel, isSaving }}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/components/workspace/artifact-provider.tsx
git commit -m "feat: add currentType, isSaving to artifact provider context"
```

---

### Task 5: Create Deep Cuts Panel

**Files:**
- Create: `src/components/workspace/deep-cuts-panel.tsx`

This is the largest task. The panel has three sections: header with dropdown + actions, and content area.

- [ ] **Step 1: Create the panel component**

```typescript
"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import { useArtifact } from "./artifact-provider";
import {
  DEEP_CUT_DOT_CLASSES,
  DEEP_CUT_LABELS,
  DEEP_CUT_ACTIONS,
  detectDeepCutType,
  type ActionKey,
} from "@/lib/deep-cut-utils";

function injectChatMessage(msg: string) {
  const input = document.querySelector<HTMLTextAreaElement>("textarea");
  if (input) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    nativeSet?.call(input, msg);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

/** Action button for the panel header */
function ActionButton({
  action,
  label,
  onClick,
  disabled,
}: {
  action: ActionKey;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles: Record<ActionKey, string> = {
    spotify: "border-green-800 bg-green-900/30 text-green-400 hover:bg-green-900/50",
    spotifyExport: "border-green-800 bg-green-900/30 text-green-400 hover:bg-green-900/50",
    slack: "border-purple-800 bg-purple-900/30 text-purple-400 hover:bg-purple-900/50",
    publish: "border-cyan-800 bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50",
  };
  const icons: Record<ActionKey, string> = {
    spotify: "▶",
    spotifyExport: "▶",
    slack: "⧉",
    publish: "⤴",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors disabled:opacity-40 ${styles[action]}`}
    >
      <span>{icons[action]}</span>
      {label}
    </button>
  );
}

export function DeepCutsPanel() {
  const { current, currentType, history, selectArtifact, showPanel, dismissPanel, isSaving } = useArtifact();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Reset published URL when current changes
  useEffect(() => {
    setPublishedUrl(null);
  }, [current?.id]);

  if (!showPanel || !current) return null;

  const actions = DEEP_CUT_ACTIONS[currentType];

  async function handlePublish() {
    if (!current || current.id === "pending" || isSaving) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/cuts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: current.id }),
      });
      const data = await res.json();
      if (data.url) {
        setPublishedUrl(data.url);
        await navigator.clipboard.writeText(data.url);
      }
    } catch {
      // silent fail
    } finally {
      setPublishing(false);
    }
  }

  function handleAction(action: ActionKey) {
    switch (action) {
      case "spotify":
        injectChatMessage(`Open the ${current!.label} in Spotify`);
        break;
      case "spotifyExport":
        injectChatMessage(`Export "${current!.label}" to Spotify as a playlist`);
        break;
      case "slack":
        injectChatMessage(`Send the "${current!.label}" to Slack`);
        break;
      case "publish":
        handlePublish();
        break;
    }
  }

  const actionLabels: Record<ActionKey, string> = {
    spotify: "Spotify",
    spotifyExport: "Export",
    slack: "Slack",
    publish: publishedUrl ? "Copied!" : publishing ? "..." : "Publish",
  };

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Dropdown trigger */}
          <div ref={dropdownRef} className="relative flex-1 min-w-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className={`h-2 w-2 shrink-0 rounded-full ${DEEP_CUT_DOT_CLASSES[currentType]}`} />
              <span className="truncate text-sm font-medium text-zinc-200">
                {current.label}
              </span>
              <svg className="h-3 w-3 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
              {history.length > 1 && (
                <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">
                  {history.length}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
                {history.map((item) => {
                  const type = detectDeepCutType(item.content);
                  const isActive = item.id === current.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        selectArtifact(item.id);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isActive ? "bg-zinc-700" : "hover:bg-zinc-700/50"
                      }`}
                    >
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${DEEP_CUT_DOT_CLASSES[type]}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs ${isActive ? "text-white font-medium" : "text-zinc-300"}`}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-zinc-600">{DEEP_CUT_LABELS[type]}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-zinc-600">
                        {timeAgo(item.timestamp)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {actions.map((action) => (
              <ActionButton
                key={action}
                action={action}
                label={actionLabels[action]}
                onClick={() => handleAction(action)}
                disabled={action === "publish" && (isSaving || current.id === "pending" || !!publishedUrl)}
              />
            ))}
            <button
              onClick={dismissPanel}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
              aria-label="Close panel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Published URL toast */}
        {publishedUrl && (
          <div className="mt-1 flex items-center gap-2 rounded bg-cyan-900/30 px-2 py-1 text-[10px] text-cyan-400">
            <span>Link copied!</span>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="underline">
              {publishedUrl}
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Renderer library={crateLibrary} response={current.content} isStreaming={false} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/deep-cuts-panel.tsx
git commit -m "feat: create Deep Cuts panel with dropdown selector and action buttons"
```

---

### Task 6: Wire Panel into Session Page with Resize

**Files:**
- Modify: `src/app/w/[sessionId]/page.tsx`
- Delete: `src/components/workspace/artifact-slide-in.tsx`

- [ ] **Step 1: Replace the session page**

Replace the entire content of `src/app/w/[sessionId]/page.tsx`:

```typescript
"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { ArtifactProvider, useArtifact } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { DeepCutsPanel } from "@/components/workspace/deep-cuts-panel";

const STORAGE_KEY = "deep-cuts-width";
const DEFAULT_WIDTH = 55; // percent
const MIN_WIDTH = 30;
const MAX_WIDTH = 70;

function ResizableWorkspace() {
  const { history, showPanel, openPanel } = useArtifact();
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseFloat(stored))) : DEFAULT_WIDTH;
  });
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const totalWidth = rect.width;
      const panelPx = rect.right - e.clientX;
      const pct = (panelPx / totalWidth) * 100;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, pct));
      setPanelWidth(clamped);
    }

    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(panelWidth));
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [panelWidth]);

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Chat */}
      <div
        className="relative overflow-hidden"
        style={{ width: showPanel ? `${100 - panelWidth}%` : "100%" }}
      >
        <ChatPanel />

        {/* Toggle button */}
        {!showPanel && history.length > 0 && (
          <button
            onClick={openPanel}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg backdrop-blur transition hover:border-zinc-600 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Deep Cuts ({history.length})
          </button>
        )}
      </div>

      {/* Resize handle */}
      {showPanel && (
        <div
          onMouseDown={startDrag}
          className="flex w-1.5 cursor-col-resize items-center justify-center bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-zinc-600" />
        </div>
      )}

      {/* Deep Cuts panel */}
      {showPanel && (
        <div style={{ width: `${panelWidth}%` }}>
          <DeepCutsPanel />
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <ArtifactProvider>
        <ResizableWorkspace />
      </ArtifactProvider>
    </Suspense>
  );
}
```

- [ ] **Step 2: Delete the old slide-in panel**

```bash
rm src/components/workspace/artifact-slide-in.tsx
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/w/\[sessionId\]/page.tsx
git rm src/components/workspace/artifact-slide-in.tsx
git commit -m "feat: resizable Deep Cuts panel replacing artifact slide-in"
```

---

## Chunk 3: Publish & Share

### Task 7: Create Publish API Route

**Files:**
- Create: `src/app/api/cuts/publish/route.ts`

- [ ] **Step 1: Create the route**

```typescript
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import { detectDeepCutType } from "@/lib/deep-cut-utils";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  let body: { artifactId: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.artifactId || body.artifactId === "pending") {
    return Response.json({ error: "Artifact not saved yet" }, { status: 400 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });

  // Check if already published
  const existing = await convex.query(api.shares.getByArtifact, {
    artifactId: body.artifactId as Id<"artifacts">,
  });
  if (existing?.isPublic) {
    const url = `https://digcrate.app/cuts/${existing.shareId}`;
    return Response.json({ shareId: existing.shareId, url, existing: true });
  }

  // Look up the artifact
  const artifact = await convex.query(api.artifacts.getById, {
    id: body.artifactId as Id<"artifacts">,
  });
  if (!artifact) return Response.json({ error: "Artifact not found" }, { status: 404 });

  // Verify ownership
  if (artifact.userId !== user._id) {
    return Response.json({ error: "Not your artifact" }, { status: 403 });
  }

  const shareId = nanoid(10);
  const type = detectDeepCutType(artifact.data);

  await convex.mutation(api.shares.create, {
    shareId,
    artifactId: body.artifactId as Id<"artifacts">,
    userId: user._id,
    label: artifact.label,
    type,
    data: artifact.data,
  });

  const url = `https://digcrate.app/cuts/${shareId}`;
  return Response.json({ shareId, url });
}
```

- [ ] **Step 2: Add `getById` query to artifacts if missing**

Check `convex/artifacts.ts` — if there's no `getById` query, add one. If artifacts doesn't have this file, create it or add to the existing file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cuts/publish/route.ts convex/artifacts.ts
git commit -m "feat: add publish API route for Deep Cuts sharing"
```

---

### Task 8: Create Public Share Page

**Files:**
- Create: `src/app/cuts/[shareId]/page.tsx`

- [ ] **Step 1: Create the share page**

```typescript
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import Link from "next/link";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await convex.query(api.shares.getByShareId, { shareId });

  if (!share || !share.isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Deep Cut Not Found</h1>
          <p className="mt-2 text-zinc-400">This deep cut is no longer available.</p>
          <Link href="/" className="mt-4 inline-block rounded-md bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500">
            Dig Deeper at Crate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/">
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>
      </header>

      {/* Deep Cut content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Renderer library={crateLibrary} response={share.data} isStreaming={false} />
      </main>

      {/* CTA Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center">
        <p className="text-zinc-400">Dig Deeper</p>
        <Link
          href="/sign-up"
          className="mt-3 inline-block rounded-md bg-[#E8520E] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Start Researching with Crate
        </Link>
      </footer>
    </div>
  );
}
```

Note: This is a Server Component — `Renderer` from OpenUI needs to work server-side. If it requires client-side rendering, wrap the Renderer section in a client component:

```typescript
// Create src/app/cuts/[shareId]/share-renderer.tsx as a "use client" component
// that receives `data` as a prop and renders via <Renderer>
```

- [ ] **Step 2: Verify TypeScript compiles and the page renders**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/cuts/
git commit -m "feat: add public share page for Deep Cuts at /cuts/[shareId]"
```

---

## Chunk 4: Final Verification

### Task 9: Build Verification and Deploy

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify build passes**

Run: `npm run build 2>&1 | tail -20`

- [ ] **Step 3: Deploy Convex functions**

```bash
npx convex deploy --yes
```

- [ ] **Step 4: Push to main and deploy**

```bash
git push origin main
npx vercel --prod
```

---

## Verification Checklist

### Panel
- [ ] Panel opens when an OpenUI component renders
- [ ] Dropdown shows all Deep Cuts with type dots and timestamps
- [ ] Clicking a dropdown item switches the displayed Deep Cut
- [ ] Clicking outside dropdown closes it
- [ ] Action buttons change based on Deep Cut type
- [ ] Resize handle works — drag left/right, respects min 30% limits
- [ ] Width persists across page reloads (localStorage)
- [ ] Close button hides panel, toggle button appears
- [ ] Toggle button shows "Deep Cuts (N)" with correct count

### Publish
- [ ] Publish button disabled while artifact is saving ("pending" state)
- [ ] Clicking Publish creates a share and copies URL to clipboard
- [ ] "Copied!" toast shows with the URL
- [ ] Re-publishing same artifact returns existing URL (not a new one)
- [ ] Share page renders at `/cuts/[shareId]` without auth
- [ ] Share page shows Crate logo + Deep Cut + CTA
- [ ] Unpublished shares show "no longer available" message
