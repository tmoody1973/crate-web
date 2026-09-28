import { SectionDivider } from "../landing/section-divider";

const tips = [
  {
    number: "01",
    title: "Start simple",
    body: "Try a greeting first to verify the fast path works.",
  },
  {
    number: "02",
    title: "Check the tools",
    body: "Watch the tool activity indicator during research.",
  },
  {
    number: "03",
    title: "Try follow-ups",
    body: "After a research response, ask a follow-up to test context.",
  },
  {
    number: "04",
    title: "Test edge cases",
    body: "Misspelled artist names, obscure genres, very old records.",
  },
  {
    number: "05",
    title: "Compare models",
    body: "Try the same query with Claude Haiku vs Sonnet.",
  },
  {
    number: "06",
    title: "Check sources",
    body: "Verify that links and data match the original sources.",
  },
];

export function GuideTips() {
  return (
    <section
      id="tips"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      <SectionDivider number="07" label="TIPS" />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#0A1628" }}
      >
        TESTING <span style={{ color: "#E8520E" }}>TIPS</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: "#6a7a8a" }}
      >
        General advice for getting the most out of your testing sessions.
      </p>

      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-6">
        {tips.map((tip) => (
          <div
            key={tip.number}
            className="border p-6 transition-colors hover:border-[#E8520E]"
            style={{
              borderColor: "rgba(10,22,40,0.1)",
              backgroundColor: "rgba(255,255,255,0.4)",
            }}
          >
            <span
              className="font-[family-name:var(--font-bebas)] text-[36px] leading-none"
              style={{ color: "#E8520E", opacity: 0.3 }}
            >
              {tip.number}
            </span>
            <h3
              className="font-[family-name:var(--font-bebas)] text-[22px] tracking-[1px] mt-2 mb-2"
              style={{ color: "#0A1628" }}
            >
              {tip.title}
            </h3>
            <p
              className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
              style={{ color: "#5a6a7a" }}
            >
              {tip.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
