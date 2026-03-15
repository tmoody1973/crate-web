"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What models can I use?",
    answer:
      "Crate supports Claude (requires your Anthropic API key) as the default model. You can also use GPT-4o, Gemini 2.5, Llama 4, DeepSeek R1, and Mistral Large by adding an OpenRouter API key in Settings. Switch between models using the model selector in the chat header.",
  },
  {
    question: "Is my API key stored securely?",
    answer:
      "Yes. API keys are encrypted with AES-256-GCM before being stored. They are decrypted only during active research sessions and are never logged, sent to third parties, or included in telemetry of any kind.",
  },
  {
    question: "Can I share keys with my team?",
    answer:
      "Organization admins can configure shared API keys in Settings under the Organization tab. Team members will use the org keys by default and won't need to add their own. Ask your admin to enable this — it's available on all paid plans.",
  },
  {
    question: "What data sources are free?",
    answer:
      "Most sources work without any API keys. Discogs, MusicBrainz, Last.fm, Bandcamp, Wikipedia, iTunes, AllMusic, Pitchfork, Rate Your Music, Setlist.fm, and YouTube all work out of the box. A small number of features (cross-session memory via Mem0, Tumblr publishing) require additional keys. See the Data Sources section for a full breakdown.",
  },
  {
    question: "How does influence mapping work?",
    answer:
      "The /influence command works by searching music publications, review databases, and Wikipedia for co-mentions and citation patterns between artists. It builds a weighted influence graph showing documented connections, with source links for every relationship it surfaces. Try \"/influence [artist name]\" to see it in action.",
  },
  {
    question: "Can I publish my research?",
    answer:
      "Yes. Type /publish after any research response and Crate will format and publish your last response as an article. Telegraph is free and requires no account — it works immediately. Tumblr publishing requires a Tumblr API key configured in Settings. Published articles include formatted text, embedded images, and source citations, and you'll receive a public URL to share.",
  },
  {
    question: "How do playlists work?",
    answer:
      "When the agent generates a track list, each track includes a play button linking to a YouTube or Bandcamp embed. You can save the full playlist to your workspace by clicking the save icon on the TrackList component — saved playlists appear in your sidebar under Playlists and persist across sessions.",
  },
  {
    question: "What is a Crate (project)?",
    answer:
      "Crates are folders for organizing your research sessions. You might create a crate for a specific show, a feature article, or a record hunt. Sessions inside a crate share context, meaning the agent can refer back to earlier research within the same crate. Create and manage crates from the sidebar.",
  },
  {
    question: "Does the agent remember previous conversations?",
    answer:
      "Within a session, the agent has full context of the conversation. Across sessions, memory is off by default. Add a Mem0 API key in Settings to enable cross-session memory — the agent will then remember your preferences, artists you've researched, your workflow patterns, and any details you've asked it to keep in mind.",
  },
  {
    question: "How do I get help?",
    answer:
      "You're here! You can also type /help in the chat at any time to open this guide, click the ? icon in the chat header, or click Help in the sidebar navigation. For bug reports or feature requests, use the feedback button at the bottom of the sidebar.",
  },
];

function FaqCard({ item }: { item: FaqItem }) {
  const [open, setOpen] = useState(false);

  return (
    <div
      className="rounded-xl border transition-colors"
      style={{
        backgroundColor: "#18181b",
        borderColor: open ? "rgba(232,82,14,0.3)" : "rgba(245,240,232,0.06)",
      }}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-[15px] font-semibold" style={{ color: "#F5F0E8" }}>
          {item.question}
        </span>
        <span
          className="shrink-0 text-[18px] font-light transition-transform"
          style={{
            color: "#E8520E",
            transform: open ? "rotate(45deg)" : "rotate(0deg)",
          }}
        >
          +
        </span>
      </button>

      {open && (
        <div
          className="px-5 pb-5 text-[14px] leading-relaxed border-t"
          style={{
            color: "#a1a1aa",
            borderColor: "rgba(245,240,232,0.06)",
          }}
        >
          <p className="pt-4">{item.answer}</p>
        </div>
      )}
    </div>
  );
}

export function HelpFaq() {
  return (
    <section id="faq" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        FREQUENTLY ASKED QUESTIONS
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Common questions about Crate.
      </p>

      <div className="space-y-3">
        {FAQ_ITEMS.map((item) => (
          <FaqCard key={item.question} item={item} />
        ))}
      </div>
    </section>
  );
}
