/**
 * Server-only PostHog emission for /recommend events.
 *
 * Split from recommend-analytics.ts because posthog-node uses Node APIs that
 * can't run in the client bundle. Next.js bundles anything reachable from a
 * client component, so we keep the Node client strictly in this file and
 * only import it from route handlers / server components.
 */

import { getPostHogClient } from "./posthog-server";
import type { RecommendEvent } from "./recommend-analytics";

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
    const client = getPostHogClient();
    client.capture({ distinctId, event, properties });
  } catch (e) {
    console.warn("[recommend-analytics-server] capture failed:", e);
  }
}
