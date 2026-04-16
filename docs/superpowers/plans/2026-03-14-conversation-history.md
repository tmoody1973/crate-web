# Conversation History Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pass conversation history from the frontend to the API so the Crate agent maintains context within a session.

**Architecture:** Frontend extracts prior messages from ChatProvider state, trims to a 60K character budget, sends in POST body. Backend passes history to both the chat-tier direct call and the agentic loop. Both LLM paths prepend history to their messages arrays.

**Tech Stack:** TypeScript, Next.js, @openuidev/react-headless (ChatProvider), Anthropic SDK, OpenAI SDK

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/agentic-loop.ts` | Modify | Accept `history` in options, prepend to messages array in both Anthropic and OpenAI paths |
| `src/app/api/chat/route.ts` | Modify | Parse `history` from request body, pass to `streamChatDirect` and `streamAgenticResponse` |
| `src/components/workspace/chat-panel.tsx` | Modify | Extract history from ChatProvider messages, trim to budget, include in POST body |

---

## Chunk 1: Full Implementation

### Task 1: Add History Support to Agentic Loop

**Files:**
- Modify: `src/lib/agentic-loop.ts:31-41` (AgenticLoopOptions interface)
- Modify: `src/lib/agentic-loop.ts:100-107` (Anthropic messages init)
- Modify: `src/lib/agentic-loop.ts:181-193` (OpenAI messages init)

- [ ] **Step 1: Add history to AgenticLoopOptions**

In `src/lib/agentic-loop.ts`, add `history` to the options interface at line 32:

```typescript
export interface AgenticLoopOptions {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  systemPrompt: string;
  model: string;
  apiKey: string;
  /** When true, route through OpenRouter (OpenAI-compatible API) */
  useOpenRouter?: boolean;
  toolGroups: Array<{ serverName: string; tools: CrateToolDef[] }>;
  maxTurns?: number;
  signal?: AbortSignal;
}
```

- [ ] **Step 2: Prepend history in Anthropic loop**

In `anthropicLoop` (line ~100), change the destructuring to include `history` and update the messages init:

```typescript
const { message, history, systemPrompt, model, apiKey, maxTurns = 25, signal } = options;
```

Replace the messages array initialization (lines 105-107):

```typescript
  const messages: Anthropic.MessageParam[] = [
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];
```

- [ ] **Step 3: Prepend history in OpenRouter loop**

In `openRouterLoop` (line ~181), change the destructuring to include `history`:

```typescript
const { message, history, systemPrompt, model, apiKey, maxTurns = 25, signal } = options;
```

Replace the messages array initialization (lines 190-193):

```typescript
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system" as const, content: systemPrompt },
    ...(history ?? []).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: message },
  ];
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors (history is optional, so no callers need to change yet)

- [ ] **Step 5: Commit**

```bash
git add src/lib/agentic-loop.ts
git commit -m "feat: add conversation history support to agentic loop"
```

---

### Task 2: Wire History Through Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts:37-42` (streamChatDirect signature)
- Modify: `src/app/api/chat/route.ts:55-71` (streamChatDirect body construction)
- Modify: `src/app/api/chat/route.ts:149-158` (streamAgenticResponse signature)
- Modify: `src/app/api/chat/route.ts:308-316` (agenticLoop call)
- Modify: `src/app/api/chat/route.ts:398-406` (request body parsing)
- Modify: `src/app/api/chat/route.ts:459-466` (function calls at end)

- [ ] **Step 1: Update request body type and parsing**

Change the body type (line ~398):

```typescript
  let body: { message?: string; model?: string; history?: Array<{ role: string; content: string }> };
```

After parsing, sanitize history (after line ~406, after `rawMessage` extraction):

```typescript
  // Sanitize history — only allow user/assistant roles with string content
  const history = (body.history ?? [])
    .filter(
      (m): m is { role: "user" | "assistant"; content: string } =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.length > 0,
    );
```

- [ ] **Step 2: Add history parameter to streamChatDirect**

Update the function signature (line ~37):

```typescript
async function streamChatDirect(
  message: string,
  apiKey: string,
  modelId: string,
  useOpenRouter?: boolean,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<Response> {
```

Update the Anthropic body construction (the non-OpenRouter branch, line ~65):

```typescript
    : {
        model: modelId,
        max_tokens: 1024,
        stream: true,
        system: CHAT_SYSTEM,
        messages: [
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
      };
```

Update the OpenRouter body construction (line ~55):

```typescript
    ? {
        model: modelId,
        max_tokens: 1024,
        stream: true,
        messages: [
          { role: "system", content: CHAT_SYSTEM },
          ...(history ?? []).map((m) => ({ role: m.role, content: m.content })),
          { role: "user", content: message },
        ],
      }
```

- [ ] **Step 3: Add history parameter to streamAgenticResponse**

Update the function signature (line ~149):

```typescript
async function streamAgenticResponse(
  message: string,
  apiKey: string,
  modelId: string,
  envKeys: Record<string, string>,
  convexUserId: string,
  clerkId: string,
  useOpenRouter?: boolean,
  isResearchCommand?: boolean,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<Response> {
```

Pass history to the agenticLoop call (line ~308):

```typescript
        const events = agenticLoop({
          message,
          history,
          systemPrompt,
          model: modelId,
          apiKey,
          useOpenRouter,
          toolGroups,
          maxTurns: isResearchCommand ? 35 : 25,
        });
```

- [ ] **Step 4: Pass history in both call sites**

Update the `streamChatDirect` call (line ~459):

```typescript
    return streamChatDirect(message, apiKey, modelId, useOpenRouter, history);
```

Update the `streamAgenticResponse` call (line ~466):

```typescript
  return streamAgenticResponse(message, apiKey, modelId, allEnvKeys, resolved.user._id, clerkId, useOpenRouter, isResearchCommand, history);
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/app/api/chat/route.ts
git commit -m "feat: wire conversation history through chat route to both response paths"
```

---

### Task 3: Send History from Frontend

**Files:**
- Modify: `src/components/workspace/chat-panel.tsx:929-945` (processMessage function)

- [ ] **Step 1: Add history extraction and trimming in processMessage**

In the `processMessage` callback (line ~929), after extracting `messageText` (line ~938) and before the `fetch` call (line ~942), add:

```typescript
      // Build conversation history from prior messages (excluding current)
      const priorMessages = messages.slice(0, -1);
      const history: Array<{ role: "user" | "assistant"; content: string }> = [];
      for (const m of priorMessages) {
        if (m.role !== "user" && m.role !== "assistant") continue;
        const parts = getContentParts(m.content);
        const text = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (text) {
          history.push({ role: m.role as "user" | "assistant", content: text });
        }
      }

      // Trim oldest messages to fit within token budget
      const MAX_HISTORY_CHARS = 60_000;
      let totalChars = history.reduce((sum, m) => sum + m.content.length, 0);
      while (totalChars > MAX_HISTORY_CHARS && history.length > 0) {
        const removed = history.shift()!;
        totalChars -= removed.content.length;
      }
```

Then update the fetch body (line ~945):

```typescript
        body: JSON.stringify({ message: messageText, model, history: history.length > 0 ? history : undefined }),
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/components/workspace/chat-panel.tsx
git commit -m "feat: send conversation history from frontend in chat requests"
```

---

### Task 4: Build, Push, and Verify

- [ ] **Step 1: Full build check**

Run: `npx next build 2>&1 | tail -10`
Expected: Build succeeds

- [ ] **Step 2: Push and deploy**

```bash
git push origin main
```

- [ ] **Step 3: Manual verification**

Open the deployed app and test:

1. Ask: "What genres are related to ambient on Bandcamp?"
2. Wait for response
3. Follow up: "yes, explore those" — agent should understand what "those" refers to
4. Follow up: "tell me more about the top one" — agent should know which tag was #1
5. Start a NEW session — verify agent doesn't carry over history from the previous session

---

## Verification Summary

1. `npx tsc --noEmit` — clean compile after each task
2. `npx next build` — full build succeeds
3. Follow-up messages maintain context within a session
4. "yes" / "go ahead" / "tell me more" work as expected
5. New sessions start fresh (no cross-session bleed)
6. Long sessions (20+ messages) don't crash from context overflow
