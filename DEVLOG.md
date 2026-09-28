# Crate Web — Devlog

## 2026-03-12: Migration from Claude Agent SDK to Direct Anthropic SDK

### The Problem

Crate's backend uses the **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) to power its music research agent. The Agent SDK works by spawning **Claude Code as a subprocess** via the `query()` function. This architecture is fundamentally incompatible with:

1. **Vercel serverless functions** — Serverless environments don't support long-running subprocesses. Functions have execution time limits (60s default) and no persistent process state.
2. **Railway containers** — Even with a full Docker container running Node.js, the Claude Code subprocess fails with `exit code 1`. The CLI requires a specific environment setup (authentication, session management) that doesn't work in headless container environments.
3. **Any standard deployment** — The Agent SDK is designed for local CLI use where Claude Code is installed and authenticated interactively.

### What We Tried

#### Attempt 1: Deploy directly to Vercel
- **Result**: `Error: Claude Code process exited with code 1`
- The Agent SDK's `query()` spawns a Claude Code subprocess. Vercel's serverless runtime cannot run persistent subprocesses.

#### Attempt 2: Vercel Sandbox
- Vercel offers a "Sandbox" product specifically for the Claude Agent SDK, but it requires enterprise access and has different constraints.

#### Attempt 3: Railway long-running server
- Built a separate Express server deployed to Railway at `https://crate-agent-production.up.railway.app`
- Architecture: Vercel signs a JWT containing the user's API keys → browser sends JWT to Railway → Railway runs CrateAgent → streams SSE back
- Added `git` and `@anthropic-ai/claude-code` to the Docker image
- **Result**: Same `exit code 1`. The Claude Code CLI subprocess fails even in a Docker container with the CLI installed.

#### Attempt 4: JWT size issues (431 Request Header Fields Too Large)
- The JWT initially contained the full prompt suffix (~15KB). Moved prompt construction server-side to shrink the token.
- Also discovered trailing `\n` in Vercel env vars (from `echo "value" | npx vercel env add`) causing JWT signature mismatches. Fixed with `printf '%s'`.

### The Solution: Direct Anthropic SDK

Replace the Agent SDK entirely with the **direct Anthropic SDK** (`@anthropic-ai/sdk`). Instead of spawning a subprocess, we:

1. **Convert tool definitions**: The MCP tools in `crate-cli` use `tool()` from the Agent SDK with Zod schemas. We convert these Zod schemas to JSON Schema format for the Anthropic Messages API's `tools` parameter.
2. **Build a manual agentic loop**: Send user message → if Claude responds with `tool_use` blocks, execute the tool handlers directly in-process → send results back → repeat until Claude responds with `end_turn`.
3. **Stream everything**: Use the Anthropic SDK's streaming mode to emit `CrateEvent`s (answer_token, tool_start, tool_end, done, error) as SSE to the frontend.

### Why This Works

- **No subprocess**: The Anthropic SDK makes HTTP calls to the Messages API. No CLI, no child processes, no special environment.
- **Vercel-compatible**: Standard HTTP requests fit perfectly in serverless functions. The streaming response keeps the connection alive within the 60s limit (configurable up to 300s on Pro plans).
- **OpenRouter-compatible**: The Anthropic SDK accepts a `baseURL` parameter. Setting it to `https://openrouter.ai/api/v1` routes through OpenRouter with zero code changes.
- **Tools run in-process**: The MCP tool handlers are plain async functions that make HTTP calls to external APIs (MusicBrainz, Discogs, etc.). They don't need a subprocess — they run directly in the Node.js runtime.

### Architecture Before vs After

**Before (Agent SDK + Railway):**
```
Browser → /api/agent-token (Vercel, signs JWT)
       → Railway /agent/research (runs CrateAgent subprocess)
       ← SSE stream back to browser
```

**After (Direct Anthropic SDK):**
```
Browser → /api/chat (Vercel)
       → Anthropic Messages API (with tools)
       → Tool handlers run in-process
       ← SSE stream back to browser
```

### What Gets Deleted

- `server/` directory (entire Railway Express server)
- `src/app/api/agent-token/` (JWT signing endpoint)
- `src/lib/agent-token.ts` (JWT signing utility)
- `.vercelignore` (was excluding server/ from Vercel)
- `AGENT_SIGNING_SECRET` and `RAILWAY_AGENT_URL` env vars
- `jose` dependency (JWT library)

### What Gets Created

- `src/lib/tool-adapter.ts` — Converts `SdkMcpToolDefinition` (Zod schemas + handlers) to Anthropic API tool format (JSON Schema) and provides a tool executor
- `src/lib/agentic-loop.ts` — The manual agentic loop: message → tool_use → execute → loop, emitting CrateEvents as an async generator
- Rewritten `src/app/api/chat/route.ts` — Handles ALL tiers (chat + agent) using the direct SDK

### OpenRouter Support

The direct Anthropic SDK supports custom base URLs:

```typescript
import Anthropic from "@anthropic-ai/sdk";

// Direct Anthropic
const client = new Anthropic({ apiKey: anthropicKey });

// Via OpenRouter — same API, different endpoint
const client = new Anthropic({
  apiKey: openRouterKey,
  baseURL: "https://openrouter.ai/api/v1",
});
```

All tool_use, streaming, and the agentic loop work identically through OpenRouter since it's wire-compatible with the Anthropic Messages API.

### Key Decisions

1. **Keep `crate-cli` as a dependency** — We import `getActiveTools()` for tool definitions, `getSystemPrompt()` for the system prompt, and `classifyQuery()` for tier routing. We just skip the `CrateAgent` class and its `query()` calls.
2. **Tools run in the API route process** — The tool handlers are async functions that make HTTP calls. They run directly in the Vercel serverless function, no subprocess needed.
3. **Set env vars before tool resolution** — `getActiveTools()` checks `process.env` for API keys to determine which servers are active. We set env vars from the user's resolved keys before calling it, and restore them after.
4. **SSE format stays identical** — The frontend already parses `CrateEvent` SSE. The new backend emits the exact same event types.
5. **Increase maxDuration** — Research queries can involve 10-25 tool calls. We increase the Vercel function timeout from 60s to 300s.
6. **Zod 4 native JSON Schema** — crate-cli uses Zod 4 which has built-in `z.toJSONSchema()`. No need for `zod-to-json-schema` third-party lib.
7. **Non-streaming for tool turns** — The agentic loop uses non-streaming API calls during tool-use turns (where latency is dominated by tool execution), and chunks text for SSE delivery.

### Implementation Status

**Completed:**
- `src/lib/tool-adapter.ts` — Converts `SdkMcpToolDefinition` Zod schemas to Anthropic API JSON Schema format, provides tool executor
- `src/lib/agentic-loop.ts` — Manual agentic loop with CrateEvent emission
- `src/lib/openui-prompt.ts` — Copied from server/src/lib/ (OpenUI Lang system prompt)
- `src/app/api/chat/route.ts` — Rewritten to handle both chat-tier (fast) and agent-tier (agentic loop with tools)
- `src/components/workspace/chat-panel.tsx` — Simplified from two-step agent-token flow to single `/api/chat` endpoint
- Build passing (TypeScript clean, Next.js build clean)

**Ready to delete (after testing):**
- `server/` directory (Railway Express server)
- `src/app/api/agent-token/route.ts` (JWT signing endpoint)
- `src/lib/agent-token.ts` (JWT signing utility)
- `src/hooks/use-crate-agent.ts` (unused hook)
- `.vercelignore` (was excluding server/)
- Railway deployment at `https://crate-agent-production.up.railway.app`
- Vercel env vars: `AGENT_SIGNING_SECRET`, `RAILWAY_AGENT_URL`
- `jose` dependency (JWT library, check if used elsewhere first)
