import Link from "next/link";
import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const FEATURED_CONNECTIONS = [
  { name: "Portishead", context: "Co-founding vocalist of the trip-hop movement", source: "Pitchfork" },
  { name: "Billie Holiday", context: "'Billie Holiday fronting Siouxsie and the Banshees'", source: "Variety" },
  { name: "Nina Simone", context: "Raw emotional exposure, torch song tradition", source: "The Guardian" },
];

const SONIC_TAGS = ["trip-hop", "torch-song", "noir production", "emotional intensity", "cinematic atmosphere"];

export function TinyDeskShowcase() {
  return (
    <section
      className="py-20 px-12 max-md:px-5 max-md:py-12 relative overflow-hidden"
      style={{ backgroundColor: "#09090b" }}
    >
      <SectionDivider number="06" label="TINY DESK DNA" dark />

      <ScrollReveal>
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-10">
            <div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/branding/tinydeskdna.svg"
                alt="Tiny Desk DNA"
                style={{ height: "60px", width: "auto" }}
                className="mb-4"
              />
              <p
                className="font-[family-name:var(--font-space)] max-w-lg"
                style={{ color: "#a1a1aa", fontSize: "16px", lineHeight: "1.7" }}
              >
                626 NPR Tiny Desk concerts. Every influence traced. Crate maps the musical DNA
                behind each performance — cited sources, pull quotes, sonic analysis.
              </p>
            </div>
            <Link
              href="/tinydesk"
              className="font-[family-name:var(--font-bebas)] shrink-0 rounded-lg px-6 py-3 tracking-widest text-sm transition-all hover:scale-105"
              style={{ backgroundColor: "#22d3ee", color: "#09090b" }}
            >
              EXPLORE TINY DESK DNA →
            </Link>
          </div>

          {/* Before / After preview */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* What NPR gives you */}
            <div>
              <p
                className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
                style={{ color: "#52525b", fontSize: "11px" }}
              >
                WHAT NPR GIVES YOU
              </p>
              <div className="relative rounded-xl overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://img.youtube.com/vi/G_-DftINZKg/maxresdefault.jpg"
                  alt="Beth Gibbons — NPR Tiny Desk Concert"
                  className="w-full aspect-video object-cover"
                  loading="lazy"
                />
                <div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(to top, rgba(9,9,11,0.6) 0%, transparent 50%)" }}
                />
                <p
                  className="absolute bottom-3 left-4 font-[family-name:var(--font-bebas)] tracking-wide"
                  style={{ color: "#f4f4f5", fontSize: "20px" }}
                >
                  Beth Gibbons
                </p>
              </div>
              <p className="mt-2" style={{ color: "#3f3f46", fontSize: "12px" }}>
                A YouTube video and a paragraph. That&apos;s it.
              </p>
            </div>

            {/* What Crate reveals */}
            <div>
              <p
                className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
                style={{ color: "#22d3ee", fontSize: "11px" }}
              >
                WHAT CRATE REVEALS
              </p>
              <div className="space-y-2">
                {FEATURED_CONNECTIONS.map((conn) => (
                  <div
                    key={conn.name}
                    className="rounded-lg px-4 py-3"
                    style={{ backgroundColor: "#18181b", border: "1px solid #27272a" }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-white">{conn.name}</p>
                        <p style={{ color: "#a1a1aa", fontSize: "13px" }}>{conn.context}</p>
                      </div>
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5"
                        style={{ backgroundColor: "#27272a", color: "#a1a1aa", fontSize: "10px" }}
                      >
                        {conn.source}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {SONIC_TAGS.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full px-2.5 py-0.5"
                    style={{ backgroundColor: "#083344", color: "#22d3ee", fontSize: "10px" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <Link
                href="/tinydesk/beth-gibbons"
                className="inline-block mt-3 text-sm transition-colors hover:text-cyan-300"
                style={{ color: "#22d3ee" }}
              >
                See full influence chain →
              </Link>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
