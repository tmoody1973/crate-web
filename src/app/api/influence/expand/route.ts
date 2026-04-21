/**
 * POST /api/influence/expand
 *
 * Expands influence connections for an artist node in the graph.
 * 1. Check Convex cache — if >= 3 connections exist, return immediately.
 * 2. Otherwise, call Perplexity sonar to discover connections.
 * 3. Cache discovered edges to Convex.
 * 4. Merge cached + discovered (dedup by lowercase name).
 * 5. Pro tier: batch-enrich top 3 with sonar-pro for deeper context.
 */

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";
import type { Id } from "../../../../../convex/_generated/dataModel";
import type { ExpandResponse } from "@/lib/openui/influence-graph-types";
import { discoverWithPerplexity } from "@/lib/perplexity-discover";
import {
  checkRateLimit,
  rateLimitHeaders,
  retryAfterSeconds,
} from "@/lib/rate-limit";

export const maxDuration = 30;

const RATE_LIMITS: Record<string, number> = {
  free: 10,
  pro: 60,
  team: 60,
};

const ONE_HOUR_MS = 60 * 60 * 1000;

// ── Route handler ─────────────────────────────────────────────────────────────

export async function POST(req: Request): Promise<Response> {
  // Auth
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Parse body
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

  // Convex client
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return Response.json({ error: "Convex not configured" }, { status: 500 });
  }
  const convex = new ConvexHttpClient(convexUrl);

  // Look up Convex user
  const convexUser = await convex.query(api.users.getByClerkId, { clerkId });
  if (!convexUser) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }
  const userId = convexUser._id as Id<"users">;

  // Determine plan from subscription
  let plan: "free" | "pro" | "team" = "free";
  try {
    const sub = await convex.query(api.subscriptions.getByUserId, { userId });
    if (sub?.status === "active" || sub?.status === "past_due") {
      plan = (sub.plan as "free" | "pro" | "team") ?? "free";
    }
  } catch {
    // Default to free if subscription lookup fails
  }

  // Rate limit check (Convex-backed; works across Vercel serverless instances)
  const rateLimit = await checkRateLimit({
    convex,
    userId,
    endpoint: "influence_expand",
    limit: RATE_LIMITS[plan] ?? RATE_LIMITS.free!,
    windowMs: ONE_HOUR_MS,
  });
  if (!rateLimit.allowed) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in an hour.", resetAt: rateLimit.resetAt },
      {
        status: 429,
        headers: {
          ...rateLimitHeaders(rateLimit),
          "Retry-After": String(retryAfterSeconds(rateLimit)),
        },
      },
    );
  }

  // ── Step 1: Check cache ────────────────────────────────────────────────────
  let cachedResult: { connections: ExpandResponse["connections"]; fromCache: boolean } = {
    connections: [],
    fromCache: false,
  };

  try {
    const cached = await convex.query(api.influence.lookupInfluences, {
      userId,
      artist,
      direction: "both",
    });

    if (cached?.connections && cached.connections.length > 0) {
      const mappedConnections: ExpandResponse["connections"] = cached.connections.map((c) => ({
        name: c.artist,
        weight: c.weight,
        relationship: c.relationship,
        context: c.context,
        sources: c.sources
          .filter((s) => s.url)
          .map((s) => ({ name: s.name ?? s.type, url: s.url!, snippet: s.snippet })),
        imageUrl: c.imageUrl,
      }));

      cachedResult = { connections: mappedConnections, fromCache: true };

      // If cache has >= 3 connections, return immediately
      if (mappedConnections.length >= 3) {
        return Response.json(
          {
            connections: mappedConnections,
            fromCache: true,
            enriched: false,
          } satisfies ExpandResponse,
          { headers: rateLimitHeaders(rateLimit) },
        );
      }
    }
  } catch (err) {
    console.error("[influence/expand] Cache lookup failed:", err);
    // Continue to discovery
  }

  // ── Step 2: Discover with Perplexity sonar ────────────────────────────────
  let discoveredConnections: ExpandResponse["connections"] = [];
  let discoveredCitations: string[] = [];

  try {
    const { connections: raw, citations } = await discoverWithPerplexity(artist, "sonar");
    discoveredCitations = citations;
    discoveredConnections = raw.map((c) => ({
      name: c.name,
      weight: typeof c.weight === "number" ? Math.min(1, Math.max(0, c.weight)) : 0.5,
      relationship: c.relationship ?? "influenced by",
      context: c.context,
    }));
  } catch (err) {
    console.error("[influence/expand] Perplexity discovery failed:", err);
    // Fall through — return whatever we have from cache
    return Response.json(
      {
        connections: cachedResult.connections,
        fromCache: cachedResult.fromCache,
        enriched: false,
      } satisfies ExpandResponse,
      { headers: rateLimitHeaders(rateLimit) },
    );
  }

  // ── Step 3: Cache discovered edges to Convex ──────────────────────────────
  if (discoveredConnections.length > 0) {
    const primaryCitationUrl = discoveredCitations[0];
    try {
      await convex.mutation(api.influence.cacheBatchEdges, {
        userId,
        edges: discoveredConnections.map((c) => ({
          fromName: artist,
          toName: c.name,
          relationship: c.relationship,
          weight: c.weight,
          context: c.context,
          source: primaryCitationUrl
            ? {
                sourceType: "web_search",
                sourceUrl: primaryCitationUrl,
                sourceName: "Perplexity Sonar",
              }
            : undefined,
        })),
      });
    } catch (err) {
      console.error("[influence/expand] Batch cache write failed:", err);
      // Non-fatal — we still return the data
    }
  }

  // ── Step 4: Merge cached + discovered (dedup by lowercase name) ───────────
  const seen = new Set<string>(cachedResult.connections.map((c) => c.name.toLowerCase()));
  const merged: ExpandResponse["connections"] = [...cachedResult.connections];

  for (const conn of discoveredConnections) {
    if (!seen.has(conn.name.toLowerCase())) {
      seen.add(conn.name.toLowerCase());
      merged.push({
        ...conn,
        sources: discoveredCitations
          .slice(0, 3)
          .map((url) => ({ name: "Perplexity Sonar", url })),
      });
    }
  }

  // ── Step 5: Pro enrichment — batch enrich top 3 with sonar-pro ───────────
  let enriched = false;
  if (plan === "pro" || plan === "team") {
    const top3 = merged.slice(0, 3);
    try {
      const enrichResults = await Promise.allSettled(
        top3.map((conn) => discoverWithPerplexity(conn.name, "sonar-pro")),
      );

      enrichResults.forEach((result, idx) => {
        if (result.status === "fulfilled" && merged[idx]) {
          const { citations, enrichment } = result.value;
          const existing = merged[idx]!;
          merged[idx] = {
            ...existing,
            // Merge enrichment fields from sonar-pro (pullQuote, sonicElements, keyWorks, context)
            ...(enrichment?.context ? { context: String(enrichment.context) } : {}),
            ...(enrichment?.pullQuote ? { pullQuote: String(enrichment.pullQuote) } : {}),
            ...(enrichment?.pullQuoteAttribution ? { pullQuoteAttribution: String(enrichment.pullQuoteAttribution) } : {}),
            ...(Array.isArray(enrichment?.sonicElements) ? { sonicElements: enrichment.sonicElements as string[] } : {}),
            ...(enrichment?.keyWorks ? { keyWorks: String(enrichment.keyWorks) } : {}),
            sources: [
              ...(existing.sources ?? []),
              ...citations.slice(0, 2).map((url) => ({ name: "Perplexity Sonar Pro", url })),
            ],
          };
          enriched = true;
        }
      });
    } catch (err) {
      console.error("[influence/expand] Pro enrichment failed:", err);
      // Non-fatal
    }
  }

  return Response.json(
    {
      connections: merged,
      fromCache: cachedResult.fromCache,
      enriched,
    } satisfies ExpandResponse,
    { headers: rateLimitHeaders(rateLimit) },
  );
}
