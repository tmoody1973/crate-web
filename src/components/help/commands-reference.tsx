const COMMANDS = [
  {
    name: "/influence",
    aliases: [],
    description: "Map an artist's influence network — who shaped their sound, who they shaped, with cited evidence and Perplexity-enriched context.",
    example: "/influence Flying Lotus",
    tier: "free",
  },
  {
    name: "/show-prep",
    aliases: ["/prep", "/showprep"],
    description: "Generate a full show prep package — track context cards, talk breaks, social copy, and interview prep. Paste your setlist or describe the vibe.",
    example: "/show-prep 4 tracks starting with Khruangbin for HYFIN evening show",
    tier: "free",
  },
  {
    name: "/news",
    aliases: [],
    description: "Generate a music news segment from today's headlines. Pulls from RSS feeds, Tavily, and Exa web search. Specify a station voice for tailored copy.",
    example: "/news hyfin 5",
    tier: "free",
  },
  {
    name: "/create-skill",
    aliases: [],
    description: "Create a custom reusable command. Describe what you want, Crate does a dry run, then saves it as a slash command you can run anytime.",
    example: "/create-skill search dusty groove for vinyl records",
    tier: "free",
  },
  {
    name: "/skills",
    aliases: [],
    description: "List your custom skills with run counts, status, and descriptions.",
    example: "/skills",
    tier: "free",
  },
  {
    name: "/radio",
    aliases: [],
    description: "Stream any of 30,000+ live radio stations while you research. Search by genre, country, or station name.",
    example: "/radio jazz",
    tier: "free",
  },
  {
    name: "/publish",
    aliases: [],
    description: "Publish the last research response to Telegraph or Tumblr.",
    example: "/publish",
    tier: "pro",
  },
  {
    name: "/published",
    aliases: [],
    description: "View your published research articles.",
    example: "/published",
    tier: "pro",
  },
  {
    name: "/spotify",
    aliases: [],
    description: "Browse and play your Spotify playlists with embedded players. Search for a specific playlist or explore your full library.",
    example: "/spotify HYFIN",
    tier: "free",
  },
  {
    name: "/help",
    aliases: [],
    description: "Open the help guide.",
    example: "/help",
    tier: "free",
  },
];

const NATURAL_COMMANDS = [
  {
    prompt: "Create a Japanese city pop playlist",
    description: "Crate researches the genre via Perplexity, finds key tracks, and renders a playable TrackList that auto-saves to your library.",
  },
  {
    prompt: "What's in my Spotify library?",
    description: "Reads your connected Spotify account — saved tracks, top artists, playlists. Requires Spotify connected in Settings.",
  },
  {
    prompt: "Deep dive into the artists on my HYFIN playlist",
    description: "Pulls tracks from your Spotify playlist, researches each artist, maps connections and samples.",
  },
  {
    prompt: "Send this to Slack",
    description: "Shows a channel picker, then sends the current research to your Slack workspace with Block Kit formatting.",
  },
  {
    prompt: "Save this to Google Docs",
    description: "Creates a Google Doc with the research content and returns a shareable link.",
  },
  {
    prompt: "Trace the influence between Fela Kuti and Beyonce",
    description: "Maps the connection path between two artists through collaborators, samples, and stylistic lineage.",
  },
];

export function CommandsReference() {
  return (
    <section id="commands" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        COMMANDS
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Type / in the chat to see the autocomplete menu, or just describe what you want in plain English.
      </p>

      {/* Slash commands */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Slash commands</h3>
      <div className="space-y-3 mb-12">
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
              {cmd.tier === "pro" && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-400">
                  Pro
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

      {/* Natural language */}
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500 mb-4">Natural language</h3>
      <p className="text-[14px] mb-4" style={{ color: "#71717a" }}>
        You don't need slash commands. Just describe what you want.
      </p>
      <div className="space-y-3">
        {NATURAL_COMMANDS.map((cmd) => (
          <div
            key={cmd.prompt}
            className="rounded-xl border p-4"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <p className="text-[14px] font-medium mb-1" style={{ color: "#F5F0E8" }}>
              "{cmd.prompt}"
            </p>
            <p className="text-[13px]" style={{ color: "#71717a" }}>
              {cmd.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
