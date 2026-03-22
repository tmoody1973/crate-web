// src/components/onboarding/quick-start-wizard.tsx
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import posthog from "posthog-js";

// --- Types ---
type Provider = "anthropic" | "openrouter";

interface QuickStartWizardProps {
  /** Start on a specific step (1-indexed). Used when error-intercepted to jump to step 2. */
  initialStep?: number;
  /** User's email for Radio Milwaukee detection */
  userEmail: string;
  /** Whether the user already has a valid key saved */
  hasExistingKey: boolean;
  /** Called when wizard completes or is skipped */
  onComplete: () => void;
  /** Called when wizard completes with a verified key (for re-sending pending message) */
  onKeyVerified?: () => void;
}

// --- Provider step data ---
const PROVIDERS = {
  anthropic: {
    name: "Anthropic",
    recommended: true,
    description:
      "Direct access to Claude \u2014 the model Crate was built for. Best tool use and research quality.",
    price: "Pay-as-you-go \u00b7 ~$0.01\u20130.05 per research query",
    prefix: "sk-ant-",
    steps: [
      {
        text: "Go to console.anthropic.com and create an account",
        link: "https://console.anthropic.com/signup",
        linkText: "console.anthropic.com",
      },
      { text: "Add a payment method (credit card required, $5 minimum)" },
      {
        text: "Go to Settings \u2192 API Keys \u2192 Create Key",
        link: "https://console.anthropic.com/settings/keys",
        linkText: "Settings \u2192 API Keys",
      },
      { text: "Copy the key (starts with sk-ant-)" },
    ],
  },
  openrouter: {
    name: "OpenRouter",
    recommended: false,
    description:
      "Access Claude, GPT-4o, Gemini, Llama, and more through one key. Swap models anytime.",
    price: "Pay-as-you-go \u00b7 Prices vary by model",
    prefix: "sk-or-",
    steps: [
      {
        text: "Go to openrouter.ai and create an account",
        link: "https://openrouter.ai/signup",
        linkText: "openrouter.ai",
      },
      {
        text: "Add credits ($5 minimum)",
        link: "https://openrouter.ai/credits",
        linkText: "Credits page",
      },
      {
        text: "Go to Keys \u2192 Create Key",
        link: "https://openrouter.ai/keys",
        linkText: "Keys",
      },
      { text: "Copy the key (starts with sk-or-)" },
    ],
  },
} as const;

const BUILT_IN_SOURCES = [
  { name: "Discogs", what: "Credits & releases" },
  { name: "MusicBrainz", what: "Metadata & IDs" },
  { name: "Last.fm", what: "Tags & similarity" },
  { name: "Spotify", what: "Artwork & audio" },
  { name: "Wikipedia", what: "Artist bios" },
  { name: "YouTube", what: "Video & audio" },
  { name: "Ticketmaster", what: "Live events" },
  { name: "Setlist.fm", what: "Concert setlists" },
  { name: "Bandcamp", what: "Independent music" },
  { name: "iTunes", what: "Album artwork" },
  { name: "fanart.tv", what: "HD artist images" },
  { name: "Radio Browser", what: "30K+ live stations" },
  { name: "Tavily", what: "Web search" },
  { name: "Exa.ai", what: "Deep web search" },
  { name: "26 Publications", what: "Review co-mentions" },
];

const OPTIONAL_SOURCES = [
  { name: "Genius", what: "Lyrics & annotations" },
  { name: "Tumblr", what: "Publish research" },
  { name: "Mem0", what: "Memory persistence" },
  { name: "AgentMail", what: "Email & Slack" },
];

const RM_COMMANDS = [
  {
    command: "/show-prep HYFIN",
    description:
      "Paste your setlist. Crate researches every track and generates talk breaks, social copy, and interview prep.",
  },
  {
    command: "/news hyfin 5",
    description:
      "Generate a 5-story music news segment, researched from RSS feeds and formatted for your station's voice.",
  },
  {
    command: "/influence [artist]",
    description:
      "Map an artist's influence network \u2014 who they were influenced by, who they influenced, with cited evidence.",
  },
  {
    command: "/radio [genre or station]",
    description:
      'Stream any of 30,000+ live radio stations while you research. Try /radio jazz or /radio KEXP.',
  },
];

// --- Detect Radio Milwaukee ---
function isRadioMilwaukee(email: string): boolean {
  return email.toLowerCase().endsWith("@radiomilwaukee.org");
}

// --- Detect provider from key prefix ---
function detectProvider(key: string): Provider | null {
  if (key.startsWith("sk-ant-")) return "anthropic";
  if (key.startsWith("sk-or-")) return "openrouter";
  return null;
}

// --- Main Component ---
export function QuickStartWizard({
  initialStep = 1,
  userEmail,
  hasExistingKey,
  onComplete,
  onKeyVerified,
}: QuickStartWizardProps) {
  const isRM = isRadioMilwaukee(userEmail);

  // If user already has a key, start at step 3 (or wherever initialStep says)
  const startStep = hasExistingKey ? 3 : initialStep;
  const [step, setStep] = useState(startStep);
  const [selectedProvider, setSelectedProvider] = useState<Provider>("anthropic");
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [verifyState, setVerifyState] = useState<
    "idle" | "saving" | "verifying" | "verified" | "error"
  >(hasExistingKey ? "verified" : "idle");
  const [errorMessage, setErrorMessage] = useState("");
  const modalRef = useRef<HTMLDivElement>(null);

  // Focus trap: focus the modal on mount
  useEffect(() => {
    modalRef.current?.focus();
  }, []);

  // Escape key to dismiss
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onComplete();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onComplete]);

  const handleNext = () => {
    if (step < 3) setStep(step + 1);
  };

  const handleSaveAndVerify = useCallback(
    async (key: string) => {
      const provider = detectProvider(key);
      if (!provider) {
        setVerifyState("error");
        setErrorMessage(
          "Key should start with sk-ant- (Anthropic) or sk-or- (OpenRouter)",
        );
        return;
      }

      // Save key
      setVerifyState("saving");
      try {
        const saveRes = await fetch("/api/keys", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ service: provider, value: key }),
        });
        if (!saveRes.ok) {
          const err = await saveRes.json().catch(() => ({ error: "Save failed" }));
          setVerifyState("error");
          setErrorMessage(err.error || "Failed to save key");
          return;
        }
      } catch {
        setVerifyState("error");
        setErrorMessage("Network error saving key. Check your connection.");
        return;
      }

      // Verify key
      setVerifyState("verifying");
      try {
        const verifyRes = await fetch("/api/verify-key", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ provider }),
        });
        const result = await verifyRes.json();
        if (result.valid) {
          setVerifyState("verified");
          posthog.capture("onboarding_api_key_verified", { provider });
          onKeyVerified?.();
        } else {
          setVerifyState("error");
          setErrorMessage(result.error || "Verification failed");
        }
      } catch {
        setVerifyState("error");
        setErrorMessage("Could not verify key. Check your connection.");
      }
    },
    [onKeyVerified],
  );

  // Auto-verify on paste (when input looks complete)
  useEffect(() => {
    if (keyInput.length > 20 && verifyState === "idle") {
      handleSaveAndVerify(keyInput);
    }
  }, [keyInput, verifyState, handleSaveAndVerify]);

  const handleFinish = () => {
    onComplete();
  };

  // --- Radio Milwaukee variant ---
  if (isRM) {
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
        {/* Modal */}
        <div
          ref={modalRef}
          tabIndex={-1}
          className="fixed inset-0 z-[51] flex items-center justify-center p-4"
        >
          <div className="w-full max-w-[520px] rounded-xl border border-zinc-700 bg-[#1a1a1a] shadow-2xl">
            {/* Header */}
            <div className="p-8 pb-0">
              <div className="mb-5 flex items-center gap-3">
                <h2 className="text-[22px] font-bold text-white">
                  Welcome, Radio Milwaukee
                </h2>
                <span className="rounded bg-[#E8520E] px-3 py-1 text-[11px] font-bold tracking-wider text-white">
                  TEAM
                </span>
              </div>
              <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                Your API keys are already configured by your team admin. You&apos;re
                ready to go. Here&apos;s what Crate can do for your shows:
              </p>

              {/* Command cards */}
              <div className="space-y-2.5">
                {RM_COMMANDS.map((cmd) => (
                  <div
                    key={cmd.command}
                    className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-3.5"
                  >
                    <code className="rounded bg-zinc-900 px-2 py-0.5 text-[13px] font-semibold text-[#E8520E]">
                      {cmd.command}
                    </code>
                    <p className="mt-1.5 text-xs leading-relaxed text-zinc-400">
                      {cmd.description}
                    </p>
                  </div>
                ))}
              </div>

              {/* Tip */}
              <div className="mt-3 rounded-lg border border-zinc-700 bg-zinc-800/80 p-3.5">
                <p className="text-xs leading-relaxed text-zinc-400">
                  <strong className="text-zinc-300">Tip:</strong> You can also
                  just ask questions naturally &mdash; &quot;What Ethiopian jazz
                  records influenced UK broken beat?&quot; Crate searches across
                  20+ databases and cites everything.
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-700 px-8 py-4 mt-6">
              <button
                onClick={onComplete}
                className="text-[13px] text-zinc-500 hover:text-zinc-300"
              >
                Got it
              </button>
              <button
                onClick={handleFinish}
                className="rounded-md bg-[#E8520E] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              >
                Start Digging &rarr;
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // --- Standard 3-step wizard ---
  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      {/* Modal */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className="fixed inset-0 z-[51] flex items-center justify-center p-4"
      >
        <div className="flex w-full max-w-[520px] max-h-[90vh] flex-col rounded-xl border border-zinc-700 bg-[#1a1a1a] shadow-2xl overflow-hidden">
          {/* Step tabs */}
          <div className="flex border-b border-zinc-700">
            {["WELCOME", "GET YOUR KEY", "CONNECT"].map((label, i) => {
              const n = i + 1;
              const isActive = step === n;
              const isDone = step > n;
              return (
                <button
                  key={label}
                  onClick={() => n <= step && setStep(n)}
                  className={`flex-1 py-3.5 text-center text-xs tracking-wide transition ${
                    isActive
                      ? "border-b-2 border-[#E8520E] text-[#E8520E]"
                      : isDone
                        ? "text-green-400"
                        : "text-zinc-600"
                  }`}
                >
                  <span
                    className={`mr-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full border text-[10px] leading-5 ${
                      isActive
                        ? "border-[#E8520E] bg-[#E8520E] text-white"
                        : isDone
                          ? "border-green-400 bg-green-400 text-black"
                          : "border-current"
                    }`}
                  >
                    {n}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>

          {/* Step content — scrollable */}
          <div className="flex-1 overflow-y-auto p-7">
            {/* Step 1: Welcome */}
            {step === 1 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Welcome to Crate
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Your AI music research workspace. Ask any question &mdash;
                  Crate queries 20+ databases and gives you cited, verified
                  answers.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    {
                      icon: "\uD83D\uDD0D",
                      title: "Deep Research",
                      desc: "Discogs, MusicBrainz, Genius, Last.fm, Spotify, and more \u2014 all at once.",
                    },
                    {
                      icon: "\uD83C\uDFB5",
                      title: "Built-in Player",
                      desc: "YouTube playback and 30,000+ live radio stations while you research.",
                    },
                    {
                      icon: "\uD83C\uDF10",
                      title: "Influence Mapping",
                      desc: "Trace artist connections across decades with cited evidence from 26 publications.",
                    },
                    {
                      icon: "\uD83D\uDCE1",
                      title: "Show Prep",
                      desc: "Generate talk breaks, social copy, and news segments for your radio show.",
                    },
                  ].map((card) => (
                    <div
                      key={card.title}
                      className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-4"
                    >
                      <div className="mb-2 text-2xl">{card.icon}</div>
                      <h4 className="mb-1 text-[13px] font-semibold text-white">
                        {card.title}
                      </h4>
                      <p className="text-[11px] leading-snug text-zinc-400">
                        {card.desc}
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Step 2: Get Your Key */}
            {step === 2 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Get your AI key
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Crate needs an AI key to power the research agent. All 20+
                  music data sources are already built in &mdash; you just need
                  one of these:
                </p>

                {/* Provider cards */}
                {(["anthropic", "openrouter"] as Provider[]).map((id) => {
                  const p = PROVIDERS[id];
                  const isSelected = selectedProvider === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => { setSelectedProvider(id); posthog.capture("onboarding_provider_selected", { provider: id }); }}
                      className={`mb-3 w-full rounded-xl border-2 p-5 text-left transition ${
                        isSelected
                          ? "border-[#E8520E] bg-[#E8520E]/5"
                          : "border-zinc-700 bg-zinc-800/80 hover:border-zinc-600"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold text-white">
                          {p.name}
                        </h3>
                        {p.recommended && (
                          <span className="rounded bg-[#E8520E] px-2 py-0.5 text-[10px] font-semibold text-white">
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] text-zinc-400">
                        {p.description}
                      </p>
                      <p className="mt-3 text-xs font-medium text-[#E8520E]">
                        {p.price}
                      </p>
                      <ol className="mt-3 list-decimal space-y-2 pl-4">
                        {p.steps.map((s, i) => (
                          <li
                            key={i}
                            className="text-[13px] leading-relaxed text-zinc-300"
                          >
                            {"link" in s && s.link ? (
                              <>
                                {s.text.split(s.linkText!)[0]}
                                <a
                                  href={s.link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#E8520E] underline"
                                >
                                  {s.linkText}
                                </a>
                                {s.text.split(s.linkText!)[1]}
                              </>
                            ) : (
                              s.text
                            )}
                          </li>
                        ))}
                      </ol>
                    </button>
                  );
                })}

                {/* Expandable extras */}
                <button
                  type="button"
                  onClick={() => setExtrasOpen(!extrasOpen)}
                  className="mt-5 flex w-full items-center gap-2 rounded-lg border border-zinc-700 bg-[#1a1a1a] px-4 py-3.5 text-left text-[13px] text-white transition hover:border-zinc-600"
                >
                  <span
                    className={`text-[10px] text-zinc-500 transition-transform ${extrasOpen ? "rotate-90" : ""}`}
                  >
                    &#9654;
                  </span>
                  <span>Already included &amp; optional extras</span>
                  <span className="ml-auto rounded bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-green-400">
                    20+ ACTIVE
                  </span>
                </button>

                {extrasOpen && (
                  <div className="mt-2 overflow-hidden rounded-lg border border-zinc-700">
                    {/* Built-in */}
                    <div className="p-4">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-green-400">
                        Built in &mdash; no key needed
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {BUILT_IN_SOURCES.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 rounded bg-[#1a1a1a] px-2 py-1.5"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
                            <div>
                              <div className="text-[11px] font-semibold text-zinc-300">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {s.what}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    <hr className="border-zinc-700" />
                    {/* Optional */}
                    <div className="p-4">
                      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[#E8520E]">
                        Optional &mdash; add your own key in Settings
                      </h4>
                      <div className="grid grid-cols-2 gap-1.5">
                        {OPTIONAL_SOURCES.map((s) => (
                          <div
                            key={s.name}
                            className="flex items-center gap-2 rounded bg-[#1a1a1a] px-2 py-1.5"
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#E8520E]" />
                            <div>
                              <div className="text-[11px] font-semibold text-zinc-300">
                                {s.name}
                              </div>
                              <div className="text-[10px] text-zinc-500">
                                {s.what}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] leading-relaxed text-zinc-500">
                        These services are free or have free tiers. Add keys
                        anytime in Settings to unlock them.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 3: Connect */}
            {step === 3 && (
              <>
                <h2 className="mb-1.5 text-[22px] font-bold text-white">
                  Paste your key
                </h2>
                <p className="mb-6 text-sm leading-relaxed text-zinc-400">
                  Paste the API key you just created. Your key is encrypted and
                  never shared.
                </p>

                {/* Key input */}
                {!hasExistingKey && (
                  <div className="mb-4">
                    <label htmlFor="api-key-input" className="mb-1.5 block text-xs uppercase tracking-wide text-zinc-400">
                      API Key
                    </label>
                    <input
                      id="api-key-input"
                      type="text"
                      value={keyInput}
                      onChange={(e) => {
                        setKeyInput(e.target.value);
                        if (verifyState === "error") setVerifyState("idle");
                      }}
                      placeholder="sk-ant-... or sk-or-..."
                      className="w-full rounded-lg border border-zinc-600 bg-zinc-900 px-3.5 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none focus:border-[#E8520E]"
                      autoFocus
                    />
                  </div>
                )}

                {/* Verification status */}
                {verifyState === "saving" && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 p-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                    <span className="text-[13px] text-yellow-400">
                      Saving key...
                    </span>
                  </div>
                )}
                {verifyState === "verifying" && (
                  <div className="mb-4 flex items-center gap-2 rounded-lg border border-zinc-600 bg-zinc-800/80 p-3">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-yellow-400" />
                    <span className="text-[13px] text-yellow-400">
                      Verifying key...
                    </span>
                  </div>
                )}
                {verifyState === "verified" && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border border-green-800 bg-green-900/30 p-3"
                    role="status"
                    aria-live="polite"
                  >
                    <div className="h-2 w-2 rounded-full bg-green-400" />
                    <span className="text-[13px] text-green-400">
                      Key verified &mdash; you&apos;re all set!
                    </span>
                  </div>
                )}
                {verifyState === "error" && (
                  <div
                    className="mb-4 flex items-center gap-2 rounded-lg border border-red-800 bg-red-900/30 p-3"
                    role="alert"
                    aria-live="polite"
                  >
                    <div className="h-2 w-2 rounded-full bg-red-400" />
                    <span className="text-[13px] text-red-400">
                      {errorMessage}
                    </span>
                  </div>
                )}

                {/* Try your first query */}
                {verifyState === "verified" && (
                  <div className="rounded-lg border border-zinc-700 bg-zinc-800/80 p-4">
                    <h4 className="mb-2 text-[13px] font-semibold text-white">
                      Try your first query:
                    </h4>
                    <p className="text-[13px] leading-relaxed text-zinc-400">
                      Type something like{" "}
                      <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[#E8520E]">
                        &quot;Who influenced Flying Lotus?&quot;
                      </code>{" "}
                      or use{" "}
                      <code className="rounded bg-zinc-900 px-1.5 py-0.5 text-[#E8520E]">
                        /influence Madlib
                      </code>{" "}
                      for a deep dive.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-zinc-700 px-7 py-4">
            <button
              onClick={onComplete}
              className="text-[13px] text-zinc-500 hover:text-zinc-300"
            >
              I&apos;ll set up later
            </button>
            <button
              onClick={step === 3 ? handleFinish : handleNext}
              className="rounded-md bg-[#E8520E] px-7 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            >
              {step === 3 ? "Start Digging \u2192" : "Next \u2192"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
