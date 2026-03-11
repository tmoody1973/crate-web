"use client";

import { ChatProvider, useThread } from "@openuidev/react-headless";
import { Renderer } from "@openuidev/react-lang";
import { useState, useRef, useEffect, useCallback, FormEvent } from "react";
import { MarkdownHooks as ReactMarkdown } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { crateLibrary } from "@/lib/openui/library";
import { crateStreamAdapter } from "@/lib/openui/stream-adapter";
import { useArtifact } from "./artifact-provider";

function MarkdownContent({ content }: { content: string }) {
  return (
    <ReactMarkdown
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
    </ReactMarkdown>
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
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
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
            <div className="prose prose-invert prose-sm mt-1 max-w-none">
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

      {isRunning && (
        <div className="mb-4">
          <span className="text-xs font-semibold uppercase text-zinc-500">
            Crate
          </span>
          <div className="mt-1 flex items-center gap-2 text-zinc-500">
            <span className="inline-flex gap-1">
              <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
              <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
            </span>
            <span className="text-sm">Researching</span>
          </div>
        </div>
      )}
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

  useEffect(() => {
    if (!sessionId || !user) return;

    for (const m of messages) {
      if (persistedRef.current.has(m.id)) continue;

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

export function ChatPanel() {
  return (
    <ChatProvider
      processMessage={async ({ messages, abortController }) => {
        // Extract the last user message text
        const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
        const parts = getContentParts(lastUserMsg?.content);
        const messageText = parts
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map((c) => c.text)
          .join("");

        return fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: messageText }),
          signal: abortController.signal,
        });
      }}
      streamProtocol={crateStreamAdapter()}
    >
      <div className="flex h-full flex-col bg-zinc-950">
        <ChatMessages />
        <ChatInput />
        <ChatPersistence />
      </div>
    </ChatProvider>
  );
}
