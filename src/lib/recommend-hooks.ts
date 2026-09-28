"use client";

/**
 * React hooks for the /recommend client.
 *
 * useTourStatus(tourId) — subscribes to the latest tourStatus row via Convex
 * useQuery. Re-renders automatically as the Convex action writes phase
 * updates. Returns the current phase, progress (0..1), an optional detail
 * string for UI display, and a derived `isComplete` boolean.
 *
 * useTourGeneration() — POSTs to /api/recommend/generate and returns a
 * stateful object with { state, tourId, slug, error }. Wraps the client-side
 * dance of submit → hold loading state → surface errors.
 */

import { useQuery } from "convex/react";
import { useCallback, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

// ── useTourStatus ────────────────────────────────────────────────────────────

export type TourStatus = {
  phase: string;
  progress: number;
  detail?: string;
  timestamp: number;
  isComplete: boolean;
};

/**
 * Subscribe to the latest phase update for a tour. Returns undefined until
 * the first status row is written (initial render before the action fires
 * its first status write).
 *
 * `isComplete` is derived from the phase string — any of:
 *   "done" (tour ready) | "done_vague" (show clarify UI) | "failed" |
 *   "timed_out" | "flagged"
 * signals the end of the pipeline. UI can stop showing loading state and
 * switch to the final view.
 */
export function useTourStatus(
  tourId: Id<"artifactsRecommend"> | null | undefined,
): TourStatus | undefined {
  const result = useQuery(
    api.recommend.mutations.getTourStatus,
    tourId ? { tourId } : "skip",
  );

  if (!result) return undefined;

  return {
    phase: result.phase,
    progress: result.progress,
    detail: result.detail,
    timestamp: result.timestamp,
    isComplete: TERMINAL_PHASES.has(result.phase),
  };
}

const TERMINAL_PHASES = new Set([
  "done",
  "done_vague",
  "failed",
  "timed_out",
  "flagged",
]);

// ── useTourGeneration ────────────────────────────────────────────────────────

export type TourGenerationState =
  | { state: "idle" }
  | { state: "submitting" }
  | { state: "submitted"; tourId: Id<"artifactsRecommend">; slug: string }
  | { state: "error"; error: string };

export function useTourGeneration() {
  const [state, setState] = useState<TourGenerationState>({ state: "idle" });

  const generate = useCallback(async (prompt: string) => {
    setState({ state: "submitting" });
    try {
      const response = await fetch("/api/recommend/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      const data = (await response.json()) as
        | { ok: true; tourId: string; slug: string }
        | { ok: false; error: string; resetAt?: number };

      if (!response.ok || !data.ok) {
        const errorMsg = !data.ok ? data.error : "We couldn't start your tour";
        setState({ state: "error", error: errorMsg });
        return;
      }

      setState({
        state: "submitted",
        tourId: data.tourId as Id<"artifactsRecommend">,
        slug: data.slug,
      });
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : "Network error";
      setState({ state: "error", error: errorMsg });
    }
  }, []);

  const reset = useCallback(() => {
    setState({ state: "idle" });
  }, []);

  return { state, generate, reset };
}
