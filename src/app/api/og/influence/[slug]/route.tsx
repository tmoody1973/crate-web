/**
 * GET /api/og/influence/[slug]
 *
 * Generates a dynamic Open Graph image for an Influence Receipt.
 * Uses @vercel/og (Satori) for server-side image generation.
 */

import { ImageResponse } from "@vercel/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import type { ReceiptData, ReceiptInfluence } from "@/lib/receipt-types";

export const runtime = "edge";

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

function getColor(rel: string): string {
  return RELATIONSHIP_COLORS[rel.toLowerCase().trim()] ?? "#a78bfa";
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  let receipt: ReceiptData | null = null;

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const cached = await convex.query(api.receipt.getBySlug, { slug });
      if (cached) {
        receipt = JSON.parse(cached.data) as ReceiptData;
      }
    }
  } catch {
    // Fall through to default OG
  }

  const artistName = receipt?.artist ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const topInfluences = receipt?.influences?.slice(0, 4) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          padding: "60px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Top: Crate branding */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            marginBottom: "40px",
          }}
        >
          <div
            style={{
              width: "24px",
              height: "24px",
              borderRadius: "4px",
              backgroundColor: "#4ade80",
            }}
          />
          <span style={{ color: "#666", fontSize: "18px", letterSpacing: "2px" }}>
            CRATE
          </span>
        </div>

        {/* Artist name */}
        <div
          style={{
            fontSize: "72px",
            fontWeight: 900,
            color: "#ffffff",
            lineHeight: 1,
            marginBottom: "8px",
            letterSpacing: "-1px",
          }}
        >
          {artistName}
        </div>

        <div
          style={{
            fontSize: "20px",
            color: "#666",
            marginBottom: "40px",
          }}
        >
          Musical Influence Receipt
        </div>

        {/* Influence list */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {topInfluences.map((inf: ReceiptInfluence, idx: number) => (
            <div
              key={idx}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  width: "12px",
                  height: "12px",
                  borderRadius: "50%",
                  backgroundColor: getColor(inf.relationship),
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "24px", color: "#fff", fontWeight: 600 }}>
                {inf.name}
              </span>
              <span style={{ fontSize: "16px", color: getColor(inf.relationship) }}>
                {inf.relationship}
              </span>
            </div>
          ))}
          {topInfluences.length === 0 && (
            <div style={{ fontSize: "24px", color: "#666" }}>
              Discover the full influence chain
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            marginTop: "auto",
            justifyContent: "space-between",
            alignItems: "flex-end",
          }}
        >
          <span style={{ fontSize: "16px", color: "#444" }}>
            digcrate.app/i/{slug}
          </span>
          <span style={{ fontSize: "14px", color: "#333" }}>
            The Liner Notes Layer
          </span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
