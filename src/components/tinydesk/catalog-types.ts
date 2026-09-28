export interface CatalogConcert {
  artist: string;
  slug: string;
  date: string;
  year: number;
  genre: string[];
  concertType: string;
  sourceUrl: string;
  youtubeId: string | null;
}

export const GENRE_COLORS: Record<string, string> = {
  "R&B/Soul": "#f472b6",
  Rock: "#ef4444",
  Latin: "#f59e0b",
  Pop: "#a78bfa",
  "Hip-Hop": "#22d3ee",
  Jazz: "#818cf8",
  Folk: "#a3e635",
  Classical: "#e2e8f0",
  World: "#fb923c",
  "Electronic/Dance": "#34d399",
  Country: "#fbbf24",
  Gospel: "#c084fc",
  Reggae: "#4ade80",
  Blues: "#60a5fa",
  Other: "#71717a",
  "Mixed Format": "#71717a",
};

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
}

export const GENRE_ORDER = [
  "R&B/Soul",
  "Rock",
  "Latin",
  "Pop",
  "Hip-Hop",
  "Jazz",
  "Folk",
  "Classical",
  "World",
  "Electronic/Dance",
  "Country",
  "Gospel",
  "Reggae",
  "Blues",
  "Other",
  "Mixed Format",
] as const;
