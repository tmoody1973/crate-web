"use client";

import { useState } from "react";

interface FaqItem {
  question: string;
  answer: string;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "What's included in the free plan?",
    answer:
      "10 agent research queries per month, 5 saved sessions, 3 custom skills, and access to all 20+ data sources. Free includes Spotify connection, playlist creation, influence mapping, show prep, and news. No credit card required.",
  },
  {
    question: "What do I get with Pro ($15/mo)?",
    answer:
      "50 agent queries/month, unlimited sessions, 20 custom skills, cross-session memory (Mem0), influence caching, and publishing to Telegraph/Tumblr. Pro also lets you bring your own API key for unlimited queries. If you work in music professionally, Pro pays for itself in the first research session.",
  },
  {
    question: "Do I need an API key?",
    answer:
      "No. Free and Pro users can use Crate's built-in AI without any API key. If you want unlimited queries or want to use a specific model (GPT-4o, Gemini, etc.), you can add your own Anthropic or OpenRouter key in Settings. BYOK users have no query limits.",
  },
  {
    question: "How does Spotify connection work?",
    answer:
      "In Settings, click Connect next to Spotify. This uses OAuth (powered by Auth0) to link your Spotify account. Once connected, Crate can read your playlists and saved tracks, research the artists you listen to, and create new playlists directly in your Spotify account. Crate never stores your Spotify password.",
  },
  {
    question: "Can Crate send to Slack?",
    answer:
      "Yes. Connect Slack in Settings, then say 'send to Slack' after any research. Crate shows a channel picker and sends a formatted message with Block Kit (headers, bullet lists, tables, dividers). You can also send DMs by saying 'send to @username'.",
  },
  {
    question: "What are Deep Cuts?",
    answer:
      "Deep Cuts are your saved research artifacts — influence chains, playlists, show prep packages, artist cards. They appear in the resizable panel on the right side of the workspace. You can switch between them with the dropdown, publish them as shareable links, export to Spotify, or send to Slack.",
  },
  {
    question: "How do custom skills work?",
    answer:
      "Type /create-skill followed by a description of what you want (e.g. 'search Dusty Groove for vinyl records'). Crate does a dry run using real tools, shows you the results, then saves it as a reusable slash command. Free users get 3 skills, Pro gets 20.",
  },
  {
    question: "How does influence mapping work?",
    answer:
      "Type /influence [artist] and Crate searches music publications, review databases, Last.fm, and Wikipedia for documented connections. It then enriches each connection via Perplexity with pull quotes, sonic elements, and key works. The result is a visual timeline with cited sources you can verify.",
  },
  {
    question: "Can I publish and share research?",
    answer:
      "Yes, two ways. Click Publish on any Deep Cut to get a shareable link (digcrate.app/cuts/...) anyone can view. Pro users can also use /publish to push to Telegraph or Tumblr as a formatted article with citations.",
  },
  {
    question: "Does Crate remember previous conversations?",
    answer:
      "Within a session, full context is maintained. Across sessions, memory requires Pro (powered by Mem0). With memory enabled, Crate remembers your preferences, past research, and workflow patterns.",
  },
  {
    question: "Is my data secure?",
    answer:
      "API keys are encrypted with AES-256-GCM. Spotify/Slack/Google tokens are managed by Auth0 Token Vault — Crate never stores raw OAuth credentials. Research data is stored in Convex with per-user isolation.",
  },
  {
    question: "How do I get help?",
    answer:
      "Type /help in chat, click Help in the top nav, or use the feedback button in the sidebar. For bug reports and feature requests, the feedback widget goes directly to our Canny board.",
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
