"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

type Visibility = "private" | "unlisted" | "public";

const VISIBILITY_STYLES: Record<Visibility, { bg: string; text: string; activeBg: string; activeText: string }> = {
  private: { bg: "#27272a", text: "#71717a", activeBg: "#3f3f46", activeText: "#fafaf9" },
  unlisted: { bg: "#27272a", text: "#71717a", activeBg: "#854d0e", activeText: "#fef08a" },
  public: { bg: "#27272a", text: "#71717a", activeBg: "#166534", activeText: "#bbf7d0" },
};

interface VisibilityToggleProps {
  pageId: string;
  initialVisibility: Visibility;
}

export function VisibilityToggle({ pageId, initialVisibility }: VisibilityToggleProps) {
  const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
  const [saving, setSaving] = useState(false);
  const toggleVisibility = useMutation(api.wiki.toggleVisibility);

  async function handleChange(newVisibility: Visibility) {
    if (newVisibility === visibility || saving) return;
    setSaving(true);
    try {
      await toggleVisibility({
        pageId: pageId as Id<"wikiPages">,
        visibility: newVisibility,
      });
      setVisibility(newVisibility);
    } catch (err) {
      console.error("[wiki] visibility toggle failed:", err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex rounded-lg overflow-hidden text-xs"
      style={{ border: "1px solid #27272a" }}
      role="radiogroup"
      aria-label="Page visibility"
    >
      {(["private", "unlisted", "public"] as const).map((v) => {
        const isActive = visibility === v;
        const styles = VISIBILITY_STYLES[v];
        return (
          <button
            key={v}
            onClick={() => handleChange(v)}
            disabled={saving}
            role="radio"
            aria-checked={isActive}
            className="px-3 py-1.5 capitalize transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            style={{
              backgroundColor: isActive ? styles.activeBg : styles.bg,
              color: isActive ? styles.activeText : styles.text,
              opacity: saving ? 0.5 : 1,
            }}
          >
            {v}
          </button>
        );
      })}
    </div>
  );
}
