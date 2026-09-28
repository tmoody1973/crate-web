/**
 * /r — Library of recent public tours.
 *
 * Server component. Fetches listRecentPublicTours and renders a grid of
 * tour cards. Zero-login — the whole library is shareable.
 */

import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Doc } from "../../../convex/_generated/dataModel";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";

export const revalidate = 60; // 1 minute — library is dynamic but doesn't need to be realtime

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const metadata = {
  title: "Listening Tours | Crate",
  description:
    "Browse 10-artist listening tours built by music writers and DJs. Each one a sequenced story with cited sources.",
  openGraph: {
    title: "Listening Tours | Crate",
    description:
      "10-artist tours, sequenced as a story, with citations you can check.",
    url: "https://digcrate.app/r",
    siteName: "Crate",
    type: "website",
  },
};

type Tour = Doc<"artifactsRecommend">;

export default async function LibraryPage() {
  let tours: Tour[] = [];
  try {
    tours = await convex.query(api.recommend.mutations.listRecentPublicTours, {
      limit: 30,
    });
  } catch {
    // empty state handled below
  }

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen bg-[#0a0a0a] text-white`}
    >
      <LibraryHeader />

      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="mb-10 text-center">
          <p
            className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
            style={{ color: "#e8b86a", fontSize: "13px" }}
          >
            LISTENING TOURS
          </p>
          <h1
            className="font-[family-name:var(--font-bebas)] tracking-wide leading-none mb-4"
            style={{ fontSize: "clamp(40px, 7vw, 64px)" }}
          >
            Someone already asked that.
          </h1>
          <p
            className="mx-auto italic"
            style={{
              color: "#a1a1aa",
              fontSize: "17px",
              maxWidth: "540px",
              fontFamily: "Georgia, serif",
            }}
          >
            Browse tours built for specific moods, eras, and shows. Each one
            sequenced as a story, each artist cited.
          </p>
        </div>

        {tours.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {tours.map((t) => (
              <TourCard key={t._id} tour={t} />
            ))}
          </div>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/recommend"
            className="font-[family-name:var(--font-bebas)] inline-block rounded-lg px-8 py-3 text-base tracking-widest transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
          >
            BUILD YOUR OWN TOUR
          </Link>
        </div>
      </section>
    </main>
  );
}

function LibraryHeader() {
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
          LIBRARY
        </span>
      </div>
      <Link
        href="/recommend"
        className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
        style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
      >
        NEW TOUR
      </Link>
    </header>
  );
}

function TourCard({ tour }: { tour: Tour }) {
  const topThree = tour.artists.slice(0, 3);
  const verifiedCount = tour.artists.filter(
    (a) => a.quote?.verified === true,
  ).length;

  return (
    <Link
      href={`/r/${tour.slug}`}
      className="group block rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <div className="p-5">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-1 truncate group-hover:text-[#e8b86a] transition-colors"
          style={{ color: "#f4f4f5", fontSize: "22px" }}
        >
          {tour.promptRedacted || "Untitled tour"}
        </p>
        <p
          className="mb-4 italic"
          style={{
            color: "#71717a",
            fontSize: "11px",
            fontFamily: "Georgia, serif",
          }}
        >
          {intentLabel(tour.intentType)} · {tour.artists.length} artists
          {verifiedCount > 0 ? ` · ${verifiedCount} cited` : ""}
        </p>

        {topThree.length > 0 && (
          <div className="space-y-1.5">
            {topThree.map((a) => (
              <div key={`${tour._id}-${a.arcPosition}`} className="flex items-center gap-2">
                <span
                  className="inline-flex w-5 h-5 items-center justify-center rounded-full shrink-0"
                  style={{
                    backgroundColor: "#27272a",
                    color: "#e8b86a",
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {a.arcPosition + 1}
                </span>
                <span
                  className="truncate"
                  style={{ color: "#d4d4d8", fontSize: "13px" }}
                >
                  {a.name}
                </span>
              </div>
            ))}
            {tour.artists.length > 3 && (
              <p
                className="pt-1"
                style={{ color: "#52525b", fontSize: "11px" }}
              >
                + {tour.artists.length - 3} more
              </p>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div
      className="rounded-xl p-10 text-center"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <p className="mb-2" style={{ color: "#d4d4d8", fontSize: "16px" }}>
        No public tours yet.
      </p>
      <p style={{ color: "#71717a", fontSize: "14px" }}>
        Be the first — head to{" "}
        <Link href="/recommend" style={{ color: "#e8b86a" }}>
          /recommend
        </Link>{" "}
        to build one.
      </p>
    </div>
  );
}

function intentLabel(intent: Tour["intentType"]): string {
  switch (intent) {
    case "mood_theme":
      return "Mood";
    case "era_genre":
      return "Era";
    case "artist_similar":
      return "Artist-similar";
    case "activity":
      return "Activity";
    case "emotional":
      return "Emotional";
    case "show_prep":
      return "Show prep";
    case "single_artist":
      return "Single artist";
    case "vague":
      return "Open";
    default:
      return "Tour";
  }
}
