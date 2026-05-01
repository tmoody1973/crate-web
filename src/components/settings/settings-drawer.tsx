"use client";

import { useState, useEffect } from "react";
import { KeyEntry } from "./key-entry";
import { TeamSharing } from "./team-sharing";
import { PlanSection } from "./plan-section";
import { SkillsSection } from "./skills-section";
import { ConnectedServices } from "./connected-services";
import { useIsMobile } from "@/hooks/use-is-mobile";

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
  { id: "openrouter", name: "OpenRouter", description: "Use any AI model (GPT-4o, Gemini, Llama, etc.)" },
  { id: "genius", name: "Genius", description: "Lyrics, annotations" },
  { id: "tavily", name: "Tavily", description: "Web search for influence mapping" },
  { id: "exa", name: "Exa.ai", description: "Neural/semantic web search" },
  { id: "tumblr", name: "Tumblr", description: "Publish to your blog" },
  { id: "mem0", name: "Mem0", description: "Agent memory across sessions" },
  { id: "agentmail", name: "AgentMail", description: "Send research to Slack or email" },
];

interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsDrawer({ isOpen, onClose }: SettingsDrawerProps) {
  const [userKeys, setUserKeys] = useState<Record<string, string>>({});
  const [refreshKey, setRefreshKey] = useState(0);
  const isMobile = useIsMobile();

  const refreshKeys = () => setRefreshKey((k) => k + 1);

  useEffect(() => {
    if (isOpen) {
      fetch("/api/keys")
        .then((r) => r.json())
        .then((data) => setUserKeys(data.keys ?? {}));
    }
  }, [isOpen, refreshKey]);

  if (!isOpen) return null;

  const settingsContent = (
    <>
      <ConnectedServices />

      <PlanSection />

      <SkillsSection />

      <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        Required
      </h3>
      {TIER_2_SERVICES.filter((s) => s.required).map((service) => (
        <KeyEntry
          key={service.id}
          service={service}
          maskedValue={userKeys[service.id]}
          tier="required"
          onSaved={refreshKeys}
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
          onSaved={refreshKeys}
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
          onSaved={refreshKeys}
        />
      ))}

      <TeamSharing refreshKey={refreshKey} hasKeys={Object.keys(userKeys).length > 0} />
    </>
  );

  if (isMobile) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 md:hidden">
        <div className="flex h-11 items-center border-b border-zinc-800 px-3">
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-zinc-400"
            aria-label="Back"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <span className="text-sm font-medium text-white">Settings</span>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {settingsContent}
        </div>
      </div>
    );
  }

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
        {settingsContent}
      </div>
    </div>
  );
}
