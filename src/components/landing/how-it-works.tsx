import { MessageSquare, Search, Package } from "lucide-react";
import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const steps = [
  {
    icon: MessageSquare,
    title: "ASK ANYTHING",
    description:
      "Type a question about any artist, track, genre, or scene. Use slash commands like /influence or /show-prep for specialized research.",
  },
  {
    icon: Search,
    title: "CRATE DIGS",
    description:
      "The agent queries 19+ sources simultaneously — Discogs, Genius, Last.fm, Spotify, Wikipedia, and more. Cross-references. Verifies. Cites everything.",
  },
  {
    icon: Package,
    title: "GET THE GOODS",
    description:
      "Results render as interactive cards — influence maps, playlists, show prep packages. Hear any track with the built-in player. Save, share, and build on your research.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="01" label="HOW IT WORKS" />

      <ScrollReveal>
        <div className="mb-10">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "#0A1628" }}
          >
            THREE
            <br />
            <span style={{ color: "#E8520E" }}>STEPS</span>
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 mb-12 max-w-[500px]"
            style={{ color: "#6a7a8a" }}
          >
            From question to deep knowledge in under a minute.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-3 gap-8 max-lg:gap-6 max-md:grid-cols-1 max-md:gap-5">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <ScrollReveal key={step.title}>
              <div
                className="relative border p-8 max-md:p-5"
                style={{
                  borderColor: "rgba(10,22,40,0.1)",
                  backgroundColor: "rgba(255,255,255,0.4)",
                }}
              >
                <span
                  className="absolute top-3 right-4 font-[family-name:var(--font-bebas)] text-[64px] leading-none select-none"
                  style={{ color: "#E8520E", opacity: 0.2 }}
                  aria-hidden="true"
                >
                  {String(index + 1).padStart(2, "0")}
                </span>

                <Icon size={28} className="mb-3" style={{ color: "#0A1628" }} />

                <h3
                  className="font-[family-name:var(--font-bebas)] text-[24px] tracking-[1px] mb-2"
                  style={{ color: "#0A1628" }}
                >
                  {step.title}
                </h3>

                <p
                  className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
                  style={{ color: "#5a6a7a" }}
                >
                  {step.description}
                </p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>
    </section>
  );
}
