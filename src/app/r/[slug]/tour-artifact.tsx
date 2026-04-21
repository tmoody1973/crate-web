"use client";

/**
 * TourArtifact — the interactive body of a /r/[slug] page.
 *
 * Wraps the arc of artist stops with per-artist keep/pass/save buttons.
 * Signals are scoped to the authenticated user; anonymous visitors see
 * neutral buttons that prompt sign-in on click.
 *
 * Optimistic updates: the button flips state immediately, the mutation
 * runs in the background, and `getMySignalsForTour` (a Convex useQuery
 * subscription) reconciles when the server confirms. On error we roll back
 * and surface a small inline message.
 */

import { useCallback, useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";

type Signal = "keep" | "pass" | "save";
type Tour = Doc<"artifactsRecommend">;
type ArtistEntry = Tour["artists"][number];

interface TourArtifactProps {
  tour: Tour;
}

export function TourArtifact({ tour }: TourArtifactProps) {
  const { isSignedIn } = useAuth();
  const signalMap =
    useQuery(api.recommend.mutations.getMySignalsForTour, {
      tourId: tour._id,
    }) ?? null;

  const artists = useMemo(
    () => [...tour.artists].sort((a, b) => a.arcPosition - b.arcPosition),
    [tour.artists],
  );

  // Single-player policy: only one YouTube iframe mounted at a time to
  // keep the page from turning into a browser-tab-hog. Lifted to parent
  // so stops can know when they've lost focus.
  const [activePosition, setActivePosition] = useState<number | null>(null);

  return (
    <div>
      <ActionBar tour={tour} />

      <ol className="space-y-4">
        {artists.map((a) => (
          <li key={`${tour._id}-${a.arcPosition}`}>
            <ArtistStop
              tourId={tour._id}
              artist={a}
              currentSignal={signalMap?.[a.arcPosition] ?? null}
              isSignedIn={!!isSignedIn}
              isPlaying={activePosition === a.arcPosition}
              onTogglePlay={(playing) =>
                setActivePosition(playing ? a.arcPosition : null)
              }
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Action bar: share + report ──────────────────────────────────────────────

function ActionBar({ tour }: { tour: Tour }) {
  const recordShare = useMutation(api.recommend.mutations.recordShare);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [reportOpen, setReportOpen] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `https://digcrate.app/r/${tour.slug}`;
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    try {
      if (nav.share) {
        await nav.share({
          title: tour.promptRedacted || "A listening tour",
          text: "Check out this Crate tour",
          url,
        });
      } else if (nav.clipboard?.writeText) {
        await nav.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 1800);
      }
      recordShare({ tourId: tour._id }).catch(() => {
        // Best-effort counter; never block the UI.
      });
    } catch {
      // User cancelled the share sheet, or permission denied. No-op.
    }
  }, [tour.slug, tour.promptRedacted, tour._id, recordShare]);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest"
          style={{ color: "#71717a", fontSize: "12px" }}
        >
          {tour.artists.length}-STOP TOUR
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-colors hover:text-[#fca5a5]"
            style={{
              backgroundColor: "transparent",
              border: "1px solid #27272a",
              color: "#a1a1aa",
            }}
            aria-label="Report this tour"
          >
            REPORT
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-colors"
            style={{
              backgroundColor: shareState === "copied" ? "#e8b86a" : "transparent",
              border: "1px solid #e8b86a",
              color: shareState === "copied" ? "#0a0a0a" : "#e8b86a",
            }}
            aria-label="Share this tour"
          >
            {shareState === "copied" ? "LINK COPIED" : "SHARE"}
          </button>
        </div>
      </div>
      {reportOpen && (
        <ReportDialog
          tourId={tour._id}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}

function ReportDialog({
  tourId,
  onClose,
}: {
  tourId: Id<"artifactsRecommend">;
  onClose: () => void;
}) {
  const { isSignedIn } = useAuth();
  const reportTour = useMutation(api.recommend.mutations.reportTour);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "submitted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      setError("Tell us what's wrong in a sentence or two.");
      return;
    }
    setError(null);
    start(async () => {
      try {
        await reportTour({ tourId, reason: trimmed });
        setState("submitted");
      } catch (e) {
        setState("error");
        setError(e instanceof Error ? e.message : "Couldn't submit report");
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.7)" }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
      >
        <h2
          id="report-title"
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-3"
          style={{ fontSize: "24px", color: "#f4f4f5" }}
        >
          Report this tour
        </h2>
        {!isSignedIn ? (
          <>
            <p
              className="mb-4"
              style={{ color: "#a1a1aa", fontSize: "14px" }}
            >
              Sign in to submit a report. We cap reports at 5 per day to
              keep the queue useful.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-2 text-xs tracking-widest"
              style={{
                border: "1px solid #27272a",
                color: "#d4d4d8",
                backgroundColor: "transparent",
              }}
            >
              CLOSE
            </button>
          </>
        ) : state === "submitted" ? (
          <>
            <p
              className="mb-4"
              style={{ color: "#d4d4d8", fontSize: "14px" }}
            >
              Thanks — a human will review this soon.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-2 text-xs tracking-widest"
              style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
            >
              DONE
            </button>
          </>
        ) : (
          <>
            <p
              className="mb-3"
              style={{ color: "#a1a1aa", fontSize: "13px" }}
            >
              What&apos;s wrong with it? Be specific — unverified quotes,
              wrong artists, anything the tour shouldn&apos;t be publishing.
            </p>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, 500))}
              rows={4}
              placeholder="e.g. the Pitchfork quote doesn't appear on that page"
              className="w-full resize-none rounded-md bg-transparent p-3 text-sm text-white placeholder:text-white/30 focus:outline-none"
              style={{
                border: "1px solid #27272a",
                fontSize: "14px",
                lineHeight: "1.5",
              }}
              aria-label="Report reason"
            />
            <div className="mt-1 flex items-center justify-between">
              <span style={{ color: "#52525b", fontSize: "11px" }}>
                {reason.length}/500
              </span>
              {error && (
                <span style={{ color: "#fca5a5", fontSize: "11px" }} role="alert">
                  {error}
                </span>
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-2 text-xs tracking-widest"
                style={{
                  border: "1px solid #27272a",
                  color: "#d4d4d8",
                  backgroundColor: "transparent",
                }}
              >
                CANCEL
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={pending}
                className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-2 text-xs tracking-widest disabled:opacity-60"
                style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
              >
                {pending ? "SENDING…" : "SUBMIT"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Artist stop with signal buttons ──────────────────────────────────────────

function ArtistStop({
  tourId,
  artist,
  currentSignal,
  isSignedIn,
  isPlaying,
  onTogglePlay,
}: {
  tourId: Id<"artifactsRecommend">;
  artist: ArtistEntry;
  currentSignal: Signal | null;
  isSignedIn: boolean;
  isPlaying: boolean;
  onTogglePlay: (playing: boolean) => void;
}) {
  const recordSignal = useMutation(api.recommend.mutations.recordSignal);
  const clearSignal = useMutation(api.recommend.mutations.clearSignal);

  const [optimistic, setOptimistic] = useState<Signal | null | "__unset">(
    "__unset",
  );
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const effective: Signal | null =
    optimistic === "__unset" ? currentSignal : optimistic;

  const handleSignal = useCallback(
    (signal: Signal) => {
      if (!isSignedIn) return; // sign-in prompt handled at button level
      const willToggleOff = effective === signal;
      setError(null);
      setOptimistic(willToggleOff ? null : signal);
      startTransition(async () => {
        try {
          if (willToggleOff) {
            await clearSignal({
              tourId,
              artistPosition: artist.arcPosition,
            });
          } else {
            await recordSignal({
              tourId,
              artistPosition: artist.arcPosition,
              signal,
            });
          }
          setOptimistic("__unset"); // release to server state
        } catch (e) {
          setOptimistic("__unset");
          const msg =
            e instanceof Error
              ? e.message
              : "Couldn't save that. Try again.";
          setError(msg);
        }
      });
    },
    [
      effective,
      isSignedIn,
      clearSignal,
      recordSignal,
      tourId,
      artist.arcPosition,
    ],
  );

  return (
    <article
      className="rounded-xl p-5 md:p-6"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <div className="flex items-start gap-4">
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-bebas)] tracking-wide"
          style={{
            backgroundColor: "#0a0a0a",
            border: "1px solid #e8b86a",
            color: "#e8b86a",
            fontSize: "16px",
          }}
        >
          {artist.arcPosition + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p
            className="font-[family-name:var(--font-bebas)] tracking-wide leading-tight"
            style={{ color: "#f4f4f5", fontSize: "28px" }}
          >
            {artist.name}
          </p>
          {(artist.album || artist.year) && (
            <p
              className="italic"
              style={{
                color: "#a1a1aa",
                fontSize: "13px",
                fontFamily: "Georgia, serif",
                marginTop: "2px",
              }}
            >
              {artist.album}
              {artist.album && artist.year ? " · " : ""}
              {artist.year}
            </p>
          )}
        </div>
      </div>

      {artist.quote && (
        <blockquote
          className="mt-4 rounded-lg p-4"
          style={{
            backgroundColor: "#0a0a0a",
            borderLeft: "2px solid #e8b86a",
          }}
        >
          <p
            className="italic mb-2"
            style={{
              color: "#e4e4e7",
              fontSize: "15px",
              fontFamily: "Georgia, serif",
              lineHeight: "1.6",
            }}
          >
            &ldquo;{artist.quote.text}&rdquo;
          </p>
          <footer
            className="text-xs tracking-wide"
            style={{ color: "#71717a" }}
          >
            —{" "}
            {artist.quote.author ? `${artist.quote.author}, ` : ""}
            <a
              href={artist.quote.url}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="underline decoration-dotted underline-offset-2 transition-colors hover:text-[#e8b86a]"
              style={{ color: "#a1a1aa" }}
            >
              {artist.quote.publication}
            </a>
            {artist.quote.verified && (
              <span
                className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide"
                style={{
                  backgroundColor: "rgba(232,184,106,0.12)",
                  color: "#e8b86a",
                }}
                aria-label="Citation verified on source page"
              >
                VERIFIED
              </span>
            )}
          </footer>
        </blockquote>
      )}

      <div className="mt-4 flex items-center gap-2">
        {isSignedIn ? (
          <>
            <SignalButton
              label="KEEP"
              active={effective === "keep"}
              disabled={pending}
              onClick={() => handleSignal("keep")}
              tone="positive"
            />
            <SignalButton
              label="PASS"
              active={effective === "pass"}
              disabled={pending}
              onClick={() => handleSignal("pass")}
              tone="negative"
            />
            <SignalButton
              label="SAVE"
              active={effective === "save"}
              disabled={pending}
              onClick={() => handleSignal("save")}
              tone="neutral"
            />
          </>
        ) : (
          <SignInButton mode="modal">
            <button
              className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-1.5 text-xs tracking-widest transition-colors"
              style={{
                border: "1px solid #27272a",
                color: "#a1a1aa",
                backgroundColor: "transparent",
              }}
            >
              SIGN IN TO KEEP / PASS
            </button>
          </SignInButton>
        )}
        <button
          type="button"
          onClick={() => onTogglePlay(!isPlaying)}
          className="ml-auto font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest transition-colors"
          style={{
            border: "1px solid #e8b86a",
            color: isPlaying ? "#0a0a0a" : "#e8b86a",
            backgroundColor: isPlaying ? "#e8b86a" : "transparent",
          }}
          aria-pressed={isPlaying}
          aria-label={isPlaying ? "Close player" : `Play ${artist.name}`}
        >
          {isPlaying ? "CLOSE" : "▶ PLAY"}
        </button>
      </div>

      {isPlaying && <YouTubeEmbed artist={artist} />}

      {error && (
        <p
          className="mt-2 text-xs"
          style={{ color: "#fca5a5" }}
          role="alert"
        >
          {error}
        </p>
      )}
    </article>
  );
}

/**
 * Lazy-mounted YouTube embed. Prefers a specific track id (populated
 * during generation when the YouTube Data API is available) and falls
 * back to a search-based embed. Uses youtube-nocookie.com to avoid
 * third-party cookie prompts and lighten up the consent surface.
 */
function YouTubeEmbed({ artist }: { artist: ArtistEntry }) {
  const src = useMemo(() => {
    if (artist.youtubeTrackId) {
      return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(
        artist.youtubeTrackId,
      )}?autoplay=1&rel=0&modestbranding=1`;
    }
    const query = artist.album
      ? `${artist.name} ${artist.album}`
      : `${artist.name} full album`;
    return `https://www.youtube-nocookie.com/embed?listType=search&list=${encodeURIComponent(
      query,
    )}&autoplay=1&rel=0&modestbranding=1`;
  }, [artist.youtubeTrackId, artist.name, artist.album]);

  return (
    <div
      className="mt-4 overflow-hidden rounded-lg"
      style={{
        border: "1px solid #27272a",
        aspectRatio: "16 / 9",
        backgroundColor: "#0a0a0a",
      }}
    >
      <iframe
        src={src}
        title={`${artist.name} — YouTube`}
        className="h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
    </div>
  );
}

function SignalButton({
  label,
  active,
  disabled,
  onClick,
  tone,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  tone: "positive" | "negative" | "neutral";
}) {
  const activeStyles: Record<typeof tone, { bg: string; fg: string; border: string }> = {
    positive: { bg: "#e8b86a", fg: "#0a0a0a", border: "#e8b86a" },
    negative: { bg: "#27272a", fg: "#fca5a5", border: "#3f3f46" },
    neutral: { bg: "#0A1628", fg: "#e8b86a", border: "#1d2d44" },
  };
  const s = activeStyles[tone];
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-[family-name:var(--font-bebas)] rounded-md px-4 py-1.5 text-xs tracking-widest transition-colors disabled:opacity-60"
      style={{
        backgroundColor: active ? s.bg : "transparent",
        color: active ? s.fg : "#d4d4d8",
        border: `1px solid ${active ? s.border : "#27272a"}`,
      }}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}
