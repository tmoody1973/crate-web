"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import posthog from "posthog-js";
import type { ReceiptData, ReceiptInfluence } from "@/lib/receipt-types";

// ── Relationship color mapping ───────────────────────────────────────────────

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

function getRelColor(relationship: string): string {
  const norm = relationship.toLowerCase().trim();
  return RELATIONSHIP_COLORS[norm] ?? "#a78bfa";
}

// ── Skeleton loading component ───────────────────────────────────────────────

function ReceiptSkeleton() {
  return (
    <div className="animate-pulse space-y-6 px-4 py-8 max-w-[640px] mx-auto">
      <div className="h-10 bg-white/10 rounded w-3/4" />
      <div className="h-4 bg-white/5 rounded w-1/2" />
      <div className="space-y-4 mt-8">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10 mt-1.5 shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-5 bg-white/10 rounded w-2/3" />
              <div className="h-3 bg-white/5 rounded w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Influence node component ─────────────────────────────────────────────────

function InfluenceNode({
  influence,
  isLast,
  depth = 0,
}: {
  influence: ReceiptInfluence;
  isLast: boolean;
  depth?: number;
}) {
  const color = getRelColor(influence.relationship);

  return (
    <div className="relative" style={{ paddingLeft: depth > 0 ? 20 : 0 }}>
      {/* Connector line */}
      {depth > 0 && (
        <>
          <div
            className="absolute left-0 top-0 w-px bg-white/10"
            style={{ height: isLast ? 12 : "100%" }}
          />
          <div
            className="absolute left-0 top-3 h-px bg-white/10"
            style={{ width: 16 }}
          />
        </>
      )}

      <div className="flex items-start gap-3 py-2">
        {/* Colored dot */}
        <div
          className="w-2.5 h-2.5 rounded-full mt-1.5 shrink-0"
          style={{ backgroundColor: color }}
        />

        <div className="min-w-0 flex-1">
          {/* Artist name (clickable) */}
          <Link
            href={`/i/${influence.slug}`}
            className="font-semibold text-white hover:underline decoration-white/30 underline-offset-2"
            aria-label={`View influences for ${influence.name}`}
          >
            {influence.name}
          </Link>

          {/* Relationship + context */}
          <div className="text-sm text-white/50 mt-0.5">
            <span style={{ color }} className="font-medium">
              {influence.relationship}
            </span>
            {influence.context && (
              <span className="ml-1.5">{influence.context}</span>
            )}
          </div>

          {/* Sources */}
          {influence.sources && influence.sources.length > 0 && (
            <div className="flex gap-2 mt-1">
              {influence.sources.map((s, idx) => (
                <a
                  key={idx}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/25 hover:text-white/50 transition-colors"
                >
                  {s.name}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sub-influences (2nd level) */}
      {influence.subInfluences && influence.subInfluences.length > 0 && (
        <div className="relative ml-1">
          {/* Vertical connector line for sub-group */}
          <div
            className="absolute left-[4px] top-0 w-px bg-white/10"
            style={{
              height: `calc(100% - 12px)`,
            }}
          />
          {influence.subInfluences.map((sub, idx) => (
            <InfluenceNode
              key={sub.slug}
              influence={sub}
              isLast={idx === influence.subInfluences!.length - 1}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Unknown tier component ───────────────────────────────────────────────────

function UnknownTier({ slug }: { slug: string }) {
  const popularArtists = [
    { name: "Kendrick Lamar", slug: "kendrick-lamar" },
    { name: "Radiohead", slug: "radiohead" },
    { name: "Nina Simone", slug: "nina-simone" },
  ];

  return (
    <div className="px-4 py-12 max-w-[640px] mx-auto text-center">
      <h1 className="font-[family-name:var(--font-bebas)] text-4xl tracking-wide mb-2">
        Artist Not Found
      </h1>
      <p className="text-white/50 mb-8">
        We don&apos;t have influence data for &ldquo;{slug}&rdquo; yet. Try one of
        these:
      </p>
      <div className="flex flex-col gap-3 mb-8">
        {popularArtists.map((a) => (
          <Link
            key={a.slug}
            href={`/i/${a.slug}`}
            className="text-lg font-semibold text-white hover:text-[#4ade80] transition-colors"
          >
            {a.name}
          </Link>
        ))}
      </div>
      <SearchBox currentSlug={slug} />
    </div>
  );
}

// ── Partial tier component ───────────────────────────────────────────────────

function PartialBanner() {
  return (
    <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-3 mt-6 text-sm text-white/50">
      We found limited influence data for this artist. Know more?{" "}
      <a
        href="mailto:tarikjmoody@gmail.com?subject=Influence Receipt feedback"
        className="text-[#4ade80] hover:underline"
      >
        Help us improve this receipt
      </a>
    </div>
  );
}

// ── Search box component ─────────────────────────────────────────────────────

function SearchBox({ currentSlug }: { currentSlug?: string }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      posthog.capture("receipt_try_another", {
        artist: currentSlug,
        next_artist: slug,
      });
      router.push(`/i/${slug}`);
    },
    [query, router, currentSlug],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Try another artist..."
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors"
        aria-label="Search for an artist"
      />
      <button
        type="submit"
        className="bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
      >
        Go
      </button>
    </form>
  );
}

// ── Share button component ───────────────────────────────────────────────────

function ShareButton({ artist, slug }: { artist: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(async () => {
    const url = `https://digcrate.app/i/${slug}?utm_source=share&utm_medium=receipt`;
    const shareData = {
      title: `${artist} — Musical DNA | Crate`,
      text: `Check out the musical influence chain for ${artist}`,
      url,
    };

    posthog.capture("receipt_share_click", { artist, slug, method: "initial" });

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        posthog.capture("receipt_share_click", { artist, slug, method: "native_share" });
        return;
      }
    } catch (err) {
      // User cancelled or share failed, fall through to clipboard
      if (err instanceof Error && err.name === "AbortError") return;
    }

    // Clipboard fallback
    try {
      await navigator.clipboard.writeText(url);
      posthog.capture("receipt_share_click", { artist, slug, method: "clipboard" });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Last resort: show the URL
      prompt("Copy this link:", url);
    }
  }, [artist, slug]);

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 bg-white/10 hover:bg-white/15 border border-white/10 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors"
      aria-label={`Share ${artist} influence receipt`}
    >
      <svg
        className="w-4 h-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
        />
      </svg>
      <span aria-live="polite">{copied ? "Link copied!" : "Share"}</span>
    </button>
  );
}

// ── Main Receipt UI ──────────────────────────────────────────────────────────

export function ReceiptUI({
  slug,
  initialReceipt,
}: {
  slug: string;
  initialReceipt: ReceiptData | null;
}) {
  const receipt = initialReceipt;
  const viewTracked = useRef(false);

  // Track receipt view
  useEffect(() => {
    if (viewTracked.current) return;
    if (!receipt) return;
    viewTracked.current = true;
    posthog.capture("receipt_view", {
      artist: receipt.artist,
      slug: receipt.slug,
      tier: receipt.tier,
      influence_count: receipt.influences.length,
      referrer: typeof document !== "undefined" ? document.referrer : "",
    });
  }, [receipt]);

  // Unknown tier
  if (!receipt || receipt.tier === "unknown") {
    return <UnknownTier slug={slug} />;
  }

  return (
    <div className="px-4 py-8 max-w-[640px] mx-auto">
      {/* Header */}
      <header className="mb-8">
        <Link
          href="/i"
          className="text-xs text-white/30 hover:text-white/50 transition-colors mb-4 block"
        >
          ← All Receipts
        </Link>
        <h1 className="font-[family-name:var(--font-bebas)] text-4xl sm:text-5xl md:text-6xl tracking-wide leading-none">
          {receipt.artist}
        </h1>
        <p className="text-white/40 text-sm mt-2">
          A receipt of musical influences
        </p>
      </header>

      {/* Influence tree */}
      <section aria-label="Influence chain" role="tree" className="mb-8">
        <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
          Who shaped them
        </h2>
        <div className="space-y-0.5">
          {receipt.influences.map((inf, idx) => (
            <InfluenceNode
              key={inf.slug}
              influence={inf}
              isLast={idx === receipt.influences.length - 1}
            />
          ))}
        </div>
      </section>

      {/* Sonic DNA tags */}
      {receipt.sonicDna && receipt.sonicDna.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-3">
            Sonic DNA
          </h2>
          <div className="flex flex-wrap gap-2">
            {receipt.sonicDna.map((tag) => (
              <span
                key={tag}
                className="bg-white/5 border border-white/10 rounded-full px-3 py-1 text-xs text-white/60"
              >
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      {/* Partial tier banner */}
      {receipt.tier === "partial" && <PartialBanner />}

      {/* Actions */}
      <footer className="border-t border-white/10 pt-6 mt-8 space-y-4">
        <div className="flex gap-3">
          <ShareButton artist={receipt.artist} slug={receipt.slug} />
        </div>

        <SearchBox currentSlug={slug} />

        <div className="text-center pt-4">
          <Link
            href="/sign-up"
            className="text-sm text-white/40 hover:text-[#4ade80] transition-colors"
            onClick={() =>
              posthog.capture("receipt_cta_click", {
                artist: receipt.artist,
                slug: receipt.slug,
                cta_type: "sign_up",
              })
            }
          >
            Want to go deeper? Try Crate →
          </Link>
        </div>

        <div className="text-center pt-2">
          <Link
            href="/"
            className="text-xs text-white/20 hover:text-white/40 transition-colors"
          >
            Crate — The Liner Notes Layer
          </Link>
        </div>
      </footer>
    </div>
  );
}
