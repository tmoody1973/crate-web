"use client";

import { useState, useEffect } from "react";
import { KeyEntry } from "./key-entry";

const TIER_1_SERVICES = [
  {
    id: "discogs",
    name: "Discogs",
    description: "Vinyl pressings, label catalogs",
  },
  {
    id: "lastfm",
    name: "Last.fm",
    description: "Listener stats, similar artists",
  },
  {
    id: "ticketmaster",
    name: "Ticketmaster",
    description: "Concerts, events, venues",
  },
];

const TIER_2_SERVICES = [
  {
    id: "anthropic",
    name: "Anthropic",
    description: "AI research agent (required)",
    required: true,
  },
  { id: "genius", name: "Genius", description: "Lyrics, annotations" },
  {
    id: "youtube",
    name: "YouTube Data",
    description: "Enables audio player",
  },
  { id: "tumblr", name: "Tumblr", description: "Publish to your blog" },
];

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const [userKeys, setUserKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetch("/api/keys")
        .then((r) => r.json())
        .then((data) => setUserKeys(data.keys ?? {}));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-md overflow-y-auto bg-zinc-900 p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Settings</h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white"
          >
            ✕
          </button>
        </div>

        <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
          Required
        </h3>
        {TIER_2_SERVICES.filter((s) => s.required).map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="required"
          />
        ))}

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase text-zinc-400">
          Tier 1 — Active (zero-config)
        </h3>
        {TIER_1_SERVICES.map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="tier1"
          />
        ))}

        <h3 className="mb-3 mt-6 text-sm font-semibold uppercase text-zinc-400">
          Tier 2 — Add to unlock
        </h3>
        {TIER_2_SERVICES.filter((s) => !s.required).map((service) => (
          <KeyEntry
            key={service.id}
            service={service}
            maskedValue={userKeys[service.id]}
            tier="tier2"
          />
        ))}
      </div>
    </div>
  );
}
