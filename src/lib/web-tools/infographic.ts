/**
 * Web-specific infographic generation tool handlers.
 * Uses Gemini Flash 2.0 for AI-powered image generation of influence maps,
 * artist profiles, and timeline visualizations.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

// ── Gemini API config ────────────────────────────────────────────

const GEMINI_API_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent";

// ── Prompt builders ──────────────────────────────────────────────

const INFOGRAPHIC_PROMPTS: Record<string, (title: string, data: string) => string> = {
  influence_map: (title, data) =>
    `Create a visually striking network visualization showing musical influence connections. Title: ${title}. Data: ${data}. Style: dark background (#1a1a2e), neon connection lines, circular artist nodes with glow effects, weight shown by line thickness.`,

  artist_profile: (title, data) =>
    `Create a rich artist profile infographic card. Title: ${title}. Data: ${data}. Style: dark background, bold typography, genre color accents, key stats highlighted.`,

  timeline: (title, data) =>
    `Create an artistic timeline infographic. Title: ${title}. Data: ${data}. Style: dark background, horizontal flow, album covers as nodes, era-specific color coding.`,
};

function buildPrompt(type: string, title: string, data: string): string {
  const builder = INFOGRAPHIC_PROMPTS[type];
  if (!builder) {
    throw new Error(`Unknown infographic type: ${type}`);
  }
  return builder(title, data);
}

// ── Gemini API caller ────────────────────────────────────────────

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

async function callGeminiImageGeneration(
  apiKey: string,
  prompt: string,
): Promise<{ base64: string; mimeType: string } | { error: string }> {
  const url = `${GEMINI_API_BASE}?key=${apiKey}`;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["TEXT", "IMAGE"],
      },
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    return { error: `Gemini API returned ${res.status}: ${errorText}` };
  }

  const body = (await res.json()) as GeminiResponse;

  if (body.error) {
    return { error: `Gemini API error: ${body.error.message}` };
  }

  const parts = body.candidates?.[0]?.content?.parts;
  if (!parts) {
    return { error: "No content returned from Gemini" };
  }

  const imagePart = parts.find((p) => p.inline_data?.data);
  if (!imagePart?.inline_data) {
    return { error: "No image data in Gemini response" };
  }

  return {
    base64: imagePart.inline_data.data,
    mimeType: imagePart.inline_data.mime_type,
  };
}

// ── Tool result helpers ──────────────────────────────────────────

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);
  return {
    content: [{ type: "text" as const, text: JSON.stringify({ error: message }) }],
  };
}

// ── Handlers ─────────────────────────────────────────────────────

export function createInfographicTools(
  geminiApiKey: string,
  _convexUrl: string,
  _userId: string,
): CrateToolDef[] {
  const generateInfographicHandler = async (args: {
    type: string;
    data: string;
    title: string;
  }) => {
    try {
      const prompt = buildPrompt(args.type, args.title, args.data);

      const result = await callGeminiImageGeneration(geminiApiKey, prompt);

      if ("error" in result) {
        return toolResult({
          error: result.error,
          type: args.type,
          title: args.title,
        });
      }

      const imageDataUrl = `data:${result.mimeType};base64,${result.base64}`;

      return toolResult({
        type: args.type,
        title: args.title,
        imageDataUrl,
      });
    } catch (error) {
      return toolError(error);
    }
  };

  return [
    {
      name: "generate_infographic",
      description:
        "Generate a visual infographic using AI. Supports influence maps (network graphs of musical connections), artist profiles (stat cards), and timelines (chronological visualizations). Returns a base64 data URL of the generated image.",
      inputSchema: {
        type: z
          .enum(["influence_map", "artist_profile", "timeline"])
          .describe("Type of infographic to generate"),
        data: z
          .string()
          .describe("JSON data to visualize"),
        title: z
          .string()
          .describe("Infographic title"),
      },
      handler: generateInfographicHandler,
    },
  ];
}
