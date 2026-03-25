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

export const maxDuration = 30;

// ── Simple in-memory rate limiter (acceptable for MVP) ────────────────────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const RATE_LIMITS: Record<string, number> = {
  free: 10,
  pro: 60,
  team: 60,
};

function checkRateLimit(clerkId: string, plan: string): boolean {
  const limit = RATE_LIMITS[plan] ?? 10;
  const now = Date.now();
  const key = `${clerkId}:${plan}`;
  const entry = rateLimitMap.get(key);

  if (!entry || now >= entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + 3_600_000 });
    return true;
  }

  if (entry.count >= limit) return false;

  rateLimitMap.set(key, { ...entry, count: entry.count + 1 });
  return true;
}

// ── Perplexity helpers ────────────────────────────────────────────────────────

interface PerplexityConnection {
  name: string;
  weight: number;
  relationship: string;
  context?: string;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  sonicElements?: string[];
  keyWorks?: string;
}

async function discoverWithPerplexity(
  artist: string,
  model: "sonar" | "sonar-pro",
): Promise<{ connections: PerplexityConnection[]; citations: string[]; enrichment: Record<string, unknown> | null }> {
  const apiKey = process.env.PERPLEXITY_API_KEY;
  if (!apiKey) throw new Error("PERPLEXITY_API_KEY not configured");

  const systemPrompt =
    "You are a music research assistant. Respond ONLY with valid JSON — no markdown, no extra text.";

  const userPrompt =
    model === "sonar-pro"
      ? `Provide deep context about the musical artist "${artist}":
Return a JSON object with these fields:
{
  "pullQuote": "a memorable quote about ${artist}'s influence or sound (with attribution in pullQuoteAttribution)",
  "pullQuoteAttribution": "who said it / source",
  "sonicElements": ["array", "of", "3-5", "defining", "sonic", "elements"],
  "keyWorks": "2-3 essential albums or tracks that define their influence",
  "context": "2-3 sentence description of their musical significance"
}`
      : `List the top 6-8 musical influence connections for the artist "${artist}".
Return a JSON array where each item has:
{
  "name": "artist name",
  "weight": 0.0-1.0,
  "relationship": "one of: influenced by, influenced, collaboration, similar, sample, inspired by, mentored, shaped",
  "context": "one sentence explaining the connection"
}
Only include well-documented connections. Weight should reflect strength of influence.`;

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      max_tokens: model === "sonar-pro" ? 600 : 1200,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Perplexity ${response.status}: ${text.slice(0, 200)}`);
  }

  const data = await response.json();
  const rawContent: string = data?.choices?.[0]?.message?.content ?? "";
  const citations: string[] = data?.citations ?? [];

  // Strip ```json ... ``` wrapping if present
  const cleaned = rawContent
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    console.error("[influence/expand] Failed to parse Perplexity response:", cleaned.slice(0, 500), err);
    return { connections: [], citations, enrichment: null };
  }
  const connections: PerplexityConnection[] = Array.isArray(parsed) ? parsed : [];
  // For sonar-pro, parsed is a single object with enrichment fields (not an array)
  const enrichment = !Array.isArray(parsed) && typeof parsed === "object" && parsed !== null
    ? parsed as Record<string, unknown>
    : null;

  return { connections, citations, enrichment };
}

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

  // Rate limit check
  if (!checkRateLimit(clerkId, plan)) {
    return Response.json(
      { error: "Rate limit exceeded. Try again in an hour." },
      { status: 429 },
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
        return Response.json({
          connections: mappedConnections,
          fromCache: true,
          enriched: false,
        } satisfies ExpandResponse);
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
    return Response.json({
      connections: cachedResult.connections,
      fromCache: cachedResult.fromCache,
      enriched: false,
    } satisfies ExpandResponse);
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

  return Response.json({
    connections: merged,
    fromCache: cachedResult.fromCache,
    enriched,
  } satisfies ExpandResponse);
}
