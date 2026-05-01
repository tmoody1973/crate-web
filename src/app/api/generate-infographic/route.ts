/**
 * API route for direct infographic generation via Gemini Flash 2.0.
 * POST /api/generate-infographic
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// ── Gemini API config ────────────────────────────────────────────

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent";

const INFOGRAPHIC_PROMPTS: Record<string, (title: string, data: string) => string> = {
  influence_map: (title, data) =>
    `Create a visually striking network visualization showing musical influence connections. Title: ${title}. Data: ${data}. Style: dark background (#1a1a2e), neon connection lines, circular artist nodes with glow effects, weight shown by line thickness.`,

  artist_profile: (title, data) =>
    `Create a rich artist profile infographic card. Title: ${title}. Data: ${data}. Style: dark background, bold typography, genre color accents, key stats highlighted.`,

  timeline: (title, data) =>
    `Create an artistic timeline infographic. Title: ${title}. Data: ${data}. Style: dark background, horizontal flow, album covers as nodes, era-specific color coding.`,

  playlist_cover: (title, data) =>
    `Create a square album-cover-style artwork for a music playlist called "${title}". The playlist contains these tracks: ${data}. Style: moody, textured, abstract — think vinyl record aesthetics meets modern graphic design. Dark background with rich color accents. Include the playlist title "${title}" as bold text integrated into the design. NO photographs of real people. Use abstract shapes, typography, textures, and color to evoke the mood of the music. Aspect ratio: square 1:1.`,
};

// ── Types ────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: { message: string };
}

interface InfographicRequestBody {
  type: string;
  data: string;
  title: string;
}

// ── Validation ───────────────────────────────────────────────────

const VALID_TYPES = new Set(["influence_map", "artist_profile", "timeline", "playlist_cover"]);

function validateBody(
  body: unknown,
): { valid: true; data: InfographicRequestBody } | { valid: false; error: string } {
  if (!body || typeof body !== "object") {
    return { valid: false, error: "Request body must be a JSON object" };
  }

  const { type, data, title } = body as Record<string, unknown>;

  if (typeof type !== "string" || !VALID_TYPES.has(type)) {
    return {
      valid: false,
      error: `Invalid type. Must be one of: ${[...VALID_TYPES].join(", ")}`,
    };
  }

  if (typeof data !== "string" || data.trim().length === 0) {
    return { valid: false, error: "data must be a non-empty string" };
  }

  if (typeof title !== "string" || title.trim().length === 0) {
    return { valid: false, error: "title must be a non-empty string" };
  }

  return { valid: true, data: { type, data, title } };
}

// ── Route handler ────────────────────────────────────────────────

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    return NextResponse.json(
      { error: "Gemini API key not configured" },
      { status: 500 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON in request body" },
      { status: 400 },
    );
  }

  const validation = validateBody(body);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 400 });
  }

  const { type, data, title } = validation.data;

  const promptBuilder = INFOGRAPHIC_PROMPTS[type];
  if (!promptBuilder) {
    return NextResponse.json({ error: "Unknown infographic type" }, { status: 400 });
  }

  const prompt = promptBuilder(title, data);

  try {
    const geminiRes = await fetch(`${GEMINI_API_BASE}?key=${geminiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseModalities: ["TEXT", "IMAGE"],
        },
      }),
    });

    if (!geminiRes.ok) {
      const errorText = await geminiRes.text();
      return NextResponse.json(
        { error: `Gemini API returned ${geminiRes.status}: ${errorText}` },
        { status: 502 },
      );
    }

    const geminiBody = (await geminiRes.json()) as GeminiResponse;

    if (geminiBody.error) {
      return NextResponse.json(
        { error: `Gemini API error: ${geminiBody.error.message}` },
        { status: 502 },
      );
    }

    const parts = geminiBody.candidates?.[0]?.content?.parts;
    if (!parts) {
      return NextResponse.json(
        { error: "No content returned from Gemini" },
        { status: 502 },
      );
    }

    const imagePart = parts.find((p) => p.inline_data?.data);
    if (!imagePart?.inline_data) {
      return NextResponse.json(
        { error: "No image data in Gemini response" },
        { status: 502 },
      );
    }

    const imageDataUrl = `data:${imagePart.inline_data.mime_type};base64,${imagePart.inline_data.data}`;

    return NextResponse.json({
      type,
      title,
      imageDataUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to generate infographic: ${message}` },
      { status: 500 },
    );
  }
}
