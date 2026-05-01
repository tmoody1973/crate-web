# Custom Skills System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users create personal slash commands by describing what they need in natural language. The agent discovers tools, runs a dry run, and saves the result as a reusable command.

**Architecture:** Skills are prompt templates stored in a Convex `userSkills` table. On execution, the template is injected into the existing agentic loop. Tool hints from the creation dry run bias tool selection but the agent can deviate. Skill creation happens conversationally in chat via `/create-skill` or natural language.

**Tech Stack:** Next.js 14 (App Router), Convex, TypeScript, Clerk (auth)

**Spec:** `docs/plans/2026-03-19-custom-skills-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `convex/userSkills.ts` | Convex queries/mutations for skill CRUD (list, get, create, update, toggle, delete, countByUser) |
| `src/app/api/skills/route.ts` | REST API for listing user's skills (used by ChatInput for autocomplete) |
| `src/app/api/skills/[skillId]/route.ts` | REST API for skill PATCH (edit) and DELETE |
| `src/app/api/skills/[skillId]/toggle/route.ts` | REST API for toggling skill enabled/disabled |
| `src/components/settings/skills-section.tsx` | Skills management UI in Settings drawer |

### Modified Files
| File | Change |
|------|--------|
| `convex/schema.ts` | Add `userSkills` table with indexes |
| `src/lib/plans.ts` | Add `maxCustomSkills` to `PlanLimits` interface and all tier configs |
| `src/lib/chat-utils.ts` | Add `/create-skill` and `/skills` to `preprocessSlashCommand`, update `getSessionTitle`, add to `getGatedCommand` |
| `src/app/api/chat/route.ts` | Resolve custom skills before agentic loop — query Convex for matching skill, inject prompt template |
| `src/components/workspace/chat-panel.tsx` | Fetch user skills on mount, append to slash command autocomplete menu |
| `src/components/settings/settings-drawer.tsx` | Import and render `SkillsSection` below `PlanSection` |

---

## Chunk 1: Foundation (Schema + CRUD + Plan Limits)

### Task 1: Add `userSkills` Table to Convex Schema

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add `userSkills` table definition**

After the `usageEvents` table (line 261), add:

```typescript
  userSkills: defineTable({
    userId: v.id("users"),
    command: v.string(),
    name: v.string(),
    description: v.string(),
    promptTemplate: v.string(),
    toolHints: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
    visibility: v.literal("private"),
    isEnabled: v.boolean(),
    schedule: v.optional(v.string()),
    lastRunAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"])
    .index("by_user_command", ["userId", "command"]),
```

- [ ] **Step 2: Commit**

```bash
git add convex/schema.ts
git commit -m "feat: add userSkills table to Convex schema"
```

---

### Task 2: Create Convex Skill Mutations and Queries

**Files:**
- Create: `convex/userSkills.ts`

- [ ] **Step 1: Create the file with all queries and mutations**

```typescript
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getByUserCommand = query({
  args: { userId: v.id("users"), command: v.string() },
  handler: async (ctx, { userId, command }) => {
    return await ctx.db
      .query("userSkills")
      .withIndex("by_user_command", (q) =>
        q.eq("userId", userId).eq("command", command),
      )
      .first();
  },
});

export const countByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const skills = await ctx.db
      .query("userSkills")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    return skills.length;
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    command: v.string(),
    name: v.string(),
    description: v.string(),
    promptTemplate: v.string(),
    toolHints: v.array(v.string()),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Check for duplicate command name
    const existing = await ctx.db
      .query("userSkills")
      .withIndex("by_user_command", (q) =>
        q.eq("userId", args.userId).eq("command", args.command),
      )
      .first();
    if (existing) {
      throw new Error(`Command /${args.command} already exists`);
    }

    const now = Date.now();
    return await ctx.db.insert("userSkills", {
      ...args,
      visibility: "private" as const,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const update = mutation({
  args: {
    skillId: v.id("userSkills"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    promptTemplate: v.optional(v.string()),
    toolHints: v.optional(v.array(v.string())),
    sourceUrl: v.optional(v.string()),
  },
  handler: async (ctx, { skillId, ...fields }) => {
    const updates: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined) updates[key] = value;
    }
    await ctx.db.patch(skillId, updates);
  },
});

export const toggleEnabled = mutation({
  args: { skillId: v.id("userSkills") },
  handler: async (ctx, { skillId }) => {
    const skill = await ctx.db.get(skillId);
    if (!skill) throw new Error("Skill not found");
    await ctx.db.patch(skillId, {
      isEnabled: !skill.isEnabled,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { skillId: v.id("userSkills") },
  handler: async (ctx, { skillId }) => {
    await ctx.db.delete(skillId);
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/userSkills.ts
git commit -m "feat: add Convex queries and mutations for user skills CRUD"
```

---

### Task 3: Update Plan Limits

**Files:**
- Modify: `src/lib/plans.ts`

- [ ] **Step 1: Add `maxCustomSkills` and `maxScheduledSkills` to `PlanLimits` interface**

Add after `hasSharedOrgKeys`:

```typescript
  maxCustomSkills: number;
  maxScheduledSkills: number; // future — added now to avoid migration
```

- [ ] **Step 2: Add values to each plan**

```typescript
// free:
maxCustomSkills: 3,
maxScheduledSkills: 0,

// pro:
maxCustomSkills: 20,
maxScheduledSkills: 3,

// team:
maxCustomSkills: 50,
maxScheduledSkills: 10,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/plans.ts
git commit -m "feat: add maxCustomSkills to plan limits (free=3, pro=20, team=50)"
```

---

## Chunk 2: Skill Resolution + Execution in Chat Route

### Task 4: Create Skills List API Route

**Files:**
- Create: `src/app/api/skills/route.ts`

This route returns the user's custom skills for the slash command autocomplete menu.

- [ ] **Step 1: Create the route**

```typescript
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function GET() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    return Response.json({ skills: [] });
  }

  const skills = await convex.query(api.userSkills.listByUser, {
    userId: user._id,
  });

  // Return only enabled skills, mapped to the shape ChatInput needs
  const enabled = skills
    .filter((s) => s.isEnabled)
    .map((s) => ({
      command: `/${s.command}`,
      description: s.description,
      name: s.name,
      isCustom: true,
    }));

  return Response.json({ skills: enabled });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/skills/route.ts
git commit -m "feat: add /api/skills GET route for autocomplete menu"
```

---

### Task 5: Add Skill Resolution to Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

The chat route needs to check for custom skills after built-in slash commands fail to match. This happens after `preprocessSlashCommand` — if the message still starts with `/` and wasn't handled by a built-in command, check Convex for a user skill.

- [ ] **Step 1: Add skill resolution after slash command preprocessing**

Find this block (around line 523-524):

```typescript
  // Slash command preprocessing
  const message = preprocessSlashCommand(rawMessage);
```

Replace with:

```typescript
  // Slash command preprocessing — built-in commands first
  let message = preprocessSlashCommand(rawMessage);

  // If message still starts with / and wasn't transformed, check for custom skill
  let isCustomSkill = false;
  if (message === rawMessage && rawMessage.trim().startsWith("/")) {
    const trimmed = rawMessage.trim();
    const spaceIdx = trimmed.indexOf(" ");
    const cmd = (spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx)).toLowerCase();
    const cmdArg = spaceIdx === -1 ? "" : trimmed.slice(spaceIdx + 1).trim();

    // Skip built-in non-preprocessed commands (setup, help)
    if (!["setup", "help", "skills", "create-skill"].includes(cmd)) {
      const skill = await convex.query(api.userSkills.getByUserCommand, {
        userId: resolved.user._id as Id<"users">,
        command: cmd,
      });

      if (skill && skill.isEnabled) {
        isCustomSkill = true;
        // Inject prompt template with optional user argument
        message = [
          `[Running custom skill: ${skill.name}]`,
          ``,
          skill.promptTemplate,
          cmdArg ? `\nUser specified: "${cmdArg}"` : ``,
        ].filter(Boolean).join("\n");
      }
    }
  }
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: resolve custom user skills in chat route before agentic loop"
```

---

### Task 6: Add `/create-skill` and `/skills` Slash Commands

**Files:**
- Modify: `src/lib/chat-utils.ts`

- [ ] **Step 1: Add `/create-skill` case to `preprocessSlashCommand`**

In the `switch (cmd.toLowerCase())` block, before the `default:` case, add:

```typescript
    case "create-skill": {
      if (!arg) {
        return [
          `I'll help you create a custom command. Describe what you want it to do.`,
          ``,
          `Examples:`,
          `- "Pull upcoming events from The Rave Milwaukee website"`,
          `- "Check Discogs for new vinyl releases in jazz"`,
          `- "Find this week's local Milwaukee music news"`,
          ``,
          `What should your command do?`,
        ].join("\n");
      }

      return [
        `The user wants to create a custom skill. Here's what they described:`,
        `"${arg}"`,
        ``,
        `SKILL CREATION WORKFLOW:`,
        `1. First, run the task they described using available tools (this is the dry run)`,
        `2. Show the results to the user`,
        `3. If the results look good, ask the user to confirm saving it as a custom command`,
        `4. Ask what they want to call the command (suggest a name based on the task)`,
        `5. When confirmed, call save_user_skill with:`,
        `   - command: the chosen name (lowercase, hyphens, no spaces)`,
        `   - name: a human-readable name`,
        `   - description: one sentence describing what it does`,
        `   - promptTemplate: the prompt that produced the successful dry run`,
        `   - toolHints: array of tool names that worked during the dry run`,
        `   - sourceUrl: the URL if a website was involved`,
        ``,
        `IMPORTANT: Actually run the research first using real tools. Do not skip the dry run.`,
      ].join("\n");
    }

    case "skills": {
      return [
        `List all of the user's custom skills.`,
        `Call list_user_skills to get them, then display each one with:`,
        `- Command name (e.g. /rave-events)`,
        `- Description`,
        `- Whether it's enabled or disabled`,
        `If the user has no custom skills, suggest they create one with /create-skill.`,
      ].join("\n");
    }
```

- [ ] **Step 2: Add `/create-skill` and `/skills` to `getSessionTitle`**

In the `switch (cmd)` block in `getSessionTitle`, add:

```typescript
      case "create-skill":
        return arg ? `Create Skill: ${arg.slice(0, 30)}` : "Create Skill";
      case "skills":
        return "My Skills";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add src/lib/chat-utils.ts
git commit -m "feat: add /create-skill and /skills slash commands"
```

---

## Chunk 3: Skill Save/List Tools for the Agent

### Task 7: Create Agent-Callable Skill Tools

**Files:**
- Create: `src/lib/web-tools/user-skills.ts`

The agent needs tools to save and list skills during the creation flow. These are web tools (like telegraph, tumblr, etc.) added to the agentic loop.

- [ ] **Step 1: Create the tool file**

```typescript
/**
 * Agent-callable tools for managing user custom skills.
 * Used during /create-skill flow and /skills listing.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createUserSkillTools(
  convexUrl: string,
  userId: Id<"users">,
  maxSkills: number,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  const saveSkillHandler = async (args: {
    command: string;
    name: string;
    description: string;
    promptTemplate: string;
    toolHints: string[];
    sourceUrl?: string;
  }) => {
    // Validate command format
    const cmd = args.command.toLowerCase().replace(/^\//, "").replace(/[^a-z0-9-]/g, "");
    if (!cmd || cmd.length < 2 || cmd.length > 30) {
      return toolResult({ error: "Command must be 2-30 characters, lowercase letters, numbers, and hyphens only." });
    }

    // Check skill count limit
    const count = await convex.query(api.userSkills.countByUser, { userId });
    if (count >= maxSkills) {
      return toolResult({
        error: `Skill limit reached (${maxSkills}). Delete an existing skill or upgrade your plan.`,
      });
    }

    try {
      const id = await convex.mutation(api.userSkills.create, {
        userId,
        command: cmd,
        name: args.name,
        description: args.description,
        promptTemplate: args.promptTemplate,
        toolHints: args.toolHints,
        sourceUrl: args.sourceUrl,
      });
      return toolResult({
        success: true,
        command: `/${cmd}`,
        name: args.name,
        id,
        message: `Skill saved! Type /${cmd} anytime to run it.`,
      });
    } catch (err) {
      return toolResult({
        error: err instanceof Error ? err.message : "Failed to save skill",
      });
    }
  };

  const listSkillsHandler = async () => {
    const skills = await convex.query(api.userSkills.listByUser, { userId });
    if (skills.length === 0) {
      return toolResult({
        skills: [],
        message: "No custom skills yet. Use /create-skill to create one.",
      });
    }
    return toolResult({
      skills: skills.map((s) => ({
        command: `/${s.command}`,
        name: s.name,
        description: s.description,
        isEnabled: s.isEnabled,
        sourceUrl: s.sourceUrl ?? null,
        toolHints: s.toolHints,
      })),
      count: skills.length,
      limit: maxSkills,
    });
  };

  return [
    {
      name: "save_user_skill",
      description:
        "Save a custom skill as a reusable slash command for the user. Call this after a successful dry run to persist the skill. The command name should be lowercase with hyphens (e.g. 'rave-events').",
      inputSchema: {
        command: z.string().describe("Command name without slash (e.g. 'rave-events')"),
        name: z.string().describe("Human-readable name (e.g. 'The Rave Events')"),
        description: z.string().describe("One sentence describing what it does"),
        promptTemplate: z.string().describe("The full prompt that produced the successful dry run results"),
        toolHints: z.array(z.string()).describe("Tool names that worked during the dry run"),
        sourceUrl: z.string().optional().describe("URL if a website was involved"),
      },
      handler: saveSkillHandler,
    },
    {
      name: "list_user_skills",
      description: "List all custom skills the user has created. Shows command name, description, and status.",
      inputSchema: {},
      handler: listSkillsHandler,
    },
  ];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/web-tools/user-skills.ts
git commit -m "feat: add save_user_skill and list_user_skills agent tools"
```

---

### Task 8: Wire Skill Tools into Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`

- [ ] **Step 1: Add import at top**

```typescript
import { createUserSkillTools } from "@/lib/web-tools/user-skills";
```

- [ ] **Step 2: Add tool creation in `streamAgenticResponse`**

After the `webBandcampTools` line and before the `webPrepResearchTools` block, add:

```typescript
        // User skill management tools (create-skill, list skills)
        const webUserSkillTools = createUserSkillTools(
          convexUrl, userId, /* maxSkills passed via new param */ 20,
        );
```

Wait — we need `maxSkills` in `streamAgenticResponse`. Add it as a parameter.

- [ ] **Step 3: Add `maxSkills` param to `streamAgenticResponse` signature**

Add after `hasInfluenceWrite?: boolean`:

```typescript
  maxSkills?: number,
```

Then update the tool creation:

```typescript
        const webUserSkillTools = createUserSkillTools(
          convexUrl, userId, maxSkills ?? 3,
        );
```

- [ ] **Step 4: Add to tool groups array**

After the `prep-research` entry, add:

```typescript
          { serverName: "user-skills", tools: webUserSkillTools },
```

- [ ] **Step 5: Pass `maxSkills` from POST handler call site**

Update the `streamAgenticResponse` call at the bottom of POST to add:

```typescript
    adminBypass ? 999 : limits.maxCustomSkills,
```

As the last argument.

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 7: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: wire user skill tools into agentic loop"
```

---

## Chunk 4: Slash Command Autocomplete

### Task 9: Append Custom Skills to Slash Command Menu

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx`

- [ ] **Step 1: Add state for custom skills**

In `ChatPanel` component, after the existing state declarations, add:

```typescript
  const [customSkills, setCustomSkills] = useState<
    Array<{ command: string; description: string; name: string; isCustom: boolean }>
  >([]);
```

- [ ] **Step 2: Fetch custom skills on mount**

Add a `useEffect` after the existing key-check effect:

```typescript
  // Fetch user's custom skills for autocomplete
  useEffect(() => {
    fetch("/api/skills")
      .then((r) => r.json())
      .then((data) => setCustomSkills(data.skills ?? []))
      .catch(() => {});
  }, []);
```

- [ ] **Step 3: Build merged command list and pass to SlashCommandMenu**

The `SLASH_COMMANDS` array is hardcoded at module level. The `SlashCommandMenu` component independently filters this array. We need to:
1. Build a merged `allCommands` array in `ChatInput`
2. Pass it to `SlashCommandMenu` instead of letting it use the hardcoded array

**In `ChatInput`**, build the merged list and update `filteredCommands`:

Replace:

```typescript
  const filteredCommands = SLASH_COMMANDS.filter(
    (c) => c.command.startsWith(slashFilter.toLowerCase()) || c.description.toLowerCase().includes(slashFilter.slice(1).toLowerCase()),
  );
```

With:

```typescript
  const allCommands = useMemo(() => [
    ...SLASH_COMMANDS,
    ...(customSkills ?? []).map((s) => ({
      command: s.command,
      description: s.description,
      usage: `${s.command} [optional args]`,
      example: s.command,
      isCustom: true as const,
    })),
  ], [customSkills]);

  const filteredCommands = allCommands.filter(
    (c) => c.command.startsWith(slashFilter.toLowerCase()) || c.description.toLowerCase().includes(slashFilter.slice(1).toLowerCase()),
  );
```

- [ ] **Step 4: Update `SlashCommandMenu` to accept commands as a prop**

Change the `SlashCommandMenu` signature to accept a `commands` prop and remove its internal filtering:

```typescript
function SlashCommandMenu({
  commands,
  filter,
  onSelect,
  selectedIndex,
}: {
  commands: Array<{ command: string; description: string; usage?: string; isCustom?: boolean }>;
  filter: string;
  onSelect: (cmd: string) => void;
  selectedIndex: number;
}) {
  if (commands.length === 0) return null;
  // ... render commands instead of filtered
```

Remove the internal `SLASH_COMMANDS.filter(...)` — the parent now passes filtered results.

Update the `SlashCommandMenu` call in `ChatInput`:

```tsx
<SlashCommandMenu
  commands={filteredCommands}
  filter={slashFilter}
  onSelect={handleSelect}
  selectedIndex={selectedIndex}
/>
```

- [ ] **Step 5: Pass `customSkills` from ChatPanel into ChatInput**

Add `customSkills` to the `ChatInput` props interface and pass it down:

```typescript
// In ChatInput signature, add:
customSkills?: Array<{ command: string; description: string; name: string; isCustom: boolean }>;

// In ChatPanel JSX, update ChatInput:
<ChatInput
  resendMessage={resendMessage}
  onResendConsumed={() => setResendMessage(null)}
  onOpenSetup={handleOpenSetup}
  customSkills={customSkills}
/>
```

- [ ] **Step 6: Show "custom" badge in SlashCommandMenu**

In the `SlashCommandMenu` render, after the description `<p>`, add:

```tsx
{"isCustom" in cmd && cmd.isCustom && (
  <span className="ml-1 rounded bg-zinc-700 px-1 py-0.5 text-[10px] text-zinc-400">custom</span>
)}
```

- [ ] **Step 6: Also add `/create-skill` and `/skills` to `SLASH_COMMANDS`**

In the `SLASH_COMMANDS` array, add:

```typescript
  { command: "/skills", description: "List your custom skills", usage: "/skills", example: "/skills" },
  { command: "/create-skill", description: "Create a new custom command", usage: "/create-skill [description]", example: "/create-skill pull events from The Rave" },
```

- [ ] **Step 7: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 8: Commit**

```bash
git add src/components/workspace/chat-panel.tsx
git commit -m "feat: show custom skills in slash command autocomplete menu"
```

---

## Chunk 5: Settings UI

### Task 10: Create Skills Section Component

**Files:**
- Create: `src/components/settings/skills-section.tsx`

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useEffect } from "react";

interface Skill {
  _id: string;
  command: string;
  name: string;
  description: string;
  promptTemplate: string;
  toolHints: string[];
  sourceUrl?: string;
  isEnabled: boolean;
}

export function SkillsSection() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrompt, setEditPrompt] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch("/api/skills?full=true")
      .then((r) => r.json())
      .then((data) => setSkills(data.skills ?? []))
      .catch(() => {});
  }, [refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const toggleEnabled = async (skillId: string) => {
    try {
      const res = await fetch(`/api/skills/${skillId}/toggle`, { method: "POST" });
      if (!res.ok) console.error("Toggle failed:", res.status);
    } catch (err) {
      console.error("Toggle failed:", err);
    }
    refresh();
  };

  const deleteSkill = async (skillId: string) => {
    if (!confirm("Delete this skill? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/skills/${skillId}`, { method: "DELETE" });
      if (!res.ok) console.error("Delete failed:", res.status);
    } catch (err) {
      console.error("Delete failed:", err);
    }
    refresh();
  };

  const savePrompt = async (skillId: string) => {
    try {
      const res = await fetch(`/api/skills/${skillId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ promptTemplate: editPrompt }),
      });
      if (!res.ok) console.error("Save failed:", res.status);
    } catch (err) {
      console.error("Save failed:", err);
    }
    setEditingId(null);
    refresh();
  };

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-zinc-400">
          Custom Skills
        </h3>
        <span className="text-xs text-zinc-600">
          Type /create-skill in chat
        </span>
      </div>
      {skills.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-700 p-4 text-center text-sm text-zinc-500">
          No custom skills yet. Type <span className="font-mono text-cyan-500">/create-skill</span> in chat to create one.
        </p>
      ) : (
      <div className="space-y-2">
        {skills.map((skill) => (
          <div
            key={skill._id}
            className="rounded-lg border border-zinc-700 bg-zinc-800 p-3"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-cyan-400">
                  /{skill.command}
                </span>
                <span className="text-sm text-zinc-400">{skill.description}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleEnabled(skill._id)}
                  className={`rounded px-2 py-0.5 text-xs ${
                    skill.isEnabled
                      ? "bg-green-500/20 text-green-400"
                      : "bg-zinc-700 text-zinc-500"
                  }`}
                >
                  {skill.isEnabled ? "On" : "Off"}
                </button>
                <button
                  onClick={() =>
                    setExpandedId(expandedId === skill._id ? null : skill._id)
                  }
                  className="text-xs text-zinc-500 hover:text-zinc-300"
                >
                  {expandedId === skill._id ? "Hide" : "Details"}
                </button>
              </div>
            </div>

            {expandedId === skill._id && (
              <div className="mt-3 space-y-2 border-t border-zinc-700 pt-3">
                {skill.sourceUrl && (
                  <p className="text-xs text-zinc-500">
                    Source: {skill.sourceUrl}
                  </p>
                )}
                <p className="text-xs text-zinc-500">
                  Tools: {skill.toolHints.join(", ") || "none"}
                </p>

                {editingId === skill._id ? (
                  <div>
                    <textarea
                      value={editPrompt}
                      onChange={(e) => setEditPrompt(e.target.value)}
                      rows={4}
                      className="w-full resize-none rounded border border-zinc-600 bg-zinc-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                    />
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => savePrompt(skill._id)}
                        className="rounded bg-cyan-600 px-3 py-1 text-xs text-white hover:bg-cyan-500"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <pre className="whitespace-pre-wrap rounded bg-zinc-900 p-2 text-xs text-zinc-400">
                      {skill.promptTemplate}
                    </pre>
                    <div className="mt-2 flex gap-2">
                      <button
                        onClick={() => {
                          setEditingId(skill._id);
                          setEditPrompt(skill.promptTemplate);
                        }}
                        className="text-xs text-zinc-500 hover:text-zinc-300"
                      >
                        Edit Prompt
                      </button>
                      <button
                        onClick={() => deleteSkill(skill._id)}
                        className="text-xs text-red-500 hover:text-red-400"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/settings/skills-section.tsx
git commit -m "feat: add SkillsSection component for settings drawer"
```

---

### Task 11: Create Skill Management API Routes

**Files:**
- Modify: `src/app/api/skills/route.ts` (update to support `?full=true`)
- Create: `src/app/api/skills/[skillId]/route.ts` (PATCH, DELETE)
- Create: `src/app/api/skills/[skillId]/toggle/route.ts` (POST)

- [ ] **Step 1: Update `/api/skills/route.ts` to support full mode**

Add to the GET handler, after the `enabled` mapping:

```typescript
  // Full mode returns all skills with full details (for Settings)
  const url = new URL(req.url);
  if (url.searchParams.get("full") === "true") {
    return Response.json({ skills });
  }
```

Update the function signature to accept `req: Request`:

```typescript
export async function GET(req: Request) {
```

- [ ] **Step 2: Create `src/app/api/skills/[skillId]/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/** Verify the authenticated user owns this skill. Returns 401/404 Response on failure, null on success. */
async function verifyOwnership(clerkId: string, skillId: string) {
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) return new Response("User not found", { status: 404 });

  const skills = await convex.query(api.userSkills.listByUser, { userId: user._id });
  const owns = skills.some((s) => s._id === skillId);
  if (!owns) return new Response("Not your skill", { status: 403 });

  return null; // ownership verified
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const { skillId } = await params;

  const denied = await verifyOwnership(clerkId, skillId);
  if (denied) return denied;

  const body = await req.json();

  await convex.mutation(api.userSkills.update, {
    skillId: skillId as Id<"userSkills">,
    promptTemplate: body.promptTemplate,
  });

  return Response.json({ success: true });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const { skillId } = await params;

  const denied = await verifyOwnership(clerkId, skillId);
  if (denied) return denied;

  await convex.mutation(api.userSkills.remove, {
    skillId: skillId as Id<"userSkills">,
  });

  return Response.json({ success: true });
}
```

- [ ] **Step 3: Create `src/app/api/skills/[skillId]/toggle/route.ts`**

```typescript
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { Id } from "../../../../../../convex/_generated/dataModel";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  const { userId: clerkId } = await auth();
  if (!clerkId) return new Response("Unauthorized", { status: 401 });

  const { skillId } = await params;

  await convex.mutation(api.userSkills.toggleEnabled, {
    skillId: skillId as Id<"userSkills">,
  });

  return Response.json({ success: true });
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add src/app/api/skills/
git commit -m "feat: add skill management API routes (PATCH, DELETE, toggle)"
```

---

### Task 12: Add SkillsSection to Settings Drawer

**Files:**
- Modify: `src/components/settings/settings-drawer.tsx`

- [ ] **Step 1: Import SkillsSection**

```typescript
import { SkillsSection } from "./skills-section";
```

- [ ] **Step 2: Render below PlanSection**

After `<PlanSection />` (line 77) and before `<h3 className="mb-3...">Required</h3>`, add:

```tsx
<SkillsSection />
```

- [ ] **Step 3: Commit**

```bash
git add src/components/settings/settings-drawer.tsx
git commit -m "feat: add SkillsSection to settings drawer"
```

---

## Chunk 6: Final Verification

### Task 13: Full Build Verification

- [ ] **Step 1: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 2: Verify no regressions in existing slash commands**

Read `src/lib/chat-utils.ts` and confirm:
- `/news`, `/prep`, `/influence`, `/publish`, `/published`, `/radio` still work
- `/create-skill` and `/skills` are new entries
- `getSessionTitle` handles the new commands

- [ ] **Step 3: Commit any remaining fixes**

```bash
git add -A
git commit -m "chore: finalize custom skills system"
```

---

## Verification Checklist

### Build
- `npx tsc --noEmit` — TypeScript compiles
- All imports resolve correctly

### Manual Testing
1. **Create a skill**: Type `/create-skill pull events from The Rave Milwaukee` → agent runs dry run → offers to save → saved to Convex
2. **Run a skill**: Type `/rave-events` → agent executes the prompt template → shows results
3. **Run with args**: Type `/rave-events this weekend` → agent scopes to weekend events
4. **List skills**: Type `/skills` → shows the saved skill
5. **Autocomplete**: Type `/r` in chat → shows both `/radio` and `/rave-events`
6. **Settings**: Open Settings → SkillsSection shows the skill with toggle, edit, delete
7. **Plan limit**: Free user with 3 skills tries to create 4th → rejected
8. **Disable**: Toggle skill off in Settings → `/rave-events` no longer resolves
