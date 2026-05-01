import { SectionDivider } from "../landing/section-divider";

const categories = [
  {
    title: "INFLUENCE & LINEAGE",
    prompts: [
      {
        query: "Trace the influence chain from J Dilla to Kaytranada",
        what: "Maps the artistic lineage connecting two artists through intermediate influences, with evidence from reviews and credits.",
      },
      {
        query: "Who are the key bridge artists connecting Afrobeats to hip-hop?",
        what: "Identifies crossover artists with co-mention data from 26 music publications.",
      },
      {
        query: "Show me how Sun Ra influenced modern electronic music",
        what: "Builds a forward-looking influence chain from a pioneer to contemporary artists.",
      },
    ],
  },
  {
    title: "DEEP RESEARCH",
    prompts: [
      {
        query: "Tell me everything about Ezra Collective — influences, members, key albums, and live shows",
        what: "Comprehensive artist profile pulling from Discogs, Wikipedia, MusicBrainz, Genius, and Ticketmaster.",
      },
      {
        query: "What's the story behind Madvillainy? Production credits, samples, and legacy",
        what: "Deep album research with verified credits from Discogs, sample chains, and critical reception.",
      },
      {
        query: "Compare the Milwaukee jazz scene to Chicago's — key venues, artists, and crossover",
        what: "Cross-city music scene analysis with local event data and artist connections.",
      },
    ],
  },
  {
    title: "PLAYLISTS & SETS",
    prompts: [
      {
        query: "Build a 2-hour jazz-funk set for a Friday night show, heavy on Roy Ayers and Herbie Hancock vibes",
        what: "AI-curated playlist with playable tracks, BPM flow, and transition notes.",
      },
      {
        query: "Create a playlist that traces the evolution of neo-soul from D'Angelo to current artists",
        what: "Chronological playlist with context cards explaining each era and connection.",
      },
      {
        query: "Give me 15 deep cuts similar to Khruangbin but from African and Middle Eastern artists",
        what: "Discovery playlist pulling from Last.fm similarity, Bandcamp, and review co-mentions.",
      },
    ],
  },
  {
    title: "SHOW PREP & PUBLISHING",
    prompts: [
      {
        query: "/show-prep 88Nine: Noname > Saba > Chance the Rapper",
        what: "Full show prep with talk breaks, track context, social posts, and interview questions.",
      },
      {
        query: "Write a 500-word feature on the resurgence of vinyl culture in Milwaukee",
        what: "Long-form content with sourced facts, ready to publish to Telegraph or Tumblr.",
      },
      {
        query: "/news HYFIN 5",
        what: "Five current music news items formatted for HYFIN's urban alternative audience.",
      },
    ],
  },
];

export function PromptExamples() {
  return (
    <section
      id="prompts"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="03" label="PROMPT EXAMPLES" dark />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#F5F0E8" }}
      >
        WHAT TO <span style={{ color: "#E8520E" }}>ASK</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        Crate works best with specific, music-focused questions. Here are real
        examples organized by category.
      </p>

      <div className="space-y-12">
        {categories.map((cat) => (
          <div key={cat.title}>
            <h3
              className="font-[family-name:var(--font-bebas)] text-[24px] tracking-[2px] mb-5"
              style={{ color: "#E8520E" }}
            >
              {cat.title}
            </h3>
            <div className="grid grid-cols-1 gap-4">
              {cat.prompts.map((p) => (
                <div
                  key={p.query}
                  className="border p-6 flex gap-6 max-md:flex-col max-md:gap-3"
                  style={{ borderColor: "rgba(245,240,232,0.08)" }}
                >
                  <div className="flex-1">
                    <p
                      className="font-[family-name:var(--font-space)] text-[15px] font-medium"
                      style={{ color: "#F5F0E8" }}
                    >
                      &ldquo;{p.query}&rdquo;
                    </p>
                  </div>
                  <div className="flex-1">
                    <p
                      className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
                      style={{ color: "#7a8a9a" }}
                    >
                      {p.what}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
