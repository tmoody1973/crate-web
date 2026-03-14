import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const stations = [
  {
    name: "HYFIN",
    tagline: "URBAN ALTERNATIVE • MILWAUKEE",
    photo: "/photos/m-lagan-2-hWaESjEic-unsplash.jpg",
    clipPath: null,
    description:
      "Bold, culturally sharp programming. Crate generates show prep that speaks the language of hip-hop lineage, neo-soul roots, and Afrobeats connections.",
    quote:
      "Crate traces the thread from Gil Scott-Heron to Noname in 30 seconds.",
  },
  {
    name: "88NINE",
    tagline: "ECLECTIC • COMMUNITY-FORWARD",
    photo: "/photos/getty-images-qPlt3T62Lvk-unsplash.jpg",
    clipPath: "polygon(0% 0%, 100% 5%, 100% 100%, 0% 95%)",
    description:
      "Warm, discovery-oriented music. Crate surfaces the unexpected connections — how a Milwaukee band links to Malian blues, or why this B-side matters now.",
    quote:
      "It found a local angle on Khruangbin I never would have Googled.",
  },
  {
    name: "RHYTHM LAB",
    tagline: "GLOBAL BEATS • CRATE DIGGERS",
    photo: "/photos/blocks-T3mKJXfdims-unsplash.jpg",
    clipPath: null,
    description:
      "Deep crates, global perspective. Crate speaks the language of influence chains, producer credits, and sample archaeology — the stuff diggers live for.",
    quote: "Like having a musicologist in the booth with you.",
  },
];

export function DjShowcase() {
  return (
    <section
      id="showcase"
      className="py-20 px-12 max-md:px-5 max-md:py-12 relative overflow-hidden"
      style={{ backgroundColor: "var(--cream)" }}
    >
      {/* Ghost background photo */}
      <div
        className="absolute pointer-events-none"
        style={{
          left: "-80px",
          top: "40px",
          width: "300px",
          height: "600px",
          backgroundImage:
            "url('/photos/mick-haupt-CbNBjnXXhNg-unsplash.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: "polygon(10% 0%, 100% 5%, 90% 100%, 0% 95%)",
          opacity: 0.04,
          filter: "grayscale(100%)",
        }}
        aria-hidden="true"
      />

      <SectionDivider number="05" label="BUILT FOR DJS" />

      <ScrollReveal>
        <div className="mb-10">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "var(--midnight)" }}
          >
            ON THE
            <br />
            <span style={{ color: "var(--orange)" }}>AIR</span>
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 mb-12 max-w-[500px]"
            style={{ color: "#6a7a8a" }}
          >
            Built for real stations, real DJs, real shows. Three voices, one
            tool.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-3 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-5">
        {stations.map((station) => (
          <ScrollReveal key={station.name}>
            <div
              className="border overflow-hidden group transition-colors"
              style={{
                borderColor: "rgba(10,22,40,0.10)",
                backgroundColor: "rgba(255,255,255,0.50)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor =
                  "var(--orange)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor =
                  "rgba(10,22,40,0.10)";
              }}
            >
              {/* Photo area */}
              <div
                className="relative h-[180px]"
                role="img"
                aria-label={`${station.name} station photo`}
              >
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url('${station.photo}')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    filter: "grayscale(30%) contrast(1.05)",
                    ...(station.clipPath
                      ? { clipPath: station.clipPath }
                      : {}),
                  }}
                />
                {/* Gradient overlay */}
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      "linear-gradient(to bottom, transparent, transparent, var(--midnight))",
                  }}
                  aria-hidden="true"
                />
              </div>

              {/* Card body */}
              <div className="p-6">
                <h3
                  className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[2px] mb-1"
                  style={{ color: "var(--midnight)" }}
                >
                  {station.name}
                </h3>
                <p
                  className="font-[family-name:var(--font-bebas)] text-[12px] uppercase tracking-[2px] mb-3"
                  style={{ color: "var(--orange)" }}
                >
                  {station.tagline}
                </p>
                <p
                  className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
                  style={{ color: "#5a6a7a" }}
                >
                  {station.description}
                </p>
                <p
                  className="font-[family-name:var(--font-space)] text-[13px] italic mt-3 pt-3"
                  style={{
                    color: "#4a5a6a",
                    borderTop: "1px solid rgba(10,22,40,0.10)",
                  }}
                >
                  &ldquo;{station.quote}&rdquo;
                </p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
