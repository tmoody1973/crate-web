# Sidebar, Persistent Chat & Artifacts UX Design

**Date:** 2026-03-11
**Status:** Approved

## Goal

Add a Claude-style sidebar with persistent chat history, crate-based project organization, full-text search, and an artifact panel that slides in on demand — transforming Crate Web from a stateless chat into a persistent music research workspace.

## Architecture

Convex provides real-time persistence and full-text search. Clerk scopes all data by user. The sidebar is a persistent left rail (260px expanded, 48px collapsed). The artifact panel is hidden by default and slides in from the right when the LLM generates OpenUI Lang content.

---

## Section 1: Layout & Sidebar Structure

**Sidebar (persistent left rail):**
- 260px expanded, 48px collapsed (icon-only)
- Toggle via hamburger or `Cmd+B`
- Sections: New Chat button, Search bar, Crates, Starred, Recents, Artifacts, Settings/Avatar

**Main content area:**
- Chat is full-width by default (no split pane)
- Artifact panel slides in from right when OpenUI Lang detected
- When artifact panel open: chat 45%, artifact 55%
- Animated transition (~400ms ease-out)

**Player bar:**
- Fixed bottom, spans full width below both sidebar and main content

## Section 2: Data Model & Convex Schema

### New Tables

**`crates`** — user-created project folders
| Field | Type | Notes |
|-------|------|-------|
| userId | string | Clerk user ID |
| name | string | User-chosen name |
| color | string (optional) | Accent color |
| createdAt | number | Timestamp |

### Modified Tables

**`sessions`** — add fields:
| Field | Type | Notes |
|-------|------|-------|
| crateId | Id<"crates"> (optional) | Folder assignment |
| isStarred | boolean | Quick access |
| lastMessageAt | number | Sort key for recents |

**`messages`** — existing, add search index:
- Convex search index on `content` field for full-text search

**`artifacts`** — add fields:
| Field | Type | Notes |
|-------|------|-------|
| userId | string | Clerk user ID |
| sessionId | Id<"sessions"> | Source session |
| label | string | Auto-extracted from OpenUI Lang root component |
| content | string | OpenUI Lang source |
| contentHash | string | Dedup detection |
| createdAt | number | Timestamp |

### Indexes

- `sessions` by `userId` + `lastMessageAt` (recents)
- `sessions` by `userId` + `isStarred` (starred)
- `sessions` by `userId` + `crateId` (crate contents)
- `messages` search index on `content` (full-text search)
- `artifacts` by `userId` + `createdAt` (artifact browser)

## Section 3: Components & UI Architecture

### Component Tree

```
<AppShell>
  <Sidebar collapsed={boolean}>
    <SidebarHeader>          — logo + collapse toggle
    <NewChatButton>          — prominent, always visible
    <SearchBar>              — Convex search index query
    <SidebarNav>
      <CratesSection>        — collapsible, lists user's crates
        <CrateItem>           — folder icon + name, expands to show sessions
      <StarredSection>        — starred sessions, sorted by lastMessageAt
      <RecentsSection>        — last 20 sessions, grouped by Today/Yesterday/This Week
      <ArtifactsSection>      — browsable artifact history across all sessions
    <SidebarFooter>           — settings gear, user avatar (Clerk)
  </Sidebar>
  <MainContent>
    <ChatPanel>               — full width when no artifact; shrinks when artifact slides in
    <ArtifactSlideIn>         — hidden by default, slides from right when artifact generated
  </MainContent>
  <PlayerBar>                 — fixed bottom, spans full width
</AppShell>
```

### Artifact Slide-In Behavior

- Chat starts full-width (no split pane by default)
- When LLM generates OpenUI Lang, artifact panel slides in from right (animated, ~400ms ease-out)
- Panel takes 55% width, chat shrinks to 45% — uses CSS transition
- User can dismiss (X button) to return chat to full-width
- Panel has a small drag handle for manual resize
- Re-opening an artifact from sidebar or history tab restores the panel

### Chat Persistence Flow

1. User sends message → immediately write to Convex `messages` table (optimistic)
2. SSE stream starts → show typing indicator in chat
3. As assistant chunks arrive → accumulate in local state (not written yet)
4. Stream completes → write full assistant message to Convex
5. If OpenUI Lang detected in response → write artifact to Convex `artifacts` table, trigger slide-in
6. On page load → fetch session's messages from Convex, hydrate chat state

### Session Management

- `useSession` hook manages current session ID (URL param: `/chat/[sessionId]`)
- New Chat creates a Convex session doc, navigates to its URL
- Session title auto-generated from first user message (first 60 chars, or LLM-summarized later)
- Starring a session toggles `isStarred` field

## Section 4: Search & Navigation

### Search

- Convex search index on `messages.content` — full-text search across all messages
- Search bar in sidebar filters as user types (debounced 300ms)
- Results grouped by session: session title + matching message snippet (highlighted)
- Clicking a result navigates to that session and scrolls to matching message

### Sidebar Navigation

- **Recents**: ordered by `lastMessageAt` desc, grouped (Today / Yesterday / This Week / Older), max 20 visible with "Show more"
- **Starred**: sorted by `lastMessageAt`, no grouping
- **Crates**: user-created folders, drag sessions in or assign via right-click
- **Artifacts**: flat list across sessions, sorted by timestamp desc, shows label + session title + date

### Keyboard Shortcuts

- `Cmd+K` — focus search bar
- `Cmd+N` — new chat
- `Cmd+B` — toggle sidebar collapse
- `Cmd+Shift+S` — star/unstar current session

## Section 5: Error Handling & Edge Cases

### Network & Sync

- Convex handles real-time sync — messages queue locally on disconnect and sync on reconnect
- Optimistic updates for user messages
- Failed assistant streams show inline error with retry button
- Partial assistant messages NOT persisted — only complete responses written

### Session Edge Cases

- Navigate away mid-stream: stream aborted, partial response discarded
- Delete session: soft delete (archived flag), data retained but hidden
- Empty sessions: auto-cleaned after 5 minutes with no messages
- Title generation: first user message truncated to 60 chars; under 10 chars uses assistant response

### Artifact Edge Cases

- Malformed OpenUI Lang: show raw content in code block fallback
- Duplicate detection: compare content hash before creating new artifact
- Dismissed panel + same artifact: re-opens without creating duplicate

### Auth

- All queries scoped by Clerk `userId`
- No shared sessions in v1
- Unauthenticated users redirected to sign-in
