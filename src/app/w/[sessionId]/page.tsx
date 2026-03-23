"use client";

import { Suspense, useState, useCallback, useEffect, useRef } from "react";
import { ArtifactProvider, useArtifact } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { DeepCutsPanel } from "@/components/workspace/deep-cuts-panel";

const STORAGE_KEY = "deep-cuts-width";
const DEFAULT_WIDTH = 55;
const MIN_WIDTH = 30;
const MAX_WIDTH = 70;

function ResizableWorkspace() {
  const { history, showPanel, openPanel } = useArtifact();
  const [panelWidth, setPanelWidth] = useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, parseFloat(stored))) : DEFAULT_WIDTH;
  });
  const isDragging = useRef(false);
  const liveWidth = useRef(panelWidth);
  const containerRef = useRef<HTMLDivElement>(null);

  const startDrag = useCallback(() => {
    isDragging.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }, []);

  useEffect(() => {
    function onMouseMove(e: MouseEvent) {
      if (!isDragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const panelPx = rect.right - e.clientX;
      const pct = (panelPx / rect.width) * 100;
      const clamped = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, pct));
      liveWidth.current = clamped;
      setPanelWidth(clamped);
    }

    function onMouseUp() {
      if (!isDragging.current) return;
      isDragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem(STORAGE_KEY, String(liveWidth.current));
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  return (
    <div ref={containerRef} className="flex h-full">
      {/* Chat */}
      <div
        className="relative overflow-hidden"
        style={{ width: showPanel ? `${100 - panelWidth}%` : "100%" }}
      >
        <ChatPanel />

        {/* Toggle button */}
        {!showPanel && history.length > 0 && (
          <button
            onClick={openPanel}
            className="absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-800/90 px-3 py-1.5 text-xs text-zinc-400 shadow-lg backdrop-blur transition hover:border-zinc-600 hover:text-white"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Deep Cuts ({history.length})
          </button>
        )}
      </div>

      {/* Resize handle */}
      {showPanel && (
        <div
          onMouseDown={startDrag}
          className="flex w-1.5 cursor-col-resize items-center justify-center bg-zinc-800 hover:bg-zinc-700 transition-colors"
        >
          <div className="h-8 w-0.5 rounded-full bg-zinc-600" />
        </div>
      )}

      {/* Deep Cuts panel */}
      {showPanel && (
        <div style={{ width: `${panelWidth}%` }}>
          <DeepCutsPanel />
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  return (
    <Suspense>
      <ArtifactProvider>
        <ResizableWorkspace />
      </ArtifactProvider>
    </Suspense>
  );
}
