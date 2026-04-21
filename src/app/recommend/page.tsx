/**
 * /recommend — The tour prompt entry page.
 *
 * Client component because it needs Clerk hooks, form state, and live
 * subscription to tourStatus as the Convex action streams phase updates.
 *
 * Flow:
 *   1. Unauthenticated → "Sign in to start a tour"
 *   2. Authenticated + idle → prompt form (single textarea + Generate)
 *   3. Submitting → inline loading panel, subscribes to tourStatus
 *   4. Terminal phase → router.push to /r/[slug] (or show vague clarify UI)
 */

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SignInButton, useAuth, useUser } from "@clerk/nextjs";
import { useMutation, useQuery } from "convex/react";
import posthog from "posthog-js";
import { api } from "../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import {
  useTourGeneration,
  useTourStatus,
} from "@/lib/recommend-hooks";
import { RECOMMEND_EVENTS } from "@/lib/recommend-analytics";

/**
 * Ensure the signed-in Clerk user has a corresponding row in the Convex
 * users table. The Clerk webhook handles this in steady state, but dev
 * instances without a webhook wired up and brand-new users on production
 * in the ~seconds between sign-up and the webhook firing would otherwise
 * hit "User not found" from the generate action.
 */
function useEnsureUserRow() {
  const { userId: clerkId } = useAuth();
  const { user: clerkUser } = useUser();
  const convexUser = useQuery(
    api.users.getByClerkId,
    clerkId ? { clerkId } : "skip",
  );
  const upsertUser = useMutation(api.users.upsert);

  useEffect(() => {
    if (!clerkId || !clerkUser || convexUser !== null) return;
    upsertUser({
      clerkId,
      email: clerkUser.primaryEmailAddress?.emailAddress ?? "",
      name: clerkUser.fullName ?? undefined,
    }).catch(() => {
      // Non-fatal; the server-side action will throw a clearer error if
      // the user still doesn't exist by the time they submit a prompt.
    });
  }, [clerkId, clerkUser, convexUser, upsertUser]);
}

export default function RecommendPage() {
  const { isLoaded, userId } = useAuth();
  useEnsureUserRow();

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen bg-[#0a0a0a] text-white`}
    >
      <RecommendHeader />
      <section className="mx-auto max-w-3xl px-6 pt-8 pb-12 md:pt-16">
        <Hero />
        {!isLoaded ? (
          <AuthSkeleton />
        ) : userId ? (
          <PromptPanel />
        ) : (
          <SignedOutCta />
        )}
      </section>
      <BelowFold />
    </main>
  );
}

function AuthSkeleton() {
  return (
    <div
      className="rounded-xl h-36 animate-pulse"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
      aria-hidden="true"
    />
  );
}

function RecommendHeader() {
  return (
    <header
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ backgroundColor: "#0A1628", borderBottom: "1px solid #1d2d44" }}
    >
      <div className="flex items-center gap-3">
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>
        <span style={{ color: "#3f3f46", fontSize: "24px", fontWeight: 300 }}>
          ×
        </span>
        <span
          className="font-[family-name:var(--font-bebas)] tracking-widest"
          style={{ color: "#e8b86a", fontSize: "20px" }}
        >
          RECOMMEND
        </span>
      </div>
      <Link
        href="/r"
        className="font-[family-name:var(--font-bebas)] tracking-widest text-sm transition-opacity hover:opacity-80"
        style={{ color: "#a1a1aa" }}
      >
        BROWSE TOURS →
      </Link>
    </header>
  );
}

function Hero() {
  return (
    <div className="text-center mb-8 md:mb-10">
      <p
        className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
        style={{ color: "#e8b86a", fontSize: "13px" }}
      >
        A LISTENING TOUR, NOT A PLAYLIST
      </p>
      <h1
        className="font-[family-name:var(--font-bebas)] tracking-wide leading-none mb-4"
        style={{ fontSize: "clamp(44px, 8vw, 72px)" }}
      >
        Tell us what you&apos;re after.
      </h1>
      <p
        className="mx-auto italic"
        style={{
          color: "#a1a1aa",
          fontSize: "18px",
          maxWidth: "540px",
          fontFamily: "Georgia, serif",
        }}
      >
        A mood. An era. Who you want to understand. The harder the ask, the
        better the tour.
      </p>
    </div>
  );
}

function SignedOutCta() {
  return (
    <div
      className="rounded-xl p-8 text-center"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <p className="mb-5" style={{ color: "#a1a1aa", fontSize: "15px" }}>
        Sign in to generate a tour. It&apos;s free during beta.
      </p>
      <SignInButton mode="modal">
        <button
          className="font-[family-name:var(--font-bebas)] rounded-lg px-8 py-3 text-base tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
        >
          SIGN IN TO START
        </button>
      </SignInButton>
    </div>
  );
}

const EXAMPLE_PROMPTS = [
  "Sad about climate change but I still want to dance",
  "Jazz that sounds like winter morning coffee",
  "New artists influenced by Arthur Russell",
  "Prep me for a 90s Detroit techno DJ set",
];

function PromptPanel() {
  const [prompt, setPrompt] = useState("");
  const { state, generate, reset } = useTourGeneration();
  const tourId = state.state === "submitted" ? state.tourId : null;
  const status = useTourStatus(tourId);
  const router = useRouter();

  // The slug returned by /api/recommend/generate is provisional — the
  // Convex action rewrites it later based on the first artist. Subscribe
  // to the tour row itself so we navigate to the final slug, not the stale
  // one the POST returned.
  const finalTour = useQuery(
    api.recommend.mutations.getMyTourById,
    tourId ? { tourId } : "skip",
  );

  useEffect(() => {
    if (state.state !== "submitted" || !status?.isComplete) return;
    if (status.phase === "done" || status.phase === "flagged") {
      const slug = finalTour?.slug ?? state.slug;
      router.push(`/r/${slug}`);
    }
  }, [state, status, router, finalTour?.slug]);

  if (state.state === "submitted") {
    return (
      <LoadingPanel
        phase={status?.phase ?? "classifying"}
        progress={status?.progress ?? 0.05}
        detail={status?.detail}
        onCancel={reset}
      />
    );
  }

  const submitting = state.state === "submitting";
  const error = state.state === "error" ? state.error : null;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const trimmed = prompt.trim();
        if (trimmed.length < 2 || submitting) return;
        try {
          posthog.capture(RECOMMEND_EVENTS.tourStartedAttempt, {
            promptLength: trimmed.length,
          });
        } catch {
          // ignore
        }
        generate(trimmed);
      }}
      className="space-y-4"
    >
      <div
        className="rounded-xl p-4 md:p-5"
        style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
      >
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 400))}
          placeholder="Describe the listening tour you want..."
          rows={3}
          disabled={submitting}
          aria-label="Describe your listening tour"
          className="w-full resize-none bg-transparent text-base text-white placeholder:text-white/30 focus:outline-none disabled:opacity-50"
          style={{ fontSize: "17px", lineHeight: "1.55" }}
          autoFocus
        />
        <div className="mt-3 flex items-center justify-between">
          <span style={{ color: "#52525b", fontSize: "12px" }}>
            {prompt.length}/400
          </span>
          <button
            type="submit"
            disabled={submitting || prompt.trim().length < 2}
            className="font-[family-name:var(--font-bebas)] rounded-lg px-6 py-2.5 text-sm tracking-widest transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
          >
            {submitting ? "STARTING…" : "GENERATE TOUR"}
          </button>
        </div>
      </div>

      {error && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{
            backgroundColor: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#fca5a5",
          }}
          role="alert"
        >
          {error}
        </div>
      )}

      <div className="pt-2">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
          style={{ color: "#71717a", fontSize: "11px" }}
        >
          TRY ONE OF THESE
        </p>
        <div className="flex flex-wrap gap-2">
          {EXAMPLE_PROMPTS.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => setPrompt(ex)}
              className="rounded-full px-3.5 py-1.5 text-xs italic transition-colors hover:bg-white/10"
              style={{
                border: "1px solid #27272a",
                color: "#d4d4d8",
                fontFamily: "Georgia, serif",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}

const PHASE_COPY: Record<string, string> = {
  classifying: "Reading what you're after",
  embedding: "Mapping your prompt to the space of music",
  cache_check: "Checking the library for near matches",
  perplexity: "Asking music writers who fits",
  verifying_citations: "Verifying the quotes are real",
  arc_ordering: "Sequencing the tour",
  moderation: "Final safety check",
  redaction: "Writing a shareable title",
  persisting: "Saving your tour",
  done: "Ready",
  done_vague: "We need a little more",
  failed: "Something went wrong",
  timed_out: "This one took too long",
  flagged: "Flagged for review",
};

function LoadingPanel({
  phase,
  progress,
  detail,
  onCancel,
}: {
  phase: string;
  progress: number;
  detail?: string;
  onCancel: () => void;
}) {
  const copy = PHASE_COPY[phase] ?? "Working";
  const pct = Math.max(5, Math.min(100, Math.round(progress * 100)));
  const isFailed =
    phase === "failed" || phase === "timed_out" || phase === "flagged";
  const isVague = phase === "done_vague";

  return (
    <div
      className="rounded-xl p-6 md:p-8"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <p
        className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
        style={{ color: "#e8b86a", fontSize: "12px" }}
      >
        {isFailed ? "STOPPED" : isVague ? "NEEDS REFINEMENT" : "BUILDING YOUR TOUR"}
      </p>
      <p
        className="mb-4 italic"
        style={{
          fontSize: "22px",
          fontFamily: "Georgia, serif",
          color: "#f4f4f5",
        }}
      >
        {copy}…
      </p>

      {!isFailed && !isVague && (
        <div
          className="h-1 w-full rounded-full overflow-hidden mb-4"
          style={{ backgroundColor: "#27272a" }}
          aria-label="Tour generation progress"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full transition-all duration-500 ease-out"
            style={{ width: `${pct}%`, backgroundColor: "#e8b86a" }}
          />
        </div>
      )}

      {detail && (
        <p style={{ color: "#a1a1aa", fontSize: "13px" }}>{detail}</p>
      )}

      {isFailed && (
        <div className="mt-5">
          <p className="mb-4" style={{ color: "#a1a1aa", fontSize: "14px" }}>
            Try a different prompt, or come back in a minute.
          </p>
          <button
            onClick={onCancel}
            className="font-[family-name:var(--font-bebas)] rounded-lg px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
          >
            TRY AGAIN
          </button>
        </div>
      )}

      {isVague && (
        <div className="mt-5">
          <p className="mb-4" style={{ color: "#a1a1aa", fontSize: "14px" }}>
            Your prompt was a little too open. Try adding a mood, era, artist,
            or what you want the tour to do.
          </p>
          <button
            onClick={onCancel}
            className="font-[family-name:var(--font-bebas)] rounded-lg px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
          >
            REFINE PROMPT
          </button>
        </div>
      )}
    </div>
  );
}

function BelowFold() {
  return (
    <section className="mx-auto max-w-3xl px-6 pb-20">
      <div
        className="rounded-xl p-6 md:p-8"
        style={{ backgroundColor: "#0A1628", border: "1px solid #1d2d44" }}
      >
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest mb-2"
          style={{ color: "#e8b86a", fontSize: "12px" }}
        >
          WHAT YOU GET
        </p>
        <p style={{ color: "#d4d4d8", fontSize: "15px", lineHeight: "1.7" }}>
          A 10-artist arc, sequenced to tell a story. Each stop has a cited
          quote from music journalism explaining why it belongs. Keep what
          lands. Refine what doesn&apos;t. Share the finished tour.
        </p>
      </div>
    </section>
  );
}
