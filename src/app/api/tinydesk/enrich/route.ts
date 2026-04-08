import { NextRequest, NextResponse } from "next/server";
import catalogData from "../../../../../public/tinydesk/catalog.json";
import { toSlug } from "@/components/tinydesk/catalog-types";
import { resolveYoutubeId, resolveGenre } from "@/lib/tinydesk-enrichment";

interface CatalogEntry {
  artist: string;
  slug: string;
  genre: string[];
  youtubeId: string | null;
}

/**
 * POST /api/tinydesk/enrich
 * Body: { artist: string }
 * Returns: { youtubeId: string | null, genre: string[] }
 *
 * Resolves YouTube video ID and genre for the main artist.
 * Connection video resolution is handled by /api/tinydesk/save.
 */
export async function POST(req: NextRequest) {
  const { artist } = (await req.json()) as { artist: string };
  if (!artist) {
    return NextResponse.json({ error: "artist required" }, { status: 400 });
  }

  const catalog = catalogData as CatalogEntry[];
  const slug = toSlug(artist);
  const catalogEntry = catalog.find((c) => c.slug === slug);

  const [youtubeId, genre] = await Promise.all([
    catalogEntry?.youtubeId
      ? Promise.resolve(catalogEntry.youtubeId)
      : resolveYoutubeId(`${artist} tiny desk concert NPR`),
    (catalogEntry?.genre?.length ?? 0) > 0
      ? Promise.resolve(catalogEntry!.genre)
      : resolveGenre(artist),
  ]);

  return NextResponse.json({ youtubeId, genre });
}
