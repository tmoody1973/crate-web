/**
 * /i/[slug] — Public Influence Receipt page.
 * Zero-login, shareable, ISR-cached.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { ReceiptData } from "@/lib/receipt-types";
import { ReceiptUI } from "./receipt-ui";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { discoverWithPerplexity } from "@/lib/perplexity-discover";
import { artistToSlug, getReceiptTier, sourceNameFromUrl, type ReceiptInfluence } from "@/lib/receipt-types";

export const revalidate = 86400; // 24 hours ISR

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function getReceipt(slug: string): Promise<ReceiptData | null> {
  // Step 1: Check cache
  try {
    const cached = await convex.query(api.receipt.getBySlug, { slug });
    if (cached) {
      return JSON.parse(cached.data) as ReceiptData;
    }
  } catch {
    // Fall through to generation
  }

  // Step 2: Generate server-side (user never sees loading state)
  const artist = slug.replace(/-/g, " ");
  try {
    const { connections, citations } = await discoverWithPerplexity(artist, "sonar");

    const influences: ReceiptInfluence[] = connections.map((c) => ({
      name: c.name,
      slug: artistToSlug(c.name),
      relationship: c.relationship ?? "influenced by",
      weight: typeof c.weight === "number" ? Math.min(1, Math.max(0, c.weight)) : 0.5,
      context: c.context,
      sources: citations.slice(0, 2).map((url) => ({ name: sourceNameFromUrl(url), url })),
      subInfluences: [],
    }));

    // Discover sub-influences for top 3
    const top3 = influences.slice(0, 3);
    const subResults = await Promise.allSettled(
      top3.map((inf) => discoverWithPerplexity(inf.name, "sonar")),
    );
    subResults.forEach((result, idx) => {
      if (result.status === "fulfilled" && top3[idx]) {
        const subConns = result.value.connections.slice(0, 2);
        top3[idx] = {
          ...top3[idx],
          subInfluences: subConns.map((sc) => ({
            name: sc.name,
            slug: artistToSlug(sc.name),
            relationship: sc.relationship ?? "influenced by",
            weight: typeof sc.weight === "number" ? Math.min(1, Math.max(0, sc.weight)) : 0.5,
            context: sc.context,
            sources: result.value.citations.slice(0, 1).map((url) => ({ name: sourceNameFromUrl(url), url })),
          })),
        };
      }
    });

    const finalInfluences = [...top3, ...influences.slice(3)];
    const tier = getReceiptTier(finalInfluences.length);
    const receiptData: ReceiptData = {
      artist,
      slug,
      tier,
      influences: finalInfluences,
      generatedAt: Date.now(),
    };

    // Cache it
    try {
      await convex.mutation(api.receipt.cacheReceipt, {
        slug,
        artist,
        tier,
        data: JSON.stringify(receiptData),
        generatedAt: receiptData.generatedAt,
      });
    } catch {
      // Non-fatal
    }

    return receiptData;
  } catch (err) {
    console.error("[receipt/page] Generation failed:", err);
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const receipt = await getReceipt(slug);

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
  const receipt = await getReceipt(slug);

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} min-h-screen bg-[#0a0a0a] text-white font-[family-name:var(--font-space)]`}
    >
      <ReceiptUI slug={slug} initialReceipt={receipt} />
    </main>
  );
}
