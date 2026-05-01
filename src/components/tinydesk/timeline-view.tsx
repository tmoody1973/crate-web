"use client";

import { CatalogConcert, GENRE_COLORS } from "./catalog-types";
import { ArtistCard } from "./artist-card";

interface TimelineViewProps {
  concerts: CatalogConcert[];
  companionSlugs: Set<string>;
}

export function TimelineView({ concerts, companionSlugs }: TimelineViewProps) {
  // Group by year, sorted descending (filter out year=0 community submissions)
  const byYear = new Map<number, CatalogConcert[]>();
  const communityEntries: CatalogConcert[] = [];
  for (const c of concerts) {
    if (!c.year) {
      communityEntries.push(c);
    } else {
      const list = byYear.get(c.year) ?? [];
      list.push(c);
      byYear.set(c.year, list);
    }
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  if (concerts.length === 0) {
    return (
      <p className="text-center py-12" style={{ color: "#52525b" }}>
        No concerts match this filter.
      </p>
    );
  }

  return (
    <div className="relative">
      {/* Vertical timeline line */}
      <div
        className="absolute left-4 md:left-6 top-0 bottom-0 w-px"
        style={{ backgroundColor: "#27272a" }}
      />

      {years.map((year) => {
        const yearConcerts = byYear.get(year) ?? [];
        return (
          <div key={year} className="relative mb-12">
            {/* Year marker */}
            <div className="flex items-center gap-4 mb-6 relative">
              <div
                className="shrink-0 w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center z-10 font-[family-name:var(--font-bebas)] tracking-wider"
                style={{
                  backgroundColor: "#22d3ee",
                  color: "#09090b",
                  fontSize: "16px",
                }}
              >
                {year}
              </div>
              <span
                className="text-sm font-medium"
                style={{ color: "#71717a" }}
              >
                {yearConcerts.length} concert{yearConcerts.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Concerts for this year */}
            <div className="pl-12 md:pl-20 space-y-4">
              {yearConcerts.map((concert) => (
                <div
                  key={`${concert.slug}-${concert.date}`}
                  className="relative flex items-start gap-3"
                >
                  {/* Genre dot on timeline */}
                  <div
                    className="absolute -left-[calc(3rem-4px)] md:-left-[calc(5rem-4px)] top-4 w-2 h-2 rounded-full z-10"
                    style={{
                      backgroundColor:
                        GENRE_COLORS[concert.genre[0]] ?? "#71717a",
                    }}
                  />
                  <div className="flex-1 max-w-md">
                    <ArtistCard
                      concert={concert}
                      hasCompanion={companionSlugs.has(concert.slug)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* Community-submitted entries (no year) */}
      {communityEntries.length > 0 && (
        <div className="relative mb-12">
          <div className="flex items-center gap-4 mb-6 relative">
            <div
              className="shrink-0 w-8 h-8 md:w-12 md:h-12 rounded-full flex items-center justify-center z-10 text-[10px] font-medium"
              style={{ backgroundColor: "#22c55e", color: "#09090b" }}
            >
              +
            </div>
            <span className="text-sm font-medium" style={{ color: "#71717a" }}>
              {communityEntries.length} community-generated
            </span>
          </div>
          <div className="pl-12 md:pl-20 space-y-4">
            {communityEntries.map((concert) => (
              <div key={concert.slug} className="relative flex items-start gap-3">
                <div
                  className="absolute -left-[calc(3rem-4px)] md:-left-[calc(5rem-4px)] top-4 w-2 h-2 rounded-full z-10"
                  style={{ backgroundColor: GENRE_COLORS[concert.genre[0]] ?? "#71717a" }}
                />
                <div className="flex-1 max-w-md">
                  <ArtistCard concert={concert} hasCompanion={companionSlugs.has(concert.slug)} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
