"use client";

interface UpgradePromptProps {
  type: "quota_exceeded" | "feature_gated";
  message: string;
  onUpgrade: () => void;
  onAddKey: () => void;
}

export function UpgradePrompt({ type, message, onUpgrade, onAddKey }: UpgradePromptProps) {
  return (
    <div className="mx-auto my-4 max-w-lg rounded-lg border border-amber-500/30 bg-amber-500/10 p-4">
      <p className="mb-3 text-sm text-amber-200">{message}</p>
      <div className="flex gap-2">
        <button
          onClick={onUpgrade}
          className="rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-black hover:bg-amber-400"
        >
          Upgrade to Pro
        </button>
        {type === "quota_exceeded" && (
          <button
            onClick={onAddKey}
            className="rounded-md border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-400"
          >
            Add API Key
          </button>
        )}
      </div>
    </div>
  );
}
