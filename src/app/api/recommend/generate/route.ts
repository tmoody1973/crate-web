/**
 * POST /api/recommend/generate
 *
 * Thin Vercel proxy for the /recommend Convex action per v1-scope.md Issue 1.1
 * architecture lock. Auth + validation + call the Convex action + return
 * { tourId, slug } so the client can navigate to a loading page and
 * subscribe to tourStatus for real-time phase updates.
 *
 * All heavy lifting (classify → embed → Perplexity → verify → arc →
 * moderate → persist) happens inside the Convex action. This route is
 * purely an auth + plumbing boundary.
 */

import { auth } from "@clerk/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../../convex/_generated/api";

export const maxDuration = 60; // Convex action returns fast (schedules the heavy work)

type GenerateResponse =
  | { ok: true; tourId: string; slug: string }
  | { ok: false; error: string; resetAt?: number };

export async function POST(req: Request): Promise<Response> {
  // ── Auth ─────────────────────────────────────────────────────────────────
  const { userId: clerkId, getToken } = await auth();
  if (!clerkId) {
    return Response.json(
      { ok: false, error: "Unauthorized" } satisfies GenerateResponse,
      { status: 401 },
    );
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let body: { prompt?: string };
  try {
    body = (await req.json()) as { prompt?: string };
  } catch {
    return Response.json(
      { ok: false, error: "Invalid JSON body" } satisfies GenerateResponse,
      { status: 400 },
    );
  }

  const prompt = typeof body?.prompt === "string" ? body.prompt : "";
  if (prompt.trim().length === 0) {
    return Response.json(
      { ok: false, error: "Prompt is required" } satisfies GenerateResponse,
      { status: 400 },
    );
  }

  // ── Convex client with Clerk JWT ─────────────────────────────────────────
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    return Response.json(
      { ok: false, error: "Convex not configured" } satisfies GenerateResponse,
      { status: 500 },
    );
  }

  // The Convex `convex` template must be configured in Clerk — see
  // convex/auth.config.ts. The JWT lets the Convex action's
  // ctx.auth.getUserIdentity() return identity.subject = clerkId.
  const token = await getToken({ template: "convex" });
  if (!token) {
    return Response.json(
      { ok: false, error: "Unauthorized" } satisfies GenerateResponse,
      { status: 401 },
    );
  }

  const convex = new ConvexHttpClient(convexUrl);
  convex.setAuth(token);

  // ── Call the Convex action ───────────────────────────────────────────────
  try {
    const result = await convex.action(api.recommend.index.generateTour, {
      prompt,
    });
    return Response.json(
      {
        ok: true,
        tourId: result.tourId,
        slug: result.slug,
      } satisfies GenerateResponse,
      { status: 200 },
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";

    // Map specific errors to specific HTTP codes
    if (/Daily tour limit reached/i.test(message)) {
      return Response.json(
        { ok: false, error: message } satisfies GenerateResponse,
        { status: 429 },
      );
    }
    if (/User not found/i.test(message)) {
      return Response.json(
        { ok: false, error: message } satisfies GenerateResponse,
        { status: 404 },
      );
    }
    if (/Not authenticated/i.test(message)) {
      return Response.json(
        { ok: false, error: "Unauthorized" } satisfies GenerateResponse,
        { status: 401 },
      );
    }

    console.error("[api/recommend/generate] Action call failed:", e);
    return Response.json(
      { ok: false, error: "We couldn't start your tour. Try again." } satisfies GenerateResponse,
      { status: 500 },
    );
  }
}
