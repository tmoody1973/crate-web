"use client";

import { CatalogConcert } from "./catalog-types";
import { ArtistCard } from "./artist-card";

interface ArtistGridProps {
  concerts: CatalogConcert[];
  companionSlugs: Set<string>;
}

export function ArtistGrid({ concerts, companionSlugs }: ArtistGridProps) {
  if (concerts.length === 0) {
    return (
      <p className="text-center py-12" style={{ color: "#52525b" }}>
        No concerts match this filter.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {concerts.map((concert) => (
        <ArtistCard
          key={`${concert.slug}-${concert.date}`}
          concert={concert}
          hasCompanion={companionSlugs.has(concert.slug)}
        />
      ))}
    </div>
  );
}
