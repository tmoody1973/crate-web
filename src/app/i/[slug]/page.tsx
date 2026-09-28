/**
 * /i/[slug] — Public Influence Receipt page.
 * Zero-login, shareable, ISR-cached.
 */

import { Suspense } from "react";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { ReceiptData } from "@/lib/receipt-types";
import { ReceiptUI } from "./receipt-ui";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";

// 10 min ISR. Server render is cache-only and never calls Perplexity, so this
// just controls how quickly a freshly (client-)generated receipt gets baked
// into SSR for rich OG tags on shared links.
export const revalidate = 600;

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

/**
 * Cache-only receipt lookup. Deliberately does NOT generate: generation costs
 * paid Perplexity calls, so it must only ever be triggered by a real user
 * action via the rate-limited /api/influence/receipt/generate route — never
 * during SSR or generateMetadata, where bots, crawlers, and link-unfurlers
 * would silently rack up spend. On a cache miss we return null and the client
 * (ReceiptUI) triggers the rate-limited generation in the browser.
 */
async function getCachedReceipt(slug: string): Promise<ReceiptData | null> {
  try {
    const cached = await convex.query(api.receipt.getBySlug, { slug });
    if (cached) {
      return JSON.parse(cached.data) as ReceiptData;
    }
  } catch {
    // Convex unreachable — render the empty shell; the client will generate.
  }
  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const receipt = await getCachedReceipt(slug);

  if (!receipt) {
    return {
      title: "Influence Receipt | Crate",
      description: "Discover the musical DNA of any artist.",
    };
  }

  const topInfluences = receipt.influences
    .slice(0, 3)
    .map((i) => i.name)
    .join(", ");
  const title = `${receipt.artist} — Musical DNA | Crate`;
  const description = topInfluences
    ? `${receipt.artist} was shaped by ${topInfluences}. Explore the full influence chain.`
    : `Explore the musical influences of ${receipt.artist}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      url: `https://digcrate.app/i/${slug}`,
      images: [
        {
          url: `https://digcrate.app/api/og/influence/${slug}`,
          width: 1200,
          height: 630,
          alt: `${receipt.artist} Influence Receipt`,
        },
      ],
      siteName: "Crate",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [`https://digcrate.app/api/og/influence/${slug}`],
    },
  };
}

export default async function InfluenceReceiptPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const receipt = await getCachedReceipt(slug);

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} min-h-screen bg-[#0a0a0a] text-white font-[family-name:var(--font-space)]`}
    >
      <Suspense fallback={null}>
        {/* key={slug} forces a fresh mount per artist. Without it, App Router
            reuses this client component across /i/[slug] → /i/[slug]
            navigations, so useState/refs carry the previous artist over and
            the generation gate blocks the next fetch. */}
        <ReceiptUI key={slug} slug={slug} initialReceipt={receipt} />
      </Suspense>
    </main>
  );
}
