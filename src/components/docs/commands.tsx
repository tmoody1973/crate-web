import { SectionDivider } from "../landing/section-divider";

const commands = [
  {
    name: "/influence",
    usage: "/influence [artist name]",
    example: "/influence Flying Lotus",
    description:
      "Map an artist's musical influences. Creates an interactive influence chain visualization with 6-12 weighted connections, showing who influenced whom and why. Sources include review co-mentions, Last.fm similar artists, and web research.",
    output: "InfluenceChain component with artist images, weights, and source citations",
  },
  {
    name: "/show-prep",
    aliases: "/prep, /showprep",
    usage: "/show-prep [station]: [request or setlist]",
    example: "/show-prep HYFIN: Khruangbin - Time (You and I)",
    description:
      "Generate complete radio show prep packages. Opens an interactive form to specify station, shift, DJ name, guest, and setlist. Produces track context, talk breaks (short/medium/long), social copy for Instagram/X/Bluesky, local event listings, and interview prep.",
    output: "Full show prep package with customizable sections",
  },
  {
    name: "/news",
    usage: "/news [station] [count]",
    example: "/news hyfin 3",
    description:
      "Generate a daily music news segment. Searches current music news from RSS feeds and web sources, cross-references facts, and formats for the specified station's voice. Supports 88Nine, HYFIN, and Rhythm Lab.",
    output: "Formatted news segment ready for on-air delivery",
  },
  {
    name: "/publish",
    usage: "/publish [telegraph|tumblr]",
    example: "/publish telegraph",
    description:
      "Publish your research to the web. Telegraph is free and instant — no account needed. Tumblr requires API keys configured in Settings. Content is formatted with clear titles, headings, and source links.",
    output: "Published URL you can share with anyone",
  },
  {
    name: "/published",
    usage: "/published",
    example: "/published",
    description:
      "View all your published content across Telegraph and Tumblr. Shows titles, URLs, categories, and publication dates grouped by platform.",
    output: "List of all published items with links",
  },
];

export function Commands() {
  return (
    <section
      id="commands"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="02" label="COMMANDS" />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#0A1628" }}
      >
        SLASH <span style={{ color: "#E8520E" }}>COMMANDS</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        Type / in the chat to see all available commands. Each triggers
        specialized research with optimized prompts and tool access.
      </p>

      <div className="space-y-6">
        {commands.map((cmd) => (
          <div
            key={cmd.name}
            className="border p-8 max-md:p-5 group transition-colors hover:border-[#E8520E]"
            style={{
              borderColor: "rgba(10,22,40,0.1)",
              backgroundColor: "rgba(255,255,255,0.4)",
            }}
          >
            <div className="flex items-start justify-between gap-4 max-md:flex-col mb-4">
              <div>
                <h3
                  className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[1px]"
                  style={{ color: "#E8520E" }}
                >
                  {cmd.name}
                </h3>
                {"aliases" in cmd && (
                  <p
                    className="font-[family-name:var(--font-space)] text-[12px] mt-1"
                    style={{ color: "#999" }}
                  >
                    Aliases: {cmd.aliases}
                  </p>
                )}
              </div>
              <code
                className="font-[family-name:var(--font-space)] text-[13px] px-3 py-1.5 shrink-0"
                style={{
                  backgroundColor: "#0A1628",
                  color: "#E8520E",
                  borderRadius: "2px",
                }}
              >
                {cmd.usage}
              </code>
            </div>

            <p
              className="font-[family-name:var(--font-space)] text-[15px] leading-relaxed mb-4"
              style={{ color: "#3a4a5c" }}
            >
              {cmd.description}
            </p>

            <div className="flex gap-6 max-md:flex-col max-md:gap-3">
              <div>
                <span
                  className="font-[family-name:var(--font-bebas)] text-[12px] tracking-[2px]"
                  style={{ color: "#999" }}
                >
                  EXAMPLE
                </span>
                <code
                  className="block font-[family-name:var(--font-space)] text-[14px] mt-1"
                  style={{ color: "#0A1628" }}
                >
                  {cmd.example}
                </code>
              </div>
              <div>
                <span
                  className="font-[family-name:var(--font-bebas)] text-[12px] tracking-[2px]"
                  style={{ color: "#999" }}
                >
                  OUTPUT
                </span>
                <p
                  className="font-[family-name:var(--font-space)] text-[14px] mt-1"
                  style={{ color: "#5a6a7a" }}
                >
                  {cmd.output}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
