"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface Artifact {
  id: string;
  label: string;
  content: string;
  timestamp: number;
}

/** Extract a label from OpenUI Lang content by parsing the root component's first string arg. */
function extractLabel(content: string): string {
  const match = content.match(/^root\s*=\s*\w+\(\s*"([^"]+)"/m);
  if (match?.[1]) return match[1];
  const fallback = content.match(/^\w+\s*=\s*\w+\(\s*"([^"]+)"/m);
  return fallback?.[1] ?? "Artifact";
}

/** Simple hash for deduplication. */
async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface ArtifactContextValue {
  current: Artifact | null;
  history: Artifact[];
  setArtifact: (content: string) => void;
  selectArtifact: (id: string) => void;
  clear: () => void;
  showPanel: boolean;
  dismissPanel: () => void;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function useArtifact() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifact must be used within ArtifactProvider");
  return ctx;
}

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Artifact | null>(null);
  const [history, setHistory] = useState<Artifact[]>([]);
  const [showPanel, setShowPanel] = useState(false);

  const params = useParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const convexArtifacts = useQuery(
    api.artifacts.listBySession,
    sessionId ? { sessionId } : "skip",
  );
  const createArtifact = useMutation(api.artifacts.create);

  // Hydrate history from Convex on mount
  useEffect(() => {
    if (!convexArtifacts || convexArtifacts.length === 0) return;
    const hydrated: Artifact[] = convexArtifacts.map((a) => ({
      id: a._id,
      label: a.label,
      content: a.data,
      timestamp: a.createdAt,
    }));
    setHistory(hydrated);
    setCurrent(hydrated[hydrated.length - 1]);
  }, [convexArtifacts]);

  const setArtifact = useCallback(
    (content: string) => {
      const artifact: Artifact = {
        id: crypto.randomUUID(),
        label: extractLabel(content),
        content,
        timestamp: Date.now(),
      };
      setCurrent(artifact);
      setHistory((prev) => [...prev, artifact]);
      setShowPanel(true);

      if (sessionId && user) {
        hashContent(content).then((contentHash) => {
          createArtifact({
            sessionId,
            userId: user._id,
            type: "openui",
            label: artifact.label,
            data: content,
            contentHash,
          });
        });
      }
    },
    [sessionId, user, createArtifact],
  );

  const selectArtifact = useCallback((id: string) => {
    setHistory((prev) => {
      const found = prev.find((a) => a.id === id);
      if (found) {
        setCurrent(found);
        setShowPanel(true);
      }
      return prev;
    });
  }, []);

  const clear = useCallback(() => {
    setCurrent(null);
  }, []);

  const dismissPanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  return (
    <ArtifactContext.Provider
      value={{ current, history, setArtifact, selectArtifact, clear, showPanel, dismissPanel }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}
