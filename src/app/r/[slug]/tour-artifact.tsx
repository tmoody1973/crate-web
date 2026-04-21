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

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { useMutation, useQuery } from "convex/react";
import { SignInButton, useAuth } from "@clerk/nextjs";
import posthog from "posthog-js";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { RECOMMEND_EVENTS } from "@/lib/recommend-analytics";
import { usePlayerSafe } from "@/components/player/player-provider";
import { sourceNameFromUrl } from "@/lib/receipt-types";

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

  // Route playback through the global Crate audio player so the whole tour
  // queues up, auto-advances when a track ends, and the PlayerBar at the
  // bottom of the page stays in sync. `usePlayerSafe()` tolerates pages
  // mounted without a PlayerProvider — it just returns null, and the PLAY
  // button falls back to a link-out. Our /r/[slug] page wraps in the
  // provider (see player-shell.tsx) so this is always set in practice.
  const player = usePlayerSafe();
  const playableArtists = useMemo(
    () => artists.filter((a) => !!a.youtubeTrackId),
    [artists],
  );

  const playFromPosition = useCallback(
    (startArcPosition: number) => {
      if (!player) return;
      const from = playableArtists.findIndex(
        (a) => a.arcPosition >= startArcPosition,
      );
      if (from === -1) return;
      const head = playableArtists[from];
      if (!head?.youtubeTrackId) return;

      player.play({
        source: "youtube",
        sourceId: head.youtubeTrackId,
        title: head.album ?? head.name,
        artist: head.name,
      });
      for (const a of playableArtists.slice(from + 1)) {
        if (!a.youtubeTrackId) continue;
        player.addToQueue({
          source: "youtube",
          sourceId: a.youtubeTrackId,
          title: a.album ?? a.name,
          artist: a.name,
        });
      }
      try {
        posthog.capture("recommend_tour_player_started", {
          slug: tour.slug,
          startArcPosition,
          queueLength: playableArtists.length - from,
        });
      } catch {
        // ignore
      }
    },
    [player, playableArtists, tour.slug],
  );

  // Fire a view event once per slug mount so we can count real engagement.
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      posthog.capture(RECOMMEND_EVENTS.tourViewed, {
        slug: tour.slug,
        intentType: tour.intentType,
        artistCount: tour.artists.length,
        verifiedCitationCount: tour.artists.filter((a) => a.quote?.verified)
          .length,
      });
    } catch {
      // telemetry hiccups never affect the user
    }
  }, [tour._id, tour.slug, tour.intentType, tour.artists]);

  return (
    <div>
      <ActionBar
        tour={tour}
        playableCount={playableArtists.length}
        onPlayTour={() => playFromPosition(0)}
      />

      <ol className="space-y-4">
        {artists.map((a) => (
          <li key={`${tour._id}-${a.arcPosition}`}>
            <ArtistStop
              tourId={tour._id}
              artist={a}
              currentSignal={signalMap?.[a.arcPosition] ?? null}
              isSignedIn={!!isSignedIn}
              onPlay={() => playFromPosition(a.arcPosition)}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Action bar: play, save, share, report ──────────────────────────────────

function ActionBar({
  tour,
  playableCount,
  onPlayTour,
}: {
  tour: Tour;
  playableCount: number;
  onPlayTour: () => void;
}) {
  const recordShare = useMutation(api.recommend.mutations.recordShare);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");
  const [reportOpen, setReportOpen] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `https://digcrate.app/r/${tour.slug}`;
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      share?: (data: ShareData) => Promise<void>;
    };
    let method: "native_share" | "clipboard" | "none" = "none";
    try {
      if (nav.share) {
        method = "native_share";
        await nav.share({
          title: tour.promptRedacted || "A listening tour",
          text: "Check out this Crate tour",
          url,
        });
      } else if (nav.clipboard?.writeText) {
        method = "clipboard";
        await nav.clipboard.writeText(url);
        setShareState("copied");
        setTimeout(() => setShareState("idle"), 1800);
      }
      recordShare({ tourId: tour._id }).catch(() => {
        // Best-effort counter; never block the UI.
      });
      try {
        posthog.capture(RECOMMEND_EVENTS.tourShared, {
          slug: tour.slug,
          method,
        });
      } catch {
        // ignore
      }
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
        <div className="flex flex-wrap gap-2">
          {playableCount > 0 && (
            <button
              type="button"
              onClick={onPlayTour}
              className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-opacity hover:opacity-90"
              style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
              aria-label={`Play all ${playableCount} tracks`}
            >
              ▶ PLAY TOUR
            </button>
          )}
          <SaveAsPlaylistButton tour={tour} />
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
        try {
          posthog.capture(RECOMMEND_EVENTS.tourReported, {
            tourId,
            reasonLength: trimmed.length,
          });
        } catch {
          // ignore
        }
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

// ── Save-as-playlist button + dialog ────────────────────────────────────────

function SaveAsPlaylistButton({ tour }: { tour: Tour }) {
  const { isSignedIn } = useAuth();
  const saveTour = useMutation(api.recommend.mutations.saveTourAsPlaylist);
  const [pending, start] = useTransition();
  const [state, setState] = useState<
    | { kind: "idle" }
    | { kind: "saved"; playlistId: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  const playableCount = useMemo(
    () => tour.artists.filter((a) => !!a.youtubeTrackId).length,
    [tour.artists],
  );
  if (playableCount === 0) return null;

  if (!isSignedIn) {
    return (
      <SignInButton mode="modal">
        <button
          type="button"
          className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-colors hover:text-[#e8b86a]"
          style={{
            backgroundColor: "transparent",
            border: "1px solid #27272a",
            color: "#a1a1aa",
          }}
          aria-label="Sign in to save this tour as a Crate playlist"
        >
          SAVE AS PLAYLIST
        </button>
      </SignInButton>
    );
  }

  if (state.kind === "saved") {
    return (
      <a
        href="/w"
        className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
      >
        SAVED · OPEN ↗
      </a>
    );
  }

  const handleClick = () => {
    setState({ kind: "idle" });
    start(async () => {
      try {
        const res = await saveTour({ tourId: tour._id });
        setState({ kind: "saved", playlistId: res.playlistId });
        try {
          posthog.capture("recommend_tour_saved_as_playlist", {
            slug: tour.slug,
            trackCount: res.trackCount,
          });
        } catch {
          // ignore
        }
      } catch (e) {
        setState({
          kind: "error",
          message: e instanceof Error ? e.message : "Save failed",
        });
      }
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="font-[family-name:var(--font-bebas)] rounded-lg px-4 py-2 text-xs tracking-widest transition-colors disabled:opacity-60"
        style={{
          backgroundColor: "transparent",
          border: "1px solid #e8b86a",
          color: "#e8b86a",
        }}
        aria-label="Save this tour as a Crate playlist"
      >
        {pending ? "SAVING…" : `SAVE · ${playableCount}`}
      </button>
      {state.kind === "error" && (
        <span
          className="text-xs"
          style={{ color: "#fca5a5" }}
          role="alert"
        >
          {state.message}
        </span>
      )}
    </>
  );
}

// ── Artist stop with signal buttons ──────────────────────────────────────────

function ArtistStop({
  tourId,
  artist,
  currentSignal,
  isSignedIn,
  onPlay,
}: {
  tourId: Id<"artifactsRecommend">;
  artist: ArtistEntry;
  currentSignal: Signal | null;
  isSignedIn: boolean;
  onPlay: () => void;
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
          try {
            posthog.capture(RECOMMEND_EVENTS.signalRecorded, {
              signal: willToggleOff ? "cleared" : signal,
              artistPosition: artist.arcPosition,
              tourId,
            });
          } catch {
            // ignore
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
            className="italic"
            style={{
              color: "#e4e4e7",
              fontSize: "15px",
              fontFamily: "Georgia, serif",
              lineHeight: "1.6",
            }}
          >
            &ldquo;{artist.quote.text}&rdquo;
          </p>
          {artist.quote.url && (
            <div className="mt-2">
              <a
                href={artist.quote.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-xs tracking-wide transition-colors hover:text-[#e8b86a]"
                style={{ color: "#a1a1aa" }}
              >
                {sourceNameFromUrl(artist.quote.url)} ↗
              </a>
            </div>
          )}
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
        {artist.youtubeTrackId ? (
          <button
            type="button"
            onClick={onPlay}
            className="ml-auto font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest transition-opacity hover:opacity-90"
            style={{
              border: "1px solid #e8b86a",
              color: "#e8b86a",
              backgroundColor: "transparent",
            }}
            aria-label={`Play ${artist.name} and the rest of the tour`}
          >
            ▶ PLAY
          </button>
        ) : (
          <a
            href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
              artist.album ? `${artist.name} ${artist.album}` : `${artist.name} full album`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto font-[family-name:var(--font-bebas)] rounded-md px-3 py-1.5 text-xs tracking-widest transition-colors"
            style={{
              border: "1px solid #e8b86a",
              color: "#e8b86a",
              backgroundColor: "transparent",
            }}
            aria-label={`Search ${artist.name} on YouTube`}
          >
            LISTEN ↗
          </a>
        )}
      </div>

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
