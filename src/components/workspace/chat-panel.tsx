"use client";

import { useState, FormEvent } from "react";
import { useCrateAgent } from "@/hooks/use-crate-agent";

export function ChatPanel() {
  const [input, setInput] = useState("");
  const { messages, toolProgress, plan, isLoading, error, sendMessage } =
    useCrateAgent();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && (
          <p className="text-zinc-500">
            Ask about any artist, track, sample, or genre...
          </p>
        )}

        {messages.map((m) => (
          <div key={m.id} className="mb-4">
            <span className="text-xs font-semibold uppercase text-zinc-500">
              {m.role === "user" ? "You" : "Crate"}
            </span>
            <div
              className={`mt-1 whitespace-pre-wrap ${
                m.role === "user" ? "text-white" : "text-zinc-300"
              }`}
            >
              {m.content}
            </div>
          </div>
        ))}

        {/* Research plan */}
        {plan && (
          <div className="mb-4 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <p className="text-xs font-semibold uppercase text-zinc-400">
              Research Plan
            </p>
            {plan.map((task) => (
              <div key={task.id} className="mt-1 text-sm text-zinc-300">
                {task.id}. {task.description}
              </div>
            ))}
          </div>
        )}

        {/* Tool progress */}
        {toolProgress.length > 0 && (
          <div className="mb-4 space-y-1">
            {toolProgress.map((tp, i) => (
              <div key={i} className="text-xs text-zinc-500">
                {tp.status === "running" ? (
                  <span className="text-cyan-400">&#x27F3; {tp.server}: {tp.tool}...</span>
                ) : (
                  <span className="text-green-400">
                    &#x2713; {tp.server}: {tp.tool}
                    {tp.durationMs ? ` (${(tp.durationMs / 1000).toFixed(1)}s)` : ""}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        {isLoading && toolProgress.length === 0 && (
          <div className="text-zinc-500">Researching...</div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about any artist, track, or genre..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
          disabled={isLoading}
        />
      </form>
    </div>
  );
}
