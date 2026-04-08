import { SectionDivider } from "../landing/section-divider";

interface Prompt {
  prompt: string;
  expected: string;
}

interface Category {
  name: string;
  prompts: Prompt[];
}

interface Persona {
  number: string;
  name: string;
  tagline: string;
  description: string;
  categories: Category[];
}

export function PersonaSection({
  persona,
  dark = false,
}: {
  persona: Persona;
  dark?: boolean;
}) {
  const bg = dark ? "#0A1628" : "#F5F0E8";
  const headingColor = dark ? "#F5F0E8" : "#0A1628";
  const bodyColor = dark ? "rgba(245,240,232,0.6)" : "#3a4a5c";
  const mutedColor = dark ? "rgba(245,240,232,0.4)" : "#6a7a8a";
  const cardBg = dark
    ? "rgba(245,240,232,0.04)"
    : "rgba(255,255,255,0.4)";
  const cardBorder = dark
    ? "rgba(245,240,232,0.08)"
    : "rgba(10,22,40,0.1)";

  return (
    <section
      id={persona.name.toLowerCase().replace(/\s+/g, "-")}
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: bg }}
    >
      <SectionDivider
        number={persona.number}
        label={persona.name.toUpperCase()}
        dark={dark}
      />

      <h2
        className="font-[family-name:var(--font-bebas)] text-[64px] max-md:text-[44px] leading-[0.9] tracking-[-2px] mb-2"
        style={{ color: headingColor }}
      >
        {persona.name.split(" ")[0]}{" "}
        <span style={{ color: "#E8520E" }}>
          {persona.name.split(" ").slice(1).join(" ") || persona.name}
        </span>
      </h2>
      <p
        className="font-[family-name:var(--font-bebas)] text-[20px] tracking-[2px] mb-2"
        style={{ color: "#E8520E" }}
      >
        {persona.tagline}
      </p>
      <p
        className="font-[family-name:var(--font-space)] text-[16px] mb-12 max-w-[600px]"
        style={{ color: mutedColor }}
      >
        {persona.description}
      </p>

      {persona.categories.map((category) => (
        <div key={category.name} className="mb-12 last:mb-0">
          <h3
            className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[1px] mb-6"
            style={{ color: headingColor }}
          >
            {category.name}
          </h3>

          <div className="space-y-4">
            {category.prompts.map((item, i) => (
              <div
                key={i}
                className="border p-6 max-md:p-4 transition-colors hover:border-[#E8520E]"
                style={{
                  borderColor: cardBorder,
                  backgroundColor: cardBg,
                }}
              >
                <code
                  className="block font-[family-name:var(--font-space)] text-[14px] max-md:text-[13px] px-4 py-3 mb-3 leading-relaxed"
                  style={{
                    backgroundColor: "#0A1628",
                    color: "#E8520E",
                    borderRadius: "2px",
                  }}
                >
                  {item.prompt}
                </code>
                <div className="flex items-start gap-2">
                  <span
                    className="font-[family-name:var(--font-bebas)] text-[11px] tracking-[2px] mt-0.5 shrink-0"
                    style={{ color: mutedColor }}
                  >
                    EXPECTED
                  </span>
                  <p
                    className="font-[family-name:var(--font-space)] text-[13px] leading-relaxed"
                    style={{ color: bodyColor }}
                  >
                    {item.expected}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}
