import { SectionDivider } from "../landing/section-divider";

const faqs = [
  {
    q: "Is Crate free?",
    a: "Crate is free to use, but you need your own AI key. Add an Anthropic or OpenRouter API key in Settings to power the agent. All 20+ music data sources (Discogs, Last.fm, Spotify, etc.) are built in and work immediately.",
  },
  {
    q: "How is this different from ChatGPT?",
    a: "ChatGPT generates answers from training data. Crate queries 19+ live music databases (Discogs, MusicBrainz, Genius, Last.fm, etc.) in real-time and cites every source. No hallucinated credits or dates.",
  },
  {
    q: "What kind of questions can I ask?",
    a: "Anything music-related — artist research, influence mapping, playlist building, show prep, album deep dives, scene analysis, sample chains. Use slash commands for specialized workflows.",
  },
  {
    q: "Do I need to be a DJ to use Crate?",
    a: "No. Crate is built for anyone curious about music — DJs, producers, writers, students, collectors, and listeners. The show prep features are DJ-focused, but most features serve all music enthusiasts.",
  },
  {
    q: "How does influence mapping work?",
    a: "Crate analyzes co-mentions across 26 music publications, Last.fm similarity data, and Discogs credits to build weighted influence connections. Each connection includes evidence and source citations.",
  },
  {
    q: "Can I play music inside Crate?",
    a: "Yes. The built-in audio player streams tracks via YouTube directly in the research interface. Every playlist and track card includes a play button.",
  },
  {
    q: "What happens to my research?",
    a: "Everything is saved to your workspace — playlists, influence chains, show prep, and starred items live in your sidebar. You can also publish to Telegraph or Tumblr.",
  },
  {
    q: "Is my data private?",
    a: "Your API keys are encrypted before being stored in your authenticated workspace. They are only decrypted server-side when making research requests to the respective APIs. Your research history and collections are tied to your account and not shared.",
  },
];

export function DocsFaq() {
  return (
    <section
      id="faq"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="07" label="FAQ" dark />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-12"
        style={{ color: "#F5F0E8" }}
      >
        COMMON <span style={{ color: "#E8520E" }}>QUESTIONS</span>
      </h2>

      <div className="grid grid-cols-2 gap-6 max-md:grid-cols-1 max-md:gap-5">
        {faqs.map((faq) => (
          <div
            key={faq.q}
            className="border p-6"
            style={{ borderColor: "rgba(245,240,232,0.08)" }}
          >
            <h3
              className="font-[family-name:var(--font-bebas)] text-[20px] tracking-[1px] mb-3"
              style={{ color: "#E8520E" }}
            >
              {faq.q}
            </h3>
            <p
              className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
              style={{ color: "#7a8a9a" }}
            >
              {faq.a}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
