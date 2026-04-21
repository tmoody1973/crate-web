/**
 * OG image for /r/[slug] tours.
 *
 * Next.js file-based convention: this export handles the og:image meta tag
 * automatically for the tour page. Satori renders it server-side.
 *
 * 1200x630 is the Twitter/OpenGraph summary_large_image size.
 */

import { ImageResponse } from "next/og";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";

export const runtime = "edge";
export const alt = "Crate listening tour";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage({
  params,
}: {
  params: { slug: string };
}) {
  const { slug } = params;

  let title = "A Listening Tour";
  let topArtists: string[] = [];
  let artistCount = 0;

  try {
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      const convex = new ConvexHttpClient(convexUrl);
      const tour = await convex.query(api.recommend.mutations.getTourBySlug, {
        slug,
      });
      if (tour) {
        title = tour.promptRedacted || title;
        topArtists = tour.artists.slice(0, 4).map((a) => a.name);
        artistCount = tour.artists.length;
      }
    }
  } catch {
    // fall through to default card
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0a",
          padding: "64px 72px",
          color: "#f4f4f5",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "32px",
          }}
        >
          <div
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "999px",
              backgroundColor: "#e8b86a",
            }}
          />
          <span
            style={{
              fontSize: "22px",
              letterSpacing: "0.18em",
              color: "#e8b86a",
              textTransform: "uppercase",
            }}
          >
            Crate · Listening Tour
          </span>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: "76px",
            lineHeight: 1.04,
            fontWeight: 700,
            letterSpacing: "-0.01em",
            marginBottom: "40px",
            color: "#f4f4f5",
            maxWidth: "980px",
          }}
        >
          {title}
        </div>

        {topArtists.length > 0 && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              marginBottom: "auto",
            }}
          >
            {topArtists.map((name, i) => (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  fontSize: "28px",
                  color: "#d4d4d8",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    width: "38px",
                    height: "38px",
                    borderRadius: "999px",
                    border: "1px solid #e8b86a",
                    color: "#e8b86a",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "18px",
                    fontWeight: 600,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ display: "flex" }}>{name}</span>
              </div>
            ))}
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: "40px",
          }}
        >
          <span style={{ fontSize: "20px", color: "#71717a" }}>
            {artistCount > 0
              ? `${artistCount}-artist arc · cited sources`
              : "Sequenced as a story · cited sources"}
          </span>
          <span
            style={{
              fontSize: "20px",
              color: "#e8b86a",
              letterSpacing: "0.12em",
            }}
          >
            digcrate.app/r
          </span>
        </div>
      </div>
    ),
    { ...size },
  );
}
