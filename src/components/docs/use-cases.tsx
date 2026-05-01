import { SectionDivider } from "../landing/section-divider";

const cases = [
  {
    station: "HYFIN",
    tagline: "URBAN ALTERNATIVE • MILWAUKEE",
    scenario: "Pre-show research for a hip-hop history segment",
    workflow: [
      "DJ types: /show-prep HYFIN: Gil Scott-Heron > Common > Noname",
      "Crate generates talk breaks tracing the lineage from spoken word to conscious rap",
      "Built-in player lets DJ preview each track while reviewing notes",
      "Social copy is ready for Instagram — artist images included",
      "Full package published to Telegraph for the station's website",
    ],
    result:
      "45-minute show prep done in 3 minutes. Every fact cited, every track playable.",
  },
  {
    station: "88NINE",
    tagline: "ECLECTIC • COMMUNITY-FORWARD",
    scenario: "Discovering local connections for an on-air feature",
    workflow: [
      'DJ asks: "How does the Milwaukee indie scene connect to Malian blues?"',
      "Crate searches Discogs credits, Last.fm tags, and 26 review publications",
      "Finds that a Milwaukee band's guitarist studied with Ali Farka Touré's student",
      "Generates an influence chain with the connection path visualized",
      "Ticketmaster data shows both artists have upcoming Milwaukee dates",
    ],
    result:
      "A compelling on-air story that no amount of Googling would have surfaced.",
  },
  {
    station: "RHYTHM LAB",
    tagline: "GLOBAL BEATS • CRATE DIGGERS",
    scenario: "Deep crate digging for a global beats playlist",
    workflow: [
      'DJ types: "Build a 90-minute set connecting Ethiopian jazz to UK broken beat"',
      "Crate pulls from Discogs releases, Bandcamp catalogs, and Genius annotations",
      "Playlist includes deep cuts with BPM-matched transitions",
      "Each track has producer credits and sample information verified via MusicBrainz",
      "Playlist saved to Collections for future reference and iteration",
    ],
    result:
      "A set that would take hours of digging, ready in under a minute with full source verification.",
  },
];

export function UseCases() {
  return (
    <section
      id="use-cases"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="04" label="USE CASES" />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#0A1628" }}
      >
        IN THE <span style={{ color: "#E8520E" }}>FIELD</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        Real workflows from real stations. Three voices, three use cases, one
        tool.
      </p>

      <div className="space-y-8">
        {cases.map((c) => (
          <div
            key={c.station}
            className="border overflow-hidden"
            style={{ borderColor: "rgba(10,22,40,0.1)" }}
          >
            {/* Header */}
            <div
              className="p-6 flex items-center justify-between max-md:flex-col max-md:items-start max-md:gap-2"
              style={{ backgroundColor: "#0A1628" }}
            >
              <div>
                <h3
                  className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[2px]"
                  style={{ color: "#F5F0E8" }}
                >
                  {c.station}
                </h3>
                <p
                  className="font-[family-name:var(--font-bebas)] text-[12px] tracking-[2px]"
                  style={{ color: "#E8520E" }}
                >
                  {c.tagline}
                </p>
              </div>
              <p
                className="font-[family-name:var(--font-space)] text-[14px] italic"
                style={{ color: "rgba(245,240,232,0.6)" }}
              >
                {c.scenario}
              </p>
            </div>

            {/* Workflow */}
            <div
              className="p-6"
              style={{ backgroundColor: "rgba(255,255,255,0.4)" }}
            >
              <p
                className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[2px] mb-4"
                style={{ color: "#999" }}
              >
                WORKFLOW
              </p>
              <ol className="space-y-3">
                {c.workflow.map((step, i) => (
                  <li
                    key={i}
                    className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed flex gap-3"
                  >
                    <span
                      className="font-[family-name:var(--font-bebas)] text-[16px] shrink-0"
                      style={{ color: "#E8520E" }}
                    >
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span style={{ color: "#3a4a5c" }}>{step}</span>
                  </li>
                ))}
              </ol>

              <div
                className="mt-5 pt-5"
                style={{ borderTop: "1px solid rgba(10,22,40,0.08)" }}
              >
                <p
                  className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[2px] mb-1"
                  style={{ color: "#E8520E" }}
                >
                  RESULT
                </p>
                <p
                  className="font-[family-name:var(--font-space)] text-[15px] font-medium"
                  style={{ color: "#0A1628" }}
                >
                  {c.result}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
