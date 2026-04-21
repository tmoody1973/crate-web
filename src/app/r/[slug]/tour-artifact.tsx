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

import Link from "next/link";
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
            />
          </li>
        ))}
      </ol>
    </div>
  );
}

// ── Action bar: share + refine ──────────────────────────────────────────────

function ActionBar({ tour }: { tour: Tour }) {
  const recordShare = useMutation(api.recommend.mutations.recordShare);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

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
  );
}

// ── Artist stop with signal buttons ──────────────────────────────────────────

function ArtistStop({
  tourId,
  artist,
  currentSignal,
  isSignedIn,
}: {
  tourId: Id<"artifactsRecommend">;
  artist: ArtistEntry;
  currentSignal: Signal | null;
  isSignedIn: boolean;
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
        <Link
          href={`https://www.youtube.com/results?search_query=${encodeURIComponent(artist.name + (artist.album ? " " + artist.album : ""))}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto font-[family-name:var(--font-bebas)] text-xs tracking-widest transition-colors hover:text-[#e8b86a]"
          style={{ color: "#71717a" }}
        >
          LISTEN ↗
        </Link>
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
