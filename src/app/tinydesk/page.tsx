import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { CatalogClient } from "@/components/tinydesk/catalog-client";
import type { CatalogConcert } from "@/components/tinydesk/catalog-types";
import catalogData from "../../../public/tinydesk/catalog.json";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

// Re-fetch companion data on every request so new saves appear immediately
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Tiny Desk DNA — Musical Influence Mapped | Crate",
  description:
    "Explore the musical DNA behind NPR Tiny Desk concerts. Cited influence chains, pull quotes, sonic analysis for 626 artists.",
  openGraph: {
    title: "Tiny Desk DNA — 626 Artists, Every Influence Traced",
    description:
      "Explore the musical DNA behind NPR Tiny Desk concerts. Cited influence chains, pull quotes, sonic analysis for 626 artists.",
    type: "website",
    url: "https://digcrate.app/tinydesk",
  },
};

interface CompanionInfo {
  slug: string;
  artist: string;
  genre?: string[];
  tinyDeskVideoId: string;
  isCommunitySubmitted?: boolean;
}

async function getCompanions(): Promise<CompanionInfo[]> {
  try {
    return await convex.query(api.tinydeskCompanions.listSlugs, {});
  } catch {
    return [];
  }
}

// Hero data for the featured companion (Beth Gibbons)
const HERO_ARTIST = "Beth Gibbons";
const HERO_SLUG = "beth-gibbons";
const HERO_VIDEO_ID = "G_-DftINZKg";
const HERO_CONNECTIONS = [
  { name: "Portishead", context: "Co-founding vocalist of the trip-hop movement", source: "Pitchfork" },
  { name: "Billie Holiday", context: "'Billie Holiday fronting Siouxsie and the Banshees'", source: "Variety" },
  { name: "Nick Drake", context: "Bare, confessional songwriting lineage", source: "The Guardian" },
];
const HERO_TAGS = ["trip-hop", "torch-song", "noir production", "emotional intensity"];

export default async function TinyDeskDNAPage() {
  const companions = await getCompanions();
  const companionSlugs = companions.map((c) => c.slug);

  // Merge: static catalog + community-submitted companions not in the JSON
  const staticConcerts = catalogData as CatalogConcert[];
  const staticSlugs = new Set(staticConcerts.map((c) => c.slug));
  const communityConcerts: CatalogConcert[] = companions
    .filter((c) => !staticSlugs.has(c.slug))
    .map((c) => ({
      artist: c.artist,
      slug: c.slug,
      date: "",
      year: 0,
      genre: c.genre ?? [],
      concertType: c.isCommunitySubmitted ? "Community" : "Tiny Desk Concert",
      sourceUrl: "",
      youtubeId: c.tinyDeskVideoId || null,
    }));
  const concerts = [...staticConcerts, ...communityConcerts];

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen`}
      style={{ backgroundColor: "#09090b", color: "#f4f4f5" }}
    >
      {/* Header */}
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/tinydeskdna.svg"
            alt="Tiny Desk DNA"
            style={{ height: "70px", width: "auto" }}
          />
        </div>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          TRY CRATE FREE
        </Link>
      </header>

      {/* Hero — Before/After Split */}
      <section className="mx-auto max-w-6xl px-6 py-10 md:py-16">
        {/* Label + subheading (NOT the dominant element) */}
        <div className="text-center mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/tinydeskdna.svg"
            alt="Tiny Desk DNA"
            className="mx-auto mb-4"
            style={{ height: "300px", width: "auto" }}
          />
          <h1 className="sr-only">Tiny Desk DNA</h1>
          <p style={{ color: "#a1a1aa", fontSize: "16px" }}>
            Every Tiny Desk has a story NPR doesn&apos;t tell. We traced it.
          </p>
        </div>

        {/* Split screen — the dominant element */}
        <div
          className="grid gap-6 md:grid-cols-2"
          aria-label="Before and after comparison"
        >
          {/* RIGHT side first on mobile (cards = the product) */}
          <div className="order-1 md:order-2">
            <h3
              className="font-[family-name:var(--font-bebas)] tracking-widest mb-4"
              style={{ color: "#f4f4f5", fontSize: "13px" }}
            >
              WHAT CRATE REVEALS
            </h3>

            {/* Connection preview cards */}
            <div className="space-y-2.5">
              {HERO_CONNECTIONS.map((conn) => (
                <div
                  key={conn.name}
                  className="rounded-lg px-4 py-3"
                  style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-white">{conn.name}</p>
                      <p style={{ color: "#a1a1aa", fontSize: "13px" }}>{conn.context}</p>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2 py-0.5"
                      style={{ backgroundColor: "#27272a", color: "#a1a1aa", fontSize: "10px" }}
                    >
                      {conn.source}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Sonic DNA tags */}
            <div className="flex flex-wrap gap-1.5 mt-4">
              {HERO_TAGS.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: "#083344", color: "#22d3ee", fontSize: "10px" }}
                >
                  {tag}
                </span>
              ))}
            </div>

            {/* CTA to full companion page */}
            <Link
              href={`/tinydesk/${HERO_SLUG}`}
              className="inline-block mt-5 min-h-[44px] flex items-center transition-colors hover:text-cyan-300"
              style={{ color: "#22d3ee", fontSize: "13px" }}
            >
              See full influence chain for {HERO_ARTIST} →
            </Link>
          </div>

          {/* LEFT side — YouTube thumbnail */}
          <div className="order-2 md:order-1">
            <h3
              className="font-[family-name:var(--font-bebas)] tracking-widest mb-4"
              style={{ color: "#52525b", fontSize: "13px" }}
            >
              WHAT YOU SEE
            </h3>

            <a
              href={`https://www.youtube.com/watch?v=${HERO_VIDEO_ID}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block relative rounded-xl overflow-hidden group"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://img.youtube.com/vi/${HERO_VIDEO_ID}/maxresdefault.jpg`}
                alt={`${HERO_ARTIST} — NPR Tiny Desk Concert`}
                className="w-full aspect-video object-cover transition-transform duration-300 group-hover:scale-105"
              />
              {/* Play button overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center transition-transform group-hover:scale-110"
                  style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </div>
              </div>
            </a>

            <p className="mt-3" style={{ color: "#52525b", fontSize: "12px" }}>
              {HERO_ARTIST} plays 3 songs at NPR&apos;s Tiny Desk.
            </p>
          </div>
        </div>

        {/* Anchor CTA */}
        <div className="text-center mt-10">
          <a
            href="#catalog"
            className="font-[family-name:var(--font-bebas)] tracking-widest text-sm transition-colors hover:text-cyan-300"
            style={{ color: "#71717a" }}
          >
            EXPLORE 626 ARTISTS ↓
          </a>
        </div>
      </section>

      {/* How It Works */}
      <section className="mx-auto max-w-5xl px-6 pb-12">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { num: "1", label: "Browse", desc: "Pick an artist from 626 Tiny Desk performances" },
            { num: "2", label: "Trace", desc: "Crate cross-references music journalism, databases, and interviews to find real influence connections" },
            { num: "3", label: "Discover", desc: "See the musical DNA: pull quotes, sonic elements, cited journalism" },
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

      {/* DNA-Ready Artists */}
      {companionSlugs.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-12">
          <h2
            className="font-[family-name:var(--font-bebas)] tracking-wide mb-4"
            style={{ color: "#f4f4f5", fontSize: "22px" }}
          >
            DNA Mapped
          </h2>
          <p className="mb-5" style={{ color: "#71717a", fontSize: "13px" }}>
            These artists have their influence chains traced. Explore their musical DNA.
          </p>
          <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: "none" }}>
            {companions.map((c) => (
              <Link
                key={c.slug}
                href={`/tinydesk/${c.slug}`}
                className="shrink-0 w-[280px] rounded-xl overflow-hidden group transition-all hover:-translate-y-1"
                style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
              >
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  {c.tinyDeskVideoId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://img.youtube.com/vi/${c.tinyDeskVideoId}/mqdefault.jpg`}
                      alt={c.artist}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-800" />
                  )}
                  <span
                    className="absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide"
                    style={{ backgroundColor: "#22c55e", color: "#09090b" }}
                  >
                    EXPLORE DNA
                  </span>
                </div>
                <div className="p-3">
                  <p
                    className="font-[family-name:var(--font-bebas)] tracking-wide group-hover:text-cyan-400 transition-colors"
                    style={{ color: "#f4f4f5", fontSize: "20px" }}
                  >
                    {c.artist}
                  </p>
                  {c.genre && c.genre.length > 0 && (
                    <div className="flex gap-1 mt-1">
                      {c.genre.map((g) => (
                        <span
                          key={g}
                          className="text-[9px]"
                          style={{ color: "#71717a" }}
                        >
                          {g}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Full Catalog Grid */}
      <section id="catalog" className="mx-auto max-w-6xl px-6 pb-20">
        <h2
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-6"
          style={{ color: "#f4f4f5", fontSize: "28px" }}
        >
          Browse All 626 Artists
        </h2>
        <CatalogClient
          concerts={concerts}
          companionSlugs={companionSlugs}
        />
      </section>

      {/* Bottom CTA */}
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
          Crate traces influence chains across music journalism, interviews, and databases. Pick any artist. Get their full musical DNA in seconds.
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
