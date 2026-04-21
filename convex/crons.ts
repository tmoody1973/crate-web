/**
 * Convex cron registry. Each cron runs on a schedule and calls an internal
 * function. Convex auto-discovers this file (the export must be named `crons`).
 *
 * Budget philosophy: each sweep deletes a bounded batch (see
 * convex/recommend/cleanup.ts). If there's a big backlog, the next cron tick
 * keeps going until it's drained. Normal-day volume is small enough that a
 * single tick clears the queue.
 */

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// /recommend TTL sweeps — schedule is spread across the hour so they
// don't all spike the same minute.
crons.interval(
  "prune tour status rows",
  { minutes: 15 },
  internal.recommend.cleanup.pruneTourStatus,
  {},
);

crons.interval(
  "prune tour events rows",
  { hours: 6 },
  internal.recommend.cleanup.pruneTourEvents,
  {},
);

crons.interval(
  "prune citation cache rows",
  { hours: 1 },
  internal.recommend.cleanup.pruneCitationCache,
  {},
);

export default crons;
