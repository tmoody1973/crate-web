"use client";

import { useCallback, useEffect } from "react";
import { CatalogConcert, GENRE_COLORS } from "./catalog-types";

interface SurpriseModalProps {
  concert: CatalogConcert | null;
  hasCompanion: boolean;
  onClose: () => void;
  onTryAnother: () => void;
}

export function SurpriseModal({
  concert,
  hasCompanion,
  onClose,
  onTryAnother,
}: SurpriseModalProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (!concert) return null;

  const thumbnailUrl = concert.youtubeId
    ? `https://img.youtube.com/vi/${concert.youtubeId}/maxresdefault.jpg`
    : null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ backgroundColor: "rgba(0,0,0,0.85)" }}
      />

      {/* Modal content */}
      <div
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-zinc-700"
          style={{ color: "#a1a1aa" }}
        >
          ✕
        </button>

        {/* Thumbnail */}
        {thumbnailUrl && (
          <div className="relative w-full" style={{ paddingTop: "56.25%" }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={thumbnailUrl}
              alt={concert.artist}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(to top, #18181b 0%, transparent 60%)",
              }}
            />
          </div>
        )}

        <div className="p-6 text-center">
          {/* Genre tags */}
          <div className="flex justify-center gap-2 mb-3">
            {concert.genre.map((g) => (
              <span
                key={g}
                className="rounded-full px-3 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: `${GENRE_COLORS[g] ?? "#71717a"}20`,
                  color: GENRE_COLORS[g] ?? "#71717a",
                }}
              >
                {g}
              </span>
            ))}
          </div>

          {/* Artist name */}
          <h2
            className="font-[family-name:var(--font-bebas)] tracking-wide leading-none mb-2"
            style={{ color: "#f4f4f5", fontSize: "clamp(36px,6vw,52px)" }}
          >
            {concert.artist}
          </h2>

          {/* Date */}
          <p className="mb-6" style={{ color: "#71717a", fontSize: "14px" }}>
            {concert.date
              ? new Date(concert.date + "T00:00:00").toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })
              : "Community Submitted"}
            {concert.concertType && ` · ${concert.concertType}`}
          </p>

          {/* Action buttons */}
          <div className="flex flex-col gap-3">
            <a
              href={concert.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-[family-name:var(--font-bebas)] rounded-lg px-6 py-3 tracking-widest text-base transition-opacity hover:opacity-90 text-center"
              style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
            >
              WATCH ON NPR
            </a>

            {hasCompanion ? (
              <a
                href={`/tinydesk/${concert.slug}`}
                className="font-[family-name:var(--font-bebas)] rounded-lg px-6 py-3 tracking-widest text-base transition-opacity hover:opacity-90 text-center"
                style={{ backgroundColor: "#22c55e", color: "#09090b" }}
              >
                EXPLORE MUSICAL DNA
              </a>
            ) : (
              <a
                href={`/w?prompt=${encodeURIComponent(`/influence ${concert.artist}`)}`}
                className="font-[family-name:var(--font-bebas)] rounded-lg px-6 py-3 tracking-widest text-base transition-opacity hover:opacity-90 text-center"
                style={{ backgroundColor: "#22c55e", color: "#09090b" }}
              >
                GENERATE MUSICAL DNA
              </a>
            )}
          </div>

          {/* Try another */}
          <button
            onClick={onTryAnother}
            className="mt-4 text-sm transition-colors hover:text-cyan-400"
            style={{ color: "#71717a" }}
          >
            Try another →
          </button>
        </div>
      </div>
    </div>
  );
}
