/**
 * Admin moderation queries + mutations for /recommend v1.
 *
 * Admin identity: the authenticated user's email must match one of the
 * comma-separated values in process.env.ADMIN_EMAILS (configured in the
 * Convex deployment environment). The check is defensive — a missing or
 * empty env var results in no admins, not unrestricted access.
 *
 * These functions are queries/mutations (not actions) because they only
 * touch the database. Read-vs-write semantics are honored.
 */

import { v } from "convex/values";
import {
  mutation,
  query,
  type MutationCtx,
  type QueryCtx,
} from "../_generated/server";

// ── Admin identity check ────────────────────────────────────────────────────

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

/**
 * Resolve the authenticated caller to a user record and confirm admin status.
 * Throws on any failure — caller cannot catch/bypass.
 */
async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Not authenticated");

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();
  if (!user) throw new Error("User not found");

  const email = user.email?.toLowerCase() ?? "";
  if (!email || !adminEmails().has(email)) {
    throw new Error("Forbidden: admin access required");
  }
  return { user, email };
}

// ── Moderation queue queries ─────────────────────────────────────────────────

/**
 * List tours currently in a review-worthy state: flagged by the moderation
 * classifier OR still pending (timed-out moderation calls are surfaced for
 * manual review). Most recent first.
 */
export const listFlaggedTours = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { limit = 25 }) => {
    await requireAdmin(ctx);
    const capped = Math.min(Math.max(1, limit), 100);

    const flagged = await ctx.db
      .query("artifactsRecommend")
      .withIndex("by_moderation_status", (q) => q.eq("moderationStatus", "flagged"))
      .order("desc")
      .take(capped);
    const timedOut = await ctx.db
      .query("artifactsRecommend")
      .withIndex("by_moderation_status", (q) => q.eq("moderationStatus", "timed_out"))
      .order("desc")
      .take(capped);

    const merged = [...flagged, ...timedOut]
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, capped);
    return merged;
  },
});

/**
 * List pending user-submitted tour reports, newest first. Each report comes
 * back with the referenced tour embedded so the admin UI renders in one query.
 */
export const listPendingReports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 25 }) => {
    await requireAdmin(ctx);
    const capped = Math.min(Math.max(1, limit), 100);

    const reports = await ctx.db
      .query("tourReports")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .order("desc")
      .take(capped);

    const hydrated = await Promise.all(
      reports.map(async (r) => ({
        report: r,
        tour: await ctx.db.get(r.tourId),
      })),
    );
    return hydrated;
  },
});

// ── Moderation actions ──────────────────────────────────────────────────────

/**
 * Admin override for tour visibility. Used to manually approve a flagged
 * tour, or take down a tour that users reported. Writes a simple audit
 * trail by appending to `moderationCategories` and updating `moderatedAt`.
 */
export const setTourVisibility = mutation({
  args: {
    tourId: v.id("artifactsRecommend"),
    action: v.union(v.literal("approve"), v.literal("block")),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, { tourId, action, reason }) => {
    const { email } = await requireAdmin(ctx);
    const tour = await ctx.db.get(tourId);
    if (!tour) throw new Error("Tour not found");

    const auditTag = `admin:${action}:${email}${reason ? `:${reason.slice(0, 80)}` : ""}`;
    const existing = tour.moderationCategories ?? [];

    await ctx.db.patch(tourId, {
      moderationStatus: action === "approve" ? "approved" : "flagged",
      isPublic: action === "approve",
      lifecyclePhase: action === "approve" ? "completed" : "flagged",
      moderationCategories: [...existing, auditTag],
      moderatedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Resolve a user-submitted report. Setting status=reviewed_approved means
 * "report dismissed, tour stays up"; reviewed_blocked means "report upheld,
 * tour taken down". The tour itself is updated separately via
 * setTourVisibility — this mutation only records the report outcome.
 */
export const resolveReport = mutation({
  args: {
    reportId: v.id("tourReports"),
    outcome: v.union(
      v.literal("reviewed_approved"),
      v.literal("reviewed_blocked"),
    ),
  },
  handler: async (ctx, { reportId, outcome }) => {
    await requireAdmin(ctx);
    const report = await ctx.db.get(reportId);
    if (!report) throw new Error("Report not found");

    await ctx.db.patch(reportId, {
      status: outcome,
      reviewedAt: Date.now(),
    });
    return { ok: true };
  },
});
