const COMMANDS = [
  {
    name: "/show-prep",
    aliases: ["/prep", "/showprep"],
    description: "Generate a full show prep package with track context, talk breaks, and social copy.",
    example: "/show-prep 4 tracks starting with Khruangbin for HYFIN evening show",
  },
  {
    name: "/influence",
    aliases: [],
    description: "Map musical influences for an artist using review co-mentions and source citations.",
    example: "/influence Flying Lotus",
  },
  {
    name: "/publish",
    aliases: [],
    description: "Publish the last research response to Telegraph or Tumblr.",
    example: "/publish",
  },
  {
    name: "/published",
    aliases: [],
    description: "View your published research articles.",
    example: "/published",
  },
  {
    name: "/radio",
    aliases: [],
    description: "Play a live radio stream by genre, country, or station name.",
    example: "/radio jazz",
  },
  {
    name: "/news",
    aliases: [],
    description: "Get the latest music news from multiple sources.",
    example: "/news hip-hop",
  },
  {
    name: "/help",
    aliases: [],
    description: "Open this help guide. Supports deep linking to sections.",
    example: "/help api-keys",
  },
];

export function CommandsReference() {
  return (
    <section id="commands" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        ALL COMMANDS
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Type these in the chat input. Start with / to see the autocomplete menu.
      </p>

      <div className="space-y-3">
        {COMMANDS.map((cmd) => (
          <div
            key={cmd.name}
            className="rounded-xl border p-4 transition-colors hover:border-[#E8520E]"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-baseline gap-3 mb-2">
              <code className="text-[15px] font-bold" style={{ color: "#E8520E" }}>
                {cmd.name}
              </code>
              {cmd.aliases.length > 0 && (
                <span className="text-[11px]" style={{ color: "#71717a" }}>
                  aliases: {cmd.aliases.join(", ")}
                </span>
              )}
            </div>
            <p className="text-[14px] mb-2" style={{ color: "#a1a1aa" }}>
              {cmd.description}
            </p>
            <div
              className="rounded border px-3 py-2 font-mono text-[12px]"
              style={{
                backgroundColor: "#0a0a0a",
                borderColor: "rgba(245,240,232,0.1)",
                color: "#E8520E",
              }}
            >
              {cmd.example}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
