# Conversation History for Crate Chat Agent

**Goal:** Pass conversation history from the frontend to the API so the agent maintains context within a session — like Claude and ChatGPT.

**Architecture:** Frontend extracts prior messages from ChatProvider state, trims to a 60K character budget, and sends them alongside the current message in every POST to /api/chat. Both the chat-tier (fast, no tools) and agent-tier (full agentic loop) prepend history to their messages arrays.

**Tech Stack:** No new dependencies. Changes to chat-panel.tsx, route.ts, agentic-loop.ts.

---

## Context

Each chat message is sent to the API as a standalone request with no prior conversation context. When the agent asks a follow-up question ("Want me to discover actual releases?") and the user replies "yes, please", the agent sees only "yes, please" — no idea what it offered. It responds with its intro greeting as if the conversation just started.

The frontend already has the full message history in ChatProvider state (hydrated from Convex on session load). It just doesn't send it.

### How it layers with mem0

Mem0 handles cross-session memory ("user likes jazz fusion"). Conversation history handles within-session context ("you just asked about Bandcamp tags"). They don't overlap.

```
System prompt
  + mem0 memories (cross-session preferences, loaded at session start)
  + conversation history (prior messages in this session)
  + current message
```

No changes to mem0. No changes to Convex schema.

---

## Design

### 1. Frontend: Extract and Trim History

**File:** `src/components/workspace/chat-panel.tsx`

In `processMessage` (line ~929), the function receives the full `messages` array from ChatProvider. Currently it extracts only the last user message text. Change to:

1. Extract all prior messages as `Array<{ role: "user" | "assistant", content: string }>`
2. Only include messages with text content (skip empty, skip messages with only tool-call artifacts)
3. Exclude the current (last) user message (that goes in the `message` field)
4. Trim from the oldest if total character count exceeds `MAX_HISTORY_CHARS` (60,000)
5. Send as `history` in the POST body

```typescript
// Build history from all prior messages (excluding the current one)
const allMessages = messages.slice(0, -1); // exclude current user message
const history: Array<{ role: "user" | "assistant"; content: string }> = [];

for (const m of allMessages) {
  const parts = getContentParts(m.content);
  const text = parts
    .filter((c): c is { type: "text"; text: string } => c.type === "text")
    .map((c) => c.text)
    .join("");
  if (text && (m.role === "user" || m.role === "assistant")) {
    history.push({ role: m.role, content: text });
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

POST body changes from:
```typescript
body: JSON.stringify({ message: messageText, model })
```
to:
```typescript
body: JSON.stringify({ message: messageText, model, history })
```

### 2. Backend: Accept and Route History

**File:** `src/app/api/chat/route.ts`

Parse `history` from the request body:

```typescript
let body: { message?: string; model?: string; history?: Array<{ role: string; content: string }> };
```

Validate history entries (must be `{ role: "user" | "assistant", content: string }`). Pass to both response paths:

```typescript
// Chat-tier
return streamChatDirect(message, apiKey, modelId, useOpenRouter, body.history);

// Agent-tier
return streamAgenticResponse(message, apiKey, modelId, allEnvKeys, resolved.user._id, clerkId, useOpenRouter, isResearchCommand, body.history);
```

### 3. Chat-Tier: History in Direct API Call

**File:** `src/app/api/chat/route.ts` — `streamChatDirect`

Add `history` parameter. Build the messages array with history prepended:

For Anthropic format:
```typescript
messages: [
  ...history.map(m => ({ role: m.role, content: m.content })),
  { role: "user", content: message },
]
```

For OpenRouter (OpenAI format):
```typescript
messages: [
  { role: "system", content: CHAT_SYSTEM },
  ...history.map(m => ({ role: m.role, content: m.content })),
  { role: "user", content: message },
]
```

### 4. Agent-Tier: History in Agentic Loop

**File:** `src/lib/agentic-loop.ts`

Add `history` to `AgenticLoopOptions`:

```typescript
export interface AgenticLoopOptions {
  message: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  // ... existing fields
}
```

In both `anthropicAgenticLoop` and `openAIAgenticLoop`, prepend history to the messages array:

Anthropic path:
```typescript
const messages: Anthropic.MessageParam[] = [
  ...(history ?? []).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })),
  { role: "user", content: message },
];
```

OpenAI path:
```typescript
const messages: OpenAI.ChatCompletionMessageParam[] = [
  { role: "system", content: systemPrompt },
  ...(history ?? []).map(m => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  })),
  { role: "user", content: message },
];
```

### 5. Token Budget Details

- `MAX_HISTORY_CHARS = 60_000` (~15-20K tokens)
- Trim strategy: drop oldest messages first (FIFO)
- Only final text responses are in history (tool call details aren't persisted to Convex, so they never appear in ChatProvider state)
- 200K context window budget after history:
  - System prompt + soul + OpenUI: ~5-10K tokens
  - Mem0 memories: ~1-2K tokens
  - Tool definitions: 30-80K tokens
  - History: ~15-20K tokens
  - Remaining for current turn: ~90-150K tokens

## Constraints

- No new files, no Convex schema changes, no new dependencies
- History is ephemeral per request — backend doesn't store or cache it
- Frontend is source of truth for session messages (already hydrated from Convex)
- Anthropic API requires alternating user/assistant messages — history from ChatProvider naturally satisfies this since it persists messages in order

## Files

| File | Action | Description |
|------|--------|-------------|
| `src/components/workspace/chat-panel.tsx` | Modify | Extract history from ChatProvider messages, trim to budget, send in POST body |
| `src/app/api/chat/route.ts` | Modify | Parse history from body, pass to both streamChatDirect and streamAgenticResponse |
| `src/lib/agentic-loop.ts` | Modify | Accept history in options, prepend to messages array in both Anthropic and OpenAI paths |

## Verification

1. `npx tsc --noEmit` — clean compile
2. Open chat, ask "What genres are related to ambient on Bandcamp?" — agent responds with tag results
3. Follow up with "yes, explore those" or "tell me more about the top one" — agent should understand the context
4. Long session test: send 20+ messages, verify no context window errors
5. New session test: verify agent doesn't carry history from a different session
