"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import { useArtifact } from "./artifact-provider";
import {
  DEEP_CUT_DOT_CLASSES,
  DEEP_CUT_LABELS,
  DEEP_CUT_ACTIONS,
  detectDeepCutType,
  type ActionKey,
} from "@/lib/deep-cut-utils";

function injectChatMessage(msg: string) {
  const input = document.querySelector<HTMLTextAreaElement>("textarea");
  if (input) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    nativeSet?.call(input, msg);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
}

function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 60_000) return "now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

function ActionButton({
  action,
  label,
  onClick,
  disabled,
}: {
  action: ActionKey;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  const styles: Record<ActionKey, string> = {
    spotify: "border-green-800 bg-green-900/30 text-green-400 hover:bg-green-900/50",
    spotifyExport: "border-green-800 bg-green-900/30 text-green-400 hover:bg-green-900/50",
    slack: "border-purple-800 bg-purple-900/30 text-purple-400 hover:bg-purple-900/50",
    publish: "border-cyan-800 bg-cyan-900/30 text-cyan-400 hover:bg-cyan-900/50",
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] transition-colors disabled:opacity-40 ${styles[action]}`}
    >
      {label}
    </button>
  );
}

export function DeepCutsPanel() {
  const { current, currentType, history, selectArtifact, showPanel, dismissPanel, isSaving } = useArtifact();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishedUrl, setPublishedUrl] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  // Reset published URL when switching items
  useEffect(() => {
    setPublishedUrl(null);
  }, [current?.id]);

  if (!showPanel || !current) return null;

  const actions = DEEP_CUT_ACTIONS[currentType];

  async function handlePublish() {
    if (!current || current.id === "pending" || isSaving) return;
    setPublishing(true);
    try {
      const res = await fetch("/api/cuts/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artifactId: current.id }),
      });
      const data = await res.json();
      if (data.url) {
        setPublishedUrl(data.url);
        await navigator.clipboard.writeText(data.url);
      }
    } catch {
      // silent
    } finally {
      setPublishing(false);
    }
  }

  function handleAction(action: ActionKey) {
    switch (action) {
      case "spotify":
        injectChatMessage(`Open the ${current!.label} in Spotify`);
        break;
      case "spotifyExport":
        injectChatMessage(`Export "${current!.label}" to Spotify as a playlist`);
        break;
      case "slack":
        injectChatMessage(`Send the "${current!.label}" to Slack`);
        break;
      case "publish":
        handlePublish();
        break;
    }
  }

  const actionLabels: Record<ActionKey, string> = {
    spotify: "Spotify",
    spotifyExport: "Export",
    slack: "Slack",
    publish: publishedUrl ? "Copied!" : publishing ? "..." : "Publish",
  };

  return (
    <div className="flex h-full flex-col border-l border-zinc-800 bg-zinc-900">
      {/* Header */}
      <div className="border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          {/* Dropdown trigger */}
          <div ref={dropdownRef} className="relative flex-1 min-w-0">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-zinc-800 transition-colors"
            >
              <div className={`h-2 w-2 shrink-0 rounded-full ${DEEP_CUT_DOT_CLASSES[currentType]}`} />
              <span className="truncate text-sm font-medium text-zinc-200">
                {current.label}
              </span>
              <svg className="h-3 w-3 shrink-0 text-zinc-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M6 9l6 6 6-6" />
              </svg>
              {history.length > 1 && (
                <span className="shrink-0 rounded bg-zinc-700 px-1.5 py-0.5 text-[9px] text-zinc-400">
                  {history.length}
                </span>
              )}
            </button>

            {/* Dropdown list */}
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-zinc-700 bg-zinc-800 shadow-xl">
                {history.map((item) => {
                  const type = detectDeepCutType(item.content);
                  const isActive = item.id === current.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        selectArtifact(item.id);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2 px-3 py-2 text-left transition-colors ${
                        isActive ? "bg-zinc-700" : "hover:bg-zinc-700/50"
                      }`}
                    >
                      <div className={`h-1.5 w-1.5 shrink-0 rounded-full ${DEEP_CUT_DOT_CLASSES[type]}`} />
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-xs ${isActive ? "text-white font-medium" : "text-zinc-300"}`}>
                          {item.label}
                        </p>
                        <p className="text-[10px] text-zinc-600">{DEEP_CUT_LABELS[type]}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-zinc-600">
                        {timeAgo(item.timestamp)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {actions.map((action) => (
              <ActionButton
                key={action}
                action={action}
                label={actionLabels[action]}
                onClick={() => handleAction(action)}
                disabled={action === "publish" && (isSaving || current.id === "pending" || !!publishedUrl)}
              />
            ))}
            <button
              onClick={dismissPanel}
              className="rounded p-1 text-zinc-500 hover:bg-zinc-800 hover:text-white"
              aria-label="Close panel"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Published URL toast */}
        {publishedUrl && (
          <div className="mt-1 flex items-center gap-2 rounded bg-cyan-900/30 px-2 py-1 text-[10px] text-cyan-400">
            <span>Link copied!</span>
            <a href={publishedUrl} target="_blank" rel="noopener noreferrer" className="underline truncate">
              {publishedUrl}
            </a>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <Renderer library={crateLibrary} response={current.content} isStreaming={false} />
      </div>
    </div>
  );
}
