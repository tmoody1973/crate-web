import {
  GitBranch,
  Mic,
  Music,
  Play,
  FolderHeart,
  Layers,
  Link,
  Key,
  Send,
} from "lucide-react";
import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

const features = [
  {
    icon: GitBranch,
    title: "INFLUENCE MAPPING",
    description:
      "Trace artistic lineage through review co-mentions. Visualize connections with interactive chains, path traces, and network graphs.",
  },
  {
    icon: Mic,
    title: "SHOW PREP",
    description:
      "Generate complete radio show packages — track context, talk breaks, social copy, interview prep. Tailored to your station's voice.",
  },
  {
    icon: Music,
    title: "SMART PLAYLISTS",
    description:
      "AI-curated playlists that understand context, not just genre tags. Every track includes play buttons and saves to your library.",
  },
  {
    icon: Play,
    title: "BUILT-IN PLAYER",
    description:
      "Hear any track without leaving Crate. YouTube playback, live radio streaming from 30,000+ stations, and ICY metadata for real-time artist and song display — all in one persistent player.",
  },
  {
    icon: FolderHeart,
    title: "COLLECTIONS & CRATES",
    description:
      "Organize your research into crates, playlists, and starred items. Your music knowledge builds over time, never lost.",
  },
  {
    icon: Layers,
    title: "ARTIFACTS",
    description:
      "Influence maps, playlists, show prep rendered as interactive cards you can save, revisit, and share with anyone.",
  },
  {
    icon: Link,
    title: "SOURCE CITATIONS",
    description:
      "Every claim backed by a source — Pitchfork reviews, Discogs credits, Genius annotations, Wikipedia entries. Verify anything.",
  },
  {
    icon: Key,
    title: "BRING YOUR OWN KEYS",
    description:
      "Use your own API keys or use ours. Full control over your AI provider and model selection.",
  },
  {
    icon: Send,
    title: "PUBLISH ANYWHERE",
    description:
      "Push your research to Telegraph or Tumblr with one command. Share influence maps, playlists, and show prep.",
  },
];

export function Features() {
  return (
    <section
      className="py-20 px-12 max-md:px-5 max-md:py-12 relative overflow-hidden"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="02" label="FEATURES" dark={true} />

      <ScrollReveal>
        <div className="mb-10">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "#F5F0E8" }}
          >
            WHAT&apos;S IN
            <br />
            <span style={{ color: "#E8520E" }}>THE CRATE</span>
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 mb-12"
            style={{ color: "#6a7a8a" }}
          >
            Everything you need to go from curious to knowledgeable.
          </p>
        </div>
      </ScrollReveal>

      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-4">
        {features.map((feature) => {
          const Icon = feature.icon;
          return (
            <ScrollReveal key={feature.title}>
              <div
                className="border p-7 relative overflow-hidden group transition-colors"
                style={{ borderColor: "rgba(245,240,232,0.08)" }}
              >
                {/* Orange left bar on hover */}
                <div
                  className="absolute top-0 left-0 w-1 h-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: "#E8520E" }}
                  aria-hidden="true"
                />

                <Icon size={24} className="mb-2.5" style={{ color: "#E8520E" }} />

                <h3
                  className="font-[family-name:var(--font-bebas)] text-[22px] tracking-[1px] mb-1.5"
                  style={{ color: "#F5F0E8" }}
                >
                  {feature.title}
                </h3>

                <p
                  className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
                  style={{ color: "#7a8a9a" }}
                >
                  {feature.description}
                </p>
              </div>
            </ScrollReveal>
          );
        })}
      </div>

      {/* Ghost background photo */}
      <div
        className="absolute pointer-events-none"
        style={{
          right: "-60px",
          bottom: "-40px",
          width: "400px",
          height: "300px",
          backgroundImage: "url('/photos/blocks-T3mKJXfdims-unsplash.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: "polygon(20% 0%, 100% 10%, 90% 100%, 0% 80%)",
          opacity: 0.08,
          filter: "grayscale(100%)",
        }}
        aria-hidden="true"
      />

      {/* Vertical text */}
      <p
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          right: "16px",
          top: "80px",
          writingMode: "vertical-rl",
          fontSize: "11px",
          letterSpacing: "5px",
          color: "#E8520E",
          opacity: 0.25,
        }}
        aria-hidden="true"
      >
        RESEARCH • DISCOVER • CREATE • SHARE
      </p>
    </section>
  );
}
