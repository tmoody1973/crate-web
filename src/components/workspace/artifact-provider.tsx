"use client";

import { createContext, useContext, useState, useCallback, useEffect, useRef, ReactNode } from "react";
import posthog from "posthog-js";
import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { detectDeepCutType, type DeepCutType } from "@/lib/deep-cut-utils";

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
  return fallback?.[1] ?? "Deep Cut";
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
  currentType: DeepCutType;
  history: Artifact[];
  setArtifact: (content: string) => void;
  selectArtifact: (id: string) => void;
  clear: () => void;
  showPanel: boolean;
  dismissPanel: () => void;
  openPanel: () => void;
  isSaving: boolean;
}

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

export function useArtifact() {
  const ctx = useContext(ArtifactContext);
  if (!ctx) throw new Error("useArtifact must be used within ArtifactProvider");
  return ctx;
}

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<Artifact | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params?.sessionId as Id<"sessions"> | undefined;
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const convexArtifacts = useQuery(
    api.artifacts.listBySession,
    sessionId ? { sessionId } : "skip",
  );
  const createArtifact = useMutation(api.artifacts.create);
  const openedFromUrlRef = useRef(false);
  // Track content hashes we've already saved to Convex to prevent duplicates
  const savedHashesRef = useRef(new Set<string>());

  // Convex artifacts ARE the history — single source of truth
  const history: Artifact[] = (convexArtifacts ?? []).map((a) => ({
    id: a._id,
    label: a.label,
    content: a.data,
    timestamp: a.createdAt,
  }));

  const currentType = current ? detectDeepCutType(current.content) : "other";

  // Seed saved hashes from Convex artifacts so we never re-save them
  useEffect(() => {
    if (!convexArtifacts) return;
    for (const a of convexArtifacts) {
      if (a.contentHash) savedHashesRef.current.add(a.contentHash);
    }
  }, [convexArtifacts]);

  // Auto-select latest artifact when history changes
  useEffect(() => {
    if (history.length > 0 && !current) {
      setCurrent(history[history.length - 1]);
    }
  }, [history, current]);

  // Open specific artifact from URL param (e.g. /w/session?artifact=id)
  useEffect(() => {
    const artifactId = searchParams?.get("artifact");
    if (!artifactId || openedFromUrlRef.current || history.length === 0) return;
    const found = history.find((a) => a.id === artifactId);
    if (found) {
      openedFromUrlRef.current = true;
      setCurrent(found);
      setShowPanel(true);
    }
  }, [searchParams, history]);

  const setArtifact = useCallback(
    (content: string) => {
      const label = extractLabel(content);
      const componentType = content.match(/^root\s*=\s*(\w+)\(/m)?.[1] ?? "unknown";
      posthog.capture("artifact_opened", { type: componentType });
      setCurrent({ id: "pending", label, content, timestamp: Date.now() });
      setShowPanel(true);
      setIsSaving(true);

      if (sessionId && user) {
        hashContent(content).then((contentHash) => {
          if (savedHashesRef.current.has(contentHash)) {
            // Content already saved — find the real ID from history
            const existing = (convexArtifacts ?? []).find((a) => a.contentHash === contentHash);
            if (existing) {
              setCurrent((prev) =>
                prev?.id === "pending" ? { ...prev, id: existing._id } : prev,
              );
            }
            setIsSaving(false);
            return;
          }
          savedHashesRef.current.add(contentHash);
          createArtifact({
            sessionId,
            userId: user._id,
            type: "openui",
            label,
            data: content,
            contentHash,
          }).then((newId) => {
            // Update current with the real Convex ID so Publish button works
            setCurrent((prev) =>
              prev?.id === "pending" ? { ...prev, id: newId } : prev,
            );
            setIsSaving(false);
          }).catch(() => setIsSaving(false));
        });
      } else {
        setIsSaving(false);
      }
    },
    [sessionId, user, createArtifact],
  );

  const selectArtifact = useCallback((id: string) => {
    const found = history.find((a: Artifact) => a.id === id);
    if (found) {
      const componentType = found.content.match(/^root\s*=\s*(\w+)\(/m)?.[1] ?? "unknown";
      posthog.capture("artifact_opened", { type: componentType });
      setCurrent(found);
      setShowPanel(true);
    }
  }, [history]);

  const clear = useCallback(() => {
    setCurrent(null);
  }, []);

  const dismissPanel = useCallback(() => {
    setShowPanel(false);
  }, []);

  const openPanel = useCallback(() => {
    if (history.length > 0) {
      if (!current) setCurrent(history[history.length - 1]);
      setShowPanel(true);
    }
  }, [history, current]);

  return (
    <ArtifactContext.Provider
      value={{ current, currentType, history, setArtifact, selectArtifact, clear, showPanel, dismissPanel, openPanel, isSaving }}
    >
      {children}
    </ArtifactContext.Provider>
  );
}
