# Sidebar, Persistent Chat & Artifacts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform Crate Web from a stateless chat into a persistent music research workspace with a Claude-style sidebar, persistent chat history in Convex, full-text search, and an artifact panel that slides in on demand.

**Architecture:** Convex is the persistence layer (real-time queries, search indexes). Clerk scopes all data by user. The current `SplitPane` (always-visible 40/60 split) is replaced by a full-width chat that yields space when an artifact slides in from the right. The `Navbar` is replaced by a collapsible sidebar. All existing components (ChatPanel, ArtifactsPanel, artifact-provider) are modified rather than replaced.

**Tech Stack:** Next.js 15, Convex, Clerk, OpenUI (@openuidev/react-lang), Tailwind CSS v4, react-resizable-panels

---

## Dependency Graph

```
Task 1 (Schema) ──► Task 2 (Convex Functions) ──► Task 3 (Sidebar Shell)
                                                      │
                                                      ▼
                                            Task 4 (Session Hook)
                                                      │
                                         ┌────────────┼────────────┐
                                         ▼            ▼            ▼
                                   Task 5        Task 6       Task 7
                                 (Chat         (Artifact    (Sidebar
                                 Persist)      Persist)     Sections)
                                         │            │            │
                                         ▼            ▼            ▼
                                   Task 8        Task 9       Task 10
                                 (Slide-In)    (Search)    (Keyboard
                                                           Shortcuts)
                                                      │
                                                      ▼
                                               Task 11
                                             (Cleanup &
                                              Polish)
```

---

### Task 1: Convex Schema Changes

**Files:**
- Modify: `convex/schema.ts`

**Context:** The existing schema has `sessions`, `messages`, `artifacts` tables but lacks: `crates` table, starred/crate fields on sessions, userId/label/hash fields on artifacts, and search indexes.

**Step 1: Add `crates` table and update existing tables**

Replace the entire `convex/schema.ts` with:

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    encryptedKeys: v.optional(v.bytes()),
    createdAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),

  crates: defineTable({
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_user", ["userId"]),

  sessions: defineTable({
    userId: v.id("users"),
    crateId: v.optional(v.id("crates")),
    title: v.optional(v.string()),
    isShared: v.boolean(),
    isStarred: v.boolean(),
    isArchived: v.boolean(),
    lastMessageAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_starred", ["userId", "isStarred"])
    .index("by_user_crate", ["userId", "crateId"])
    .index("by_user_recent", ["userId", "lastMessageAt"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .searchIndex("search_content", {
      searchField: "content",
      filterFields: ["sessionId"],
    }),

  artifacts: defineTable({
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    label: v.string(),
    data: v.string(),
    contentHash: v.string(),
    createdAt: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_user", ["userId"]),

  toolCalls: defineTable({
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    args: v.string(),
    result: v.optional(v.string()),
    status: v.union(
      v.literal("running"),
      v.literal("complete"),
      v.literal("error"),
    ),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
  }).index("by_session", ["sessionId"]),

  playerQueue: defineTable({
    sessionId: v.id("sessions"),
    tracks: v.array(
      v.object({
        title: v.string(),
        artist: v.string(),
        source: v.union(v.literal("youtube"), v.literal("bandcamp")),
        sourceId: v.string(),
        imageUrl: v.optional(v.string()),
      }),
    ),
    currentIndex: v.number(),
  }).index("by_session", ["sessionId"]),
});
```

**Step 2: Push schema to Convex**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx convex dev --once`

Expected: Schema deployed successfully. Existing data will get `undefined` for new optional fields — this is fine, Convex handles optional fields gracefully.

**Step 3: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add crates table, session/artifact fields, search index"
```

---

### Task 2: Convex Functions (CRUD)

**Files:**
- Create: `convex/crates.ts`
- Modify: `convex/sessions.ts`
- Modify: `convex/messages.ts`
- Modify: `convex/artifacts.ts`

**Context:** We need CRUD for crates, updated session queries (starred, recents, by crate), a search function for messages, and artifact functions that include userId/label/hash.

**Step 1: Create `convex/crates.ts`**

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
    name: v.string(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("crates", {
      userId: args.userId,
      name: args.name,
      color: args.color,
      createdAt: Date.now(),
    });
  },
});

export const list = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("crates")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const rename = mutation({
  args: { id: v.id("crates"), name: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { name: args.name });
  },
});

export const remove = mutation({
  args: { id: v.id("crates") },
  handler: async (ctx, args) => {
    // Unassign all sessions in this crate first
    const sessions = await ctx.db
      .query("sessions")
      .filter((q) => q.eq(q.field("crateId"), args.id))
      .collect();
    for (const session of sessions) {
      await ctx.db.patch(session._id, { crateId: undefined });
    }
    await ctx.db.delete(args.id);
  },
});
```

**Step 2: Update `convex/sessions.ts`**

Replace entire file:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    return await ctx.db.insert("sessions", {
      userId: args.userId,
      isShared: false,
      isStarred: false,
      isArchived: false,
      lastMessageAt: now,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const listRecent = query({
  args: { userId: v.id("users"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 20;
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_recent", (q) => q.eq("userId", args.userId))
      .order("desc")
      .filter((q) => q.eq(q.field("isArchived"), false))
      .take(limit);
  },
});

export const listStarred = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_starred", (q) =>
        q.eq("userId", args.userId).eq("isStarred", true),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

export const listByCrate = query({
  args: { userId: v.id("users"), crateId: v.id("crates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user_crate", (q) =>
        q.eq("userId", args.userId).eq("crateId", args.crateId),
      )
      .filter((q) => q.eq(q.field("isArchived"), false))
      .collect();
  },
});

export const get = query({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const updateTitle = mutation({
  args: {
    id: v.id("sessions"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      title: args.title,
      updatedAt: Date.now(),
    });
  },
});

export const toggleStar = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(args.id, { isStarred: !session.isStarred });
  },
});

export const assignToCrate = mutation({
  args: {
    id: v.id("sessions"),
    crateId: v.optional(v.id("crates")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      crateId: args.crateId,
      updatedAt: Date.now(),
    });
  },
});

export const archive = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      isArchived: true,
      updatedAt: Date.now(),
    });
  },
});

export const toggleShare = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(args.id, { isShared: !session.isShared });
  },
});

export const touchLastMessage = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.id, {
      lastMessageAt: now,
      updatedAt: now,
    });
  },
});
```

**Step 3: Update `convex/messages.ts`**

Replace entire file to add search:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
    // Touch session's lastMessageAt
    const now = Date.now();
    await ctx.db.patch(args.sessionId, {
      lastMessageAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const list = query({
  args: {
    sessionId: v.id("sessions"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("messages")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const search = query({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args) => {
    if (!args.query.trim()) return [];
    const results = await ctx.db
      .query("messages")
      .withSearchIndex("search_content", (q) => q.search("content", args.query))
      .take(50);
    return results;
  },
});
```

**Step 4: Update `convex/artifacts.ts`**

Replace entire file:

```typescript
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    userId: v.id("users"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    label: v.string(),
    data: v.string(),
    contentHash: v.string(),
  },
  handler: async (ctx, args) => {
    // Deduplicate: check if artifact with same hash already exists in session
    const existing = await ctx.db
      .query("artifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .filter((q) => q.eq(q.field("contentHash"), args.contentHash))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("artifacts", {
      sessionId: args.sessionId,
      userId: args.userId,
      messageId: args.messageId,
      type: args.type,
      label: args.label,
      data: args.data,
      contentHash: args.contentHash,
      createdAt: Date.now(),
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("artifacts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .take(50);
  },
});
```

**Step 5: Push schema and verify**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx convex dev --once`

Expected: All functions deploy successfully.

**Step 6: Commit**

```bash
git add convex/crates.ts convex/sessions.ts convex/messages.ts convex/artifacts.ts
git commit -m "feat: add crates CRUD, session starring/archiving, message search, artifact dedup"
```

---

### Task 3: Sidebar Shell & Layout Restructure

**Files:**
- Create: `src/components/sidebar/sidebar.tsx`
- Create: `src/components/sidebar/sidebar-header.tsx`
- Create: `src/components/sidebar/sidebar-footer.tsx`
- Modify: `src/app/w/layout.tsx`
- Modify: `src/components/workspace/navbar.tsx` (delete or gut)

**Context:** The current workspace layout is `Navbar` (top bar) + `main` + `PlayerBar`. We're replacing the top Navbar with a left sidebar. The Navbar currently contains the Crate logo, settings gear, and Clerk UserButton. These move into the sidebar.

**Step 1: Create `src/components/sidebar/sidebar.tsx`**

```tsx
"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within Sidebar");
  return ctx;
}

export function Sidebar({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      <aside
        className={`flex h-full flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ${
          collapsed ? "w-12" : "w-[260px]"
        }`}
      >
        <SidebarHeader />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {!collapsed && children}
        </div>
        <SidebarFooter />
      </aside>
    </SidebarContext.Provider>
  );
}
```

**Step 2: Create `src/components/sidebar/sidebar-header.tsx`**

```tsx
"use client";

import { useSidebar } from "./sidebar";

export function SidebarHeader() {
  const { collapsed, toggle } = useSidebar();

  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-3">
      {!collapsed && (
        <span className="text-lg font-bold text-white">Crate</span>
      )}
      <button
        onClick={toggle}
        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          )}
        </svg>
      </button>
    </div>
  );
}
```

**Step 3: Create `src/components/sidebar/sidebar-footer.tsx`**

```tsx
"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { useSidebar } from "./sidebar";

export function SidebarFooter() {
  const { collapsed } = useSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className={`flex items-center border-t border-zinc-800 p-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        <UserButton />
        {!collapsed && (
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Settings"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        )}
      </div>
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
```

**Step 4: Update `src/app/w/layout.tsx`**

Replace entire file:

```tsx
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { Sidebar } from "@/components/sidebar/sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          {/* Sidebar sections added in Task 7 */}
          <div />
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
      </div>
    </PlayerProvider>
  );
}
```

**Step 5: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds. The app now shows a sidebar on the left with Crate logo, collapse toggle, user avatar, and settings gear. Main content area fills the rest.

**Step 6: Commit**

```bash
git add src/components/sidebar/ src/app/w/layout.tsx
git commit -m "feat: add collapsible sidebar shell, restructure workspace layout"
```

---

### Task 4: Session Hook & Routing

**Files:**
- Create: `src/hooks/use-session.ts`
- Modify: `src/app/w/page.tsx`
- Modify: `src/app/w/[sessionId]/page.tsx`

**Context:** We need a `useSession` hook that reads the current session ID from the URL, creates new sessions, and provides session data from Convex. The workspace landing page (`/w`) should auto-create a session and redirect. The session page (`/w/[sessionId]`) should load that session's data.

**Step 1: Create `src/hooks/use-session.ts`**

```tsx
"use client";

import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useCallback } from "react";

export function useCurrentUser() {
  const user = useQuery(api.users.getByClerkId, { clerkId: "__clerk_user_id__" });
  // We can't pass the actual Clerk ID here at call time — we need to get it from the auth context.
  // Instead, we'll create a helper query. For now, return undefined.
  return user;
}

export function useSession() {
  const params = useParams();
  const router = useRouter();
  const sessionId = params?.sessionId as string | undefined;

  const session = useQuery(
    api.sessions.get,
    sessionId ? { id: sessionId as Id<"sessions"> } : "skip",
  );

  const createSession = useMutation(api.sessions.create);
  const updateTitle = useMutation(api.sessions.updateTitle);
  const toggleStar = useMutation(api.sessions.toggleStar);
  const archiveSession = useMutation(api.sessions.archive);
  const assignToCrate = useMutation(api.sessions.assignToCrate);

  const newChat = useCallback(
    async (userId: Id<"users">) => {
      const id = await createSession({ userId });
      router.push(`/w/${id}`);
      return id;
    },
    [createSession, router],
  );

  return {
    sessionId: sessionId as Id<"sessions"> | undefined,
    session,
    newChat,
    updateTitle,
    toggleStar,
    archiveSession,
    assignToCrate,
  };
}
```

**Step 2: Update `src/app/w/[sessionId]/page.tsx`**

```tsx
"use client";

import { ArtifactProvider } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";

export default function SessionPage() {
  return (
    <ArtifactProvider>
      <ChatPanel />
    </ArtifactProvider>
  );
}
```

**Step 3: Update `src/app/w/page.tsx`**

This page auto-creates a new session and redirects:

```tsx
"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export default function WorkspacePage() {
  const router = useRouter();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);
  const creating = useRef(false);

  useEffect(() => {
    if (!user || creating.current) return;
    creating.current = true;
    createSession({ userId: user._id }).then((id) => {
      router.replace(`/w/${id}`);
    });
  }, [user, createSession, router]);

  return (
    <div className="flex h-full items-center justify-center">
      <p className="text-zinc-500">Creating new session...</p>
    </div>
  );
}
```

**Step 4: Verify routing works**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds. Navigating to `/w` creates a session and redirects to `/w/[sessionId]`.

**Step 5: Commit**

```bash
git add src/hooks/use-session.ts src/app/w/page.tsx src/app/w/\\[sessionId\\]/page.tsx
git commit -m "feat: add useSession hook, auto-create session on /w, wire routing"
```

---

### Task 5: Chat Persistence (Wire ChatPanel to Convex)

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx`

**Context:** Currently `ChatPanel` uses OpenUI's `ChatProvider` which manages messages in local state only. We need to:
1. Load existing messages from Convex on mount
2. Persist user messages to Convex immediately (optimistic)
3. Persist assistant messages to Convex after streaming completes
4. Update session title from first user message

The `ChatProvider`/`useThread` from OpenUI still manages the streaming conversation — we add Convex persistence as a side-effect layer on top.

**Step 1: Add Convex persistence hooks to ChatPanel**

At the top of `chat-panel.tsx`, add these imports:

```tsx
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
```

**Step 2: Create a `ChatPersistence` component**

Add inside the `ChatProvider` (after `ChatMessages` and `ChatInput`), a component that watches thread state and persists:

```tsx
function ChatPersistence() {
  const { messages, isRunning } = useThread();
  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sendMessage = useMutation(api.messages.send);
  const updateTitle = useMutation(api.sessions.updateTitle);
  const persistedRef = useRef(new Set<string>());
  const titleSetRef = useRef(false);

  useEffect(() => {
    if (!sessionId || !user) return;

    for (const m of messages) {
      if (persistedRef.current.has(m.id)) continue;

      // Persist user messages immediately
      if (m.role === "user") {
        const parts = getContentParts(m.content);
        const text = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (text) {
          persistedRef.current.add(m.id);
          sendMessage({ sessionId, role: "user", content: text });
          // Set session title from first user message
          if (!titleSetRef.current) {
            titleSetRef.current = true;
            const title = text.length > 60 ? text.slice(0, 60) + "..." : text;
            updateTitle({ id: sessionId, title });
          }
        }
      }

      // Persist assistant messages only after streaming completes
      if (m.role === "assistant" && !isRunning) {
        const parts = getContentParts(m.content);
        const text = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (text) {
          persistedRef.current.add(m.id);
          sendMessage({ sessionId, role: "assistant", content: text });
        }
      }
    }
  }, [messages, isRunning, sessionId, user, sendMessage, updateTitle]);

  return null; // Invisible persistence layer
}
```

**Step 3: Add `ChatPersistence` inside the `ChatPanel` render**

In the `ChatPanel` component, add `<ChatPersistence />` inside the `ChatProvider`:

```tsx
export function ChatPanel() {
  return (
    <ChatProvider
      processMessage={async ({ messages, abortController }) => {
        // ... existing code unchanged ...
      }}
      streamProtocol={crateStreamAdapter()}
    >
      <div className="flex h-full flex-col bg-zinc-950">
        <ChatMessages />
        <ChatInput />
        <ChatPersistence />
      </div>
    </ChatProvider>
  );
}
```

**Step 4: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds. Messages now persist to Convex.

**Step 5: Commit**

```bash
git add src/components/workspace/chat-panel.tsx
git commit -m "feat: persist chat messages to Convex, auto-set session title"
```

---

### Task 6: Artifact Persistence (Wire to Convex)

**Files:**
- Modify: `src/components/workspace/artifact-provider.tsx`

**Context:** Currently `ArtifactProvider` keeps artifacts in local React state only. We need to persist artifacts to Convex and load them from Convex on mount. The `contentHash` field enables deduplication.

**Step 1: Update `artifact-provider.tsx`**

Replace entire file:

```tsx
"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface Artifact {
  id: string;
  label: string;
  content: string;
  timestamp: number;
}

/** Extract a label from OpenUI Lang content by parsing the root component's first string arg. */
function extractLabel(content: string): string {
  const match = content.match(/^root\s*=\s*\w+\(\s*"([^"]+)"/m);
  if (match?.[1]) return match[1];
  const fallback = content.match(/^\w+\s*=\s*\w+\(\s*"([^"]+)"/m);
  return fallback?.[1] ?? "Artifact";
}

/** Simple hash for deduplication. */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ArtifactContextValue {
  current: Artifact | null;
  history: Artifact[];
  setArtifact: (content: string) => void;
  selectArtifact: (id: string) => void;
  clear: () => void;
  showPanel: boolean;
  dismissPanel: () => void;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function useArtifact() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifact must be used within ArtifactProvider");
  return ctx;
}

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Artifact | null>(null);
  const [history, setHistory] = useState<Artifact[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const convexArtifacts = useQuery(
    api.artifacts.listBySession,
    sessionId ? { sessionId } : "skip",
  );
  const createArtifact = useMutation(api.artifacts.create);

  // Hydrate history from Convex on mount
  useEffect(() => {
    if (!convexArtifacts || convexArtifacts.length === 0) return;
    const hydrated: Artifact[] = convexArtifacts.map((a) => ({
      id: a._id,
      label: a.label,
      content: a.data,
      timestamp: a.createdAt,
    }));
    setHistory(hydrated);
    // Set current to latest
    setCurrent(hydrated[hydrated.length - 1]);
  }, [convexArtifacts]);

  const setArtifact = useCallback(
    (content: string) => {
      const artifact: Artifact = {
        id: crypto.randomUUID(),
        label: extractLabel(content),
        content,
        timestamp: Date.now(),
      };
      setCurrent(artifact);
      setHistory((prev) => [...prev, artifact]);
      setShowPanel(true);

      // Persist to Convex
      if (sessionId && user) {
        hashContent(content).then((contentHash) => {
          createArtifact({
            sessionId,
            userId: user._id,
            type: "openui",
            label: artifact.label,
            data: content,
            contentHash,
          });
        });
      }
    },
    [sessionId, user, createArtifact],
  );

  const selectArtifact = useCallback((id: string) => {
    setHistory((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found) {
        setCurrent(found);
        setShowPanel(true);
      }
      return prev;
    });
  }, []);

  const clear = useCallback(() => {
    setCurrent(null);
  }, []);

  const dismissPanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  return (
    <ArtifactContext.Provider
      value={{ current, history, setArtifact, selectArtifact, clear, showPanel, dismissPanel }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}
```

**Step 2: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

**Step 3: Commit**

```bash
git add src/components/workspace/artifact-provider.tsx
git commit -m "feat: persist artifacts to Convex with dedup, add showPanel state"
```

---

### Task 7: Sidebar Sections (Crates, Starred, Recents, Artifacts)

**Files:**
- Create: `src/components/sidebar/new-chat-button.tsx`
- Create: `src/components/sidebar/recents-section.tsx`
- Create: `src/components/sidebar/starred-section.tsx`
- Create: `src/components/sidebar/crates-section.tsx`
- Create: `src/components/sidebar/artifacts-section.tsx`
- Create: `src/components/sidebar/session-item.tsx`
- Modify: `src/app/w/layout.tsx`

**Context:** The sidebar needs four sections: Crates (user-created folders), Starred (favorited sessions), Recents (last 20 sessions grouped by date), and Artifacts (browsable artifact history). Each section is collapsible.

**Step 1: Create `src/components/sidebar/session-item.tsx`**

Reusable session list item used by Recents, Starred, and Crates sections:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

interface SessionItemProps {
  id: Id<"sessions">;
  title: string | undefined;
  isStarred: boolean;
  onToggleStar?: () => void;
}

export function SessionItem({ id, title, isStarred, onToggleStar }: SessionItemProps) {
  const params = useParams();
  const isActive = params?.sessionId === id;
  const displayTitle = title || "New chat";

  return (
    <Link
      href={`/w/${id}`}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
    >
      <span className="flex-1 truncate">{displayTitle}</span>
      {onToggleStar && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleStar();
          }}
          className={`shrink-0 opacity-0 group-hover:opacity-100 ${
            isStarred ? "text-yellow-500 opacity-100" : "text-zinc-500"
          }`}
        >
          {isStarred ? "★" : "☆"}
        </button>
      )}
    </Link>
  );
}
```

**Step 2: Create `src/components/sidebar/new-chat-button.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export function NewChatButton() {
  const router = useRouter();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);

  const handleNewChat = async () => {
    if (!user) return;
    const id = await createSession({ userId: user._id });
    router.push(`/w/${id}`);
  };

  return (
    <button
      onClick={handleNewChat}
      className="mx-3 mt-3 flex items-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      New chat
    </button>
  );
}
```

**Step 3: Create `src/components/sidebar/recents-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";

function groupByDate(sessions: Array<{ _id: string; lastMessageAt: number; title?: string; isStarred: boolean }>) {
  const now = Date.now();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, typeof sessions> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  for (const s of sessions) {
    const d = new Date(s.lastMessageAt);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= weekAgo) groups["This Week"].push(s);
    else groups.Older.push(s);
  }

  return groups;
}

export function RecentsSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sessions = useQuery(api.sessions.listRecent, user ? { userId: user._id } : "skip");
  const toggleStar = useMutation(api.sessions.toggleStar);

  if (!sessions || sessions.length === 0) return null;

  const groups = groupByDate(sessions as any);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Recents
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-2">
          {Object.entries(groups).map(([label, items]) =>
            items.length > 0 ? (
              <div key={label}>
                <p className="px-2 text-[10px] font-medium uppercase text-zinc-600">{label}</p>
                {items.map((s: any) => (
                  <SessionItem
                    key={s._id}
                    id={s._id}
                    title={s.title}
                    isStarred={s.isStarred}
                    onToggleStar={() => toggleStar({ id: s._id })}
                  />
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 4: Create `src/components/sidebar/starred-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";

export function StarredSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sessions = useQuery(api.sessions.listStarred, user ? { userId: user._id } : "skip");
  const toggleStar = useMutation(api.sessions.toggleStar);

  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Starred
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1">
          {(sessions as any[]).map((s) => (
            <SessionItem
              key={s._id}
              id={s._id}
              title={s.title}
              isStarred={true}
              onToggleStar={() => toggleStar({ id: s._id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 5: Create `src/components/sidebar/crates-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";

export function CratesSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const crates = useQuery(api.crates.list, user ? { userId: user._id } : "skip");
  const createCrate = useMutation(api.crates.create);
  const toggleStar = useMutation(api.sessions.toggleStar);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  if (!crates) return null;

  const handleCreate = async () => {
    if (!user || !newName.trim()) return;
    await createCrate({ userId: user._id, name: newName.trim() });
    setNewName("");
    setCreating(false);
  };

  return (
    <div className="px-3 py-2">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs font-semibold uppercase text-zinc-500"
        >
          Crates
          <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
        </button>
        <button
          onClick={() => setCreating(true)}
          className="text-xs text-zinc-500 hover:text-zinc-300"
        >
          +
        </button>
      </div>
      {expanded && (
        <div className="mt-1">
          {creating && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleCreate();
              }}
              className="mb-1"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => {
                  if (!newName.trim()) setCreating(false);
                }}
                placeholder="Crate name..."
                className="w-full rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-xs text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
              />
            </form>
          )}
          {crates.length === 0 && !creating && (
            <p className="px-2 text-xs text-zinc-600">No crates yet</p>
          )}
          {crates.map((crate) => (
            <CrateFolder key={crate._id} crateId={crate._id} name={crate.name} userId={user!._id} toggleStar={toggleStar} />
          ))}
        </div>
      )}
    </div>
  );
}

function CrateFolder({
  crateId,
  name,
  userId,
  toggleStar,
}: {
  crateId: any;
  name: string;
  userId: any;
  toggleStar: any;
}) {
  const [open, setOpen] = useState(false);
  const sessions = useQuery(api.sessions.listByCrate, { userId, crateId });

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      >
        <span className="text-xs">{open ? "📂" : "📁"}</span>
        <span className="truncate">{name}</span>
        {sessions && sessions.length > 0 && (
          <span className="ml-auto text-[10px] text-zinc-600">{sessions.length}</span>
        )}
      </button>
      {open && sessions && (
        <div className="ml-4">
          {sessions.length === 0 ? (
            <p className="px-2 text-xs text-zinc-600">Empty</p>
          ) : (
            (sessions as any[]).map((s) => (
              <SessionItem
                key={s._id}
                id={s._id}
                title={s.title}
                isStarred={s.isStarred}
                onToggleStar={() => toggleStar({ id: s._id })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 6: Create `src/components/sidebar/artifacts-section.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export function ArtifactsSection() {
  const [expanded, setExpanded] = useState(false);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const artifacts = useQuery(api.artifacts.listByUser, user ? { userId: user._id } : "skip");
  const router = useRouter();

  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Artifacts
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1">
          {artifacts.map((a) => (
            <button
              key={a._id}
              onClick={() => router.push(`/w/${a.sessionId}`)}
              className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-900"
            >
              <span className="truncate text-zinc-300">{a.label}</span>
              <span className="text-[10px] text-zinc-600">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

**Step 7: Wire sections into workspace layout**

Update `src/app/w/layout.tsx`:

```tsx
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { Sidebar } from "@/components/sidebar/sidebar";
import { NewChatButton } from "@/components/sidebar/new-chat-button";
import { CratesSection } from "@/components/sidebar/crates-section";
import { StarredSection } from "@/components/sidebar/starred-section";
import { RecentsSection } from "@/components/sidebar/recents-section";
import { ArtifactsSection } from "@/components/sidebar/artifacts-section";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          <NewChatButton />
          <div className="mt-2 space-y-1">
            <CratesSection />
            <StarredSection />
            <RecentsSection />
            <ArtifactsSection />
          </div>
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
      </div>
    </PlayerProvider>
  );
}
```

**Step 8: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds. Sidebar shows New Chat button, Crates, Starred, Recents, and Artifacts sections.

**Step 9: Commit**

```bash
git add src/components/sidebar/ src/app/w/layout.tsx
git commit -m "feat: add sidebar sections — crates, starred, recents, artifacts"
```

---

### Task 8: Artifact Slide-In Panel

**Files:**
- Create: `src/components/workspace/artifact-slide-in.tsx`
- Modify: `src/app/w/[sessionId]/page.tsx`
- Modify: `src/components/workspace/split-pane.tsx` (can be deleted or kept as legacy)

**Context:** The current `SplitPane` always shows a 40/60 split. The new design has chat full-width by default, with the artifact panel sliding in from the right when an artifact is generated. We replace `SplitPane` with a new layout in the session page.

**Step 1: Create `src/components/workspace/artifact-slide-in.tsx`**

```tsx
"use client";

import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import { useArtifact } from "./artifact-provider";

export function ArtifactSlideIn() {
  const { current, history, selectArtifact, showPanel, dismissPanel } = useArtifact();

  if (!showPanel || !current) return null;

  return (
    <div className="flex h-full w-[55%] shrink-0 flex-col border-l border-zinc-800 bg-zinc-900 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-sm font-medium text-zinc-300">
          {current.label.length > 40 ? `${current.label.slice(0, 40)}...` : current.label}
        </span>
        <button
          onClick={dismissPanel}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          aria-label="Close artifact panel"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* History tabs */}
      {history.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-1.5">
          {history.map((a) => (
            <button
              key={a.id}
              onClick={() => selectArtifact(a.id)}
              className={`shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
                a.id === current.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {a.label.length > 25 ? `${a.label.slice(0, 25)}...` : a.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Renderer library={crateLibrary} response={current.content} isStreaming={false} />
      </div>
    </div>
  );
}
```

**Step 2: Update `src/app/w/[sessionId]/page.tsx`**

```tsx
"use client";

import { ArtifactProvider } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { ArtifactSlideIn } from "@/components/workspace/artifact-slide-in";

export default function SessionPage() {
  return (
    <ArtifactProvider>
      <div className="flex h-full">
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
        <ArtifactSlideIn />
      </div>
    </ArtifactProvider>
  );
}
```

**Step 3: Add Tailwind animate-in utility**

The `animate-in slide-in-from-right` classes may not exist in Tailwind v4 by default. Add to `src/app/globals.css`:

```css
@keyframes slide-in-from-right {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-in.slide-in-from-right {
  animation: slide-in-from-right 0.3s ease-out;
}
```

**Step 4: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds. Chat is now full-width, artifact panel slides in when generated.

**Step 5: Commit**

```bash
git add src/components/workspace/artifact-slide-in.tsx src/app/w/\\[sessionId\\]/page.tsx src/app/globals.css
git commit -m "feat: replace split-pane with artifact slide-in panel"
```

---

### Task 9: Sidebar Search

**Files:**
- Create: `src/components/sidebar/search-bar.tsx`
- Modify: `src/app/w/layout.tsx` (add SearchBar to sidebar)

**Context:** The sidebar needs a search bar that queries the Convex `messages` search index and shows results grouped by session.

**Step 1: Create `src/components/sidebar/search-bar.tsx`**

```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery(
    api.messages.search,
    debouncedQuery.trim() ? { query: debouncedQuery.trim() } : "skip",
  );

  // Group results by session
  const grouped = results
    ? Object.entries(
        results.reduce(
          (acc, msg) => {
            const key = msg.sessionId;
            if (!acc[key]) acc[key] = [];
            acc[key].push(msg);
            return acc;
          },
          {} as Record<string, typeof results>,
        ),
      )
    : [];

  return (
    <div className="relative mx-3 mt-2">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder="Search research history..."
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
      />
      <svg
        className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Results dropdown */}
      {isOpen && debouncedQuery && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
          {grouped.length === 0 ? (
            <p className="p-3 text-xs text-zinc-500">No results</p>
          ) : (
            grouped.map(([sessionId, msgs]) => (
              <button
                key={sessionId}
                onClick={() => {
                  router.push(`/w/${sessionId}`);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="flex w-full flex-col border-b border-zinc-800 px-3 py-2 text-left last:border-0 hover:bg-zinc-800"
              >
                <span className="text-xs text-zinc-300">
                  {msgs[0].content.slice(0, 80)}
                  {msgs[0].content.length > 80 ? "..." : ""}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {msgs.length} match{msgs.length > 1 ? "es" : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
```

**Step 2: Add SearchBar to layout**

In `src/app/w/layout.tsx`, add import and place after `NewChatButton`:

```tsx
import { SearchBar } from "@/components/sidebar/search-bar";
```

Inside the Sidebar children, add `<SearchBar />` after `<NewChatButton />`.

**Step 3: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

**Step 4: Commit**

```bash
git add src/components/sidebar/search-bar.tsx src/app/w/layout.tsx
git commit -m "feat: add full-text search bar to sidebar"
```

---

### Task 10: Keyboard Shortcuts

**Files:**
- Create: `src/hooks/use-keyboard-shortcuts.ts`
- Modify: `src/app/w/layout.tsx` (add hook)

**Context:** Four shortcuts: `Cmd+K` (focus search), `Cmd+N` (new chat), `Cmd+B` (toggle sidebar), `Cmd+Shift+S` (star/unstar session).

**Step 1: Create `src/hooks/use-keyboard-shortcuts.ts`**

```tsx
"use client";

import { useEffect } from "react";

interface ShortcutHandlers {
  onNewChat?: () => void;
  onToggleSidebar?: () => void;
  onFocusSearch?: () => void;
  onToggleStar?: () => void;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;

      if (e.key === "k") {
        e.preventDefault();
        handlers.onFocusSearch?.();
      } else if (e.key === "n") {
        e.preventDefault();
        handlers.onNewChat?.();
      } else if (e.key === "b") {
        e.preventDefault();
        handlers.onToggleSidebar?.();
      } else if (e.key === "S" && e.shiftKey) {
        e.preventDefault();
        handlers.onToggleStar?.();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handlers]);
}
```

**Step 2: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds.

**Note:** Wiring the shortcuts to actual handlers requires making the sidebar context and search input ref accessible from the layout. This can be done by exposing the sidebar toggle via the `useSidebar` context (already exported) and adding a ref to the search input. The wiring will happen during Task 11 integration.

**Step 3: Commit**

```bash
git add src/hooks/use-keyboard-shortcuts.ts
git commit -m "feat: add keyboard shortcuts hook (Cmd+K/N/B/Shift+S)"
```

---

### Task 11: Integration, Cleanup & Polish

**Files:**
- Modify: `src/app/w/layout.tsx` (wire keyboard shortcuts)
- Modify: `src/components/sidebar/sidebar.tsx` (expose toggle to layout)
- Modify: `src/components/sidebar/search-bar.tsx` (expose focus via ref)
- Delete or deprecate: `src/components/workspace/split-pane.tsx` (no longer used)
- Delete or deprecate: `src/components/workspace/navbar.tsx` (replaced by sidebar)

**Context:** Final integration — wire keyboard shortcuts, clean up unused components, ensure everything works together.

**Step 1: Export sidebar toggle for keyboard shortcuts**

The `useSidebar` hook is already exported from `sidebar.tsx`. To use it in the layout, we need to restructure slightly. Create a wrapper component in the layout that can access both sidebar context and shortcuts.

Update `src/app/w/layout.tsx`:

```tsx
"use client";

import { useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { Sidebar, useSidebar } from "@/components/sidebar/sidebar";
import { NewChatButton } from "@/components/sidebar/new-chat-button";
import { SearchBar } from "@/components/sidebar/search-bar";
import { CratesSection } from "@/components/sidebar/crates-section";
import { StarredSection } from "@/components/sidebar/starred-section";
import { RecentsSection } from "@/components/sidebar/recents-section";
import { ArtifactsSection } from "@/components/sidebar/artifacts-section";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

function WorkspaceInner({ children }: { children: React.ReactNode }) {
  const { toggle } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useParams();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);
  const toggleStar = useMutation(api.sessions.toggleStar);

  const handleNewChat = useCallback(async () => {
    if (!user) return;
    const id = await createSession({ userId: user._id });
    router.push(`/w/${id}`);
  }, [user, createSession, router]);

  const handleToggleStar = useCallback(async () => {
    const sessionId = params?.sessionId as string | undefined;
    if (!sessionId) return;
    await toggleStar({ id: sessionId as Id<"sessions"> });
  }, [params, toggleStar]);

  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onToggleSidebar: toggle,
    onFocusSearch: () => searchRef.current?.focus(),
    onToggleStar: handleToggleStar,
  });

  return (
    <>
      <NewChatButton />
      <SearchBar ref={searchRef} />
      <div className="mt-2 space-y-1">
        <CratesSection />
        <StarredSection />
        <RecentsSection />
        <ArtifactsSection />
      </div>
    </>
  );
}

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          <WorkspaceInner>{children}</WorkspaceInner>
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
      </div>
    </PlayerProvider>
  );
}
```

**Step 2: Make SearchBar accept a forwarded ref**

Update `src/components/sidebar/search-bar.tsx` to use `forwardRef`:

Add at the top:
```tsx
import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
```

Change the component to:
```tsx
export const SearchBar = forwardRef<HTMLInputElement>(function SearchBar(_props, ref) {
  // ... existing code ...
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current!, []);

  // ... rest unchanged, but use inputRef internally ...
});
```

**Step 3: Delete unused components**

```bash
rm src/components/workspace/split-pane.tsx
rm src/components/workspace/navbar.tsx
```

**Step 4: Verify it builds**

Run: `cd /Users/tarikmoody/Documents/Projects/crate-web && npx next build 2>&1 | tail -20`

Expected: Build succeeds with no import errors. If `split-pane` or `navbar` are imported elsewhere, update those imports.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: wire keyboard shortcuts, clean up unused navbar and split-pane"
```

---

## Post-Implementation Verification

After all tasks complete, verify:

1. **Sidebar**: Collapses/expands, shows Crates/Starred/Recents/Artifacts
2. **New Chat**: Creates session in Convex, navigates to `/w/[sessionId]`
3. **Chat Persistence**: Messages appear after page reload
4. **Session Title**: Auto-set from first user message
5. **Starring**: Star icon toggles, session appears/disappears in Starred section
6. **Artifacts**: Generated artifacts appear in sidebar Artifacts section
7. **Artifact Slide-In**: Panel slides in on generation, dismisses with X
8. **Search**: Finds messages by content, grouped by session
9. **Keyboard Shortcuts**: `Cmd+K/N/B/Shift+S` all work
10. **Auth Scoping**: Different Clerk users see only their own data
