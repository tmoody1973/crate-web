"use client";

import { useRef } from "react";
import { GENRE_ORDER, GENRE_COLORS } from "./catalog-types";

interface GenreFilterProps {
  genreCounts: Record<string, number>;
  totalCount: number;
  activeGenre: string | null;
  onGenreChange: (genre: string | null) => void;
}

export function GenreFilter({
  genreCounts,
  totalCount,
  activeGenre,
  onGenreChange,
}: GenreFilterProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const genres = GENRE_ORDER.filter((g) => (genreCounts[g] ?? 0) > 0);

  return (
    <div className="relative">
      {/* Fade edges on mobile */}
      <div
        className="pointer-events-none absolute left-0 top-0 bottom-0 w-6 z-10 md:hidden"
        style={{
          background:
            "linear-gradient(to right, #09090b, transparent)",
        }}
      />
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0 w-6 z-10 md:hidden"
        style={{
          background:
            "linear-gradient(to left, #09090b, transparent)",
        }}
      />

      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto scrollbar-hide px-1 py-1"
        style={{ scrollbarWidth: "none" }}
      >
        {/* All pill */}
        <button
          onClick={() => onGenreChange(null)}
          className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
          style={{
            backgroundColor: activeGenre === null ? "#22d3ee" : "#27272a",
            color: activeGenre === null ? "#09090b" : "#a1a1aa",
          }}
        >
          All ({totalCount})
        </button>

        {genres.map((genre) => {
          const isActive = activeGenre === genre;
          const color = GENRE_COLORS[genre] ?? "#71717a";
          return (
            <button
              key={genre}
              onClick={() => onGenreChange(genre)}
              className="shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors whitespace-nowrap"
              style={{
                backgroundColor: isActive ? color : "#27272a",
                color: isActive ? "#09090b" : "#a1a1aa",
              }}
            >
              {genre} ({genreCounts[genre]})
            </button>
          );
        })}
      </div>
    </div>
  );
}
