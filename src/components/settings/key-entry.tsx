"use client";

import { useState } from "react";

interface Service {
  id: string;
  name: string;
  description: string;
  required?: boolean;
}

interface KeyEntryProps {
  service: Service;
  maskedValue?: string;
  tier: "required" | "tier1" | "tier2";
}

export function KeyEntry({ service, maskedValue, tier }: KeyEntryProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!value.trim()) return;
    setSaving(true);
    try {
      await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: service.id, value: value.trim() }),
      });
      setEditing(false);
      setValue("");
    } finally {
      setSaving(false);
    }
  };

  const isConfigured = !!maskedValue;
  const statusColor = isConfigured
    ? "text-green-400"
    : tier === "tier1"
      ? "text-yellow-400"
      : "text-zinc-500";
  const statusText = isConfigured
    ? maskedValue
    : tier === "tier1"
      ? "Using shared key"
      : "Not configured";

  return (
    <div className="mb-3 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-white">{service.name}</p>
          <p className="text-xs text-zinc-500">{service.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs ${statusColor}`}>{statusText}</span>
          <button
            onClick={() => setEditing(!editing)}
            className="text-xs text-zinc-400 hover:text-white"
          >
            {isConfigured ? "Edit" : tier === "tier1" ? "Add Own" : "Add Key"}
          </button>
        </div>
      </div>
      {editing && (
        <div className="mt-2 flex gap-2">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={`Paste your ${service.name} key...`}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
          />
          <button
            onClick={handleSave}
            disabled={saving || !value.trim()}
            className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
          >
            {saving ? "..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
