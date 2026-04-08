"use client";

export type PersonaId =
  | "new-user"
  | "radio-host"
  | "dj"
  | "collector"
  | "music-lover"
  | "journalist";

interface Persona {
  id: PersonaId;
  name: string;
  description: string;
  icon: string;
}

const PERSONAS: Persona[] = [
  { id: "new-user", name: "New User", description: "Just getting started with Crate", icon: "👋" },
  { id: "radio-host", name: "Radio Host / Music Director", description: "Show prep, interview research, on-air talking points", icon: "🎙️" },
  { id: "dj", name: "DJ / Producer", description: "Sample digging, genre exploration, playlist building", icon: "🎧" },
  { id: "collector", name: "Record Collector", description: "Album research, discographies, collection management", icon: "📀" },
  { id: "music-lover", name: "Music Lover", description: "Artist discovery, playlists, genre deep dives", icon: "🎵" },
  { id: "journalist", name: "Music Journalist", description: "Artist research, influence mapping, publishing", icon: "✍️" },
];

const DOMAIN_PERSONAS: Record<string, PersonaId[]> = {
  "radiomilwaukee.org": ["radio-host", "dj", "journalist"],
};

function getRecommendedPersonas(email: string | undefined): PersonaId[] {
  if (!email) return [];
  const domain = email.split("@")[1];
  if (!domain) return [];
  return DOMAIN_PERSONAS[domain] ?? [];
}

interface PersonaPickerProps {
  onSelect: (persona: PersonaId) => void;
  userEmail?: string;
}

export function PersonaPicker({ onSelect, userEmail }: PersonaPickerProps) {
  const recommended = getRecommendedPersonas(userEmail);

  return (
    <div className="mx-auto max-w-3xl py-12 px-6">
      <h2
        className="text-[48px] font-bold tracking-[-2px] mb-2"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        HOW DO YOU <span style={{ color: "#E8520E" }}>USE MUSIC</span>?
      </h2>
      <p className="text-[16px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Pick your role and we&apos;ll tailor the guide to your workflow.
      </p>
      <div className="grid grid-cols-2 gap-4 max-md:grid-cols-1">
        {PERSONAS.map((p) => {
          const isRecommended = recommended.includes(p.id);
          return (
            <button
              key={p.id}
              onClick={() => onSelect(p.id)}
              className="group relative rounded-xl border p-5 text-left transition-colors hover:border-[#E8520E]"
              style={{
                backgroundColor: "#0f1a2e",
                borderColor: isRecommended ? "#E8520E" : "rgba(245,240,232,0.06)",
              }}
            >
              {isRecommended && (
                <span
                  className="absolute top-3 right-3 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  style={{ backgroundColor: "#E8520E", color: "#0A1628" }}
                >
                  Recommended
                </span>
              )}
              <div className="text-2xl mb-2">{p.icon}</div>
              <h3 className="text-[17px] font-semibold mb-1" style={{ color: "#F5F0E8" }}>
                {p.name}
              </h3>
              <p className="text-[13px]" style={{ color: "#7a8a9a" }}>
                {p.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Helper to read/write persona from localStorage for anonymous users
const STORAGE_KEY = "crate-help-persona";

export function getStoredPersona(): PersonaId | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEY) as PersonaId | null;
}

export function setStoredPersona(persona: PersonaId): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, persona);
}
