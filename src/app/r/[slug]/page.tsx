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
import { TourArtifact } from "./tour-artifact";
import { TourPlayerShell } from "./player-shell";

export const revalidate = 300; // 5 minutes — tours are near-immutable once public

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

type Tour = Doc<"artifactsRecommend">;

/**
 * Rich per-source card section — mirrors the `/cuts` ReviewSourceCard
 * pattern. Each card shows publication badge + linked title + snippet +
 * date + the tour artists mentioned in that source. Cards come from
 * Perplexity's `search_results` array (real URLs, real snippets, real
 * titles), stored on the tour as `sources` during generation.
 *
 * Falls back to a flat URL list when `sources` is empty (older tours or
 * Perplexity responses that only include `citations[]`).
 */
function TourSources({ tour }: { tour: Tour }) {
  const sources = tour.sources ?? [];
  const fallbackUrls =
    sources.length === 0
      ? tour.citations.filter((u) => /^https?:\/\//.test(u)).slice(0, 10)
      : [];

  if (sources.length === 0 && fallbackUrls.length === 0) return null;

  return (
    <section className="mx-auto max-w-3xl px-6 pb-16">
      <p
        className="font-[family-name:var(--font-bebas)] tracking-widest mb-4"
        style={{ color: "#e8b86a", fontSize: "12px" }}
      >
        REVIEWS CITED
      </p>
      {sources.length > 0 ? (
        <ul className="space-y-3">
          {sources.map((s) => (
            <li key={s.url}>
              <ReviewSourceCard source={s} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2 rounded-xl p-5"
          style={{ backgroundColor: "#0A1628", border: "1px solid #1d2d44" }}
        >
          {fallbackUrls.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="truncate block text-sm transition-colors hover:text-[#e8b86a]"
                style={{ color: "#a1a1aa" }}
              >
                {hostnameFor(url)}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type TourSource = NonNullable<Tour["sources"]>[number];

function ReviewSourceCard({ source }: { source: TourSource }) {
  return (
    <article
      className="rounded-lg p-4"
      style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
    >
      <div className="flex items-start justify-between gap-4">
        {source.heroImageUrl && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={source.heroImageUrl}
            alt=""
            className="h-16 w-16 shrink-0 rounded object-cover"
            loading="lazy"
          />
        )}
        <div className="min-w-0 flex-1">
          <span
            className="inline-block font-[family-name:var(--font-bebas)] tracking-widest"
            style={{ color: "#e8b86a", fontSize: "10px" }}
          >
            {source.publication}
          </span>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="mt-1 block text-sm font-semibold transition-colors hover:underline"
            style={{ color: "#22d3ee" }}
          >
            {source.title || source.url}
          </a>
          {source.snippet && (
            <p
              className="mt-2 italic"
              style={{
                color: "#d4d4d8",
                fontSize: "13px",
                lineHeight: "1.55",
                fontFamily: "Georgia, serif",
              }}
            >
              &ldquo;{source.snippet}&rdquo;
            </p>
          )}
        </div>
        {source.date && (
          <span
            className="shrink-0 text-[10px] tracking-wide"
            style={{ color: "#52525b" }}
          >
            {source.date}
          </span>
        )}
      </div>
      {source.artistsMentioned.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {source.artistsMentioned.map((a) => (
            <span
              key={a}
              className="rounded-full px-2 py-0.5 text-[10px]"
              style={{
                backgroundColor: "rgba(232,184,106,0.12)",
                color: "#e8b86a",
              }}
            >
              {a}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}

function hostnameFor(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

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

  return (
    <TourPlayerShell>
      <main
        className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen bg-[#0a0a0a] text-white pb-24`}
      >
        <TourHeader />

        <section className="mx-auto max-w-3xl px-6 pt-8 pb-12">
          <Hero tour={tour} />
        </section>

        <section className="mx-auto max-w-3xl px-6 pb-16">
          <TourArtifact tour={tour} />
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
    </TourPlayerShell>
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

