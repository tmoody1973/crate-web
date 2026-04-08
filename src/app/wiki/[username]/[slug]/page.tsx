import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { VisibilityToggle } from "@/components/wiki/visibility-toggle";
import type { Metadata } from "next";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

interface WikiSource {
  tool: string;
  url?: string;
  fetchedAt: number;
}

interface WikiSection {
  heading: string;
  content: string;
  sources: WikiSource[];
  lastSynthesizedAt?: number;
}

interface WikiContradiction {
  claim1: { source: string; value: string };
  claim2: { source: string; value: string };
  field: string;
}

interface WikiPage {
  entityName: string;
  description?: string;
  sections: WikiSection[];
  contradictions: WikiContradiction[];
  metadata: {
    origin?: string;
    yearsActive?: string;
    members?: string[];
    genreDNA?: string[];
  };
  visibility: "private" | "unlisted" | "public";
  updatedAt: number;
  ownerName: string;
}

interface WikiPageProps {
  params: Promise<{ username: string; slug: string }>;
}

export async function generateMetadata({ params }: WikiPageProps): Promise<Metadata> {
  const { username, slug } = await params;
  const { userId: clerkId } = await auth();
  const page = await convex.query(api.wiki.getBySlug, {
    userSlug: username,
    slug,
    viewerClerkId: clerkId ?? undefined,
  });

  if (!page) {
    return { title: "Not Found — Crate" };
  }

  return {
    title: `${page.entityName} — Music Wiki | Crate`,
    description: page.description ?? `${page.entityName} music intelligence page on Crate`,
    openGraph: {
      title: `${page.entityName} — Music Wiki | Crate`,
      description: page.description ?? `${page.entityName} music intelligence page`,
      type: "article",
      url: `https://digcrate.app/wiki/${username}/${slug}`,
    },
  };
}

// Source tool name → display name mapping
const SOURCE_DISPLAY: Record<string, string> = {
  Spotify: "Spotify",
  WhoSampled: "WhoSampled",
  Bandcamp: "Bandcamp",
  YouTube: "YouTube",
  Radio: "Radio",
  "Influence Cache": "Influence Data",
  "Tiny Desk": "Tiny Desk",
  Images: "Images",
  "Prep Research": "Research",
};

export default async function WikiDetailPage({ params }: WikiPageProps) {
  const { username, slug } = await params;
  const { userId: clerkId } = await auth();
  const page = await convex.query(api.wiki.getBySlug, {
    userSlug: username,
    slug,
    viewerClerkId: clerkId ?? undefined,
  });

  if (!page) {
    notFound();
  }

  // Check if viewer is the page owner (for showing visibility toggle)
  const ownerUser = clerkId
    ? await convex.query(api.users.getByClerkId, { clerkId })
    : null;
  const isOwner = ownerUser && page.userId === ownerUser._id;

  // Collect unique source tools
  const allSources = new Set<string>();
  for (const section of page.sections) {
    for (const source of section.sources) {
      allSources.add(source.tool);
    }
  }

  const isSynthesized = page.sections.some((s: WikiSection) => s.lastSynthesizedAt);

  // Show first 4 sections, collapse the rest
  const VISIBLE_SECTIONS = 4;
  const visibleSections = page.sections.slice(0, VISIBLE_SECTIONS);
  const hiddenCount = Math.max(0, page.sections.length - VISIBLE_SECTIONS);

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen`}
      style={{ backgroundColor: "#09090b", color: "#f4f4f5" }}
      role="main"
    >
      {/* Header — matches /tinydesk pattern */}
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
        <div className="flex items-center gap-3">
          {isOwner ? (
            <VisibilityToggle
              pageId={page._id}
              userId={page.userId}
              initialVisibility={page.visibility}
            />
          ) : (
            <span
              className="text-xs px-3 py-1 rounded-full capitalize"
              style={{
                backgroundColor: page.visibility === "public" ? "#166534" : "#3f3f46",
                color: page.visibility === "public" ? "#bbf7d0" : "#a1a1aa",
              }}
            >
              {page.visibility}
            </span>
          )}
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-6 py-10">
        {/* V2-C Split Layout: editorial left, graph placeholder right */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_300px] gap-10">
          {/* LEFT: Editorial content */}
          <div>
            <h1
              className="font-[family-name:var(--font-bebas)] text-5xl md:text-7xl tracking-tight mb-4"
              style={{ color: "#fafaf9" }}
            >
              {page.entityName.toUpperCase()}
            </h1>

            {/* Metadata row */}
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm mb-6" style={{ color: "#a1a1aa" }}>
              {page.metadata.origin && (
                <span>
                  <span style={{ color: "#71717a" }}>ORIGIN</span>{" "}
                  {page.metadata.origin}
                </span>
              )}
              {page.metadata.yearsActive && (
                <span>
                  <span style={{ color: "#71717a" }}>YEARS ACTIVE</span>{" "}
                  {page.metadata.yearsActive}
                </span>
              )}
              {page.metadata.members && page.metadata.members.length > 0 && (
                <span>
                  <span style={{ color: "#71717a" }}>MEMBERS</span>{" "}
                  {page.metadata.members.join(", ")}
                </span>
              )}
            </div>

            {/* Description */}
            {page.description ? (
              <p className="text-base leading-relaxed mb-8" style={{ color: "#d4d4d8" }}>
                {page.description}
              </p>
            ) : !isSynthesized ? (
              <div className="flex items-center gap-2 mb-8">
                <span
                  className="inline-block w-2 h-2 rounded-full animate-pulse"
                  style={{ backgroundColor: "#eab308" }}
                />
                <span className="text-sm" style={{ color: "#a1a1aa" }}>
                  Synthesizing...
                </span>
              </div>
            ) : null}

            {/* Sections */}
            <div className="space-y-6 mb-8">
              {visibleSections.map((section, i) => (
                <div key={i}>
                  <h3
                    className="text-xs tracking-widest uppercase mb-2"
                    style={{ color: "#71717a" }}
                  >
                    {section.heading}
                  </h3>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#d4d4d8" }}>
                    {section.content}
                  </p>
                  <div className="flex gap-2 mt-2">
                    {section.sources.map((src, j) => (
                      <span
                        key={j}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ backgroundColor: "#27272a", color: "#a1a1aa" }}
                      >
                        {SOURCE_DISPLAY[src.tool] ?? src.tool}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {hiddenCount > 0 && (
              <details className="mb-8">
                <summary
                  className="text-sm cursor-pointer hover:underline"
                  style={{ color: "#a1a1aa" }}
                >
                  Show {hiddenCount} more source{hiddenCount > 1 ? "s" : ""}
                </summary>
                <div className="space-y-6 mt-4">
                  {page.sections.slice(VISIBLE_SECTIONS).map((section, i) => (
                    <div key={i + VISIBLE_SECTIONS}>
                      <h3
                        className="text-xs tracking-widest uppercase mb-2"
                        style={{ color: "#71717a" }}
                      >
                        {section.heading}
                      </h3>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#d4d4d8" }}>
                        {section.content}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>

          {/* RIGHT: Influence graph placeholder (Phase 2: real graph) */}
          <aside
            className="hidden md:block"
            aria-label="Influence connections"
          >
            <div
              className="sticky top-20 rounded-lg p-6"
              style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
            >
              <h3
                className="text-xs tracking-widest uppercase mb-4"
                style={{ color: "#71717a" }}
              >
                Influence Chain
              </h3>
              {/* Phase 2: replace with visual node graph from influenceArtists/influenceEdges */}
              <p className="text-sm" style={{ color: "#a1a1aa" }}>
                Influence graph coming in Phase 2. Research more artists to build connections.
              </p>
            </div>
          </aside>
        </div>

        {/* Bottom grid: Genre DNA, Source Provenance, Contradictions */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-10 pt-10"
          style={{ borderTop: "1px solid #27272a" }}
        >
          {/* Genre DNA */}
          <div>
            <h3
              className="text-xs tracking-widest uppercase mb-3"
              style={{ color: "#71717a" }}
            >
              Genre DNA
            </h3>
            <div className="flex flex-wrap gap-2">
              {(page.metadata.genreDNA ?? []).length > 0 ? (
                page.metadata.genreDNA!.map((genre) => (
                  <span
                    key={genre}
                    className="text-xs px-3 py-1 rounded-full"
                    style={{ backgroundColor: "#27272a", color: "#e4e4e7" }}
                  >
                    {genre}
                  </span>
                ))
              ) : (
                <span className="text-sm" style={{ color: "#52525b" }}>
                  Research more to discover genres
                </span>
              )}
            </div>
          </div>

          {/* Source Provenance */}
          <div>
            <h3
              className="text-xs tracking-widest uppercase mb-3"
              style={{ color: "#71717a" }}
            >
              Sources
            </h3>
            <div className="flex flex-wrap gap-2">
              {Array.from(allSources).map((source) => (
                <span
                  key={source}
                  className="text-xs px-3 py-1 rounded-full"
                  style={{ backgroundColor: "#27272a", color: "#e4e4e7" }}
                >
                  {SOURCE_DISPLAY[source] ?? source}
                </span>
              ))}
            </div>
          </div>

          {/* Contradictions */}
          <div>
            <h3
              className="text-xs tracking-widest uppercase mb-3"
              style={{ color: "#71717a" }}
            >
              Contradictions
            </h3>
            {page.contradictions.length > 0 ? (
              <div className="space-y-3">
                {page.contradictions.map((c, i) => (
                  <div
                    key={i}
                    className="text-xs p-3 rounded"
                    style={{ backgroundColor: "#1c1917", border: "1px solid #44403c" }}
                  >
                    <span style={{ color: "#fbbf24" }}>{c.field}:</span>{" "}
                    <span style={{ color: "#a1a1aa" }}>
                      {c.claim1.source} says &quot;{c.claim1.value}&quot; but{" "}
                      {c.claim2.source} says &quot;{c.claim2.value}&quot;
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm" style={{ color: "#52525b" }}>
                No contradictions found.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-10 pt-6 flex items-center justify-between text-xs"
          style={{ borderTop: "1px solid #27272a", color: "#52525b" }}
        >
          <Link href="/wiki" className="hover:underline" style={{ color: "#a1a1aa" }}>
            ← Your Wiki
          </Link>
          <span>
            {page.sections.length} sources · Last updated{" "}
            {new Date(page.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </div>
    </main>
  );
}
