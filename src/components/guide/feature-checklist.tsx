import { SectionDivider } from "../landing/section-divider";

interface ChecklistGroup {
  name: string;
  items: string[];
}

const groups: ChecklistGroup[] = [
  {
    name: "Core Chat",
    items: [
      "Simple greeting responds in ~1-2s",
      "Music research uses full agent (10-30s)",
      "Streaming tokens appear progressively",
      "Tool activity shown during research",
      "Multi-model switching works",
    ],
  },
  {
    name: "Data Sources",
    items: [
      "MusicBrainz",
      "Discogs",
      "Last.fm",
      "Bandcamp",
      "Wikipedia",
      "Ticketmaster",
      "Genius",
      "WhoSampled",
      "Web Search",
    ],
  },
  {
    name: "Skills",
    items: [
      "Artist Deep Dive",
      "Sample Archaeology",
      "Scene Mapping",
      "Vinyl Valuation",
    ],
  },
  {
    name: "Player",
    items: [
      "/play starts YouTube playback",
      "Player bar persists",
      "Pause/resume works",
      "Volume control works",
    ],
  },
  {
    name: "Actions",
    items: ["Copy", "Slack", "Email", "Share"],
  },
  {
    name: "Sidebar & Persistence",
    items: [
      "New chat creates session",
      "Chat history persists",
      "Crates work",
      "Search finds past sessions",
      "Artifacts panel opens",
    ],
  },
  {
    name: "Settings",
    items: [
      "API keys save and encrypt",
      "Model selector shows correct models",
      "OpenRouter models appear",
      "Team key sharing works",
    ],
  },
  {
    name: "Keyboard Shortcuts",
    items: [
      "Cmd+K Search",
      "Cmd+N New chat",
      "Cmd+B Toggle sidebar",
      "Shift+S Settings",
    ],
  },
];

export function FeatureChecklist() {
  return (
    <section
      id="checklist"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="06" label="FEATURE CHECKLIST" dark />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#F5F0E8" }}
      >
        FEATURE <span style={{ color: "#E8520E" }}>CHECKLIST</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "rgba(245,240,232,0.5)" }}
      >
        Verify each feature area works end-to-end. Check off items as you test.
      </p>

      <div className="grid grid-cols-2 max-md:grid-cols-1 gap-8">
        {groups.map((group) => (
          <div
            key={group.name}
            className="border p-6 max-md:p-4"
            style={{
              borderColor: "rgba(245,240,232,0.08)",
              backgroundColor: "rgba(245,240,232,0.03)",
            }}
          >
            <h3
              className="font-[family-name:var(--font-bebas)] text-[24px] tracking-[1px] mb-4"
              style={{ color: "#E8520E" }}
            >
              {group.name}
            </h3>
            <ul className="space-y-2.5">
              {group.items.map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <span
                    className="w-4 h-4 border shrink-0"
                    style={{
                      borderColor: "rgba(245,240,232,0.2)",
                      borderRadius: "2px",
                    }}
                  />
                  <span
                    className="font-[family-name:var(--font-space)] text-[14px]"
                    style={{ color: "rgba(245,240,232,0.6)" }}
                  >
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
