"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import type { CatalogConcert } from "@/components/tinydesk/catalog-types";
import { GENRE_COLORS } from "@/components/tinydesk/catalog-types";

interface TinyDeskPickerProps {
  onSelect: (artist: string) => void;
  onCancel: () => void;
}

export function TinyDeskPicker({ onSelect, onCancel }: TinyDeskPickerProps) {
  const [catalog, setCatalog] = useState<CatalogConcert[]>([]);
  const [search, setSearch] = useState("");
  const [activeGenre, setActiveGenre] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/tinydesk/catalog.json")
      .then((r) => r.json())
      .then((data) => { setCatalog(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { searchRef.current?.focus(); }, []);

  const genres = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of catalog) {
      for (const g of c.genre) counts[g] = (counts[g] ?? 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [catalog]);

  const filtered = useMemo(() => {
    let result = catalog;
    if (activeGenre) result = result.filter((c) => c.genre.includes(activeGenre));
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.artist.toLowerCase().includes(q));
    }
    return result;
  }, [catalog, search, activeGenre]);

  const handleSurprise = () => {
    const pool = filtered.length > 0 ? filtered : catalog;
    if (pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    onSelect(pick.artist);
  };

  return (
    <div className="border-t border-zinc-800 px-3 py-3 md:px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-white">Tiny Desk DNA</span>
          <span className="text-[10px] text-zinc-500">{catalog.length} concerts</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSurprise}
            className="rounded px-2.5 py-1 text-[11px] font-medium transition-colors"
            style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
          >
            🎲 Surprise
          </button>
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-300">✕</button>
        </div>
      </div>

      {/* Search */}
      <input
        ref={searchRef}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search artists..."
        className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none mb-3"
      />

      {/* Genre pills */}
      <div className="flex gap-1.5 overflow-x-auto mb-3 pb-1" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => setActiveGenre(null)}
          className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors"
          style={{
            backgroundColor: activeGenre === null ? "#22d3ee" : "#27272a",
            color: activeGenre === null ? "#09090b" : "#71717a",
          }}
        >
          All
        </button>
        {genres.map(([genre, count]) => (
          <button
            key={genre}
            onClick={() => setActiveGenre(activeGenre === genre ? null : genre)}
            className="shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium transition-colors whitespace-nowrap"
            style={{
              backgroundColor: activeGenre === genre ? (GENRE_COLORS[genre] ?? "#71717a") : "#27272a",
              color: activeGenre === genre ? "#09090b" : "#71717a",
            }}
          >
            {genre} ({count})
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="max-h-48 overflow-y-auto space-y-1" style={{ scrollbarWidth: "thin" }}>
        {loading ? (
          <p className="text-xs text-zinc-500 text-center py-4">Loading catalog...</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-zinc-500 text-center py-4">No matches</p>
        ) : (
          filtered.map((c) => (
            <button
              key={`${c.slug}-${c.year}`}
              onClick={() => onSelect(c.artist)}
              className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-zinc-800"
            >
              {c.youtubeId ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://img.youtube.com/vi/${c.youtubeId}/default.jpg`}
                  alt=""
                  className="h-8 w-12 rounded object-cover shrink-0"
                />
              ) : (
                <div className="h-8 w-12 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                  <span className="text-[8px] text-zinc-600">NPR</span>
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm text-white truncate">{c.artist}</p>
                <div className="flex items-center gap-1.5">
                  {c.genre.slice(0, 2).map((g) => (
                    <span
                      key={g}
                      className="text-[9px]"
                      style={{ color: GENRE_COLORS[g] ?? "#71717a" }}
                    >
                      {g}
                    </span>
                  ))}
                  <span className="text-[9px] text-zinc-600">{c.year}</span>
                </div>
              </div>
              <span className="text-[10px] text-cyan-500 shrink-0">Generate DNA →</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
