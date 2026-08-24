import posthog from "posthog-js";
import { dropBenignExceptions } from "@/lib/posthog-noise-filter";

posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
  api_host: "/ingest",
  ui_host: "https://us.posthog.com",
  defaults: "2026-01-30",
  capture_exceptions: true,
  before_send: dropBenignExceptions,
  debug: process.env.NODE_ENV === "development",
});
