"use client";

import { useState, useEffect, useRef } from "react";

export interface ModelOption {
  id: string;
  name: string;
  provider: string;
  description: string;
}

const MODELS: ModelOption[] = [
  // Anthropic (direct key or via OpenRouter)
  { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6", provider: "Anthropic", description: "Best coding model — fast, accurate" },
  { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5", provider: "Anthropic", description: "Lightweight, 3x cheaper" },
  // OpenRouter models (require OpenRouter key)
  { id: "openai/gpt-4o", name: "GPT-4o", provider: "OpenAI", description: "Multimodal, fast" },
  { id: "openai/gpt-4.1", name: "GPT-4.1", provider: "OpenAI", description: "Latest GPT model" },
  { id: "google/gemini-2.5-flash-preview", name: "Gemini 2.5 Flash", provider: "Google", description: "Fast, efficient" },
  { id: "google/gemini-2.5-pro-preview", name: "Gemini 2.5 Pro", provider: "Google", description: "Most capable Gemini" },
  { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick", provider: "Meta", description: "Open source, powerful" },
  { id: "deepseek/deepseek-r1", name: "DeepSeek R1", provider: "DeepSeek", description: "Reasoning model" },
  { id: "mistralai/mistral-large-2411", name: "Mistral Large", provider: "Mistral", description: "European AI leader" },
  { id: "inception/mercury-2", name: "Mercury 2", provider: "Inception", description: "Ultra-fast inference" },
];

const STORAGE_KEY = "crate-model";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function getStoredModel(): string {
  if (typeof window === "undefined") return DEFAULT_MODEL;
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_MODEL;
}

export function ModelSelector({ hasOpenRouter }: { hasOpenRouter: boolean }) {
  const [selected, setSelected] = useState(DEFAULT_MODEL);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected(getStoredModel());
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const available = hasOpenRouter
    ? MODELS
    : MODELS.filter((m) => m.provider === "Anthropic");

  const current = MODELS.find((m) => m.id === selected) ?? MODELS[0];

  const handleSelect = (model: ModelOption) => {
    setSelected(model.id);
    localStorage.setItem(STORAGE_KEY, model.id);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-700 hover:text-white"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
        <span>{current.name}</span>
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M3 5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-zinc-700 bg-zinc-900 py-1 shadow-xl">
          {!hasOpenRouter && (
            <p className="px-3 py-1.5 text-[10px] text-zinc-600">
              Add an OpenRouter key in Settings to unlock more models
            </p>
          )}
          {available.map((model) => (
            <button
              key={model.id}
              onClick={() => handleSelect(model)}
              className={`flex w-full items-start gap-2 px-3 py-2 text-left transition hover:bg-zinc-800 ${
                model.id === selected ? "bg-zinc-800/50" : ""
              }`}
            >
              <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${
                model.id === selected ? "bg-green-500" : "bg-zinc-700"
              }`} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-white">{model.name}</span>
                  <span className="text-[10px] text-zinc-600">{model.provider}</span>
                </div>
                <p className="text-[10px] text-zinc-500">{model.description}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
