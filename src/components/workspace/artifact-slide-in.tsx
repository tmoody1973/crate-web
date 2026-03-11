"use client";

import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import { useArtifact } from "./artifact-provider";

export function ArtifactSlideIn() {
  const { current, history, selectArtifact, showPanel, dismissPanel } = useArtifact();

  if (!showPanel || !current) return null;

  return (
    <div className="flex h-full w-[55%] shrink-0 flex-col border-l border-zinc-800 bg-zinc-900 animate-in slide-in-from-right duration-300">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-3 py-2">
        <span className="text-sm font-medium text-zinc-300">
          {current.label.length > 40 ? `${current.label.slice(0, 40)}...` : current.label}
        </span>
        <button
          onClick={dismissPanel}
          className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
          aria-label="Close artifact panel"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* History tabs */}
      {history.length > 1 && (
        <div className="flex gap-1 overflow-x-auto border-b border-zinc-800 px-3 py-1.5">
          {history.map((a) => (
            <button
              key={a.id}
              onClick={() => selectArtifact(a.id)}
              className={`shrink-0 rounded px-2 py-0.5 text-xs transition-colors ${
                a.id === current.id
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {a.label.length > 25 ? `${a.label.slice(0, 25)}...` : a.label}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Renderer library={crateLibrary} response={current.content} isStreaming={false} />
      </div>
    </div>
  );
}
