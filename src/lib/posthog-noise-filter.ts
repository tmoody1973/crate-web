import type { CaptureResult } from "posthog-js";

// Browsers dispatch "ResizeObserver loop completed with undelivered
// notifications" to window.onerror when a resize callback does not settle in one
// animation frame. It is a benign notice, not a thrown exception (no stack,
// mechanism.synthetic). Drop it so it does not clutter error tracking.
const RESIZE_OBSERVER_NOISE = /^ResizeObserver loop/;

/** PostHog `before_send` handler that drops benign ResizeObserver notices. */
export function dropBenignExceptions(
  event: CaptureResult | null,
): CaptureResult | null {
  if (event?.event !== "$exception") return event;
  const list = event.properties?.$exception_list as
    | { value?: string }[]
    | undefined;
  const isNoise = list?.some(
    (item) => item.value != null && RESIZE_OBSERVER_NOISE.test(item.value),
  );
  return isNoise ? null : event;
}
