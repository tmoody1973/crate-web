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
