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
  title: "Tiny Desk Catalog — 626 Concerts, One Musical Universe | Crate",
  description:
    "Browse 626 NPR Tiny Desk concerts (2021-2025). Filter by genre, explore timelines, and discover the musical DNA behind each performance.",
  openGraph: {
    title: "Tiny Desk Catalog — 626 Concerts | Crate",
    description:
      "Browse 626 NPR Tiny Desk concerts. Filter by genre, explore timelines, discover musical DNA.",
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

export default async function TinyDeskCatalogPage() {
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
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          TRY CRATE FREE
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-12 md:py-16 text-center">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
          style={{ color: "#22d3ee", fontSize: "14px" }}
        >
          POWERED BY CRATE
        </p>
        <h1
          className="font-[family-name:var(--font-bebas)] leading-none mb-4"
          style={{ color: "#f4f4f5", fontSize: "clamp(40px,7vw,80px)" }}
        >
          Tiny Desk Catalog
        </h1>
        <p
          className="mx-auto max-w-2xl mb-2"
          style={{ color: "#a1a1aa", fontSize: "18px", lineHeight: "1.6" }}
        >
          626 NPR Tiny Desk concerts from 2021–2025. Browse by genre, scroll the timeline, or let us surprise you.
        </p>
        <p style={{ color: "#52525b", fontSize: "14px" }}>
          {companionSlugs.length > 0 && (
            <>
              <span style={{ color: "#22c55e" }}>●</span>{" "}
              {companionSlugs.length} artist{companionSlugs.length !== 1 ? "s" : ""} with Musical DNA companion pages
            </>
          )}
        </p>
      </section>

      {/* What is this / What Crate does */}
      <section className="mx-auto max-w-4xl px-6 pb-12">
        <div
          className="rounded-xl p-6 md:p-8 grid md:grid-cols-2 gap-6"
          style={{ backgroundColor: "#0A1628", border: "1px solid #1d2d44" }}
        >
          <div>
            <h2
              className="font-[family-name:var(--font-bebas)] tracking-wide mb-3"
              style={{ color: "#f4f4f5", fontSize: "24px" }}
            >
              Why This Exists
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.7" }}>
              Every Tiny Desk performance has a story that goes deeper than the set list.
              Who influenced the artist? What genres collide in their sound? Where does their
              music come from? This catalog lets you explore five years of Tiny Desk concerts
              and trace those connections.
            </p>
          </div>
          <div>
            <h2
              className="font-[family-name:var(--font-bebas)] tracking-wide mb-3"
              style={{ color: "#f4f4f5", fontSize: "24px" }}
            >
              What Crate Does
            </h2>
            <p style={{ color: "#a1a1aa", fontSize: "14px", lineHeight: "1.7" }}>
              Crate is an AI-powered music research agent. It searches 20+ sources — interviews,
              liner notes, music journalism, databases — to build influence chains, find sample
              origins, and map the musical DNA of any artist. Pick any artist below and generate
              their companion page in seconds.
            </p>
          </div>
        </div>
      </section>

      {/* Catalog */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <CatalogClient
          concerts={concerts}
          companionSlugs={companionSlugs}
        />
      </section>

      {/* CTA Section */}
      <section
        className="border-t py-16 text-center"
        style={{ borderColor: "#27272a", backgroundColor: "#0A1628" }}
      >
        <h2
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-4"
          style={{ color: "#f4f4f5", fontSize: "36px" }}
        >
          Want to Dig Even Deeper?
        </h2>
        <p
          className="mx-auto mb-8 max-w-lg"
          style={{ color: "#71717a", fontSize: "16px" }}
        >
          Crate gives you AI-powered music research across 20+ sources. Build your own influence chains, discover samples, and trace the DNA of any artist.
        </p>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] inline-block rounded-lg px-10 py-4 text-lg tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          DIG DEEPER — TRY CRATE FREE
        </Link>
      </section>
    </main>
  );
}
