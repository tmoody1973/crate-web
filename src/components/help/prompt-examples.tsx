"use client";

import { useState } from "react";
import type { PersonaId } from "./persona-picker";

interface PromptExample {
  prompt: string;
  description: string;
  personas: PersonaId[];
}

const ALL_PROMPTS: PromptExample[] = [
  {
    prompt: "Tell me about Flying Lotus",
    description: "Quick artist overview",
    personas: ["new-user", "radio-host", "dj", "collector", "music-lover", "journalist"],
  },
  {
    prompt: "/show-prep 4 tracks starting with Khruangbin for HYFIN evening show",
    description: "Full show prep package",
    personas: ["radio-host"],
  },
  {
    prompt: "/influence Flying Lotus",
    description: "Map musical influences with sources",
    personas: ["radio-host", "journalist"],
  },
  {
    prompt: "What samples did Madlib use on Shades of Blue?",
    description: "Sample research via WhoSampled",
    personas: ["dj", "collector"],
  },
  {
    prompt: "Find experimental jazz on Bandcamp",
    description: "Bandcamp tag search",
    personas: ["dj", "music-lover"],
  },
  {
    prompt: "Build a 10-track DJ set that goes from deep house to Detroit techno",
    description: "DJ set building with transition notes",
    personas: ["dj"],
  },
  {
    prompt: "Show me all Blue Note releases from 1963-1967",
    description: "Label catalog browser",
    personas: ["collector"],
  },
  {
    prompt: "Deep dive on Madvillainy — production, samples, reception, pressings",
    description: "Complete album research",
    personas: ["collector", "music-lover"],
  },
  {
    prompt: "Find artists similar to Khruangbin that I might not know",
    description: "Artist discovery beyond the obvious",
    personas: ["music-lover"],
  },
  {
    prompt: "Create a Sunday morning playlist — mellow, jazzy, warm",
    description: "Mood-based playlist generation",
    personas: ["music-lover"],
  },
  {
    prompt: "Write a comprehensive profile of Thundercat — career arc, collaborations, discography",
    description: "Long-form artist profile",
    personas: ["journalist"],
  },
  {
    prompt: "Find all Pitchfork and Resident Advisor reviews mentioning Four Tet",
    description: "Cross-publication source research",
    personas: ["journalist"],
  },
  {
    prompt: "/publish",
    description: "Publish research to Telegraph or Tumblr",
    personas: ["radio-host", "journalist"],
  },
  {
    prompt: "/radio jazz",
    description: "Play a live jazz radio stream",
    personas: ["new-user", "radio-host", "dj", "collector", "music-lover", "journalist"],
  },
];

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    });
  }

  return (
    <button
      onClick={handleCopy}
      className="ml-auto shrink-0 rounded px-2.5 py-1 text-[11px] font-semibold transition-colors"
      style={{
        backgroundColor: copied ? "rgba(232,82,14,0.15)" : "rgba(245,240,232,0.06)",
        color: copied ? "#E8520E" : "#7a8a9a",
        border: `1px solid ${copied ? "rgba(232,82,14,0.3)" : "rgba(245,240,232,0.1)"}`,
      }}
    >
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}

function PromptCard({ example }: { example: PromptExample }) {
  return (
    <div
      className="rounded-xl border p-4 transition-colors hover:border-[#E8520E]"
      style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div
            className="font-mono text-[13px] mb-1.5 break-words"
            style={{ color: "#F5F0E8" }}
          >
            {example.prompt}
          </div>
          <p className="text-[12px]" style={{ color: "#7a8a9a" }}>
            {example.description}
          </p>
        </div>
        <CopyButton text={example.prompt} />
      </div>
    </div>
  );
}

export function PromptExamples({ persona }: { persona: PersonaId }) {
  const relevant = ALL_PROMPTS.filter((p) => p.personas.includes(persona));
  const rest = ALL_PROMPTS.filter((p) => !p.personas.includes(persona));

  return (
    <section id="prompts" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        EXAMPLE PROMPTS
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Click any prompt to copy it, then paste it into the chat.
      </p>

      {relevant.length > 0 && (
        <div className="mb-8">
          <p
            className="text-[11px] font-bold uppercase tracking-wider mb-4"
            style={{ color: "#E8520E" }}
          >
            For your workflow
          </p>
          <div className="space-y-3">
            {relevant.map((example) => (
              <PromptCard key={example.prompt} example={example} />
            ))}
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div>
          <p
            className="text-[11px] font-bold uppercase tracking-wider mb-4"
            style={{ color: "#7a8a9a" }}
          >
            More examples
          </p>
          <div className="space-y-3">
            {rest.map((example) => (
              <PromptCard key={example.prompt} example={example} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
