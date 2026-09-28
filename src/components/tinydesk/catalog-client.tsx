"use client";

import { useState, useMemo, useCallback } from "react";
import { CatalogConcert } from "./catalog-types";
import { GenreFilter } from "./genre-filter";
import { ArtistGrid } from "./artist-grid";
import { TimelineView } from "./timeline-view";
import { SurpriseModal } from "./surprise-modal";

type ViewMode = "grid" | "timeline";

interface CatalogClientProps {
  concerts: CatalogConcert[];
  companionSlugs: string[];
}

export function CatalogClient({
  concerts,
  companionSlugs,
}: CatalogClientProps) {
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [dnaOnly, setDnaOnly] = useState(false);
  const [surpriseConcert, setSurpriseConcert] =
    useState<CatalogConcert | null>(null);

  const companionSet = useMemo(
    () => new Set(companionSlugs),
    [companionSlugs],
  );

  const genreCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of concerts) {
      for (const g of c.genre) {
        counts[g] = (counts[g] ?? 0) + 1;
      }
    }
    return counts;
  }, [concerts]);

  const filtered = useMemo(() => {
    let result = concerts;
    if (activeGenre) {
      result = result.filter((c) => c.genre.includes(activeGenre));
    }
    if (dnaOnly) {
      result = result.filter((c) => companionSet.has(c.slug));
    }
    // Sort DNA-ready artists to the top
    return [...result].sort((a, b) => {
      const aHas = companionSet.has(a.slug) ? 0 : 1;
      const bHas = companionSet.has(b.slug) ? 0 : 1;
      return aHas - bHas;
    });
  }, [concerts, activeGenre, dnaOnly, companionSet]);

  const pickRandom = useCallback(() => {
    const pool = activeGenre ? filtered : concerts;
    const idx = Math.floor(Math.random() * pool.length);
    setSurpriseConcert(pool[idx]);
  }, [concerts, filtered, activeGenre]);

  return (
    <>
      {/* Controls bar — sticky below header */}
      <div
        className="sticky z-40 flex flex-col gap-3 mb-8 -mx-6 px-6 py-4"
        style={{ top: "65px", backgroundColor: "#09090b", borderBottom: "1px solid #1e1e1e" }}
      >
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Surprise Me */}
            <button
              onClick={pickRandom}
              className="font-[family-name:var(--font-bebas)] shrink-0 rounded-lg px-5 py-2.5 tracking-widest text-sm transition-all hover:scale-105"
              style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
            >
              🎲 SURPRISE ME
            </button>

            {/* DNA Ready toggle */}
            {companionSlugs.length > 0 && (
              <button
                onClick={() => setDnaOnly((prev) => !prev)}
                className="shrink-0 rounded-lg px-4 py-2 text-xs font-medium transition-colors flex items-center gap-1.5"
                style={{
                  backgroundColor: dnaOnly ? "#22c55e" : "#27272a",
                  color: dnaOnly ? "#09090b" : "#a1a1aa",
                  border: dnaOnly ? "1px solid #22c55e" : "1px solid #27272a",
                }}
              >
                <span style={{ fontSize: "8px" }}>●</span>
                DNA Ready ({companionSlugs.length})
              </button>
            )}
          </div>

          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid #27272a" }}>
            <button
              onClick={() => setViewMode("grid")}
              className="px-4 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: viewMode === "grid" ? "#27272a" : "transparent",
                color: viewMode === "grid" ? "#f4f4f5" : "#71717a",
              }}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("timeline")}
              className="px-4 py-2 text-xs font-medium transition-colors"
              style={{
                backgroundColor: viewMode === "timeline" ? "#27272a" : "transparent",
                color: viewMode === "timeline" ? "#f4f4f5" : "#71717a",
              }}
            >
              Timeline
            </button>
          </div>
        </div>

        {/* Genre filter */}
        <GenreFilter
          genreCounts={genreCounts}
          totalCount={concerts.length}
          activeGenre={activeGenre}
          onGenreChange={setActiveGenre}
        />

        {/* Results count */}
        <p style={{ color: "#52525b", fontSize: "13px" }}>
          {filtered.length} concert{filtered.length !== 1 ? "s" : ""}
          {activeGenre ? ` in ${activeGenre}` : ""}
        </p>
      </div>

      {/* Content */}
      {viewMode === "grid" ? (
        <ArtistGrid concerts={filtered} companionSlugs={companionSet} />
      ) : (
        <TimelineView concerts={filtered} companionSlugs={companionSet} />
      )}

      {/* Surprise modal */}
      {surpriseConcert && (
        <SurpriseModal
          concert={surpriseConcert}
          hasCompanion={companionSet.has(surpriseConcert.slug)}
          onClose={() => setSurpriseConcert(null)}
          onTryAnother={pickRandom}
        />
      )}
    </>
  );
}
