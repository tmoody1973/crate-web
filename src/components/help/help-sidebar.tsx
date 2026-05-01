"use client";

import { useEffect, useState } from "react";
import type { PersonaId } from "./persona-picker";

interface SidebarSection {
  id: string;
  label: string;
}

const PERSONA_SECTIONS: Record<PersonaId, SidebarSection[]> = {
  "new-user": [
    { id: "getting-started", label: "Getting Started" },
  ],
  "radio-host": [
    { id: "getting-started", label: "Getting Started" },
    { id: "show-prep", label: "Show Prep" },
    { id: "interview-research", label: "Interview Research" },
    { id: "influence-mapping", label: "Influence Mapping" },
    { id: "publishing", label: "Publishing" },
  ],
  "dj": [
    { id: "getting-started", label: "Getting Started" },
    { id: "sample-digging", label: "Sample Digging" },
    { id: "genre-exploration", label: "Genre Exploration" },
    { id: "playlist-building", label: "Playlist Building" },
    { id: "bandcamp-discovery", label: "Bandcamp Discovery" },
  ],
  "collector": [
    { id: "getting-started", label: "Getting Started" },
    { id: "collection-management", label: "Collection Management" },
    { id: "album-research", label: "Album Research" },
    { id: "discography-dives", label: "Discography Deep Dives" },
  ],
  "music-lover": [
    { id: "getting-started", label: "Getting Started" },
    { id: "artist-discovery", label: "Artist Discovery" },
    { id: "playlist-creation", label: "Playlist Creation" },
    { id: "genre-exploration", label: "Genre Exploration" },
  ],
  "journalist": [
    { id: "getting-started", label: "Getting Started" },
    { id: "artist-research", label: "Artist Research" },
    { id: "influence-mapping", label: "Influence Mapping" },
    { id: "publishing", label: "Publishing" },
    { id: "source-citations", label: "Source Citations" },
  ],
};

const REFERENCE_SECTIONS: SidebarSection[] = [
  { id: "commands", label: "All Commands" },
  { id: "sources", label: "Data Sources" },
  { id: "api-keys", label: "API Keys Setup" },
  { id: "prompts", label: "Example Prompts" },
  { id: "faq", label: "FAQ" },
];

const PERSONA_LABELS: Record<PersonaId, string> = {
  "new-user": "New User",
  "radio-host": "Radio Host",
  "dj": "DJ / Producer",
  "collector": "Record Collector",
  "music-lover": "Music Lover",
  "journalist": "Journalist",
};

interface HelpSidebarProps {
  persona: PersonaId;
  onChangePersona: () => void;
}

export function HelpSidebar({ persona, onChangePersona }: HelpSidebarProps) {
  const [activeSection, setActiveSection] = useState("getting-started");
  const personaSections = PERSONA_SECTIONS[persona];

  // Track scroll position to highlight active section
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        }
      },
      { rootMargin: "-100px 0px -60% 0px" },
    );

    const allSections = [...personaSections, ...REFERENCE_SECTIONS];
    for (const s of allSections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [persona, personaSections]);

  function scrollTo(id: string) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", `#${id}`);
    }
  }

  return (
    <nav
      className="w-[220px] shrink-0 overflow-y-auto border-r px-4 pb-4 pt-6 max-md:hidden"
      style={{ backgroundColor: "#111", borderColor: "rgba(245,240,232,0.06)" }}
    >
      {/* Persona badge */}
      <div
        className="mb-5 rounded-lg border p-3"
        style={{ backgroundColor: "#1c1917", borderColor: "#44403c" }}
      >
        <div className="text-[10px] uppercase tracking-wider" style={{ color: "#a1a1aa" }}>
          Your role
        </div>
        <div className="mt-0.5 text-[13px] font-semibold" style={{ color: "#E8520E" }}>
          {PERSONA_LABELS[persona]}
        </div>
        <button
          onClick={onChangePersona}
          className="mt-1 text-[11px] hover:underline"
          style={{ color: "#71717a" }}
        >
          Change
        </button>
      </div>

      {/* For You */}
      <SidebarGroup label="For You" sections={personaSections} active={activeSection} onSelect={scrollTo} />

      {/* Reference */}
      <SidebarGroup label="Reference" sections={REFERENCE_SECTIONS} active={activeSection} onSelect={scrollTo} />
    </nav>
  );
}

function SidebarGroup({
  label,
  sections,
  active,
  onSelect,
}: {
  label: string;
  sections: SidebarSection[];
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-4">
      <div
        className="mb-2 px-2 text-[10px] uppercase tracking-wider"
        style={{ color: "#71717a" }}
      >
        {label}
      </div>
      {sections.map((s) => (
        <button
          key={s.id}
          onClick={() => onSelect(s.id)}
          className="block w-full rounded px-2 py-1.5 text-left text-[13px] transition-colors"
          style={{
            color: active === s.id ? "#fff" : "#d4d4d8",
            backgroundColor: active === s.id ? "#1c1917" : "transparent",
            borderLeft: active === s.id ? "2px solid #E8520E" : "2px solid transparent",
          }}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
