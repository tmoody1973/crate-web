import type { PersonaId } from "./persona-picker";

export function PersonaGuides({ persona }: { persona: PersonaId }) {
  return (
    <section id="persona-guides" className="mb-16">
      <h2 className="text-[28px] font-bold mb-4" style={{ color: "#F5F0E8" }}>
        Workflow Guides
      </h2>
      <p style={{ color: "#7a8a9a" }}>Coming soon — {persona}.</p>
    </section>
  );
}
