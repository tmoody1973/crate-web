# Crate Web Scaffold — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Scaffold the Crate Web app — a collaborative music research workspace with split-pane layout, streaming chat, dynamic artifacts via OpenUI, persistent audio player, and API key management.

**Architecture:** Next.js 15 App Router on Vercel, Convex for real-time DB, Clerk for auth, OpenUI for dynamic components, YouTube IFrame API for audio. Two-tier key model with embedded defaults for Tier 1 services.

**Tech Stack:** Next.js 15, React 19, TypeScript, Convex, Clerk, @thesysdev/openui, Tailwind CSS, Vercel AI SDK

---

### Task 1: Initialize Next.js project with Tailwind

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `app/layout.tsx`, `app/page.tsx`

**Step 1: Create Next.js app**

```bash
cd /Users/tarikmoody/Documents/Projects/crate-web
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

When prompted, accept defaults. This scaffolds the project with App Router, Tailwind, and TypeScript.

**Step 2: Verify it runs**

```bash
npm run dev
```

Open `http://localhost:3000` — should see the Next.js default page.

**Step 3: Clean up defaults**

- Replace `src/app/page.tsx` with a simple placeholder:

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Crate</h1>
    </main>
  );
}
```

- Remove default CSS from `src/app/globals.css` except Tailwind directives:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Step 4: Commit**

```bash
git add -A
git commit -m "feat: initialize Next.js 15 with Tailwind and TypeScript"
```

---

### Task 2: Install and configure Convex

**Files:**
- Create: `convex/schema.ts`, `convex/_generated/`, `convex/tsconfig.json`
- Modify: `package.json`, `src/app/layout.tsx`

**Step 1: Install Convex**

```bash
npm install convex
npx convex dev --once
```

This creates the `convex/` directory and connects to a Convex project. Follow the prompts to create a new project named "crate-web".

**Step 2: Create the schema**

```typescript
// convex/schema.ts
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

  sessions: defineTable({
    userId: v.id("users"),
    title: v.optional(v.string()),
    isShared: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  messages: defineTable({
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

  artifacts: defineTable({
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    data: v.string(),
    createdAt: v.number(),
  }).index("by_session", ["sessionId"]),

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

**Step 3: Create ConvexClientProvider**

```typescript
// src/providers/convex-provider.tsx
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

**Step 4: Wrap layout with provider**

Update `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { ConvexClientProvider } from "@/providers/convex-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Crate",
  description: "AI-powered music research workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ConvexClientProvider>{children}</ConvexClientProvider>
      </body>
    </html>
  );
}
```

**Step 5: Push schema to Convex**

```bash
npx convex dev --once
```

Verify: Schema deploys without errors.

**Step 6: Commit**

```bash
git add -A
git commit -m "feat: add Convex with 6-table schema for sessions, messages, artifacts"
```

---

### Task 3: Install and configure Clerk auth

**Files:**
- Create: `src/middleware.ts`, `src/app/sign-in/[[...sign-in]]/page.tsx`, `src/app/sign-up/[[...sign-up]]/page.tsx`
- Modify: `src/app/layout.tsx`, `.env.local`

**Step 1: Install Clerk**

```bash
npm install @clerk/nextjs
```

**Step 2: Add Clerk env vars**

Create `.env.local`:
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CONVEX_URL=https://...convex.cloud
```

**Step 3: Create middleware**

```typescript
// src/middleware.ts
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isProtectedRoute = createRouteMatcher(["/w(.*)"]);
const isPublicRoute = createRouteMatcher(["/", "/sign-in(.*)", "/sign-up(.*)", "/s(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
```

**Step 4: Wrap layout with ClerkProvider**

Update `src/app/layout.tsx`:

```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { ConvexClientProvider } from "@/providers/convex-provider";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body>
          <ConvexClientProvider>{children}</ConvexClientProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
```

**Step 5: Create sign-in and sign-up pages**

```tsx
// src/app/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn />
    </div>
  );
}
```

```tsx
// src/app/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp />
    </div>
  );
}
```

**Step 6: Verify auth works**

```bash
npm run dev
```

Visit `/sign-in` — should see Clerk sign-in form. Visit `/w` — should redirect to sign-in.

**Step 7: Commit**

```bash
git add -A
git commit -m "feat: add Clerk auth with protected workspace routes"
```

---

### Task 4: Create workspace layout with split pane

**Files:**
- Create: `src/app/w/layout.tsx`, `src/app/w/page.tsx`, `src/components/workspace/split-pane.tsx`, `src/components/workspace/navbar.tsx`, `src/components/workspace/chat-panel.tsx`, `src/components/workspace/artifacts-panel.tsx`

**Step 1: Install split pane library**

```bash
npm install react-resizable-panels
```

**Step 2: Create navbar**

```tsx
// src/components/workspace/navbar.tsx
"use client";

import { UserButton } from "@clerk/nextjs";

export function Navbar() {
  return (
    <nav className="flex h-14 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-white">Crate</span>
      </div>
      <div className="flex items-center gap-3">
        <button className="text-zinc-400 hover:text-white">
          {/* Settings gear icon */}
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
        <UserButton afterSignOutUrl="/" />
      </div>
    </nav>
  );
}
```

**Step 3: Create chat panel placeholder**

```tsx
// src/components/workspace/chat-panel.tsx
"use client";

export function ChatPanel() {
  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-zinc-500">Start a conversation...</p>
      </div>
      <div className="border-t border-zinc-800 p-4">
        <input
          type="text"
          placeholder="Ask about any artist, track, or genre..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
```

**Step 4: Create artifacts panel placeholder**

```tsx
// src/components/workspace/artifacts-panel.tsx
"use client";

export function ArtifactsPanel() {
  return (
    <div className="flex h-full items-center justify-center bg-zinc-900">
      <div className="text-center">
        <p className="text-lg text-zinc-500">Artifacts appear here</p>
        <p className="text-sm text-zinc-600">
          Sample trees, album grids, playlists, and more
        </p>
      </div>
    </div>
  );
}
```

**Step 5: Create split-pane workspace**

```tsx
// src/components/workspace/split-pane.tsx
"use client";

import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { ChatPanel } from "./chat-panel";
import { ArtifactsPanel } from "./artifacts-panel";

export function SplitPane() {
  return (
    <PanelGroup direction="horizontal" className="h-full">
      <Panel defaultSize={40} minSize={25}>
        <ChatPanel />
      </Panel>
      <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-zinc-600 transition-colors" />
      <Panel defaultSize={60} minSize={25}>
        <ArtifactsPanel />
      </Panel>
    </PanelGroup>
  );
}
```

**Step 6: Create workspace layout and page**

```tsx
// src/app/w/layout.tsx
import { Navbar } from "@/components/workspace/navbar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col bg-zinc-950">
      <Navbar />
      <main className="flex-1 overflow-hidden">{children}</main>
      {/* Audio player bar goes here (Task 8) */}
    </div>
  );
}
```

```tsx
// src/app/w/page.tsx
import { SplitPane } from "@/components/workspace/split-pane";

export default function WorkspacePage() {
  return <SplitPane />;
}
```

**Step 7: Update home page to redirect signed-in users**

```tsx
// src/app/page.tsx
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) redirect("/w");

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-white">Crate</h1>
        <p className="mt-4 text-xl text-zinc-400">AI-powered music research workspace</p>
        <a
          href="/sign-up"
          className="mt-8 inline-block rounded-lg bg-white px-8 py-3 font-semibold text-black hover:bg-zinc-200"
        >
          Try Crate
        </a>
      </div>
    </main>
  );
}
```

**Step 8: Verify layout works**

```bash
npm run dev
```

Visit `/w` (signed in) — should see split-pane with navbar, chat placeholder left, artifacts placeholder right.

**Step 9: Commit**

```bash
git add -A
git commit -m "feat: add split-pane workspace layout with navbar, chat, and artifacts panels"
```

---

### Task 5: Create Convex mutations and queries for sessions and messages

**Files:**
- Create: `convex/sessions.ts`, `convex/messages.ts`

**Step 1: Create session mutations/queries**

```typescript
// convex/sessions.ts
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
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const list = query({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sessions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
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

export const toggleShare = mutation({
  args: { id: v.id("sessions") },
  handler: async (ctx, args) => {
    const session = await ctx.db.get(args.id);
    if (!session) throw new Error("Session not found");
    await ctx.db.patch(args.id, { isShared: !session.isShared });
  },
});
```

**Step 2: Create message mutations/queries**

```typescript
// convex/messages.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    sessionId: v.id("sessions"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("messages", {
      sessionId: args.sessionId,
      role: args.role,
      content: args.content,
      createdAt: Date.now(),
    });
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
```

**Step 3: Push to Convex**

```bash
npx convex dev --once
```

**Step 4: Commit**

```bash
git add convex/sessions.ts convex/messages.ts
git commit -m "feat: add Convex mutations and queries for sessions and messages"
```

---

### Task 6: Create Convex functions for artifacts and tool calls

**Files:**
- Create: `convex/artifacts.ts`, `convex/toolCalls.ts`

**Step 1: Create artifact mutations/queries**

```typescript
// convex/artifacts.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const create = mutation({
  args: {
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    type: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artifacts", {
      sessionId: args.sessionId,
      messageId: args.messageId,
      type: args.type,
      data: args.data,
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
```

**Step 2: Create tool call mutations/queries**

```typescript
// convex/toolCalls.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const start = mutation({
  args: {
    sessionId: v.id("sessions"),
    messageId: v.optional(v.id("messages")),
    toolName: v.string(),
    args: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("toolCalls", {
      sessionId: args.sessionId,
      messageId: args.messageId,
      toolName: args.toolName,
      args: args.args,
      status: "running",
      startedAt: Date.now(),
    });
  },
});

export const complete = mutation({
  args: {
    id: v.id("toolCalls"),
    result: v.string(),
    status: v.union(v.literal("complete"), v.literal("error")),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      result: args.result,
      status: args.status,
      completedAt: Date.now(),
    });
  },
});

export const listBySession = query({
  args: { sessionId: v.id("sessions") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("toolCalls")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
  },
});
```

**Step 3: Push to Convex**

```bash
npx convex dev --once
```

**Step 4: Commit**

```bash
git add convex/artifacts.ts convex/toolCalls.ts
git commit -m "feat: add Convex functions for artifacts and tool calls"
```

---

### Task 7: Create Convex user sync via Clerk webhook

**Files:**
- Create: `convex/users.ts`, `src/app/api/webhooks/clerk/route.ts`

**Step 1: Create user query/mutation**

```typescript
// convex/users.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email,
        name: args.name,
      });
      return existing._id;
    }

    return await ctx.db.insert("users", {
      clerkId: args.clerkId,
      email: args.email,
      name: args.name,
      createdAt: Date.now(),
    });
  },
});
```

**Step 2: Create Clerk webhook handler**

```typescript
// src/app/api/webhooks/clerk/route.ts
import { Webhook } from "svix";
import { headers } from "next/headers";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: any;

  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    });
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (evt.type === "user.created" || evt.type === "user.updated") {
    const { id, email_addresses, first_name, last_name } = evt.data;
    const email = email_addresses?.[0]?.email_address ?? "";
    const name = [first_name, last_name].filter(Boolean).join(" ") || undefined;

    await convex.mutation(api.users.upsert, {
      clerkId: id,
      email,
      name,
    });
  }

  return new Response("OK", { status: 200 });
}
```

**Step 3: Install svix for webhook verification**

```bash
npm install svix
```

**Step 4: Push to Convex and verify**

```bash
npx convex dev --once
```

**Step 5: Commit**

```bash
git add convex/users.ts src/app/api/webhooks/clerk/route.ts
git commit -m "feat: add Clerk webhook for user sync to Convex"
```

---

### Task 8: Create audio player component

**Files:**
- Create: `src/components/player/player-bar.tsx`, `src/components/player/player-provider.tsx`, `src/components/player/youtube-embed.tsx`

**Step 1: Create PlayerProvider context**

```tsx
// src/components/player/player-provider.tsx
"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Track {
  title: string;
  artist: string;
  source: "youtube" | "bandcamp";
  sourceId: string;
  imageUrl?: string;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

interface PlayerContextValue extends PlayerState {
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  addToQueue: (track: Track) => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    volume: 80,
    currentTime: 0,
    duration: 0,
  });

  const play = useCallback((track: Track) => {
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      queue: [...prev.queue, track],
      currentIndex: prev.queue.length,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.queue.length) return { ...prev, isPlaying: false };
      return {
        ...prev,
        currentIndex: nextIndex,
        currentTrack: prev.queue[nextIndex],
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) return prev;
      return {
        ...prev,
        currentIndex: prevIndex,
        currentTrack: prev.queue[prevIndex],
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState((prev) => ({ ...prev, queue: [...prev.queue, track] }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  }, []);

  const seek = useCallback((_time: number) => {
    // YouTube player seek handled via ref in youtube-embed
  }, []);

  const setCurrentTime = useCallback((currentTime: number) => {
    setState((prev) => ({ ...prev, currentTime }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setState((prev) => ({ ...prev, duration }));
  }, []);

  const setIsPlaying = useCallback((isPlaying: boolean) => {
    setState((prev) => ({ ...prev, isPlaying }));
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        pause,
        resume,
        next,
        previous,
        addToQueue,
        setVolume,
        seek,
        setCurrentTime,
        setDuration,
        setIsPlaying,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
```

**Step 2: Create player bar UI**

```tsx
// src/components/player/player-bar.tsx
"use client";

import { usePlayer } from "./player-provider";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    pause,
    resume,
    next,
    previous,
    setVolume,
  } = usePlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex h-[72px] items-center border-t border-zinc-800 bg-zinc-950 px-4">
      {/* Track info */}
      <div className="flex w-1/4 items-center gap-3">
        {currentTrack.imageUrl && (
          <img
            src={currentTrack.imageUrl}
            alt=""
            className="h-12 w-12 rounded object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {currentTrack.title}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {currentTrack.artist}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button onClick={previous} className="text-zinc-400 hover:text-white">
            ◄◄
          </button>
          <button
            onClick={isPlaying ? pause : resume}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200"
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white">
            ►►
          </button>
        </div>
        {/* Progress bar */}
        <div className="flex w-full max-w-md items-center gap-2">
          <span className="text-xs text-zinc-500">{formatTime(currentTime)}</span>
          <div className="relative h-1 flex-1 rounded-full bg-zinc-700">
            <div
              className="absolute h-full rounded-full bg-white"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-zinc-500">{formatTime(duration)}</span>
        </div>
      </div>

      {/* Volume */}
      <div className="flex w-1/4 items-center justify-end gap-2">
        <span className="text-zinc-400">🔊</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-24"
        />
      </div>
    </div>
  );
}
```

**Step 3: Add PlayerProvider and PlayerBar to workspace layout**

Update `src/app/w/layout.tsx`:

```tsx
import { Navbar } from "@/components/workspace/navbar";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="flex h-screen flex-col bg-zinc-950">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
```

**Step 4: Verify player bar renders**

```bash
npm run dev
```

Visit `/w` — player bar should be hidden (no current track). Test by temporarily hardcoding a track in provider state.

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add persistent audio player with PlayerProvider and PlayerBar"
```

---

### Task 9: Create API key management (encryption + settings drawer)

**Files:**
- Create: `src/lib/encryption.ts`, `src/app/api/keys/route.ts`, `src/app/api/keys/validate/route.ts`, `convex/keys.ts`, `src/components/settings/settings-drawer.tsx`, `src/components/settings/key-entry.tsx`

**Step 1: Create encryption utilities**

```typescript
// src/lib/encryption.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY not set");
  return Buffer.from(key, "hex");
}

export function encrypt(plaintext: string): Buffer {
  const key = getEncryptionKey();
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  // Format: [16 bytes IV][16 bytes auth tag][encrypted data]
  return Buffer.concat([iv, authTag, encrypted]);
}

export function decrypt(data: Buffer): string {
  const key = getEncryptionKey();
  const iv = data.subarray(0, 16);
  const authTag = data.subarray(16, 32);
  const encrypted = data.subarray(32);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return decipher.update(encrypted) + decipher.final("utf8");
}
```

**Step 2: Create Convex key storage mutation**

```typescript
// convex/keys.ts
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const store = mutation({
  args: {
    userId: v.id("users"),
    encryptedKeys: v.bytes(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      encryptedKeys: args.encryptedKeys,
    });
  },
});

export const get = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.encryptedKeys ?? null;
  },
});
```

**Step 3: Create key management API routes**

```typescript
// src/app/api/keys/route.ts
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { encrypt, decrypt } from "@/lib/encryption";
import { NextResponse } from "next/server";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// GET — return masked keys
export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user?.encryptedKeys) return NextResponse.json({ keys: {} });

  const decrypted = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
  const masked: Record<string, string> = {};
  for (const [key, value] of Object.entries(decrypted)) {
    const v = value as string;
    masked[key] = v.length > 6 ? "••••••" + v.slice(-4) : "••••••";
  }

  return NextResponse.json({ keys: masked });
}

// POST — save a key
export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { service, value } = await req.json();
  if (!service || !value) {
    return NextResponse.json({ error: "Missing service or value" }, { status: 400 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get existing keys
  let existing: Record<string, string> = {};
  if (user.encryptedKeys) {
    existing = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
  }

  // Add/update the key
  existing[service] = value;

  // Re-encrypt and store
  const encrypted = encrypt(JSON.stringify(existing));
  await convex.mutation(api.keys.store, {
    userId: user._id,
    encryptedKeys: new Uint8Array(encrypted),
  });

  return NextResponse.json({ success: true });
}
```

**Step 4: Create settings drawer component**

```tsx
// src/components/settings/settings-drawer.tsx
"use client";

import { useState, useEffect } from "react";
import { KeyEntry } from "./key-entry";

const TIER_1_SERVICES = [
  { id: "discogs", name: "Discogs", description: "Vinyl pressings, label catalogs" },
  { id: "lastfm", name: "Last.fm", description: "Listener stats, similar artists" },
  { id: "ticketmaster", name: "Ticketmaster", description: "Concerts, events, venues" },
];

const TIER_2_SERVICES = [
  { id: "anthropic", name: "Anthropic", description: "AI research agent (required)", required: true },
  { id: "genius", name: "Genius", description: "Lyrics, annotations" },
  { id: "youtube", name: "YouTube Data", description: "Enables audio player" },
  { id: "tumblr", name: "Tumblr", description: "Publish to your blog" },
];

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const [userKeys, setUserKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetch("/api/keys")
        .then((r) => r.json())
        .then((data) => setUserKeys(data.keys ?? {}));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto bg-zinc-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">✕</button>
        </div>

        <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
          Required
        </h3>
        {TIER_2_SERVICES.filter((s) => s.required).map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="required"
          />
        ))}

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase text-zinc-400">
          Tier 1 — Active (zero-config)
        </h3>
        {TIER_1_SERVICES.map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="tier1"
          />
        ))}

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase text-zinc-400">
          Tier 2 — Add to unlock
        </h3>
        {TIER_2_SERVICES.filter((s) => !s.required).map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="tier2"
          />
        ))}
      </div>
    </div>
  );
}
```

**Step 5: Commit**

```bash
git add -A
git commit -m "feat: add API key encryption, storage, and settings drawer"
```

---

### Task 10: Create chat API route with Vercel AI SDK streaming

**Files:**
- Create: `src/app/api/chat/route.ts`

**Step 1: Install Vercel AI SDK**

```bash
npm install ai @ai-sdk/anthropic
```

**Step 2: Create the chat route**

```typescript
// src/app/api/chat/route.ts
import { auth } from "@clerk/nextjs/server";
import { streamText } from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { decrypt } from "@/lib/encryption";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  // Decrypt user's API keys
  let userKeys: Record<string, string> = {};
  if (user.encryptedKeys) {
    userKeys = JSON.parse(decrypt(Buffer.from(user.encryptedKeys)));
  }

  const anthropicKey = userKeys.anthropic;
  if (!anthropicKey) {
    return new Response("Anthropic API key required. Add it in Settings.", { status: 400 });
  }

  const { messages } = await req.json();

  const anthropic = createAnthropic({ apiKey: anthropicKey });

  const result = streamText({
    model: anthropic("claude-sonnet-4-6"),
    system: "You are Crate, an expert music research agent. You help DJs, record collectors, music journalists, and serious listeners research music in depth.",
    messages,
  });

  return result.toDataStreamResponse();
}
```

**Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: add streaming chat API route with Vercel AI SDK"
```

---

### Task 11: Wire up chat panel to streaming API

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx`

**Step 1: Install useChat hook dependency (already in ai package)**

**Step 2: Update chat panel with streaming**

```tsx
// src/components/workspace/chat-panel.tsx
"use client";

import { useChat } from "ai/react";

export function ChatPanel() {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({ api: "/api/chat" });

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-zinc-500">
            Ask about any artist, track, sample, or genre...
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`mb-4 ${m.role === "user" ? "text-white" : "text-zinc-300"}`}
          >
            <span className="text-xs font-semibold uppercase text-zinc-500">
              {m.role === "user" ? "You" : "Crate"}
            </span>
            <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
          </div>
        ))}
        {isLoading && (
          <div className="text-zinc-500">Researching...</div>
        )}
      </div>
      <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-4">
        <input
          value={input}
          onChange={handleInputChange}
          placeholder="Ask about any artist, track, or genre..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </form>
    </div>
  );
}
```

**Step 3: Verify streaming works**

```bash
npm run dev
```

Sign in, go to `/w`, add Anthropic key in settings, type a message — should stream a response.

**Step 4: Commit**

```bash
git add src/components/workspace/chat-panel.tsx
git commit -m "feat: wire chat panel to streaming AI with useChat"
```

---

### Task 12: Create shared session route

**Files:**
- Create: `src/app/s/[sessionId]/page.tsx`

**Step 1: Create read-only shared session page**

```tsx
// src/app/s/[sessionId]/page.tsx
"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function SharedSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const session = useQuery(api.sessions.get, {
    id: sessionId as Id<"sessions">,
  });
  const messages = useQuery(api.messages.list, {
    sessionId: sessionId as Id<"sessions">,
  });

  if (!session) return <div className="p-8 text-zinc-500">Loading...</div>;
  if (!session.isShared)
    return <div className="p-8 text-zinc-500">This session is not shared.</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">
        {session.title ?? "Research Session"}
      </h1>
      <div className="space-y-4">
        {messages?.map((m) => (
          <div key={m._id}>
            <span className="text-xs font-semibold uppercase text-zinc-500">
              {m.role === "user" ? "Researcher" : "Crate"}
            </span>
            <div className="mt-1 whitespace-pre-wrap text-zinc-300">
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add src/app/s/
git commit -m "feat: add read-only shared session page"
```

---

### Task 13: Create session route with sessionId

**Files:**
- Create: `src/app/w/[sessionId]/page.tsx`

**Step 1: Create session workspace page**

```tsx
// src/app/w/[sessionId]/page.tsx
import { SplitPane } from "@/components/workspace/split-pane";

export default function SessionPage() {
  // SplitPane will read sessionId from URL params
  return <SplitPane />;
}
```

**Step 2: Commit**

```bash
git add src/app/w/[sessionId]/
git commit -m "feat: add session-specific workspace route"
```

---

### Task 14: Deploy to Vercel

**Step 1: Push to GitHub**

```bash
git remote add origin <github-repo-url>
git push -u origin main
```

**Step 2: Connect to Vercel**

- Go to vercel.com → New Project → Import from GitHub
- Select crate-web repo
- Add environment variables:
  - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
  - `CLERK_SECRET_KEY`
  - `CLERK_WEBHOOK_SECRET`
  - `NEXT_PUBLIC_CONVEX_URL`
  - `ENCRYPTION_KEY` (generate: `openssl rand -hex 32`)
  - `EMBEDDED_TICKETMASTER_KEY`
  - `EMBEDDED_LASTFM_KEY`
  - `EMBEDDED_DISCOGS_KEY`
  - `EMBEDDED_DISCOGS_SECRET`

**Step 3: Deploy**

Vercel auto-deploys on push. Verify the deployment works.

**Step 4: Set up Clerk webhook**

In Clerk dashboard → Webhooks → Add endpoint:
- URL: `https://your-app.vercel.app/api/webhooks/clerk`
- Events: `user.created`, `user.updated`
- Copy signing secret → add as `CLERK_WEBHOOK_SECRET` env var in Vercel

**Step 5: Commit any deployment fixes**

```bash
git commit -am "chore: deployment configuration fixes"
```
