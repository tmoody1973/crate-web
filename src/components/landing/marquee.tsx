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
            style={{ color: "var(--orange)" }}
          >
            {source}
          </span>
          <span
            className="font-[family-name:var(--font-bebas)] text-[12px]"
            style={{ color: "var(--orange)" }}
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
      className="overflow-hidden border-t py-4"
      style={{
        backgroundColor: "var(--midnight)",
        borderColor: "rgba(245,240,232,0.1)",
      }}
      aria-hidden="true"
    >
      <div
        className="marquee-track flex gap-4 whitespace-nowrap"
        style={{ animation: "marquee-scroll 30s linear infinite" }}
      >
        {/* First copy */}
        <MarqueeItems />
        {/* Duplicate for seamless loop */}
        <MarqueeItems />
      </div>
    </div>
  );
}
