/**
 * Shared event names for /recommend PostHog events. CLIENT-SAFE — this file
 * never imports posthog-node or any Node-only dependency, so it's safe to
 * pull into client components without leaking server code into the browser
 * bundle.
 *
 * For server-side emission, use `@/lib/recommend-analytics-server`.
 *
 * PII rule: no raw prompt text, no emails, no clerk IDs. Use hashed forms
 * (promptHash, userIdHash) when shipping identifying properties.
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

/**
 * Fire an event from the browser. Safe to call on the server: if posthog-js
 * isn't initialized (SSR or PostHog env vars missing), the call no-ops.
 */
export function trackRecommendClient(
  event: RecommendEvent,
  properties?: Record<string, unknown>,
): void {
  if (typeof window === "undefined") return;
  try {
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
