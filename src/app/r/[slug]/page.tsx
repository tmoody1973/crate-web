/**
 * /r/[slug] — Public tour page.
 *
 * Server component. Zero-login. Fetches the tour by slug and renders the
 * 10-artist arc with quotes and citations. This is the shareable URL —
 * every tour that reaches moderationStatus="approved" + isPublic=true
 * lives here.
 *
 * Interactivity (keep/pass/save/share buttons, inline YouTube play, refine)
 * will be layered on in chunks 6–7 as a client "TourArtifact" component.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { Doc } from "../../../../convex/_generated/dataModel";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";

export const revalidate = 300; // 5 minutes — tours are near-immutable once public

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Tour = Doc<"artifactsRecommend">;

async function getTour(slug: string): Promise<Tour | null> {
  try {
    return await convex.query(api.recommend.mutations.getTourBySlug, { slug });
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) {
    return {
      title: "Tour not found | Crate",
      description: "This tour doesn't exist or isn't public yet.",
    };
  }

  const title = `${tour.promptRedacted || "Listening Tour"} | Crate`;
  const topThree = tour.artists
    .slice(0, 3)
    .map((a) => a.name)
    .join(", ");
  const description = topThree
    ? `A ${tour.artists.length}-artist listening tour: ${topThree}, and more. Cited. Sequenced.`
    : `A listening tour built on Crate.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://digcrate.app/r/${slug}`,
      siteName: "Crate",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function TourPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tour = await getTour(slug);
  if (!tour) notFound();

  const artists = [...tour.artists].sort(
    (a, b) => a.arcPosition - b.arcPosition,
  );

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen bg-[#0a0a0a] text-white`}
    >
      <TourHeader />

      <section className="mx-auto max-w-3xl px-6 pt-8 pb-12">
        <Hero tour={tour} />
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-16">
        <ol className="space-y-4">
          {artists.map((a) => (
            <li key={`${tour._id}-${a.arcPosition}`}>
              <ArtistStop artist={a} />
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-20">
        <div
          className="rounded-xl p-6 md:p-8 text-center"
          style={{ backgroundColor: "#0A1628", border: "1px solid #1d2d44" }}
        >
          <p
            className="font-[family-name:var(--font-bebas)] tracking-wide mb-3"
            style={{ color: "#f4f4f5", fontSize: "26px" }}
          >
            Want one of your own?
          </p>
          <p
            className="mb-5 mx-auto"
            style={{ color: "#a1a1aa", fontSize: "15px", maxWidth: "440px" }}
          >
            Describe a mood, an era, a show you&apos;re prepping. Crate builds
            a 10-artist tour sequenced like a story.
          </p>
          <Link
            href="/recommend"
            className="font-[family-name:var(--font-bebas)] inline-block rounded-lg px-8 py-3 text-base tracking-widest transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#e8b86a", color: "#0a0a0a" }}
          >
            BUILD YOUR TOUR
          </Link>
        </div>
      </section>
    </main>
  );
}

function TourHeader() {
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
        <Link
          href="/r"
          className="font-[family-name:var(--font-bebas)] tracking-widest transition-opacity hover:opacity-80"
          style={{ color: "#e8b86a", fontSize: "20px" }}
        >
          LIBRARY
        </Link>
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

function Hero({ tour }: { tour: Tour }) {
  const verified = tour.artists.filter((a) => a.quote?.verified).length;
  return (
    <div>
      <p
        className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
        style={{ color: "#e8b86a", fontSize: "12px" }}
      >
        A LISTENING TOUR
      </p>
      <h1
        className="font-[family-name:var(--font-bebas)] tracking-wide leading-none mb-4"
        style={{ fontSize: "clamp(40px, 7vw, 64px)" }}
      >
        {tour.promptRedacted || "Untitled tour"}
      </h1>
      {tour.promptShowRaw && tour.prompt && (
        <p
          className="mb-5 italic"
          style={{
            color: "#a1a1aa",
            fontSize: "16px",
            fontFamily: "Georgia, serif",
          }}
        >
          &ldquo;{tour.prompt}&rdquo;
        </p>
      )}
      <div
        className="flex flex-wrap gap-x-4 gap-y-1 text-xs tracking-widest"
        style={{ color: "#71717a" }}
      >
        <span>{tour.artists.length} ARTISTS</span>
        {verified > 0 && <span>· {verified} CITED</span>}
        {tour.perplexityFallbackUsed && <span>· BROAD SEARCH</span>}
      </div>
    </div>
  );
}

type ArtistEntry = Tour["artists"][number];

function ArtistStop({ artist }: { artist: ArtistEntry }) {
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
    </article>
  );
}
