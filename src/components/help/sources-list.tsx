const SOURCES = [
  { name: "Discogs", data: "Releases, labels, credits, cover art", key: "Embedded (free)" },
  { name: "MusicBrainz", data: "Artist metadata, relationships, recordings", key: "No key needed" },
  { name: "Last.fm", data: "Similar artists, tags, listening stats", key: "Embedded (free)" },
  { name: "Genius", data: "Lyrics, annotations, song metadata", key: "User key" },
  { name: "Bandcamp", data: "Album search, tag exploration, related tags", key: "No key needed" },
  { name: "WhoSampled", data: "Sample origins, covers, remixes", key: "Embedded (Kernel)" },
  { name: "Wikipedia", data: "Artist bios, discography context", key: "No key needed" },
  { name: "Ticketmaster", data: "Concert listings, ticket availability", key: "Embedded (free)" },
  { name: "Spotify", data: "Album/artist artwork (640x640)", key: "User key" },
  { name: "fanart.tv", data: "HD artist backgrounds, logos, album covers", key: "User key" },
  { name: "iTunes", data: "Album artwork (600x600), track search", key: "No key needed" },
  { name: "AllMusic", data: "Reviews, ratings, style classifications", key: "No key needed" },
  { name: "Pitchfork", data: "Reviews (via 26-publication search)", key: "No key needed" },
  { name: "Rate Your Music", data: "Community ratings and lists", key: "No key needed" },
  { name: "Setlist.fm", data: "Live setlist history", key: "No key needed" },
  { name: "YouTube", data: "Music videos, live performances", key: "Embedded" },
  { name: "Exa.ai", data: "Semantic web search", key: "User key" },
  { name: "Tavily", data: "AI-optimized web search", key: "User key" },
  { name: "Mem0", data: "Cross-session user memory", key: "User key" },
];

function keyBadgeColor(key: string): string {
  if (key.startsWith("No key")) return "#22c55e";
  if (key.startsWith("Embedded")) return "#3b82f6";
  return "#f59e0b";
}

export function SourcesList() {
  return (
    <section id="sources" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        DATA SOURCES
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        The agent queries these 19 sources during research. Most work without any setup.
      </p>

      <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
        {SOURCES.map((s) => (
          <div
            key={s.name}
            className="rounded-lg border p-4"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-[15px] font-semibold" style={{ color: "#F5F0E8" }}>
                {s.name}
              </h3>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase"
                style={{ backgroundColor: keyBadgeColor(s.key), color: "#0A1628" }}
              >
                {s.key}
              </span>
            </div>
            <p className="text-[13px]" style={{ color: "#7a8a9a" }}>
              {s.data}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
