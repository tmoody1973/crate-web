/**
 * Web-specific Bandcamp tools — extends crate-cli's bandcamp server
 * with the undocumented related_tags API endpoint.
 *
 * Endpoint: POST /api/tag_search/2/related_tags
 * Discovered via robots.txt Allow directive + bandcamp-fetch library.
 */

import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

const RELATED_TAGS_URL = "https://bandcamp.com/api/tag_search/2/related_tags";
const FETCH_TIMEOUT_MS = 10_000;

/** 1.5s rate limit — matches crate-cli's bandcamp rate limit for this undocumented API. */
const MIN_DELAY_MS = 1500;

/** Promise chain ensures sequential rate limiting under concurrent requests. */
let rateLimitChain = Promise.resolve();

async function rateLimit(): Promise<void> {
  const prev = rateLimitChain;
  let resolve!: () => void;
  rateLimitChain = new Promise<void>((r) => {
    resolve = r;
  });
  await prev;
  await new Promise((r) => setTimeout(r, MIN_DELAY_MS));
  resolve();
}

function toolResult(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function toolError(msg: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ error: msg }) }] };
}

interface RelatedTag {
  id: number;
  name: string;
  norm_name: string;
  relation: number;
  isloc: boolean;
}

interface RelatedTagsResponse {
  single_results?: Array<{
    tag: { name: string; norm_name: string };
    related_tags: RelatedTag[];
  }>;
  combo_results?: RelatedTag[];
}

export function createBandcampWebTools(): CrateToolDef[] {
  return [
    {
      name: "get_related_tags",
      description:
        "Get related genre/style tags from Bandcamp for given tags. " +
        "Returns weighted relationships (0-1) showing how closely genres are connected. " +
        "Use for genre exploration, finding sub-genres, and understanding style relationships. " +
        "Example: ['jazz'] returns modern-jazz (0.85), contemporary-jazz (0.79), swing (0.65), etc.",
      inputSchema: {
        tags: z
          .array(z.string().max(100).trim())
          .min(1)
          .max(5)
          .describe("Tag/genre names to find related tags for (e.g., ['jazz', 'funk'])"),
        size: z
          .number()
          .int()
          .min(1)
          .max(50)
          .optional()
          .describe("Number of related tags to return per input tag (default 20)"),
      },
      handler: async (args: { tags: string[]; size?: number }, _extra: unknown) => {
        await rateLimit();

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

        try {
          const res = await fetch(RELATED_TAGS_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": "Crate/1.0 (music-research-agent)",
            },
            body: JSON.stringify({
              tag_names: args.tags,
              combo: true,
              size: args.size ?? 20,
            }),
            signal: controller.signal,
          });

          if (!res.ok) {
            const text = await res.text().catch(() => "");
            return toolError(`Bandcamp API ${res.status}: ${text.slice(0, 200)}`);
          }

          const data = (await res.json()) as RelatedTagsResponse;

          const results = {
            per_tag: (data.single_results ?? []).map((r) => ({
              tag: r.tag.name,
              related: r.related_tags.map((t) => ({
                name: t.name,
                weight: Math.round(t.relation * 1000) / 1000,
                is_location: t.isloc,
              })),
            })),
            ...(data.combo_results && args.tags.length > 1
              ? {
                  combined: data.combo_results.map((t) => ({
                    name: t.name,
                    weight: Math.round(t.relation * 1000) / 1000,
                    is_location: t.isloc,
                  })),
                }
              : {}),
          };

          return toolResult(results);
        } finally {
          clearTimeout(timer);
        }
      },
    },
  ];
}
