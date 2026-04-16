/**
 * POST /api/influence/receipt/generate
 *
 * Public (no auth) endpoint that generates an Influence Receipt for an artist.
 * 1. Check Convex cache — if receipt exists, return it.
 * 2. Check rate limit (IP-based, Convex-backed).
 * 3. Call Perplexity Sonar to discover influence connections.
 * 4. For top 3 influences, discover their sub-influences (2nd level).
 * 5. Cache the result to Convex.
 * 6. Return structured ReceiptData.
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../../convex/_generated/api";
import { discoverWithPerplexity } from "@/lib/perplexity-discover";
import {
  type ReceiptData,
  type ReceiptInfluence,
  artistToSlug,
  getReceiptTier,
  sourceNameFromUrl,
} from "@/lib/receipt-types";

export const maxDuration = 30;

export async function POST(req: Request): Promise<Response> {
  let body: { artist?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";
  if (!artist) {
    return Response.json({ error: "artist is required" }, { status: 400 });
  }

  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return Response.json({ error: "Convex not configured" }, { status: 500 });
  }
  const convex = new ConvexHttpClient(convexUrl);

  const slug = artistToSlug(artist);

  // ── Step 1: Check cache ──────────────────────────────────────────────────
  try {
    const cached = await convex.query(api.receipt.getBySlug, { slug });
    if (cached) {
      const receiptData: ReceiptData = JSON.parse(cached.data);
      return Response.json({ receipt: receiptData, fromCache: true });
    }
  } catch (err) {
    console.error("[receipt/generate] Cache lookup failed:", err);
  }

  // ── Step 2: Rate limit ───────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  try {
    const rateResult = await convex.mutation(
      api.receipt.checkAndIncrementRateLimit,
      { ip },
    );
    if (!rateResult.allowed) {
      const retryAfter = Math.ceil((rateResult.retryAfterMs ?? 3600000) / 1000);
      return Response.json(
        {
          error:
            rateResult.reason === "global_limit"
              ? "Daily generation limit reached. Try again tomorrow."
              : "Rate limit exceeded. Try again in an hour.",
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        },
      );
    }
  } catch (err) {
    console.error("[receipt/generate] Rate limit check failed:", err);
    // Non-fatal — allow the request if rate limiting itself fails
  }

  // ── Step 3: Discover with Perplexity Sonar ───────────────────────────────
  const startTime = Date.now();
  let influences: ReceiptInfluence[] = [];

  try {
    const { connections, citations } = await discoverWithPerplexity(
      artist,
      "sonar",
    );

    influences = connections.map((c) => ({
      name: c.name,
      slug: artistToSlug(c.name),
      relationship: c.relationship ?? "influenced by",
      weight:
        typeof c.weight === "number" ? Math.min(1, Math.max(0, c.weight)) : 0.5,
      context: c.context,
      sources: citations
        .slice(0, 2)
        .map((url) => ({ name: sourceNameFromUrl(url), url })),
      subInfluences: [],
    }));
  } catch (err) {
    console.error("[receipt/generate] Perplexity discovery failed:", err);
    // Return unknown tier
    const receiptData: ReceiptData = {
      artist,
      slug,
      tier: "unknown",
      influences: [],
      generatedAt: Date.now(),
    };

    return Response.json({ receipt: receiptData, fromCache: false });
  }

  // ── Step 4: Discover sub-influences for top 3 ────────────────────────────
  const top3 = influences.slice(0, 3);
  try {
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
            weight:
              typeof sc.weight === "number"
                ? Math.min(1, Math.max(0, sc.weight))
                : 0.5,
            context: sc.context,
            sources: result.value.citations
              .slice(0, 1)
              .map((url) => ({ name: sourceNameFromUrl(url), url })),
          })),
        };
      }
    });
  } catch (err) {
    console.error("[receipt/generate] Sub-influence discovery failed:", err);
    // Non-fatal — we still have primary influences
  }

  // Reassemble influences with enriched top 3
  const finalInfluences = [
    ...top3,
    ...influences.slice(3),
  ];

  const tier = getReceiptTier(finalInfluences.length);

  const receiptData: ReceiptData = {
    artist,
    slug,
    tier,
    influences: finalInfluences,
    generatedAt: Date.now(),
  };

  // ── Step 5: Cache to Convex ──────────────────────────────────────────────
  try {
    await convex.mutation(api.receipt.cacheReceipt, {
      slug,
      artist,
      tier,
      data: JSON.stringify(receiptData),
      generatedAt: receiptData.generatedAt,
    });
  } catch (err) {
    console.error("[receipt/generate] Cache write failed:", err);
    // Non-fatal — we still return the data
  }

  const durationMs = Date.now() - startTime;
  console.log(
    `[receipt/generate] Generated receipt for "${artist}" (${tier}) in ${durationMs}ms`,
  );

  return Response.json({ receipt: receiptData, fromCache: false });
}
