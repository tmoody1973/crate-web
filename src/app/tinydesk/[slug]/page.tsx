import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
import { notFound } from "next/navigation";
import { VideoInfluenceChain } from "@/components/tinydesk/video-influence-chain";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import type { CatalogConcert } from "@/components/tinydesk/catalog-types";
import { GENRE_COLORS } from "@/components/tinydesk/catalog-types";
import catalogData from "../../../../public/tinydesk/catalog.json";

interface TinyDeskNode {
  name: string;
  role: string;
  era?: string;
  connection: string;
  strength: number;
  source?: string;
  sourceUrl?: string;
  videoId: string;
  videoTitle: string;
}

interface TinyDeskData {
  artist: string;
  slug: string;
  tagline: string;
  tinyDeskVideoId: string;
  nodes: TinyDeskNode[];
}

async function getTinyDeskData(slug: string): Promise<TinyDeskData | null> {
  // Try Convex first
  try {
    const companion = await convex.query(api.tinydeskCompanions.getBySlug, { slug });
    if (companion) {
      return {
        artist: companion.artist,
        slug: companion.slug,
        tagline: companion.tagline,
        tinyDeskVideoId: companion.tinyDeskVideoId,
        nodes: JSON.parse(companion.nodes),
      };
    }
  } catch {
    // Fall through to static file
  }

  // Fallback: static JSON
  try {
    const { readFile } = await import("fs/promises");
    const { join } = await import("path");
    const filePath = join(process.cwd(), "public", "tinydesk", `${slug}.json`);
    const raw = await readFile(filePath, "utf-8");
    return JSON.parse(raw) as TinyDeskData;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTinyDeskData(slug);

  if (!data) {
    return { title: "Not Found | Crate" };
  }

  const title = `Tiny Desk Companion: ${data.artist} — Musical DNA | Crate`;
  const description = data.tagline;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://digcrate.app/tinydesk/${slug}`,
      images: [
        {
          url: `https://img.youtube.com/vi/${data.tinyDeskVideoId}/maxresdefault.jpg`,
          width: 1280,
          height: 720,
          alt: `${data.artist} — Tiny Desk Companion`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [
        `https://img.youtube.com/vi/${data.tinyDeskVideoId}/maxresdefault.jpg`,
      ],
    },
  };
}

export default async function TinyDeskCompanionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = await getTinyDeskData(slug);

  if (!data) {
    notFound();
  }

  // Find same-genre artists from catalog
  const catalog = catalogData as CatalogConcert[];
  const thisConcert = catalog.find((c) => c.slug === slug);
  const thisGenres: string[] = thisConcert?.genre ?? [];
  const sameGenre = thisGenres.length > 0
    ? catalog
        .filter((c) => c.slug !== slug && c.genre.some((g) => thisGenres.includes(g)))
        .sort(() => Math.random() - 0.5)
        .slice(0, 6)
    : [];

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
          href="/tinydesk"
          className="font-[family-name:var(--font-bebas)] tracking-widest text-sm md:text-base transition-colors hover:text-cyan-400"
          style={{ color: "#71717a" }}
        >
          ← BACK TO CATALOG
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-12 md:py-16">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest mb-2"
          style={{ color: "#22d3ee", fontSize: "14px" }}
        >
          TINY DESK COMPANION
        </p>
        <h1
          className="font-[family-name:var(--font-bebas)] leading-none mb-4"
          style={{ color: "#f4f4f5", fontSize: "clamp(48px,8vw,80px)" }}
        >
          {data.artist}
        </h1>
        <p
          className="mb-8 max-w-2xl"
          style={{ color: "#a1a1aa", fontSize: "18px", lineHeight: "1.6" }}
        >
          {data.tagline}
        </p>

        {/* Tiny Desk YouTube embed */}
        <div
          className="relative w-full overflow-hidden rounded-xl"
          style={{ paddingTop: "56.25%", marginBottom: "64px" }}
        >
          <iframe
            src={`https://www.youtube.com/embed/${data.tinyDeskVideoId}`}
            title={`${data.artist} — NPR Tiny Desk Concert`}
            className="absolute inset-0 h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
          />
        </div>
      </section>

      {/* Story intro */}
      <section className="mx-auto max-w-2xl px-6 pb-16 text-center">
        <div
          className="w-px mx-auto"
          style={{ height: "48px", backgroundColor: "#27272a" }}
        />
        <p
          className="my-8 text-lg md:text-xl leading-relaxed"
          style={{ color: "#a1a1aa" }}
        >
          Every sound has a story. Scroll to trace the musical DNA behind this performance — {data.nodes.length} connections, each one cited from real music journalism and criticism.
        </p>
        <div
          className="w-px mx-auto"
          style={{ height: "48px", backgroundColor: "#27272a" }}
        />
        <svg width="12" height="8" viewBox="0 0 12 8" fill="none" className="mx-auto mt-[-1px]">
          <path d="M6 8L0 0H12L6 8Z" fill="#27272a" />
        </svg>
      </section>

      {/* Influence Chain — storytelling scroll */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <VideoInfluenceChain nodes={data.nodes} artist={data.artist} />
      </section>

      {/* More in [genre] */}
      {sameGenre.length > 0 && (
        <section className="mx-auto max-w-4xl px-6 pb-16">
          <h2
            className="font-[family-name:var(--font-bebas)] tracking-wide mb-6"
            style={{ color: "#f4f4f5", fontSize: "28px" }}
          >
            More in{" "}
            {thisGenres.map((g, i) => (
              <span key={g}>
                {i > 0 && " & "}
                <span style={{ color: GENRE_COLORS[g] ?? "#a1a1aa" }}>{g}</span>
              </span>
            ))}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {sameGenre.map((c) => (
              <Link
                key={c.slug}
                href={`/tinydesk?genre=${encodeURIComponent(c.genre[0])}`}
                className="group rounded-xl overflow-hidden transition-all hover:-translate-y-1"
                style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
              >
                <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
                  {c.youtubeId ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`https://img.youtube.com/vi/${c.youtubeId}/mqdefault.jpg`}
                      alt={c.artist}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-800" />
                  )}
                  <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(9,9,11,0.85) 0%, transparent 60%)" }}
                  />
                </div>
                <div className="p-3">
                  <p
                    className="font-[family-name:var(--font-bebas)] tracking-wide group-hover:text-cyan-400 transition-colors truncate"
                    style={{ color: "#f4f4f5", fontSize: "18px" }}
                  >
                    {c.artist}
                  </p>
                  <div className="flex gap-1">
                    {c.genre.slice(0, 2).map((g) => (
                      <span
                        key={g}
                        className="text-[9px]"
                        style={{ color: GENRE_COLORS[g] ?? "#71717a" }}
                      >
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      <footer
        className="border-t mt-8"
        style={{ borderColor: "#27272a", backgroundColor: "#0A1628" }}
      >
        <div className="mx-auto max-w-4xl px-6 py-12 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <p
              className="font-[family-name:var(--font-bebas)] tracking-wider mb-1"
              style={{ color: "#f4f4f5", fontSize: "22px" }}
            >
              Explore More Artists
            </p>
            <Link
              href="/tinydesk"
              className="text-sm transition-opacity hover:opacity-80"
              style={{ color: "#22d3ee" }}
            >
              ← Back to all companions
            </Link>
          </div>
          <Link
            href="/sign-in"
            className="font-[family-name:var(--font-bebas)] rounded-lg px-8 py-3 tracking-widest text-base transition-opacity hover:opacity-90"
            style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
          >
            DIG DEEPER — TRY CRATE FREE
          </Link>
        </div>
      </footer>
    </main>
  );
}
