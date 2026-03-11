"use client";

export function ChatPanel() {
  return (
    <div className="flex h-full flex-col bg-zinc-950">
      <div className="flex-1 overflow-y-auto p-4">
        <p className="text-zinc-500">Start a conversation...</p>
      </div>
      <div className="border-t border-zinc-800 p-4">
        <input
          type="text"
          placeholder="Ask about any artist, track, or genre..."
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
        />
      </div>
    </div>
  );
}
