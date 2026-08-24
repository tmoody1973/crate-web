import { describe, it, expect } from "vitest";
import type { CaptureResult } from "posthog-js";
import { dropBenignExceptions } from "../posthog-noise-filter";

function exceptionEvent(value: string): CaptureResult {
  return {
    event: "$exception",
    properties: { $exception_list: [{ value }] },
  } as unknown as CaptureResult;
}

describe("dropBenignExceptions", () => {
  it("drops ResizeObserver loop notices", () => {
    const event = exceptionEvent(
      "ResizeObserver loop completed with undelivered notifications.",
    );
    expect(dropBenignExceptions(event)).toBeNull();
  });

  it("keeps real exceptions", () => {
    const event = exceptionEvent("TypeError: cannot read property 'x' of undefined");
    expect(dropBenignExceptions(event)).toBe(event);
  });

  it("keeps non-exception events", () => {
    const event = { event: "$pageview", properties: {} } as unknown as CaptureResult;
    expect(dropBenignExceptions(event)).toBe(event);
  });

  it("passes through a null event", () => {
    expect(dropBenignExceptions(null)).toBeNull();
  });

  it("keeps exceptions with no exception list", () => {
    const event = { event: "$exception", properties: {} } as unknown as CaptureResult;
    expect(dropBenignExceptions(event)).toBe(event);
  });
});
