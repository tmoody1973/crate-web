"use client";

import { useState } from "react";

interface KeyGuide {
  name: string;
  providerUrl: string;
  steps: string[];
  unlocks: string;
}

const REQUIRED: KeyGuide[] = [
  {
    name: "Anthropic",
    providerUrl: "https://console.anthropic.com",
    steps: [
      "Go to console.anthropic.com and sign in (or create an account).",
      'Click "API Keys" in the left sidebar.',
      'Click "Create Key", give it a name, and copy the key.',
      "In Crate, open Settings (Shift+S) and paste the key into the Anthropic field.",
    ],
    unlocks: "Required to use Crate. Powers the AI research agent.",
  },
];

const RECOMMENDED: KeyGuide[] = [
  {
    name: "OpenRouter",
    providerUrl: "https://openrouter.ai/keys",
    steps: [
      "Go to openrouter.ai/keys and sign in.",
      'Click "Create Key" and copy it.',
      "In Crate Settings, paste into the OpenRouter field.",
    ],
    unlocks: "Unlocks GPT-4o, Gemini 2.5, Llama 4, DeepSeek R1, Mistral Large.",
  },
  {
    name: "Genius",
    providerUrl: "https://genius.com/api-clients",
    steps: [
      "Go to genius.com/api-clients and sign in.",
      'Click "New API Client" and fill in any app name and URL.',
      'Copy the "Client Access Token" (not the secret).',
    ],
    unlocks: "Lyrics, song annotations, and artist metadata.",
  },
  {
    name: "Spotify",
    providerUrl: "https://developer.spotify.com/dashboard",
    steps: [
      "Go to developer.spotify.com/dashboard and sign in.",
      'Click "Create App" — name it anything, set redirect URI to http://localhost.',
      "Copy both the Client ID and Client Secret.",
    ],
    unlocks: "High-resolution album and artist artwork (640x640).",
  },
  {
    name: "Mem0",
    providerUrl: "https://app.mem0.ai/dashboard",
    steps: [
      "Go to app.mem0.ai and sign in.",
      "Copy the API key from your dashboard.",
    ],
    unlocks: "Cross-session memory — the agent remembers your preferences between sessions.",
  },
];

const OPTIONAL: KeyGuide[] = [
  {
    name: "Tavily",
    providerUrl: "https://tavily.com",
    steps: [
      "Go to tavily.com and create an account.",
      "Copy the API key from your dashboard.",
    ],
    unlocks: "AI-optimized web search for deeper research.",
  },
  {
    name: "Exa",
    providerUrl: "https://exa.ai",
    steps: [
      "Go to exa.ai and create an account.",
      "Go to Settings and copy your API key.",
    ],
    unlocks: "Semantic web search — finds content by meaning, not just keywords.",
  },
  {
    name: "Tumblr",
    providerUrl: "https://www.tumblr.com/oauth/apps",
    steps: [
      "Go to tumblr.com/oauth/apps and sign in.",
      'Click "Register application" and fill in the form.',
      "Copy the OAuth consumer key.",
    ],
    unlocks: "Publish research directly to your Tumblr blog.",
  },
  {
    name: "fanart.tv",
    providerUrl: "https://fanart.tv/get-an-api-key/",
    steps: [
      "Go to fanart.tv/get-an-api-key and register.",
      "Copy your personal API key.",
    ],
    unlocks: "HD artist backgrounds, logos, and album covers.",
  },
];

export function ApiKeysGuide({ clerkId }: { clerkId?: string }) {
  void clerkId; // Reserved for future key-status checkmarks
  return (
    <section id="api-keys" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        API KEYS SETUP
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Add keys to unlock more data sources and models. Only Anthropic is required.
      </p>

      <KeyTier label="Required" color="#ef4444" keys={REQUIRED} />
      <KeyTier label="Recommended" color="#f59e0b" keys={RECOMMENDED} />
      <KeyTier label="Optional" color="#71717a" keys={OPTIONAL} />
    </section>
  );
}

function KeyTier({ label, color, keys }: { label: string; color: string; keys: KeyGuide[] }) {
  return (
    <div className="mb-8">
      <div
        className="mb-3 text-[12px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </div>
      <div className="space-y-3">
        {keys.map((k) => (
          <KeyCard key={k.name} guide={k} />
        ))}
      </div>
    </div>
  );
}

function KeyCard({ guide }: { guide: KeyGuide }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <h3 className="text-[15px] font-semibold" style={{ color: "#F5F0E8" }}>
            {guide.name}
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "#7a8a9a" }}>
            {guide.unlocks}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={guide.providerUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-[12px] font-semibold hover:underline"
            style={{ color: "#E8520E" }}
          >
            Get key &rarr;
          </a>
          <span
            className="text-[14px] transition-transform"
            style={{ color: "#71717a", transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            &#9660;
          </span>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: "rgba(245,240,232,0.06)" }}>
          <ol className="space-y-2">
            {guide.steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-[13px]" style={{ color: "#a1a1aa" }}>
                <span className="font-bold shrink-0" style={{ color: "#E8520E" }}>
                  {i + 1}.
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
