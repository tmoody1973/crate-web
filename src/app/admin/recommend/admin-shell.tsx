"use client";

/**
 * Admin moderation shell — client component.
 *
 * Fetches flagged tours + pending reports via Convex useQuery. The Convex
 * admin functions throw "Forbidden" for non-admins; we render that error
 * as a clean panel instead of a red blob.
 */

import Link from "next/link";
import { useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

type Tour = Doc<"artifactsRecommend">;
type Report = Doc<"tourReports">;

export function AdminModerationShell() {
  const flaggedTours = useQuery(api.recommend.admin.listFlaggedTours, {
    limit: 25,
  });
  const pendingReports = useQuery(api.recommend.admin.listPendingReports, {
    limit: 25,
  });

  // Convex throws server-side for non-admins; useQuery surfaces it as an
  // error we can look at. The shape of the error from the client is opaque,
  // so we treat any query that fails to load as a permissions failure.
  const flaggedError = flaggedTours === undefined && pendingReports === undefined;
  if (flaggedError) {
    return <LoadingOrForbidden />;
  }

  return (
    <div className="space-y-12">
      <FlaggedToursSection tours={flaggedTours} />
      <ReportsSection reports={pendingReports} />
    </div>
  );
}

function LoadingOrForbidden() {
  // useQuery is either loading (undefined) OR forbidden. Give it a beat
  // before showing the forbidden panel — 400ms is enough to avoid flash
  // on admin reloads.
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <p style={{ color: "#a1a1aa", fontSize: "15px" }}>
        Loading moderation queue… If this message sticks, you&apos;re not on
        the admin list.
      </p>
    </div>
  );
}

// ── Flagged tours ────────────────────────────────────────────────────────────

function FlaggedToursSection({
  tours,
}: {
  tours: Tour[] | undefined;
}) {
  return (
    <section>
      <SectionHeader
        label="Flagged Tours"
        count={tours?.length ?? 0}
        description="Tours where moderation classifier flagged content, or moderation timed out."
      />
      {!tours ? (
        <LoadingStrip />
      ) : tours.length === 0 ? (
        <EmptyStrip text="No flagged tours. All quiet." />
      ) : (
        <ul className="space-y-3">
          {tours.map((t) => (
            <FlaggedTourRow key={t._id} tour={t} />
          ))}
        </ul>
      )}
    </section>
  );
}

function FlaggedTourRow({ tour }: { tour: Tour }) {
  const setVisibility = useMutation(api.recommend.admin.setTourVisibility);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const act = (action: "approve" | "block") => {
    setError(null);
    start(async () => {
      try {
        await setVisibility({ tourId: tour._id, action });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  return (
    <li
      className="rounded-xl p-4"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="font-[family-name:var(--font-bebas)] tracking-wide truncate"
            style={{ color: "#f4f4f5", fontSize: "20px" }}
          >
            {tour.promptRedacted || "Untitled tour"}
          </p>
          <p
            className="italic truncate"
            style={{
              color: "#a1a1aa",
              fontSize: "12px",
              fontFamily: "Georgia, serif",
            }}
          >
            “{tour.prompt.slice(0, 120)}
            {tour.prompt.length > 120 ? "…" : ""}”
          </p>
          <div
            className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] tracking-widest"
            style={{ color: "#71717a" }}
          >
            <span>STATUS: {tour.moderationStatus.toUpperCase()}</span>
            <span>ARTISTS: {tour.artists.length}</span>
            {tour.moderationCategories && tour.moderationCategories.length > 0 && (
              <span>FLAGS: {tour.moderationCategories.join(", ")}</span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href={`/r/${tour.slug}`}
            target="_blank"
            className="font-[family-name:var(--font-bebas)] text-xs tracking-widest transition-colors hover:text-[#e8b86a]"
            style={{ color: "#a1a1aa" }}
          >
            VIEW ↗
          </Link>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={pending}
            className="font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest disabled:opacity-60"
            style={{
              backgroundColor: "#e8b86a",
              color: "#0a0a0a",
            }}
          >
            APPROVE
          </button>
          <button
            type="button"
            onClick={() => act("block")}
            disabled={pending}
            className="font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest disabled:opacity-60"
            style={{
              border: "1px solid #fca5a5",
              color: "#fca5a5",
              backgroundColor: "transparent",
            }}
          >
            BLOCK
          </button>
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "#fca5a5" }} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// ── Reports ──────────────────────────────────────────────────────────────────

type HydratedReport = { report: Report; tour: Tour | null };

function ReportsSection({
  reports,
}: {
  reports: HydratedReport[] | undefined;
}) {
  return (
    <section>
      <SectionHeader
        label="Pending Reports"
        count={reports?.length ?? 0}
        description="User-submitted reports. Resolve by confirming or dismissing each one."
      />
      {!reports ? (
        <LoadingStrip />
      ) : reports.length === 0 ? (
        <EmptyStrip text="No pending reports." />
      ) : (
        <ul className="space-y-3">
          {reports.map(({ report, tour }) => (
            <ReportRow
              key={report._id}
              report={report}
              tour={tour}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ReportRow({
  report,
  tour,
}: {
  report: Report;
  tour: Tour | null;
}) {
  const resolveReport = useMutation(api.recommend.admin.resolveReport);
  const setVisibility = useMutation(api.recommend.admin.setTourVisibility);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const dismiss = (reportId: Id<"tourReports">) => {
    setError(null);
    start(async () => {
      try {
        await resolveReport({ reportId, outcome: "reviewed_approved" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  const uphold = (reportId: Id<"tourReports">, tourId: Id<"artifactsRecommend">) => {
    setError(null);
    start(async () => {
      try {
        await setVisibility({ tourId, action: "block", reason: `report:${reportId}` });
        await resolveReport({ reportId, outcome: "reviewed_blocked" });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Action failed");
      }
    });
  };

  return (
    <li
      className="rounded-xl p-4"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <p
            className="font-[family-name:var(--font-bebas)] tracking-wide truncate"
            style={{ color: "#f4f4f5", fontSize: "18px" }}
          >
            {tour?.promptRedacted || "(tour missing)"}
          </p>
          <p
            className="italic"
            style={{
              color: "#d4d4d8",
              fontSize: "13px",
              fontFamily: "Georgia, serif",
              marginTop: "4px",
              lineHeight: "1.5",
            }}
          >
            “{report.reason}”
          </p>
          <p
            className="mt-2 text-[11px] tracking-widest"
            style={{ color: "#71717a" }}
          >
            REPORTED {new Date(report.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {tour && (
            <Link
              href={`/r/${tour.slug}`}
              target="_blank"
              className="font-[family-name:var(--font-bebas)] text-xs tracking-widest transition-colors hover:text-[#e8b86a]"
              style={{ color: "#a1a1aa" }}
            >
              VIEW ↗
            </Link>
          )}
          <button
            type="button"
            onClick={() => dismiss(report._id)}
            disabled={pending}
            className="font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest disabled:opacity-60"
            style={{
              border: "1px solid #27272a",
              color: "#d4d4d8",
              backgroundColor: "transparent",
            }}
          >
            DISMISS
          </button>
          {tour && (
            <button
              type="button"
              onClick={() => uphold(report._id, tour._id)}
              disabled={pending}
              className="font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest disabled:opacity-60"
              style={{
                backgroundColor: "#fca5a5",
                color: "#0a0a0a",
              }}
            >
              UPHOLD
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="mt-2 text-xs" style={{ color: "#fca5a5" }} role="alert">
          {error}
        </p>
      )}
    </li>
  );
}

// ── Shared UI bits ──────────────────────────────────────────────────────────

function SectionHeader({
  label,
  count,
  description,
}: {
  label: string;
  count: number;
  description: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between gap-4">
        <h2
          className="font-[family-name:var(--font-bebas)] tracking-wide"
          style={{ fontSize: "28px", color: "#f4f4f5" }}
        >
          {label}
        </h2>
        <span
          className="font-[family-name:var(--font-bebas)] tracking-widest"
          style={{ color: "#e8b86a", fontSize: "14px" }}
        >
          {count}
        </span>
      </div>
      <p style={{ color: "#71717a", fontSize: "13px" }}>{description}</p>
    </div>
  );
}

function LoadingStrip() {
  return (
    <div
      className="rounded-xl h-20 animate-pulse"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
      aria-hidden="true"
    />
  );
}

function EmptyStrip({ text }: { text: string }) {
  return (
    <div
      className="rounded-xl p-5 text-center"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <p style={{ color: "#71717a", fontSize: "13px" }}>{text}</p>
    </div>
  );
}
