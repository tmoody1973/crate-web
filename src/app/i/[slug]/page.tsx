/**
 * /i/[slug] — Public Influence Receipt page.
 * Zero-login, shareable, ISR-cached.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import type { ReceiptData } from "@/lib/receipt-types";
import { ReceiptUI } from "./receipt-ui";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";

export const revalidate = 86400; // 24 hours ISR

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

async function getReceipt(slug: string): Promise<ReceiptData | null> {
  try {
    const cached = await convex.query(api.receipt.getBySlug, { slug });
    if (cached) {
      return JSON.parse(cached.data) as ReceiptData;
    }
  } catch {
    // Fall through
  }
  return null;
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
