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

/** Try to detect if content contains OpenUI Lang (has component assignments). */
function containsOpenUILang(content: string): boolean {
  return /^\w+\s*=\s*\w+\(/m.test(content);
}

/** Check if a line is an OpenUI Lang assignment: `varName = ComponentName(...)` */
function isOpenUILine(line: string): boolean {
  return /^\w+\s*=\s*[A-Z]\w*\(/.test(line.trim());
}

/** Split content into markdown sections and OpenUI Lang blocks. */
function splitContent(content: string): Array<{ type: "markdown" | "openui"; text: string }> {
  if (!containsOpenUILang(content)) {
    return [{ type: "markdown", text: content }];
  }

  const lines = content.split("\n");
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
      // Switching from markdown to openui
      flush();
      currentType = "openui";
      currentLines.push(line);
    } else if (!lineIsOpenUI && currentType === "openui") {
      // Could be an empty line within OpenUI block — peek ahead behavior:
      // Keep empty lines, but non-empty non-OpenUI lines end the block
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
        {doneSteps.map((step) => (
          <div key={step.id} className="flex items-center gap-2 text-zinc-600 text-sm">
            <span className="text-green-500">✓</span>
            <span>{step.label}</span>
          </div>
        ))}
        {activeSteps.length > 0 ? (
          activeSteps.map((step) => (
            <div key={step.id} className="flex items-center gap-2 text-zinc-400 text-sm">
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
    for (const part of parts) {
      if (part.type !== "text" || !part.text) continue;
      const sections = splitContent(part.text);
      const openuiSection = sections.find((s) => s.type === "openui");
      if (openuiSection) {
        pushArtifact(openuiSection.text);
      }
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
          )}
        </div>
      ))}

      {isRunning && <ResearchSteps />}
    </div>
  );
}

function ChatInput() {
  const [input, setInput] = useState("");
  const { processMessage, isRunning } = useThread();
  const isLoading = isRunning;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    processMessage({
      role: "user",
      content: [{ type: "text", text: input.trim() }],
    });
    setInput("");
  };

  return (
    <form onSubmit={handleSubmit} className="border-t border-zinc-800 p-4">
      <div className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={isLoading ? "Crate is researching..." : "Ask about any artist, track, or genre..."}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none disabled:opacity-50"
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

      return fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: messageText, model: getStoredModel() }),
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
