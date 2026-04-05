"use client";

import { detectDeepCutType, DEEP_CUT_LABELS } from "@/lib/deep-cut-utils";

interface DeepCutInlineCardProps {
  label: string;
  content: string;
  onTap: () => void;
}

const BORDER_COLORS: Record<string, string> = {
  influence: "border-l-violet-500",
  playlist: "border-l-green-500",
  showprep: "border-l-amber-500",
  artist: "border-l-cyan-500",
  other: "border-l-zinc-500",
};

const DOT_COLORS: Record<string, string> = {
  influence: "bg-violet-500",
  playlist: "bg-green-500",
  showprep: "bg-amber-500",
  artist: "bg-cyan-500",
  other: "bg-zinc-500",
};

export function DeepCutInlineCard({ label, content, onTap }: DeepCutInlineCardProps) {
  const type = detectDeepCutType(content);

  return (
    <button
      onClick={onTap}
      className={`flex w-full items-center gap-3 rounded-lg border-l-4 bg-zinc-800/60 px-4 py-3.5 text-left transition-colors active:bg-zinc-700/60 ${BORDER_COLORS[type]}`}
      style={{ minHeight: 56 }}
    >
      <div className={`h-2 w-2 shrink-0 rounded-full ${DOT_COLORS[type]}`} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500">{DEEP_CUT_LABELS[type]}</p>
      </div>
      <span className="shrink-0 text-xs text-zinc-500">View →</span>
    </button>
  );
}
