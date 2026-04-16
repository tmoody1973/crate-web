/**
 * /i — Influence Receipt landing page.
 * Browse-first grid of pre-seeded artists + search box.
 */

import Link from "next/link";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { ReceiptSearch } from "./receipt-search";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const revalidate = 3600; // 1 hour ISR

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

// Relationship color for the dot on the landing grid
const TIER_COLORS: Record<string, string> = {
  full: "#4ade80",
  partial: "#facc15",
  unknown: "#666",
};

export default async function InfluenceReceiptsPage() {
  let receipts: Array<{
    slug: string;
    artist: string;
    tier: string;
    generatedAt: number;
  }> = [];

  try {
    receipts = await convex.query(api.receipt.listCached, {});
  } catch {
    // Empty state if Convex fails
  }

  // Sort alphabetically
  const sorted = [...receipts].sort((a, b) =>
    a.artist.localeCompare(b.artist),
  );

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} min-h-screen bg-[#0a0a0a] text-white font-[family-name:var(--font-space)]`}
    >
      <div className="px-4 py-12 max-w-[800px] mx-auto">
        {/* Header */}
        <header className="mb-10">
          <Link
            href="/"
            className="text-xs text-white/30 hover:text-white/50 transition-colors mb-4 block"
          >
            ← Crate
          </Link>
          <h1 className="font-[family-name:var(--font-bebas)] text-5xl sm:text-6xl tracking-wide leading-none mb-3">
            Influence Receipts
          </h1>
          <p className="text-white/50 text-base max-w-md">
            Type any artist. See who shaped their sound, who they influenced, and
            why. The liner notes layer for the streaming era.
          </p>
        </header>

        {/* Search */}
        <div className="mb-10">
          <ReceiptSearch />
        </div>

        {/* Receipt grid */}
        {sorted.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-white/30 uppercase tracking-widest mb-4">
              Browse receipts ({sorted.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {sorted.map((r) => (
                <Link
                  key={r.slug}
                  href={`/i/${r.slug}`}
                  className="group bg-white/[0.03] hover:bg-white/[0.06] border border-white/[0.06] hover:border-white/10 rounded-lg px-4 py-3 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        backgroundColor: TIER_COLORS[r.tier] ?? "#666",
                      }}
                    />
                    <span className="font-semibold text-sm text-white/80 group-hover:text-white truncate">
                      {r.artist}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {sorted.length === 0 && (
          <p className="text-white/30 text-sm text-center py-8">
            No receipts generated yet. Search for an artist above to create the
            first one.
          </p>
        )}

        {/* Footer */}
        <footer className="text-center mt-16 pt-8 border-t border-white/5">
          <Link
            href="/sign-up"
            className="text-sm text-white/40 hover:text-[#4ade80] transition-colors"
          >
            Want to go deeper? Try Crate →
          </Link>
          <p className="text-xs text-white/20 mt-4">
            Crate — The Liner Notes Layer for the Streaming Era
          </p>
        </footer>
      </div>
    </main>
  );
}
