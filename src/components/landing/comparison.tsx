import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const googleTabsItems = [
  "Open 10+ tabs across Discogs, Wikipedia, Genius",
  "Manually cross-reference credits and dates",
  "Copy-paste into a doc, lose half the links",
  "No connections between artists",
  "30-60 minutes per session",
  "Results die in browser history",
];

const chatgptItems: { marker: "x" | "tilde"; text: string }[] = [
  { marker: "tilde", text: "Answers questions about music (but generic)" },
  { marker: "x", text: "Can't query Discogs, MusicBrainz, or Last.fm" },
  { marker: "x", text: "No real-time data — training cutoff limits" },
  { marker: "x", text: "No audio player, playlists, or interactive cards" },
  { marker: "x", text: "Hallucinates credits, dates, and samples" },
  {
    marker: "x",
    text: "No collections, artifacts, or persistent workspace",
  },
  { marker: "x", text: "No influence mapping or show prep tools" },
];

const crateItems = [
  "One question, 19+ real sources queried live",
  "Every fact cited — Discogs, Genius, MusicBrainz",
  "Real-time data from APIs, not training data",
  "Built-in audio player, playable playlists, influence maps",
  "Verifiable credits, dates, and sample chains",
  "Collections, artifacts, and a sidebar that remembers everything",
  "Show prep, publishing, and playlist export built in",
];

export function Comparison() {
  return (
    <section
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="03" label="VS THE OLD WAY" />

      <ScrollReveal>
        <div className="mb-10">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "#0A1628" }}
          >
            WHY NOT JUST
            <br />
            <span style={{ color: "#E8520E" }}>GOOGLE IT?</span>
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 mb-12 max-w-[600px]"
            style={{ color: "#6a7a8a" }}
          >
            Or ask ChatGPT. Or Claude. Here&apos;s why Crate is different.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-3 gap-6 max-w-[1000px] max-md:grid-cols-1 max-md:gap-4">
        {/* Column 1: Google + Tabs */}
        <ScrollReveal>
          <div
            className="p-7 border"
            style={{
              backgroundColor: "rgba(10,22,40,0.04)",
              borderColor: "rgba(10,22,40,0.08)",
            }}
          >
            <h3
              className="font-[family-name:var(--font-bebas)] text-[20px] tracking-[2px] mb-4"
              style={{ color: "#999" }}
            >
              GOOGLE + TABS
            </h3>
            <ul className="space-y-0">
              {googleTabsItems.map((item) => (
                <li
                  key={item}
                  className="font-[family-name:var(--font-space)] text-[14px] leading-8 flex gap-2"
                >
                  <span
                    className="text-[12px] shrink-0 mt-[5px]"
                    style={{ color: "#ccc" }}
                    aria-hidden="true"
                  >
                    ✕
                  </span>
                  <span style={{ color: "#888" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        {/* Column 2: ChatGPT / Claude */}
        <ScrollReveal>
          <div
            className="p-7 border"
            style={{
              backgroundColor: "rgba(10,22,40,0.04)",
              borderColor: "rgba(10,22,40,0.08)",
            }}
          >
            <h3
              className="font-[family-name:var(--font-bebas)] text-[20px] tracking-[2px] mb-4"
              style={{ color: "#999" }}
            >
              CHATGPT / CLAUDE
            </h3>
            <ul className="space-y-0">
              {chatgptItems.map((item) => (
                <li
                  key={item.text}
                  className="font-[family-name:var(--font-space)] text-[14px] leading-8 flex gap-2"
                >
                  {item.marker === "tilde" ? (
                    <span
                      className="text-[12px] shrink-0 mt-[5px]"
                      style={{ color: "#eab308" }}
                      aria-hidden="true"
                    >
                      ~
                    </span>
                  ) : (
                    <span
                      className="text-[12px] shrink-0 mt-[5px]"
                      style={{ color: "#ccc" }}
                      aria-hidden="true"
                    >
                      ✕
                    </span>
                  )}
                  <span style={{ color: "#888" }}>{item.text}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>

        {/* Column 3: With Crate */}
        <ScrollReveal>
          <div
            className="p-7 border-2"
            style={{
              backgroundColor: "#0A1628",
              borderColor: "#E8520E",
            }}
          >
            <h3
              className="font-[family-name:var(--font-bebas)] text-[20px] tracking-[2px] mb-4"
              style={{ color: "#E8520E" }}
            >
              WITH CRATE
            </h3>
            <ul className="space-y-0">
              {crateItems.map((item) => (
                <li
                  key={item}
                  className="font-[family-name:var(--font-space)] text-[14px] leading-8 flex gap-2"
                >
                  <span
                    className="text-[12px] font-bold shrink-0 mt-[5px]"
                    style={{ color: "#E8520E" }}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span style={{ color: "rgba(245,240,232,0.8)" }}>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
