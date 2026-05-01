import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { CrateToolDef } from "../tool-adapter";
import { z } from "zod";

function toolResult(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

export function createTinyDeskTools(
  convexUrl: string,
  userId: Id<"users">,
): CrateToolDef[] {
  const convex = new ConvexHttpClient(convexUrl);

  return [
    {
      name: "save_tinydesk_companion",
      description:
        "Save an influence chain as a public Tiny Desk Companion page at digcrate.app/tinydesk/[slug]. Pass the artist name, tagline, Tiny Desk YouTube video ID, and the influence nodes as a JSON string array. Each node needs: name, role, era, connection, strength, source, sourceUrl, videoId, videoTitle. Optional: sourceQuote, sonicDna (string array), keyWorks (array of {title, year}). The slug is auto-generated from the artist name. IMPORTANT: Before calling, confirm with the user: 'Create a Tiny Desk Companion page for [artist]? This will be publicly visible at digcrate.app/tinydesk/[slug].' Wait for confirmation.",
      inputSchema: {
        artist: z.string().describe("Artist name"),
        tagline: z.string().max(300).describe("One-line tagline for the influence journey"),
        tinyDeskVideoId: z.string().describe("YouTube video ID of the artist's Tiny Desk Concert"),
        nodes: z.string().describe("JSON string of influence nodes array"),
      },
      handler: async (args: {
        artist: string;
        tagline: string;
        tinyDeskVideoId: string;
        nodes: string;
      }) => {
        try {
          const parsed = JSON.parse(args.nodes);
          if (!Array.isArray(parsed) || parsed.length === 0) {
            return toolResult({ error: "nodes must be a non-empty JSON array" });
          }

          const slug = args.artist
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "");

          const id = await convex.mutation(api.tinydeskCompanions.create, {
            slug,
            artist: args.artist,
            tagline: args.tagline,
            tinyDeskVideoId: args.tinyDeskVideoId,
            nodes: args.nodes,
            userId,
          });

          const url = `https://digcrate.app/tinydesk/${slug}`;

          return toolResult({
            status: "published",
            url,
            slug,
            artist: args.artist,
            nodeCount: parsed.length,
            id,
            message: `Tiny Desk Companion for ${args.artist} is live at ${url}`,
          });
        } catch (err) {
          return toolResult({
            error: err instanceof Error ? err.message : "Failed to save companion",
          });
        }
      },
    },
  ];
}
