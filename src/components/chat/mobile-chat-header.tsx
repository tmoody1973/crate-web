"use client";

import { useState } from "react";

interface MobileChatHeaderProps {
  onOpenSidebar: () => void;
  currentModel?: string;
  onModelChange?: (model: string) => void;
}

const MODELS = [
  { id: "claude-haiku-4-5-20251001", label: "Haiku 4.5" },
  { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
];

export function MobileChatHeader({ onOpenSidebar, currentModel, onModelChange }: MobileChatHeaderProps) {
  const [modelOpen, setModelOpen] = useState(false);
  const modelLabel = MODELS.find(m => m.id === currentModel)?.label || "Haiku 4.5";

  return (
    <div className="flex h-11 items-center border-b border-zinc-800 bg-zinc-950 px-3 md:hidden">
      {/* Hamburger */}
      <button
        onClick={onOpenSidebar}
        className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
        aria-label="Open menu"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Logo + Beta */}
      <div className="flex flex-1 items-center justify-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/crate-logo_Light.svg"
          alt="Crate"
          className="h-5 w-auto max-[374px]:hidden"
        />
        <span className="rounded bg-[#E8520E]/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#E8520E]">
          Beta
        </span>
      </div>

      {/* Model selector pill */}
      <div className="relative">
        <button
          onClick={() => setModelOpen(!modelOpen)}
          className="flex h-8 items-center gap-1 rounded-full bg-zinc-800 px-2.5 text-[11px] text-zinc-400"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {modelLabel}
          <span className="text-[9px]">▾</span>
        </button>
        {modelOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
            {MODELS.map(m => (
              <button
                key={m.id}
                onClick={() => { onModelChange?.(m.id); setModelOpen(false); }}
                className={`block w-full px-4 py-2.5 text-left text-xs ${m.id === currentModel ? "text-white bg-zinc-700" : "text-zinc-400"}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
