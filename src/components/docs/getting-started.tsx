import { SectionDivider } from "../landing/section-divider";

const steps = [
  {
    num: "01",
    title: "SIGN UP",
    description:
      "Create a free account. No credit card required. You can start researching immediately with Crate's built-in API keys.",
  },
  {
    num: "02",
    title: "ASK A QUESTION",
    description:
      'Type any music question in the chat — "Who influenced Erykah Badu?" or "Build me a neo-soul set for Friday." Crate\'s agent handles the rest.',
  },
  {
    num: "03",
    title: "EXPLORE RESULTS",
    description:
      "Results appear as interactive cards — influence chains, playlists with playback, show prep packages. Save anything to your collections.",
  },
  {
    num: "04",
    title: "GO DEEPER",
    description:
      "Use slash commands for specialized research. Configure your own API keys for unlimited usage. Publish and share your findings.",
  },
];

export function GettingStarted() {
  return (
    <section
      id="getting-started"
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#0A1628" }}
    >
      <SectionDivider number="01" label="GETTING STARTED" dark />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
        style={{ color: "#F5F0E8" }}
      >
        ZERO TO <span style={{ color: "#E8520E" }}>DIGGING</span>
      </h2>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[500px]"
        style={{ color: "#6a7a8a" }}
      >
        Get started in under a minute. No setup required.
      </p>

      <div className="grid grid-cols-4 gap-6 max-lg:grid-cols-2 max-md:grid-cols-1 max-md:gap-5">
        {steps.map((step) => (
          <div
            key={step.num}
            className="border p-6 relative"
            style={{ borderColor: "rgba(245,240,232,0.08)" }}
          >
            <span
              className="font-[family-name:var(--font-bebas)] text-[48px] leading-none absolute top-3 right-4"
              style={{ color: "#E8520E", opacity: 0.15 }}
            >
              {step.num}
            </span>
            <h3
              className="font-[family-name:var(--font-bebas)] text-[22px] tracking-[1px] mb-2"
              style={{ color: "#F5F0E8" }}
            >
              {step.title}
            </h3>
            <p
              className="font-[family-name:var(--font-space)] text-[14px] leading-relaxed"
              style={{ color: "#7a8a9a" }}
            >
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
