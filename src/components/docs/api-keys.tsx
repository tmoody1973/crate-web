import { SectionDivider } from "../landing/section-divider";

const keys = [
  {
    name: "ANTHROPIC",
    required: true,
    description:
      "Powers Crate's AI agent directly via the Claude API. Required if you're not using OpenRouter. Get a key from Anthropic's console.",
    where: "console.anthropic.com/settings/keys",
  },
  {
    name: "OPENROUTER",
    required: true,
    description:
      "Alternative to a direct Anthropic key. Routes to Claude, GPT-4, and other LLMs through a single API. One key, many models.",
    where: "openrouter.ai/keys",
  },
  {
    name: "SPOTIFY",
    required: false,
    description:
      "Enables high-quality album artwork (640x640) and artist images. Used for the image pipeline in influence chains and playlists.",
    where: "developer.spotify.com/dashboard",
  },
  {
    name: "FANART.TV",
    required: false,
    description:
      "HD artist backgrounds, logos, and album art. Requires a MusicBrainz ID (automatically resolved by Crate).",
    where: "fanart.tv/get-an-api-key",
  },
  {
    name: "TUMBLR",
    required: false,
    description:
      "Required only for /publish tumblr. Lets you publish research directly to your Tumblr blog.",
    where: "tumblr.com/oauth/apps",
  },
  {
    name: "GENIUS",
    required: false,
    description:
      "Lyrics, annotations, and song metadata. Crate provides a default key, but your own avoids rate limits.",
    where: "genius.com/api-clients",
  },
  {
    name: "LAST.FM",
    required: false,
    description:
      "Similar artists, tags, and listening data. Crate provides a default key, but your own avoids rate limits.",
    where: "last.fm/api/account/create",
  },
];

export function ApiKeys() {
  return (
    <section
      id="api-keys"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="06" label="CONFIGURATION" />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#0A1628" }}
      >
        BRING YOUR <span style={{ color: "#E8520E" }}>OWN KEYS</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-4 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        You need either an Anthropic or OpenRouter API key to power the AI
        agent. All other keys are optional and enhance specific features.
      </p>
      <p
        className="font-[family-name:var(--font-space)] text-[14px] mb-12 max-w-[600px]"
        style={{ color: "#999" }}
      >
        Configure keys in Settings (gear icon in the sidebar). Keys are stored
        securely and never leave your browser until a research request is made.
      </p>

      <div className="grid grid-cols-2 gap-5 max-md:grid-cols-1 max-md:gap-4">
        {keys.map((k) => (
          <div
            key={k.name}
            className="border p-6 transition-colors hover:border-[#E8520E]"
            style={{
              borderColor: "rgba(10,22,40,0.1)",
              backgroundColor: "rgba(255,255,255,0.4)",
            }}
          >
            <div className="flex items-center gap-3 mb-3">
              <h3
                className="font-[family-name:var(--font-bebas)] text-[22px] tracking-[1px]"
                style={{ color: "#0A1628" }}
              >
                {k.name}
              </h3>
              <span
                className="font-[family-name:var(--font-bebas)] text-[11px] tracking-[1px] px-2 py-0.5"
                style={{
                  backgroundColor: k.required
                    ? "#E8520E"
                    : "rgba(10,22,40,0.08)",
                  color: k.required ? "#F5F0E8" : "#999",
                }}
              >
                {k.required ? "REQUIRED" : "OPTIONAL"}
              </span>
            </div>
            <p
              className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed mb-3"
              style={{ color: "#5a6a7a" }}
            >
              {k.description}
            </p>
            <p
              className="font-[family-name:var(--font-space)] text-[12px]"
              style={{ color: "#E8520E" }}
            >
              {k.where}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
