"use client";

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

interface MobileDeepCutsProps {
  onBack: () => void;
}

export function MobileDeepCuts({ onBack }: MobileDeepCutsProps) {
  const { current, currentType, history, selectArtifact, isSaving } = useArtifact();

  if (!current) return null;

  const actions = DEEP_CUT_ACTIONS[currentType];

  function handleAction(action: ActionKey) {
    switch (action) {
      case "spotify":
        injectChatMessage(`Open the ${current!.label} in Spotify`);
        onBack();
        break;
      case "spotifyExport":
        injectChatMessage(`Export "${current!.label}" to Spotify as a playlist`);
        onBack();
        break;
      case "slack":
        injectChatMessage(`Send the "${current!.label}" to Slack`);
        onBack();
        break;
      case "publish":
        // Publish: call API, copy URL
        if (current!.id === "pending" || isSaving) return;
        fetch("/api/cuts/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artifactId: current!.id }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.url) navigator.clipboard.writeText(data.url);
          })
          .catch(() => {});
        break;
    }
  }

  const actionIcons: Record<ActionKey, string> = {
    spotify: "▶",
    spotifyExport: "▶",
    slack: "⧉",
    publish: "⤴",
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950 md:hidden">
      {/* Header */}
      <div className="flex h-11 items-center border-b border-zinc-800 px-2">
        <button
          onClick={onBack}
          className="flex h-11 w-11 items-center justify-center text-zinc-400"
          aria-label="Back to chat"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex flex-1 items-center gap-2 min-w-0 px-2">
          <div className={`h-2 w-2 shrink-0 rounded-full ${DEEP_CUT_DOT_CLASSES[currentType]}`} />
          <span className="truncate text-sm font-medium text-zinc-200">{current.label}</span>
        </div>
        <div className="flex items-center gap-1">
          {actions.map((action) => (
            <button
              key={action}
              onClick={() => handleAction(action)}
              disabled={action === "publish" && (isSaving || current.id === "pending")}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-zinc-700 text-xs text-zinc-400 active:bg-zinc-800 disabled:opacity-30"
            >
              {actionIcons[action]}
            </button>
          ))}
        </div>
      </div>

      {/* Horizontal pill tabs */}
      {history.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto border-b border-zinc-800 px-3 py-2 scrollbar-none"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {history.map((item) => {
            const type = detectDeepCutType(item.content);
            const isActive = item.id === current.id;
            return (
              <button
                key={item.id}
                onClick={() => selectArtifact(item.id)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs transition-colors ${
                  isActive
                    ? "bg-zinc-700 text-white"
                    : "text-zinc-500 active:bg-zinc-800"
                }`}
              >
                <div className={`h-1.5 w-1.5 rounded-full ${DEEP_CUT_DOT_CLASSES[type]}`} />
                {DEEP_CUT_LABELS[type]}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3">
        <Renderer library={crateLibrary} response={current.content} isStreaming={false} />
      </div>
    </div>
  );
}
