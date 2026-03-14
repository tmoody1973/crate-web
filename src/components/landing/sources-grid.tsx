import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const sources = [
  { name: "DISCOGS", type: "Releases & Credits", highlight: true },
  { name: "MUSICBRAINZ", type: "Metadata & IDs", highlight: false },
  { name: "LAST.FM", type: "Tags & Similarity", highlight: true },
  { name: "GENIUS", type: "Lyrics & Annotations", highlight: false },
  { name: "BANDCAMP", type: "Independent Music", highlight: false },
  { name: "SPOTIFY", type: "Artwork & Audio", highlight: true },
  { name: "WIKIPEDIA", type: "Artist Bios", highlight: false },
  { name: "TICKETMASTER", type: "Live Events", highlight: false },
  { name: "YOUTUBE", type: "Video & Audio", highlight: true },
  { name: "SETLIST.FM", type: "Concert Setlists", highlight: false },
  { name: "PITCHFORK", type: "Reviews", highlight: false },
  { name: "ALLMUSIC", type: "Guides & Reviews", highlight: false },
  { name: "RATE YOUR MUSIC", type: "Community Reviews", highlight: false },
  { name: "FANART.TV", type: "HD Artist Images", highlight: false },
  { name: "ITUNES", type: "Album Artwork", highlight: false },
  { name: "26 PUBLICATIONS", type: "Review Co-Mentions", highlight: true },
];

export function SourcesGrid() {
  return (
    <section
      id="sources"
      className="py-20 px-12 max-md:px-5 max-md:py-12 relative overflow-hidden"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="04" label="DATA SOURCES" dark={true} />

      <ScrollReveal>
        <div className="mb-10">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "#F5F0E8" }}
          >
            <span style={{ color: "#E8520E" }}>19+</span> SOURCES
            <br />
            ONE AGENT
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 mb-12"
            style={{ color: "#6a7a8a" }}
          >
            Every query taps into the world&apos;s best music databases.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-3 max-md:grid-cols-2 max-md:gap-3">
        {sources.map((source) => (
          <ScrollReveal key={source.name}>
            <div
              className={`border p-5 text-center transition-all duration-200 hover:-translate-y-0.5 hover:border-[#E8520E] ${
                source.highlight
                  ? "border-[#E8520E] bg-[rgba(232,82,14,0.06)]"
                  : "border-[rgba(245,240,232,0.06)]"
              }`}
            >
              <p
                className="font-[family-name:var(--font-bebas)] text-[16px] tracking-[2px] mb-1"
                style={{ color: "#F5F0E8" }}
              >
                {source.name}
              </p>
              <p
                className="font-[family-name:var(--font-space)] text-[11px] uppercase tracking-[1px]"
                style={{ color: "#5a6a7a" }}
              >
                {source.type}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
