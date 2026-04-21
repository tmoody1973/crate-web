/**
 * Shared event names + typed property shapes for /recommend PostHog events.
 *
 * Centralized so the same names fire from client (posthog-js), server (posthog-node
 * via posthog-server.ts), and the Convex action (HTTP capture API). Changing a
 * constant here changes it everywhere; PostHog dashboards stay consistent.
 *
 * PII rule: no raw prompt text, no emails, no clerk IDs. Use the hashed forms
 * already computed by the Convex action (promptHash, userIdHash) when shipping
 * identifying properties.
 */

export const RECOMMEND_EVENTS = {
  /** Client fired the submit form action (pre-request). */
  tourStartedAttempt: "recommend_tour_started_attempt",
  /** Server accepted the tour request and kicked off generation. */
  tourStarted: "recommend_tour_started",
  /** Server-emitted on completion (from runGenerationFlow → PostHog HTTP). */
  tourCompleted: "recommend_tour_completed",
  /** Client landed on /r/[slug] successfully. */
  tourViewed: "recommend_tour_viewed",
  /** User hit keep/pass/save on an artist. */
  signalRecorded: "recommend_signal_recorded",
  /** User tapped Share (native or clipboard). */
  tourShared: "recommend_tour_shared",
  /** User submitted a report. */
  tourReported: "recommend_tour_reported",
  /** Admin approved or blocked a tour. */
  adminModerated: "recommend_admin_moderated",
} as const;

export type RecommendEvent =
  (typeof RECOMMEND_EVENTS)[keyof typeof RECOMMEND_EVENTS];

// ── Client (posthog-js) ─────────────────────────────────────────────────────

/**
 * Fire an event from the browser. Safe to call on the server: if posthog-js
 * isn't initialized (SSR or PostHog env vars missing), the call no-ops.
 */
export function trackRecommendClient(
  event: RecommendEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  // Lazy require so server bundles don't pull posthog-js.
  try {
    // Types are loose on posthog-js global; use a structural cast.
    const posthog = (
      window as unknown as {
        posthog?: { capture?: (name: string, props?: unknown) => void };
      }
    ).posthog;
    posthog?.capture?.(event, properties);
  } catch {
    // Never break user flow on a telemetry hiccup.
  }
}

// ── Server (posthog-node) ───────────────────────────────────────────────────

/**
 * Fire an event from a Vercel route handler. Uses the shared posthog-node
 * client from posthog-server.ts. `distinctId` should be the Clerk user id
 * (or a stable anonymous id for unauthenticated flows).
 *
 * Never throws: telemetry failures are logged, not propagated.
 */
export async function trackRecommendServer(
  distinctId: string,
  event: RecommendEvent,
  properties?: Record<string, unknown>,
): Promise<void> {
  try {
    const { getPostHogClient } = await import("./posthog-server");
    const client = getPostHogClient();
    client.capture({ distinctId, event, properties });
  } catch (e) {
    console.warn("[recommend-analytics] server capture failed:", e);
  }
}
