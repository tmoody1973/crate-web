"use client";

import { ChatProvider, useThread } from "@openuidev/react-headless";
import { Renderer } from "@openuidev/react-lang";
import {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
  createContext,
  useContext,
  FormEvent,
} from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { crateLibrary } from "@/lib/openui/library";
import { crateStreamAdapter } from "@/lib/openui/stream-adapter";
import { useArtifact } from "./artifact-provider";
import { getToolLabel, type ToolStep } from "@/lib/tool-labels";
import { ModelSelector, getStoredModel } from "./model-selector";
import { ResponseActions } from "./response-actions";

// --- Tool activity context ---
const ToolActivityContext = createContext<{ steps: ToolStep[] }>({ steps: [] });
function useToolActivity() {
  return useContext(ToolActivityContext);
}

function MarkdownContent({ content }: { content: string }) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{
        a: ({ href, children, ...props }) => (
          <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
            {children}
          </a>
        ),
      }}
    >
      {content}
    </Markdown>
  );
}

/** Strip markdown code fences that might wrap OpenUI Lang output. */
function stripCodeFences(content: string): string {
  return content.replace(/```(?:\w*)\n?([\s\S]*?)```/g, "$1");
}

/** OpenUI assignment pattern: `varName = ComponentName(...)` */
const OPENUI_PATTERN = /\b(\w+\s*=\s*[A-Z]\w*\()/;

/** Try to detect if content contains OpenUI Lang (has component assignments). */
function containsOpenUILang(content: string): boolean {
  return OPENUI_PATTERN.test(stripCodeFences(content));
}

/** Check if a line is an OpenUI Lang assignment: `varName = ComponentName(...)` */
function isOpenUILine(line: string): boolean {
  return /^\w+\s*=\s*[A-Z]\w*\(/.test(line.trim());
}

/**
 * Pre-process content to ensure OpenUI assignments start on their own line.
 * Handles cases like "some prose:root = ShowPrepPackage(...)" by splitting
 * at the assignment boundary.
 */
function normalizeOpenUIBoundaries(content: string): string {
  // Split lines where OpenUI starts mid-line (e.g. "prose text:root = Component(...)")
  return content.replace(/([^\n])(\b(?:root|[a-z]\w*)\s*=\s*[A-Z]\w*\()/g, "$1\n$2");
}

/** Split content into markdown sections and OpenUI Lang blocks. */
function splitContent(content: string): Array<{ type: "markdown" | "openui"; text: string }> {
  // First, unwrap code fences and normalize boundaries
  const unwrapped = normalizeOpenUIBoundaries(stripCodeFences(content));

  if (!containsOpenUILang(unwrapped)) {
    return [{ type: "markdown", text: content }];
  }

  const lines = unwrapped.split("\n");
  const result: Array<{ type: "markdown" | "openui"; text: string }> = [];
  let currentLines: string[] = [];
  let currentType: "markdown" | "openui" = "markdown";

  function flush() {
    const text = currentLines.join("\n").trim();
    if (text) {
      result.push({ type: currentType, text });
    }
    currentLines = [];
  }

  for (const line of lines) {
    const lineIsOpenUI = isOpenUILine(line);

    if (lineIsOpenUI && currentType !== "openui") {
      flush();
      currentType = "openui";
      currentLines.push(line);
    } else if (!lineIsOpenUI && currentType === "openui") {
      if (line.trim() === "") {
        currentLines.push(line);
      } else {
        flush();
        currentType = "markdown";
        currentLines.push(line);
      }
    } else {
      currentLines.push(line);
    }
  }

  flush();
  return result.length > 0 ? result : [{ type: "markdown", text: content }];
}

/** Normalize message content to always be an array of content parts. */
function getContentParts(
  content: unknown,
): { type: string; text?: string; [k: string]: unknown }[] {
  if (!content) return [];
  if (typeof content === "string") return [{ type: "text", text: content }];
  if (Array.isArray(content)) return content;
  return [];
}

function ResearchSteps() {
  const { steps } = useToolActivity();
  const activeSteps = steps.filter((s) => s.status === "active");
  const doneSteps = steps.filter((s) => s.status === "done");

  return (
    <div className="mb-4">
      <span className="text-xs font-semibold uppercase text-zinc-500">
        Crate
      </span>
      <div className="mt-1 space-y-1">
        {doneSteps.map((step, i) => (
          <div key={`${step.id}-${i}`} className="flex items-center gap-2 text-zinc-600 text-sm">
            <span className="text-green-500">✓</span>
            <span>{step.label}</span>
          </div>
        ))}
        {activeSteps.length > 0 ? (
          activeSteps.map((step, i) => (
            <div key={`${step.id}-${i}`} className="flex items-center gap-2 text-zinc-400 text-sm">
              <span className="inline-flex w-4 justify-center">
                <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
              </span>
              <span>{step.label}</span>
            </div>
          ))
        ) : (
          <div className="flex items-center gap-2 text-zinc-500 text-sm">
            <span className="inline-flex w-4 justify-center">
              <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-500" />
            </span>
            <span>Thinking...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function ChatMessages() {
  const { messages, isRunning } = useThread();
  const { setArtifact } = useArtifact();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastArtifactRef = useRef<string>("");

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isRunning]);

  // Mirror OpenUI Lang content to the artifacts panel
  const pushArtifact = useCallback(
    (openuiContent: string) => {
      if (openuiContent && openuiContent !== lastArtifactRef.current) {
        lastArtifactRef.current = openuiContent;
        setArtifact(openuiContent);
      }
    },
    [setArtifact],
  );

  // Check latest assistant message for OpenUI content
  useEffect(() => {
    if (isRunning) return; // Wait until streaming is done
    const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;
    const parts = getContentParts(lastAssistant.content);
    // Collect ALL OpenUI sections across all content parts
    const allOpenUI: string[] = [];
    for (const part of parts) {
      if (part.type !== "text" || !part.text) continue;
      const sections = splitContent(part.text);
      for (const s of sections) {
        if (s.type === "openui") allOpenUI.push(s.text);
      }
    }
    if (allOpenUI.length > 0) {
      pushArtifact(allOpenUI.join("\n"));
    }
  }, [messages, isRunning, pushArtifact]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4">
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
          {m.role === "user" ? (
            <div className="mt-1 text-white">
              {getContentParts(m.content).map((c, i) =>
                c.type === "text" ? <span key={i}>{c.text}</span> : null,
              )}
            </div>
          ) : (
            <>
              <div className="prose prose-invert prose-sm mt-1 max-w-none overflow-hidden break-words">
                {getContentParts(m.content).flatMap((c, ci) => {
                  if (c.type !== "text") return [];
                  const text = c.text ?? "";
                  const sections = splitContent(text);
                  return sections.map((section, si) =>
                    section.type === "openui" ? (
                      <Renderer
                        key={`${ci}-${si}`}
                        library={crateLibrary}
                        response={section.text}
                        isStreaming={isRunning && ci === getContentParts(m.content).length - 1}
                      />
                    ) : (
                      <MarkdownContent key={`${ci}-${si}`} content={section.text} />
                    ),
                  );
                })}
              </div>
              {!isRunning && (
                <ResponseActions
                  content={getContentParts(m.content)
                    .filter((c): c is { type: "text"; text: string } => c.type === "text")
                    .map((c) => c.text)
                    .join("")}
                />
              )}
            </>
          )}
        </div>
      ))}

      {isRunning && <ResearchSteps />}
    </div>
  );
}

const SLASH_COMMANDS = [
  { command: "/news", description: "Daily music news segment", usage: "/news [station] [count]", example: "/news hyfin 3" },
  { command: "/show-prep", description: "Full show prep or specific pieces", usage: "/show-prep [station]: [request or setlist]", example: "/show-prep HYFIN: Khruangbin - Time" },
  { command: "/prep", description: "Show prep (shorthand)", usage: "/prep [station]: [request]", example: "/prep 88nine: talk breaks for Khruangbin > Simz" },
];

function SlashCommandMenu({
  filter,
  onSelect,
  selectedIndex,
}: {
  filter: string;
  onSelect: (cmd: string) => void;
  selectedIndex: number;
}) {
  const filtered = SLASH_COMMANDS.filter(
    (c) => c.command.startsWith(filter.toLowerCase()) || c.description.toLowerCase().includes(filter.slice(1).toLowerCase()),
  );

  if (filtered.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl">
      {filtered.map((cmd, i) => (
        <button
          key={cmd.command}
          type="button"
          onClick={() => onSelect(cmd.command + " ")}
          className={`flex w-full items-start gap-3 px-4 py-2.5 text-left transition first:rounded-t-lg last:rounded-b-lg ${
            i === selectedIndex ? "bg-zinc-800" : "hover:bg-zinc-800/50"
          }`}
        >
          <span className="shrink-0 font-mono text-sm font-medium text-cyan-400">{cmd.command}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-zinc-300">{cmd.description}</p>
            <p className="text-xs text-zinc-600">{cmd.usage}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

const STATIONS = ["88Nine", "HYFIN", "Rhythm Lab"] as const;
const SHIFTS = ["morning", "midday", "afternoon", "evening", "overnight"] as const;
const PREP_OPTIONS = [
  { key: "context", label: "Track Context", desc: "Origin stories, production notes, connections" },
  { key: "breaks", label: "Talk Breaks", desc: "Short/medium/long transition scripts" },
  { key: "social", label: "Social Copy", desc: "Instagram, X, Bluesky posts" },
  { key: "events", label: "Local Events", desc: "Milwaukee concerts & shows" },
  { key: "interview", label: "Interview Prep", desc: "Questions for a guest" },
] as const;

function ShowPrepForm({ onSubmit, onCancel }: { onSubmit: (msg: string) => void; onCancel: () => void }) {
  const [station, setStation] = useState<string>("");
  const [shift, setShift] = useState<string>("evening");
  const [djName, setDjName] = useState("");
  const [setlist, setSetlist] = useState("");
  const [guest, setGuest] = useState("");
  const [selectedOptions, setSelectedOptions] = useState<Set<string>>(new Set());
  const setlistRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setlistRef.current?.focus();
  }, []);

  const toggleOption = (key: string) => {
    setSelectedOptions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const isFullPrep = selectedOptions.size === 0;

  const handleSubmit = () => {
    // Encode form data as structured metadata the preprocessor can parse deterministically
    const meta: Record<string, string> = {};
    if (station) meta.station = station;
    meta.shift = shift;
    if (djName) meta.dj = djName;
    if (guest) meta.guest = guest;
    if (!isFullPrep) meta.include = [...selectedOptions].join(",");

    // Build a clean /prep message with metadata header + setlist
    const metaLine = Object.entries(meta).map(([k, v]) => `${k}=${v}`).join("|");
    const message = setlist.trim()
      ? `/prep [${metaLine}]\n${setlist.trim()}`
      : `/prep [${metaLine}]`;
    onSubmit(message);
  };

  return (
    <div className="border-t border-zinc-800 bg-zinc-950 p-4">
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Show Prep</h3>
          <button type="button" onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">
            Cancel
          </button>
        </div>

        {/* Station + Shift row */}
        <div className="mb-3 flex gap-3">
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Station</label>
            <select
              value={station}
              onChange={(e) => setStation(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Select station...</option>
              {STATIONS.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">Shift</label>
            <select
              value={shift}
              onChange={(e) => setShift(e.target.value)}
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
            >
              {SHIFTS.map((s) => (
                <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs text-zinc-500">DJ Name <span className="text-zinc-600">(optional)</span></label>
            <input
              type="text"
              value={djName}
              onChange={(e) => setDjName(e.target.value)}
              placeholder="Your name"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Setlist */}
        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">Setlist <span className="text-zinc-600">(Artist - Track, one per line)</span></label>
          <textarea
            ref={setlistRef}
            value={setlist}
            onChange={(e) => setSetlist(e.target.value)}
            rows={4}
            placeholder={"Khruangbin - Time (You and I)\nLittle Simz - Gorilla\nThundercat - Them Changes"}
            className="w-full resize-none rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
          />
        </div>

        {/* What do you need? */}
        <div className="mb-3">
          <label className="mb-1 block text-xs text-zinc-500">What do you need? <span className="text-zinc-600">(leave all unchecked for full prep)</span></label>
          <div className="flex flex-wrap gap-2">
            {PREP_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => toggleOption(opt.key)}
                className={`rounded-full border px-3 py-1 text-xs transition ${
                  selectedOptions.has(opt.key)
                    ? "border-cyan-500 bg-cyan-500/10 text-cyan-400"
                    : "border-zinc-700 text-zinc-400 hover:border-zinc-500"
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Guest (shows if interview selected or full prep) */}
        {(isFullPrep || selectedOptions.has("interview")) && (
          <div className="mb-4">
            <label className="mb-1 block text-xs text-zinc-500">Interview Guest <span className="text-zinc-600">(optional)</span></label>
            <input
              type="text"
              value={guest}
              onChange={(e) => setGuest(e.target.value)}
              placeholder="Guest artist name"
              className="w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!station && !setlist.trim()}
          className="w-full rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isFullPrep ? "Generate Full Show Prep" : `Generate ${[...selectedOptions].map((k) => PREP_OPTIONS.find((o) => o.key === k)?.label).join(" + ")}`}
        </button>
      </div>
    </div>
  );
}

function ChatInput() {
  const [input, setInput] = useState("");
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [showPrepForm, setShowPrepForm] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const { processMessage, isRunning } = useThread();
  const isLoading = isRunning;
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea to fit content (1 row min, 6 rows max)
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [input]);

  // Show menu when input starts with "/" and has no space yet (still typing command)
  const slashFilter = input.startsWith("/") && !input.includes(" ") && !input.includes("\n") ? input : "";

  useEffect(() => {
    setShowSlashMenu(slashFilter.length > 0);
    setSelectedIndex(0);
  }, [slashFilter]);

  const filteredCommands = SLASH_COMMANDS.filter(
    (c) => c.command.startsWith(slashFilter.toLowerCase()) || c.description.toLowerCase().includes(slashFilter.slice(1).toLowerCase()),
  );

  const handleSelect = (cmd: string) => {
    // If selecting /show-prep or /prep, open the form instead of filling input
    const trimmed = cmd.trim();
    if (trimmed === "/show-prep" || trimmed === "/prep") {
      setShowPrepForm(true);
      setShowSlashMenu(false);
      setInput("");
      return;
    }
    setInput(cmd);
    setShowSlashMenu(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Slash menu navigation
    if (showSlashMenu) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, filteredCommands.length - 1));
        return;
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
        return;
      } else if (e.key === "Tab" || (e.key === "Enter" && filteredCommands.length > 0 && !input.includes(" "))) {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) handleSelect(selected.command + " ");
        return;
      } else if (e.key === "Escape") {
        setShowSlashMenu(false);
        return;
      }
    }

    // Enter submits, Shift+Enter inserts newline
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!input.trim() || isLoading) return;
      // If just "/prep" or "/show-prep" with no args, open the form
      const trimmedInput = input.trim().toLowerCase();
      if (trimmedInput === "/prep" || trimmedInput === "/show-prep" || trimmedInput === "/showprep") {
        setShowPrepForm(true);
        setShowSlashMenu(false);
        setInput("");
        return;
      }
      setShowSlashMenu(false);
      processMessage({
        role: "user",
        content: [{ type: "text", text: input.trim() }],
      });
      setInput("");
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
  };

  const handlePrepSubmit = (msg: string) => {
    setShowPrepForm(false);
    processMessage({
      role: "user",
      content: [{ type: "text", text: msg }],
    });
  };

  if (showPrepForm) {
    return (
      <ShowPrepForm
        onSubmit={handlePrepSubmit}
        onCancel={() => {
          setShowPrepForm(false);
          inputRef.current?.focus();
        }}
      />
    );
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-4">
      <div className="relative">
        {showSlashMenu && (
          <SlashCommandMenu
            filter={slashFilter}
            onSelect={handleSelect}
            selectedIndex={selectedIndex}
          />
        )}
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder={isLoading ? "Crate is researching..." : "Ask about any artist, track, or genre... (/ for commands)"}
          className="w-full resize-none rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
          disabled={isLoading}
        />
        {isLoading && (
          <div className="absolute bottom-0 left-0 h-0.5 w-full overflow-hidden rounded-b-lg">
            <div className="h-full w-1/3 animate-pulse bg-cyan-500/50" style={{ animation: "shimmer 1.5s ease-in-out infinite" }} />
          </div>
        )}
      </div>
    </form>
  );
}

/** Load saved messages from Convex into the ChatProvider on mount / session change. */
function ChatHydration() {
  const { setMessages } = useThread();
  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const saved = useQuery(
    api.messages.list,
    sessionId ? { sessionId } : "skip",
  );
  // Track which session we've already hydrated to avoid re-hydrating
  // AND to properly reset when navigating between sessions
  const hydratedSessionRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId || !saved) return;
    // Already hydrated this session
    if (hydratedSessionRef.current === sessionId) return;

    if (saved.length === 0) {
      // New session or empty session — mark hydrated so we don't keep checking
      hydratedSessionRef.current = sessionId;
      return;
    }

    hydratedSessionRef.current = sessionId;

    const hydrated = saved.map((m) =>
      m.role === "user"
        ? {
            id: m._id as string,
            role: "user" as const,
            content: [{ type: "text" as const, text: m.content }],
          }
        : {
            id: m._id as string,
            role: "assistant" as const,
            content: m.content,
          },
    );
    setMessages(hydrated);
  }, [saved, sessionId, setMessages]);

  return null;
}

function ChatPersistence() {
  const { messages, isRunning } = useThread();
  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sendMessage = useMutation(api.messages.send);
  const updateTitle = useMutation(api.sessions.updateTitle);
  const persistedRef = useRef(new Set<string>());
  const titleSetRef = useRef(false);
  const prevSessionRef = useRef<string | null>(null);

  // Reset persistence tracking when session changes
  useEffect(() => {
    if (sessionId && sessionId !== prevSessionRef.current) {
      prevSessionRef.current = sessionId;
      persistedRef.current = new Set<string>();
      titleSetRef.current = false;
    }
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !user) return;

    for (const m of messages) {
      if (persistedRef.current.has(m.id)) continue;

      // Messages hydrated from Convex already have Convex IDs — skip them
      // Convex IDs don't contain dashes (UUIDs do)
      if (!m.id.includes("-")) {
        persistedRef.current.add(m.id);
        continue;
      }

      // Persist user messages immediately
      if (m.role === "user") {
        const parts = getContentParts(m.content);
        const text = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (text) {
          persistedRef.current.add(m.id);
          sendMessage({ sessionId, role: "user", content: text });
          // Set session title from first user message
          if (!titleSetRef.current) {
            titleSetRef.current = true;
            const title = text.length > 60 ? text.slice(0, 60) + "..." : text;
            updateTitle({ id: sessionId, title });
          }
        }
      }

      // Persist assistant messages only after streaming completes
      if (m.role === "assistant" && !isRunning) {
        const parts = getContentParts(m.content);
        const text = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");
        if (text) {
          persistedRef.current.add(m.id);
          sendMessage({ sessionId, role: "assistant", content: text });
        }
      }
    }
  }, [messages, isRunning, sessionId, user, sendMessage, updateTitle]);

  return null;
}

function ChatHeader() {
  const [hasOpenRouter, setHasOpenRouter] = useState(false);

  useEffect(() => {
    fetch("/api/keys")
      .then((r) => r.json())
      .then((data) => setHasOpenRouter(!!data.keys?.openrouter))
      .catch(() => {});
  }, []);

  return (
    <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2">
      <ModelSelector hasOpenRouter={hasOpenRouter} />
    </div>
  );
}

export function ChatPanel() {
  const [steps, setSteps] = useState<ToolStep[]>([]);

  const onToolStartRef = useRef<((info: { tool: string; server: string; input: unknown }) => void) | null>(null);
  const onToolEndRef = useRef<((info: { tool: string; server: string }) => void) | null>(null);

  onToolStartRef.current = ({ tool, server, input }) => {
    const id = `${server}__${tool}__${Date.now()}`;
    const label = getToolLabel(tool, server, input);
    setSteps((prev) => [...prev, { id, tool, server, label, status: "active" }]);
  };

  onToolEndRef.current = ({ tool, server }) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.tool === tool && s.server === server && s.status === "active"
          ? { ...s, status: "done" as const }
          : s,
      ),
    );
  };

  const adapter = useMemo(
    () =>
      crateStreamAdapter({
        onToolStart: (info) => onToolStartRef.current?.(info),
        onToolEnd: (info) => onToolEndRef.current?.(info),
        onStreamEnd: () => setSteps([]),
      }),
    [],
  );

  const processMessage = useCallback(
    async ({ messages, abortController }: { threadId: string; messages: Array<{ role: string; content?: unknown }>; abortController: AbortController }) => {
      // Clear steps from any previous run
      setSteps([]);

      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      const parts = getContentParts(lastUserMsg?.content);
      const messageText = parts
        .filter((c): c is { type: "text"; text: string } => c.type === "text")
        .map((c) => c.text)
        .join("");

      const model = getStoredModel();

      // Single endpoint handles both chat and agent tiers
      return fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, model }),
        signal: abortController.signal,
      });
    },
    [],
  );

  return (
    <ToolActivityContext.Provider value={{ steps }}>
      <ChatProvider processMessage={processMessage} streamProtocol={adapter}>
        <div className="flex h-full flex-col bg-zinc-950">
          <ChatHeader />
          <ChatHydration />
          <ChatMessages />
          <ChatInput />
          <ChatPersistence />
        </div>
      </ChatProvider>
    </ToolActivityContext.Provider>
  );
}
