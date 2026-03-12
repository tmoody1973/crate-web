"use client";

import { Suspense } from "react";
import { ArtifactProvider, useArtifact } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { ArtifactSlideIn } from "@/components/workspace/artifact-slide-in";

function ArtifactToggle() {
  const { history, showPanel, openPanel } = useArtifact();

  if (showPanel || history.length === 0) return null;

  return (
    <button
      onClick={openPanel}
      className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg backdrop-blur transition hover:border-zinc-600 hover:text-white"
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      Artifacts ({history.length})
    </button>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <ArtifactProvider>
        <div className="flex h-full">
          <div className="relative flex-1 overflow-hidden">
            <ChatPanel />
            <ArtifactToggle />
          </div>
          <ArtifactSlideIn />
        </div>
      </ArtifactProvider>
    </Suspense>
  );
}
