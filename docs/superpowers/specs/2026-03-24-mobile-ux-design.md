# Mobile UX — Design Spec

> **Date:** March 24, 2026
> **Status:** Approved
> **Goal:** Make Crate's web app fully responsive with a mobile-first chat experience, touch-friendly navigation, and native-feeling interactions — ready to wrap in Capacitor for iOS.

## Overview

Crate's current UI is desktop-only: fixed sidebar, resizable split panel, hover-dependent interactions. This redesign makes mobile a first-class experience at the `md:` breakpoint (768px). The mobile layout uses a full-screen chat as home, a hamburger-triggered sidebar overlay, full-screen Deep Cuts with horizontal tabs, and a speech-to-text mic button.

## Navigation model

Three screens, one visible at a time:

1. **Chat** (home) — full-screen, always the default view
2. **Sidebar** — full-width overlay from left, triggered by hamburger
3. **Deep Cuts** — full-screen page with back arrow, triggered by tapping an inline card

No tab bar. No split view. Each screen is a full takeover. Users always know where they are.

## Breakpoint

- **Below `md:` (< 768px):** Mobile layout
- **At or above `md:` (>= 768px):** Desktop layout (current behavior, unchanged)

All mobile changes are scoped behind Tailwind `md:` responsive classes or a `useIsMobile()` hook. Desktop is not affected.

## Chat screen (mobile)

### Header
- **Left:** Hamburger icon (3 lines). Tapping opens sidebar overlay.
- **Center:** Crate logo (light SVG, ~20px height) + Beta badge
- **Right:** Model selector pill (e.g. "Haiku 4.5 ▾"). Tapping opens model dropdown.
- **Height:** 44px (touch-friendly)

### Messages
- Full-width with 12px horizontal padding
- Same styling as desktop (user messages, agent messages, tool indicators)
- Slightly larger font: 15px body text (vs 14px desktop) for readability on small screens

### Deep Cut inline cards
When the agent renders an OpenUI component, a tappable summary card appears in the chat:
- Colored left border matching Deep Cut type (purple/green/amber/cyan)
- Type dot + title + "View →"
- Tapping transitions to the full-screen Deep Cuts view
- Card is rendered by the chat panel, not the Deep Cuts panel

### Input bar
- **Position:** Fixed at bottom, above player bar
- **Shape:** Rounded pill (border-radius: 20px), dark background
- **Left:** Mic button (speech-to-text)
- **Center:** Expandable text input, placeholder "Message Crate..."
- **Right:** Send button (orange circle with arrow)
- **Slash autocomplete:** Pops up above input when `/` is typed, scrollable list of commands

### Speech-to-text (mic button)
- Uses the Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Mic icon on the left side of the input bar
- Tap to start listening — icon turns red, pulsing animation
- Speech transcribes in real-time into the input field
- Tap again or pause in speech to stop
- Falls back gracefully: if `SpeechRecognition` is not supported (some browsers), hide the mic button entirely
- No server-side dependency — purely client-side

### Player bar behavior
- **Default:** Mini player bar below input (album art thumbnail, title/artist, play/pause button). Height: 44px.
- **On keyboard focus:** Player bar slides down and hides completely. Input bar moves to directly above keyboard.
- **On keyboard dismiss:** Player bar slides back up. Input returns to position above player.
- This prevents the input from being pushed too high on small screens.

## Deep Cuts view (mobile)

Full-screen takeover, replaces the chat view temporarily.

### Header
- **Left:** Back arrow (←). Returns to chat.
- **Center:** Type dot + Deep Cut title (truncated)
- **Right:** Action buttons — small icon-only pills for Export/Slack/Publish
- **Height:** 44px

### Horizontal pill tabs
- Below the header, horizontally scrollable
- Each pill: type dot + label (e.g. "Influence", "HYFIN Playlist")
- Active pill has background highlight
- Swipe left/right to scroll through tabs
- Tapping switches the displayed Deep Cut

### Content
- Full-width, scrollable
- OpenUI components render normally but in a full-width container
- All touch targets minimum 44x44px
- Hero banners (InfluenceChain) scale to full width
- Action buttons inside components (Deep Dive, Influence Map, Send to Slack) use larger touch targets

### Transition
- Slide in from right (like iOS navigation push)
- Back arrow or swipe from left edge to return to chat

## Sidebar drawer (mobile)

### Trigger
- Hamburger icon in chat header
- Slides in from the left, full-width overlay
- Dark backdrop behind (bg-black/60)

### Header
- Crate logo (left) + Beta badge
- Close button (X) on the right
- Height: 44px (consistent with all mobile headers)

### Content (scrollable)
Same sections as desktop sidebar (`workspace-shell.tsx` `SidebarContent`), in order:
1. New Chat button (prominent, full-width)
2. Search bar
3. Crates
4. Playlists
5. Collections
6. Published
7. Starred
8. Recents
9. Deep Cuts (ArtifactsSection)

### Footer
- Settings button (full-width, subtle)
- Feedback button
- Sign out

### Close behavior
- X button in header
- Tap on backdrop (outside sidebar)
- Swipe right to dismiss
- Navigating to a session auto-closes

## Settings (mobile)

Currently a drawer overlay. On mobile, renders as a full page:
- Accessed from sidebar footer "Settings" button
- Back arrow returns to sidebar (or chat)
- Full-width sections matching current `SettingsDrawer`: Connected Services, Plan Section, Skills Section, API Key groups (Required, Tier 1, Tier 2), Team Sharing
- All form inputs and buttons sized for touch (44px minimum)

## Implementation notes

### Mobile navigation state
Mobile navigation uses a `mobileView` state in `workspace-shell.tsx`: `"chat" | "deep-cuts" | "sidebar" | "settings"`. This is separate from `ArtifactProvider`'s `showPanel`. On mobile, when `setArtifact` fires, it sets `mobileView = "deep-cuts"` instead of `showPanel = true`. The `useIsMobile()` hook determines which path runs.

### ArtifactProvider on mobile
`showPanel` is ignored on mobile. Instead, `workspace-shell.tsx` manages which screen is visible. The provider still manages `current`, `history`, `selectArtifact`, and `isSaving` — those are screen-independent.

### useIsMobile hook (SSR-safe)

```typescript
function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false); // false on server
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 767px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);
  return isMobile;
}
```

Initializes to `false` on the server. Hydrates to the real value on mount via `useEffect`. No hydration mismatch because the initial render matches server output.

### Keyboard detection for player hide
Use `visualViewport.onresize` to detect keyboard open/close on iOS:
- If `visualViewport.height < window.innerHeight * 0.75`, keyboard is open → hide player
- This threshold distinguishes keyboard from orientation change (orientation keeps > 75% of height)
- Attach listener in `player-bar.tsx` when `useIsMobile()` is true

### Mini player bar (mobile)
Mobile player bar is 44px height (not the desktop 72px). Includes:
- Album art thumbnail (32x32px, rounded)
- Title + artist (single line, truncated)
- Play/pause button (32x32px)
- No progress bar, no volume, no skip buttons on mobile
- These controls are accessible by tapping the mini player to expand (future enhancement)

### Gestures
Defer swipe gestures to a future iteration. For v1:
- Sidebar closes via X button or backdrop tap (no swipe-to-dismiss)
- Deep Cuts returns to chat via back arrow (no swipe-from-edge)
- This avoids a gesture library dependency for the initial release

### Settings "back" behavior
Back from Settings always returns to chat (not sidebar). Settings is a full-page view — returning to the sidebar (another overlay) would feel like going backwards through two layers. Direct return to chat is simpler.

### Web Speech API TypeScript
Add `@types/dom-speech-recognition` as a dev dependency, or declare a global shim:
```typescript
interface Window {
  webkitSpeechRecognition: typeof SpeechRecognition;
}
```

### Model selector on mobile
Model selector stays in the chat header (right side) as a small pill, not in the input bar. This is a mobile-only header element. On desktop, it remains in its current position inside the chat panel.

## Touch targets

All interactive elements on mobile must be minimum 44x44px (Apple HIG recommendation):
- Buttons in headers: 44px height
- Action pills (Export, Slack, Publish): 44px touch area (can be visually smaller with padding)
- List items in sidebar: 48px height
- Deep Cut inline cards: 56px height
- Slash command autocomplete items: 48px height

## Files

### New files
| File | Responsibility |
|------|---------------|
| `src/hooks/use-is-mobile.ts` | `useIsMobile()` hook using matchMedia |
| `src/components/chat/speech-to-text.tsx` | Mic button component with Web Speech API |
| `src/components/workspace/mobile-deep-cuts.tsx` | Full-screen Deep Cuts view for mobile |
| `src/components/sidebar/mobile-sidebar.tsx` | Full-width sidebar overlay for mobile |

### Modified files
| File | Change |
|------|--------|
| `src/components/workspace/workspace-shell.tsx` | Conditionally render mobile sidebar vs desktop sidebar |
| `src/components/sidebar/sidebar.tsx` | Add mobile overlay mode |
| `src/app/w/[sessionId]/page.tsx` | Conditionally render mobile Deep Cuts vs desktop panel |
| `src/components/workspace/chat-panel.tsx` | Add inline Deep Cut cards, mobile input with mic, hide player on focus |
| `src/components/player/player-bar.tsx` | Hide on keyboard focus (mobile) |
| `src/components/workspace/deep-cuts-panel.tsx` | Mobile variant with horizontal tabs |
| `src/components/settings/settings-drawer.tsx` | Full page on mobile |

## Edge cases

- **Orientation change:** Layout recalculates via CSS breakpoints. The `visualViewport` keyboard detection uses a 75% height threshold that distinguishes keyboard from orientation (orientation keeps > 75% viewport height).
- **Very small screens (< 375px):** Logo hides, only hamburger + model selector in header. Content padding reduces to 8px.
- **Long Deep Cut titles:** Truncate with ellipsis in headers and tabs.
- **No SpeechRecognition support:** Mic button hidden entirely. Input works normally.
- **Keyboard covers input:** Input fixed above keyboard via `visualViewport` API for reliable positioning on iOS Safari.
- **Player audio continues:** When navigating to Deep Cuts or Sidebar, audio keeps playing. Player bar reappears when returning to chat.
- **Deep Cut from shared link on mobile:** `/cuts/[shareId]` already renders full-width — no changes needed.

## What's NOT changing
- Desktop layout (>= 768px) — completely unchanged
- OpenUI component internals — same components render on mobile, just in a full-width container
- API routes — no backend changes
- Agent behavior — no prompt changes
