"use client";

import { useState, useCallback, useRef } from "react";

interface ToolProgress {
  tool: string;
  server: string;
  status: "running" | "complete";
  durationMs?: number;
}

interface PlanTask {
  id: number;
  description: string;
  done: boolean;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface CrateAgentState {
  messages: Message[];
  toolProgress: ToolProgress[];
  plan: PlanTask[] | null;
  isLoading: boolean;
  error: string | null;
  totalMs: number;
  toolsUsed: string[];
}

export function useCrateAgent() {
  const [state, setState] = useState<CrateAgentState>({
    messages: [],
    toolProgress: [],
    plan: null,
    isLoading: false,
    error: null,
    totalMs: 0,
    toolsUsed: [],
  });

  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(async (input: string) => {
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: input };
    const assistantId = crypto.randomUUID();

    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, userMsg],
      toolProgress: [],
      plan: null,
      isLoading: true,
      error: null,
    }));

    abortRef.current = new AbortController();

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input }),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setState((prev) => ({ ...prev, isLoading: false, error: err.error }));
        return;
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const data = line.slice(6);
          if (data === "[DONE]") continue;

          try {
            const event = JSON.parse(data);

            switch (event.type) {
              case "plan":
                setState((prev) => ({ ...prev, plan: event.tasks }));
                break;

              case "tool_start":
                setState((prev) => ({
                  ...prev,
                  toolProgress: [
                    ...prev.toolProgress,
                    { tool: event.tool, server: event.server, status: "running" },
                  ],
                }));
                break;

              case "tool_end":
                setState((prev) => ({
                  ...prev,
                  toolProgress: prev.toolProgress.map((tp) =>
                    tp.tool === event.tool && tp.status === "running"
                      ? { ...tp, status: "complete", durationMs: event.durationMs }
                      : tp,
                  ),
                }));
                break;

              case "answer_token":
                assistantText += event.token;
                setState((prev) => {
                  const msgs = [...prev.messages];
                  const existing = msgs.find((m) => m.id === assistantId);
                  if (existing) {
                    return {
                      ...prev,
                      messages: msgs.map((m) =>
                        m.id === assistantId ? { ...m, content: assistantText } : m,
                      ),
                    };
                  }
                  return {
                    ...prev,
                    messages: [
                      ...msgs,
                      { id: assistantId, role: "assistant" as const, content: assistantText },
                    ],
                  };
                });
                break;

              case "done":
                setState((prev) => ({
                  ...prev,
                  isLoading: false,
                  totalMs: event.totalMs,
                  toolsUsed: event.toolsUsed,
                }));
                break;

              case "error":
                setState((prev) => ({
                  ...prev,
                  isLoading: false,
                  error: event.message,
                }));
                break;
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : "Connection failed",
        }));
      }
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setState((prev) => ({ ...prev, isLoading: false }));
  }, []);

  return { ...state, sendMessage, stop };
}
