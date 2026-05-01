import type { PersonaId } from "./persona-picker";

const PERSONA_PROMPTS: Record<PersonaId, string> = {
  "new-user": "Tell me about Flying Lotus — who is he and what should I listen to first?",
  "radio-host": "Prep a 4-track set for my evening show — start with Khruangbin and build from there",
  "dj": "Find what samples Madlib used on Shades of Blue and show me related tracks",
  "collector": "Show me the full Stones Throw Records discography from 2000-2010",
  "music-lover": "Create a playlist of artists similar to Hiatus Kaiyote",
  "journalist": "/influence Flying Lotus — map his musical influences with sources",
};

export function GettingStarted({ persona }: { persona: PersonaId }) {
  const examplePrompt = PERSONA_PROMPTS[persona];

  const steps = [
    {
      number: 1,
      title: "Ask your first question",
      description: "No setup needed. Free accounts get 10 agent research queries per month. Try something like:",
      prompt: examplePrompt,
    },
    {
      number: 2,
      title: "Connect your services (optional)",
      description:
        "Open Settings (gear icon) and connect Spotify to pull your library and create playlists. Connect Slack to send research to your team. Connect Google to save as Docs. All free.",
    },
    {
      number: 3,
      title: "Explore Deep Cuts",
      description:
        "Research results appear as interactive Deep Cuts — playlists with play buttons, influence chains with artist photos, show prep with talk breaks. Click Publish to share a link, or Export to Spotify to create a playlist from your findings.",
    },
    {
      number: 4,
      title: "Create custom skills",
      description:
        "Type /create-skill and describe what you want (e.g. 'search Dusty Groove for vinyl records'). Crate tests it, saves it, and you can run it anytime as a slash command. Free users get 3 skills.",
    },
    {
      number: 5,
      title: "Upgrade when you outgrow it",
      description:
        "Pro ($15/mo) gives you 50 queries, unlimited sessions, cross-session memory, and 20 custom skills. Or bring your own API key for unlimited queries.",
      link: { label: "See pricing", url: "/pricing" },
    },
  ];

  return (
    <section id="getting-started" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        GETTING STARTED
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Set up Crate and run your first research query in under 3 minutes.
      </p>

      <div className="space-y-4">
        {steps.map((step) => (
          <div
            key={step.number}
            className="rounded-xl border p-5"
            style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-[14px] font-bold"
                style={{ backgroundColor: "#E8520E", color: "#0A1628" }}
              >
                {step.number}
              </div>
              <h3 className="text-[17px] font-semibold" style={{ color: "#F5F0E8" }}>
                {step.title}
              </h3>
            </div>
            <p className="text-[14px] leading-relaxed mb-3" style={{ color: "#a1a1aa" }}>
              {step.description}
            </p>
            {step.prompt && (
              <div
                className="rounded-lg border px-4 py-3 font-mono text-[13px]"
                style={{
                  backgroundColor: "#0a0a0a",
                  borderColor: "rgba(245,240,232,0.1)",
                  color: "#d4d4d8",
                }}
              >
                &ldquo;{step.prompt}&rdquo;
              </div>
            )}
            {step.link && (
              <a
                href={step.link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block mt-2 text-[13px] hover:underline"
                style={{ color: "#E8520E" }}
              >
                {step.link.label} &rarr;
              </a>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
