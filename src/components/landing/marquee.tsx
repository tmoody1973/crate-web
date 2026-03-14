const SOURCES = [
  "DISCOGS",
  "MUSICBRAINZ",
  "LAST.FM",
  "GENIUS",
  "BANDCAMP",
  "SPOTIFY",
  "WIKIPEDIA",
  "TICKETMASTER",
  "YOUTUBE",
  "SETLIST.FM",
  "PITCHFORK",
  "ALLMUSIC",
  "RATE YOUR MUSIC",
  "FANART.TV",
  "ITUNES",
  "26 PUBLICATIONS",
] as const;

function MarqueeItems() {
  return (
    <>
      {SOURCES.map((source, i) => (
        <span key={i} className="flex shrink-0 items-center gap-4">
          <span
            className="font-[family-name:var(--font-bebas)] text-[12px] tracking-[3px]"
            style={{ color: "#E8520E" }}
          >
            {source}
          </span>
          <span
            className="text-[8px]"
            style={{ color: "rgba(245,240,232,0.15)" }}
            aria-hidden="true"
          >
            •
          </span>
        </span>
      ))}
    </>
  );
}

export function Marquee() {
  return (
    <div
      className="overflow-hidden py-2"
      style={{
        backgroundColor: "#0A1628",
        borderTop: "1px solid rgba(245,240,232,0.06)",
      }}
      aria-hidden="true"
    >
      <div
        className="flex gap-4 whitespace-nowrap"
        style={{ animation: "marquee-scroll 30s linear infinite" }}
      >
        <MarqueeItems />
        <MarqueeItems />
      </div>
    </div>
  );
}
