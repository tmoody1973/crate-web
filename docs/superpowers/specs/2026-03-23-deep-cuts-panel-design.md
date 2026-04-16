# Deep Cuts Panel — Design Spec

> **Date:** March 23, 2026
> **Status:** Approved
> **Goal:** Replace the current artifact slide-in with a resizable, action-rich "Deep Cuts" panel featuring a dropdown selector, publish/share functionality, and context-aware action buttons.

## Overview

Deep Cuts are Crate's saved research outputs — influence chains, playlists, show prep packages, artist cards. The current implementation is a basic slide-in panel. This redesign makes Deep Cuts a first-class feature with a resizable split panel, contextual actions (Spotify export, Slack send, publish), and public sharing via `digcrate.app/cuts/[shareId]`.

## Architecture

### Panel Layout

The workspace splits into two resizable panes:
- **Left:** Chat panel (min 30% width)
- **Right:** Deep Cuts panel (min 30% width, default 55%)
- **Between:** 6px drag handle for resizing. Stores width preference in localStorage.

The panel opens automatically when an OpenUI component renders (existing behavior). When closed, the chat takes full width.

### Panel Structure (top to bottom)

1. **Header bar** — contains:
   - Dropdown selector (current Deep Cut title + chevron)
   - Action buttons: Export to Spotify (green), Send to Slack (purple), Publish (cyan), Close (X)
   - Action buttons are contextual — only relevant buttons show based on Deep Cut type:
     - InfluenceChain: Spotify export + Slack + Publish
     - SpotifyPlaylist/SpotifyPlaylists: Spotify open + Slack + Publish
     - ShowPrepPackage: Slack + Publish
     - TrackList: Spotify export + Slack + Publish
     - ArtistCard: Spotify listen + Slack + Publish
     - Default: Publish only

2. **Dropdown** (collapsed by default) — click header to expand:
   - Lists all Deep Cuts for the current session
   - Each row: color-coded type dot + title + relative timestamp
   - Type colors: purple (#8b5cf6) = influence, green (#22c55e) = playlist, amber (#f59e0b) = show prep, cyan (#06b6d4) = artist, zinc (#71717a) = other
   - Click a row to switch to that Deep Cut
   - Clicking outside or selecting an item closes the dropdown

3. **Content area** — scrollable, renders the OpenUI component via `<Renderer>`

### Resizable Split

Uses a mouse drag handler on the 6px divider:
- `onMouseDown` on the handle starts tracking
- `onMouseMove` on the container updates the flex basis
- `onMouseUp` stops tracking and saves to `localStorage('deep-cuts-width')`
- CSS cursor changes to `col-resize` during drag
- Minimum widths: chat 30%, panel 30%

### Deep Cut Type Detection

Detect the type from the OpenUI Lang content to determine the type dot color and which action buttons to show:

```typescript
function detectDeepCutType(content: string): 'influence' | 'playlist' | 'showprep' | 'artist' | 'other' {
  if (content.includes('InfluenceChain(') || content.includes('InfluencePathTrace(')) return 'influence';
  if (content.includes('TrackList(') || content.includes('SpotifyPlaylist(') || content.includes('SpotifyPlaylists(')) return 'playlist';
  if (content.includes('ShowPrepPackage(')) return 'showprep';
  if (content.includes('ArtistCard(') || content.includes('ArtistProfileCard(')) return 'artist';
  return 'other';
}
```

## Publish / Share

### Flow

1. User clicks "Publish" button in the panel header
2. Frontend calls `POST /api/cuts/publish` with `{ artifactId }`
3. API generates a unique share ID (nanoid, 10 chars)
4. Creates a record in the Convex `shares` table
5. Returns `{ shareId, url }` where url = `https://digcrate.app/cuts/{shareId}`
6. UI copies URL to clipboard and shows a toast "Link copied!"

### Share Page (`/cuts/[shareId]`)

A public page (no auth required) that renders:

1. **Header:** Crate logo (light variant) on dark background
2. **Deep Cut:** The OpenUI component rendered via `<Renderer>`, same as in-panel
3. **Smart buttons:** Only link-based buttons shown for unauthenticated viewers:
   - "Open in Spotify" links work for everyone
   - "Listen on Spotify" links work for everyone
   - Auth-dependent buttons (Export to Spotify, Send to Slack) hidden unless viewer is logged into Crate
4. **CTA footer:** "Dig Deeper at digcrate.app" with sign-up button

### Data Model

Add to `convex/schema.ts`:

```typescript
shares: defineTable({
  shareId: v.string(),         // nanoid, 10 chars
  artifactId: v.id("artifacts"),
  userId: v.id("users"),       // who published it
  label: v.string(),           // Deep Cut title
  type: v.string(),            // influence, playlist, showprep, artist, other
  data: v.string(),            // OpenUI Lang content (snapshot at publish time)
  isPublic: v.boolean(),       // can be unpublished later
  createdAt: v.number(),
})
  .index("by_share_id", ["shareId"])
  .index("by_user", ["userId"])
  .index("by_artifact", ["artifactId"])
```

The `by_artifact` index allows checking if an artifact is already published (show existing URL instead of creating a new one).

The `label` field copies from `artifact.label` at publish time — do NOT re-derive via `extractLabel`.

### API Route (`/api/cuts/publish`)

```typescript
POST /api/cuts/publish
Body: { artifactId: string }
Auth: Required (Clerk)
Response: { shareId: string, url: string }
```

- Looks up the artifact in Convex
- Verifies ownership (artifact.userId matches current user)
- Generates shareId via nanoid
- Snapshots the current OpenUI content into the share record
- Returns the public URL

## Files

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/workspace/deep-cuts-panel.tsx` | Resizable panel with header, dropdown, action bar, content renderer |
| `src/app/cuts/[shareId]/page.tsx` | Public share page |
| `src/app/api/cuts/publish/route.ts` | Publish API route |
| `convex/shares.ts` | Share CRUD (create, getByShareId, listByUser, unpublish) |

### Modified Files
| File | Change |
|------|--------|
| `convex/schema.ts` | Add `shares` table |
| `src/components/workspace/artifact-provider.tsx` | Add `publish` function to context, add `detectDeepCutType` |
| `src/app/w/[sessionId]/page.tsx` | Replace `ArtifactSlideIn` with `DeepCutsPanel`, add resize logic |
| `src/components/sidebar/artifacts-section.tsx` | Already renamed to "Deep Cuts" — no further changes |

### Deleted Files
| File | Reason |
|------|--------|
| `src/components/workspace/artifact-slide-in.tsx` | Replaced by `deep-cuts-panel.tsx` |

## Action Button Visibility

| Context | Spotify Export | Slack Send | Open in Spotify | Publish | Close |
|---------|---------------|------------|----------------|---------|-------|
| In-panel (logged in) | By type | By type | By type | Yes | Yes |
| Share page (logged out) | Hidden | Hidden | Yes (link) | Hidden | N/A |
| Share page (logged in) | By type | By type | Yes (link) | Hidden | N/A |

## Implementation Notes

### Publish button race condition
The `ArtifactProvider` uses `id: "pending"` while saving to Convex asynchronously. The Publish button MUST be disabled until the artifact has a real Convex ID. The provider should expose an `isSaving` boolean in the context. The panel greys out the Publish button and shows "Saving..." until the ID resolves.

### Public route protection
`/cuts/[shareId]` MUST remain publicly accessible (no auth required). Add it to the Clerk middleware's public routes matcher. Document this dependency clearly — if middleware is ever broadened to protect more routes, the share page must stay exempt.

### Resize drag handler
Attach `mousemove` and `mouseup` to `window` (not the container element) during drag, otherwise the drag breaks when the cursor moves fast and leaves the handle area. Clean up listeners on `mouseup`.

### Deep Cut type in context
`detectDeepCutType` lives in a shared utility file (`src/lib/deep-cut-utils.ts`), imported by both `artifact-provider.tsx` and `deep-cuts-panel.tsx`. The provider exposes `currentType` in the context value so the panel doesn't need to re-derive it.

### Button terminology
"Open in Spotify" and "Listen on Spotify" are the same button — a link to Spotify. Use "Open in Spotify" consistently. "Export to Spotify" is the auth-dependent action that creates a playlist via the `export_to_spotify` tool.

### Mobile breakpoint
Below Tailwind `md:` (768px), the panel renders as a full-screen overlay with a close button. No split view, no resize handle. The "Deep Cuts (N)" toggle button still appears.

## Edge Cases

- **No Deep Cuts yet:** Panel doesn't render. Chat takes full width.
- **Panel closed:** Toggle button appears top-right with count badge: "Deep Cuts (4)"
- **Resize limits:** Enforce min 30% for each side. Below threshold, snap to closed.
- **Mobile:** Panel goes full-screen overlay (no split). Swipe down to dismiss.
- **Publish twice:** Same artifact can be re-published (creates new share URL). Old URLs stay valid.
- **Unpublish:** Sets `isPublic: false`. Share page shows "This Deep Cut is no longer available."
