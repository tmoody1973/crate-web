import { SectionDivider } from "../landing/section-divider";

const sources = [
  {
    name: "DISCOGS",
    type: "Releases & Credits",
    detail: "Full discographies, producer credits, label info, release dates, vinyl pressings",
  },
  {
    name: "MUSICBRAINZ",
    type: "Metadata & IDs",
    detail: "Canonical artist/album IDs, recording relationships, work credits, ISRCs",
  },
  {
    name: "LAST.FM",
    type: "Tags & Similarity",
    detail: "User-generated tags, similar artists, listening stats, genre classifications",
  },
  {
    name: "GENIUS",
    type: "Lyrics & Annotations",
    detail: "Song lyrics, community annotations, artist bios, song stories",
  },
  {
    name: "BANDCAMP",
    type: "Independent Music",
    detail: "Independent releases, artist pages, genre tags, direct-to-artist catalogs",
  },
  {
    name: "SPOTIFY",
    type: "Artwork & Audio",
    detail: "Album artwork (640x640), artist images, audio features, popularity data",
  },
  {
    name: "WIKIPEDIA",
    type: "Artist Bios",
    detail: "Artist biographies, career timelines, discography summaries, cultural context",
  },
  {
    name: "TICKETMASTER",
    type: "Live Events",
    detail: "Concert listings, venue info, tour dates, ticket availability",
  },
  {
    name: "YOUTUBE",
    type: "Video & Audio",
    detail: "Music videos, live performances, interviews, in-app playback",
  },
  {
    name: "SETLIST.FM",
    type: "Concert Setlists",
    detail: "Historical setlists, tour data, venue history, song frequency",
  },
  {
    name: "PITCHFORK",
    type: "Reviews",
    detail: "Album reviews, ratings, Best New Music, artist features",
  },
  {
    name: "ALLMUSIC",
    type: "Guides & Reviews",
    detail: "Expert reviews, style guides, mood classifications, similar albums",
  },
  {
    name: "RATE YOUR MUSIC",
    type: "Community Reviews",
    detail: "Community ratings, genre charts, descriptors, user lists",
  },
  {
    name: "FANART.TV",
    type: "HD Artist Images",
    detail: "High-res artist backgrounds, logos, album covers, CD art",
  },
  {
    name: "ITUNES",
    type: "Album Artwork",
    detail: "Album artwork (600x600), track previews, release metadata",
  },
  {
    name: "26 PUBLICATIONS",
    type: "Review Co-Mentions",
    detail:
      "Cross-referenced artist mentions across Pitchfork, NME, Rolling Stone, Stereogum, and 22 more music publications for influence mapping",
  },
];

export function DataSources() {
  return (
    <section
      id="sources"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="05" label="DATA SOURCES" dark />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#F5F0E8" }}
      >
        <span style={{ color: "#E8520E" }}>19+</span> SOURCES
        <br />
        EXPLAINED
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        Every query can tap into any combination of these sources. The agent
        decides which to use based on your question.
      </p>

      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1 max-md:gap-3">
        {sources.map((s) => (
          <div
            key={s.name}
            className="border p-5 transition-colors hover:border-[#E8520E]"
            style={{ borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3
                className="font-[family-name:var(--font-bebas)] text-[18px] tracking-[2px]"
                style={{ color: "#F5F0E8" }}
              >
                {s.name}
              </h3>
              <span
                className="font-[family-name:var(--font-space)] text-[11px] uppercase tracking-[1px]"
                style={{ color: "#E8520E" }}
              >
                {s.type}
              </span>
            </div>
            <p
              className="font-[family-name:var(--font-space)] text-[13px] leading-relaxed"
              style={{ color: "#7a8a9a" }}
            >
              {s.detail}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
