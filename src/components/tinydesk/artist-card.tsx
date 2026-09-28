import Link from "next/link";
import { CatalogConcert, GENRE_COLORS } from "./catalog-types";

interface ArtistCardProps {
  concert: CatalogConcert;
  hasCompanion: boolean;
}

export function ArtistCard({ concert, hasCompanion }: ArtistCardProps) {
  const thumbnailUrl = concert.youtubeId
    ? `https://img.youtube.com/vi/${concert.youtubeId}/mqdefault.jpg`
    : null;

  const isHomeConcert = concert.concertType === "Tiny Desk Home Concert";

  const cardContent = (
    <>
      {/* Thumbnail */}
      <div
        className="relative w-full overflow-hidden"
        style={{ paddingTop: "56.25%" }}
      >
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt={`${concert.artist} — NPR Tiny Desk`}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={{ backgroundColor: "#18181b" }}
          >
            <span
              className="font-[family-name:var(--font-bebas)] tracking-wider text-2xl"
              style={{ color: "#27272a" }}
            >
              NPR
            </span>
          </div>
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(9,9,11,0.85) 0%, transparent 60%)",
          }}
        />

        {/* Concert type badge */}
        {isHomeConcert && (
          <span
            className="absolute top-2 right-2 rounded px-2 py-0.5 text-[10px] font-medium tracking-wide"
            style={{ backgroundColor: "#27272a", color: "#a1a1aa" }}
          >
            HOME
          </span>
        )}

        {/* Companion badge */}
        {hasCompanion && (
          <span
            className="absolute top-2 left-2 rounded px-2 py-0.5 text-[10px] font-bold tracking-wide"
            style={{ backgroundColor: "#22c55e", color: "#09090b" }}
          >
            EXPLORE DNA
          </span>
        )}
      </div>

      {/* Card content */}
      <div className="p-4">
        <h3
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-1.5 group-hover:text-cyan-400 transition-colors leading-tight"
          style={{ color: "#f4f4f5", fontSize: "22px" }}
        >
          {concert.artist}
        </h3>

        {/* Genre tags */}
        <div className="flex flex-wrap gap-1 mb-2">
          {concert.genre.map((g) => (
            <span
              key={g}
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: `${GENRE_COLORS[g] ?? "#71717a"}20`,
                color: GENRE_COLORS[g] ?? "#71717a",
              }}
            >
              {g}
            </span>
          ))}
        </div>

        {concert.date && (
          <p style={{ color: "#52525b", fontSize: "11px" }}>
            {new Date(concert.date + "T00:00:00").toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        )}
      </div>
    </>
  );

  const className =
    "group block rounded-xl overflow-hidden transition-all duration-200 hover:-translate-y-1 hover:border-zinc-600";
  const style = {
    backgroundColor: "#18181b",
    border: "1px solid #27272a",
  };

  if (hasCompanion) {
    return (
      <Link href={`/tinydesk/${concert.slug}`} className={className} style={style}>
        {cardContent}
      </Link>
    );
  }

  return (
    <div className="rounded-xl overflow-hidden" style={style}>
      <a
        href={concert.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={{ border: "none" }}
      >
        {cardContent}
      </a>
      <Link
        href={`/w?prompt=${encodeURIComponent(`/influence ${concert.artist}`)}`}
        className="block text-center py-2 text-[11px] font-medium tracking-wide transition-colors hover:text-cyan-300"
        style={{ color: "#22d3ee", borderTop: "1px solid #27272a" }}
      >
        Generate Musical DNA →
      </Link>
    </div>
  );
}
