/**
 * /i — Influence Receipts landing page.
 * Matches the visual quality of /tinydesk: hero, cards, catalog, CTAs.
 */

import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { ReceiptSearch } from "./receipt-search";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Influence Receipts — Discover Musical DNA | Crate",
  description:
    "Type any artist. See who shaped their sound, who they influenced, and why. The liner notes layer for the streaming era.",
  openGraph: {
    title: "Influence Receipts — Discover Musical DNA | Crate",
    description:
      "Type any artist. See who shaped their sound, who they influenced, and why.",
    url: "https://digcrate.app/i",
    siteName: "Crate",
    images: [
      {
        url: "/crate_web_social.jpg",
        width: 1200,
        height: 625,
        alt: "Crate Influence Receipts",
      },
    ],
    type: "website",
  },
};

const RELATIONSHIP_COLORS: Record<string, string> = {
  "influenced by": "#4ade80",
  "inspired by": "#4ade80",
  influenced: "#22d3ee",
  shaped: "#22d3ee",
  mentored: "#22d3ee",
  collaboration: "#facc15",
  sample: "#facc15",
  similar: "#a78bfa",
};

function getRelColor(rel: string): string {
  return RELATIONSHIP_COLORS[rel?.toLowerCase().trim()] ?? "#a78bfa";
}

interface CachedReceipt {
  slug: string;
  artist: string;
  tier: string;
  generatedAt: number;
  topInfluences: Array<{ name: string; relationship: string }>;
}

export default async function InfluenceReceiptsPage() {
  let receipts: CachedReceipt[] = [];

  try {
    receipts = await convex.query(api.receipt.listCached, {});
  } catch {
    // Empty state
  }

  const sorted = [...receipts].sort((a, b) =>
    a.artist.localeCompare(b.artist),
  );

  // Pick a hero (first receipt with full tier and 3+ influences)
  const hero = sorted.find(
    (r) => r.tier === "full" && r.topInfluences.length >= 3,
  );

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen`}
      style={{ backgroundColor: "#09090b", color: "#f4f4f5" }}
    >
      {/* ── Header ──────────────────────────────────────────────────────── */}
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
          <span style={{ color: "#3f3f46", fontSize: "24px", fontWeight: 300 }}>×</span>
          <span
            className="font-[family-name:var(--font-bebas)] tracking-widest"
            style={{ color: "#f4f4f5", fontSize: "20px" }}
          >
            INFLUENCE RECEIPTS
          </span>
        </div>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          TRY CRATE FREE
        </Link>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        <div className="text-center mb-8">
          <h1
            className="font-[family-name:var(--font-bebas)] tracking-wide leading-none mb-4"
            style={{ fontSize: "clamp(48px, 8vw, 80px)" }}
          >
            Every Record Has a Story
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "18px", maxWidth: "520px", margin: "0 auto" }}>
            Type any artist. See who shaped their sound, who they influenced, and why.
            The liner notes layer for the streaming era.
          </p>
        </div>

        {/* Search — prominent */}
        <div className="max-w-xl mx-auto mb-12">
          <ReceiptSearch />
        </div>

        {/* Hero receipt preview (if we have one) */}
        {hero && (
          <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
            {/* Left: What Crate Reveals */}
            <div>
              <h3
                className="font-[family-name:var(--font-bebas)] tracking-widest mb-4"
                style={{ color: "#f4f4f5", fontSize: "13px" }}
              >
                WHAT CRATE REVEALS
              </h3>
              <div className="space-y-2.5">
                {hero.topInfluences.map((inf) => (
                  <div
                    key={inf.name}
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: getRelColor(inf.relationship) }}
                      />
                      <p className="text-sm font-bold text-white">{inf.name}</p>
                      <span
                        className="ml-auto shrink-0 rounded-full px-2 py-0.5"
                        style={{
                          backgroundColor: "#27272a",
                          color: getRelColor(inf.relationship),
                          fontSize: "10px",
                        }}
                      >
                        {inf.relationship}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <Link
                href={`/i/${hero.slug}`}
                className="inline-block mt-5 min-h-[44px] flex items-center transition-colors hover:text-cyan-300"
                style={{ color: "#22d3ee", fontSize: "13px" }}
              >
                See full influence chain for {hero.artist} →
              </Link>
            </div>

            {/* Right: The concept */}
            <div
              className="rounded-xl p-6"
              style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
            >
              <p
                className="font-[family-name:var(--font-bebas)] tracking-wide mb-2"
                style={{ fontSize: "28px" }}
              >
                {hero.artist}
              </p>
              <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.7" }}>
                Every artist stands on the shoulders of others. Crate traces the influence
                chain — who shaped their sound, who they inspired, and the connections
                music journalism has documented across decades.
              </p>
              <p
                className="mt-4"
                style={{ color: "#71717a", fontSize: "12px" }}
              >
                Sources: Wikipedia, Genius, AllMusic, Pitchfork, Rolling Stone, and more
              </p>
            </div>
          </div>
        )}

        {/* Anchor CTA */}
        {sorted.length > 0 && (
          <div className="text-center mt-10">
            <a
              href="#catalog"
              className="font-[family-name:var(--font-bebas)] tracking-widest text-sm transition-colors hover:text-cyan-300"
              style={{ color: "#71717a" }}
            >
              BROWSE {sorted.length} RECEIPTS ↓
            </a>
          </div>
        )}
      </section>

      {/* ── How It Works ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              num: "1",
              label: "Search",
              desc: "Type any artist name. From Kendrick Lamar to Billie Holiday to Aphex Twin.",
            },
            {
              num: "2",
              label: "Trace",
              desc: "Crate cross-references music journalism, databases, and interviews to map real influence connections.",
            },
            {
              num: "3",
              label: "Share",
              desc: "Get a shareable influence receipt with cited sources. Post it, text it, debate it.",
            },
          ].map((step) => (
            <div
              key={step.num}
              className="rounded-lg p-6"
              style={{ backgroundColor: "#18181b", border: "1px solid #1e1e1e" }}
            >
              <span
                className="font-[family-name:var(--font-bebas)] block mb-2"
                style={{ color: "#22d3ee", fontSize: "32px" }}
              >
                {step.num}
              </span>
              <p className="text-sm font-bold text-white mb-1">{step.label}</p>
              <p style={{ color: "#a1a1aa", fontSize: "13px" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── What is Crate ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-4xl px-6 pb-12">
        <div
          className="rounded-xl p-6 md:p-8 text-center"
          style={{ backgroundColor: "#0A1628", border: "1px solid #1d2d44" }}
        >
          <div className="flex items-center justify-center gap-3 mb-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/crate-logo_Light.svg"
              alt="Crate"
              style={{ height: "28px", width: "auto" }}
            />
          </div>
          <p style={{ color: "#a1a1aa", fontSize: "15px", lineHeight: "1.7" }}>
            Crate is an AI music research agent. It traces influence chains, finds sample origins,
            and maps musical DNA across 20+ sources — interviews, liner notes, music journalism,
            and databases. Influence Receipts are what happens when you point it at any artist
            and ask: who shaped their sound?
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm transition-colors hover:text-cyan-300"
            style={{ color: "#22d3ee" }}
          >
            Learn more about Crate →
          </Link>
        </div>
      </section>

      {/* ── Receipt Catalog ─────────────────────────────────────────────── */}
      {sorted.length > 0 && (
        <section id="catalog" className="mx-auto max-w-6xl px-6 pb-20">
          <h2
            className="font-[family-name:var(--font-bebas)] tracking-wide mb-2"
            style={{ color: "#f4f4f5", fontSize: "28px" }}
          >
            Browse All Receipts
          </h2>
          <p className="mb-6" style={{ color: "#71717a", fontSize: "13px" }}>
            {sorted.length} artists with influence chains traced and cited.
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sorted.map((r) => (
              <Link
                key={r.slug}
                href={`/i/${r.slug}`}
                className="group rounded-xl overflow-hidden transition-all hover:-translate-y-0.5"
                style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
              >
                <div className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p
                      className="font-[family-name:var(--font-bebas)] tracking-wide group-hover:text-cyan-400 transition-colors truncate"
                      style={{ color: "#f4f4f5", fontSize: "22px" }}
                    >
                      {r.artist}
                    </p>
                    {r.tier === "full" && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide"
                        style={{ backgroundColor: "#22c55e20", color: "#4ade80" }}
                      >
                        FULL
                      </span>
                    )}
                  </div>

                  {/* Influence preview */}
                  {r.topInfluences.length > 0 && (
                    <div className="space-y-1.5">
                      {r.topInfluences.map((inf) => (
                        <div key={inf.name} className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: getRelColor(inf.relationship) }}
                          />
                          <span style={{ color: "#a1a1aa", fontSize: "12px" }}>
                            {inf.name}
                          </span>
                          <span
                            className="ml-auto"
                            style={{ color: "#52525b", fontSize: "10px" }}
                          >
                            {inf.relationship}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {sorted.length === 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-20 text-center">
          <p style={{ color: "#52525b", fontSize: "14px" }}>
            No receipts generated yet. Search for an artist above to create the first one.
          </p>
        </section>
      )}

      {/* ── Bottom CTA ──────────────────────────────────────────────────── */}
      <section
        className="border-t py-16 text-center"
        style={{ borderColor: "#27272a", backgroundColor: "#0A1628" }}
      >
        <h2
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-4"
          style={{ color: "#f4f4f5", fontSize: "36px" }}
        >
          Want to Map Any Artist&apos;s DNA?
        </h2>
        <p
          className="mx-auto mb-8 max-w-lg"
          style={{ color: "#71717a", fontSize: "16px" }}
        >
          Crate traces influence chains across music journalism, interviews, and databases.
          Pick any artist. Get their full musical DNA in seconds.
        </p>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] inline-block rounded-lg px-10 py-4 text-lg tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          TRY CRATE FREE
        </Link>
      </section>
    </main>
  );
}
