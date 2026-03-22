import Link from "next/link";
import { Check, X } from "lucide-react";
import { SectionDivider } from "./section-divider";
import { ScrollReveal } from "./scroll-reveal";

interface Feature {
  label: string;
  free: string | boolean;
  pro: string | boolean;
  team: string | boolean;
}

const features: Feature[] = [
  {
    label: "Agent research queries / month",
    free: "10",
    pro: "50",
    team: "200 (pooled)",
  },
  {
    label: "Custom skills",
    free: "3",
    pro: "20",
    team: "50",
  },
  {
    label: "Saved sessions",
    free: "5",
    pro: "Unlimited",
    team: "Unlimited",
  },
  {
    label: "Publishing (/publish, /published)",
    free: false,
    pro: true,
    team: true,
  },
  {
    label: "Cross-session memory (Mem0)",
    free: false,
    pro: true,
    team: true,
  },
  {
    label: "Influence cache (write access)",
    free: false,
    pro: true,
    team: true,
  },
  {
    label: "Admin dashboard",
    free: false,
    pro: false,
    team: true,
  },
  {
    label: "Shared org keys",
    free: false,
    pro: false,
    team: true,
  },
];

type PlanKey = "free" | "pro" | "team";

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <Check className="w-4 h-4 text-cyan-400 mx-auto" aria-label="Included" />;
  }
  if (value === false) {
    return <X className="w-4 h-4 text-zinc-600 mx-auto" aria-label="Not included" />;
  }
  return (
    <span className="font-[family-name:var(--font-space)] text-sm text-zinc-300">
      {value}
    </span>
  );
}

const plans: {
  id: PlanKey;
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaHref: string;
  isExternal?: boolean;
  highlighted: boolean;
}[] = [
  {
    id: "free",
    name: "FREE",
    price: "$0",
    period: "forever",
    description: "Get started with music research. No credit card required.",
    cta: "Get Started",
    ctaHref: "/sign-up",
    highlighted: false,
  },
  {
    id: "pro",
    name: "PRO",
    price: "$15",
    period: "/ month",
    description:
      "For DJs, music journalists, and serious crate diggers who need full access.",
    cta: "Start Pro",
    ctaHref: "/sign-up?plan=pro",
    highlighted: true,
  },
  {
    id: "team",
    name: "TEAM",
    price: "$25",
    period: "/ month",
    description: "For radio stations, labels, and organizations sharing one workspace.",
    cta: "Contact Us",
    ctaHref: "mailto:hello@crate.fm",
    isExternal: true,
    highlighted: false,
  },
];

export function Pricing() {
  return (
    <section
      className="py-20 px-12 max-md:px-5 max-md:py-12"
      style={{ backgroundColor: "#09090b" }}
      id="pricing"
    >
      <SectionDivider number="06" label="PRICING" dark />

      <ScrollReveal>
        <div className="mb-12">
          <h2
            className="font-[family-name:var(--font-bebas)] text-[72px] max-lg:text-[64px] max-md:text-[48px] max-[375px]:text-[40px] leading-[0.9] tracking-[-2px]"
            style={{ color: "#F5F0E8" }}
          >
            PICK YOUR
            <br />
            <span style={{ color: "#22d3ee" }}>PLAN</span>
          </h2>
          <p
            className="font-[family-name:var(--font-space)] text-[16px] mt-4 max-w-[540px]"
            style={{ color: "#a1a1aa" }}
          >
            Start free. Upgrade when your research outgrows it.
          </p>
        </div>
      </ScrollReveal>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-6 max-w-[1000px] max-lg:grid-cols-1 max-lg:gap-5">
        {plans.map((plan) => (
          <ScrollReveal key={plan.id}>
            <div
              className="relative flex flex-col h-full p-8 border rounded-sm"
              style={{
                backgroundColor: plan.highlighted ? "#18181b" : "#18181b",
                borderColor: plan.highlighted
                  ? "#22d3ee"
                  : "rgba(63,63,70,0.6)",
                boxShadow: plan.highlighted
                  ? "0 0 0 1px rgba(34,211,238,0.15), 0 4px 32px rgba(34,211,238,0.06)"
                  : "none",
              }}
            >
              {/* Most Popular badge */}
              {plan.highlighted && (
                <div
                  className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 text-xs tracking-[3px] font-[family-name:var(--font-bebas)]"
                  style={{
                    backgroundColor: "#22d3ee",
                    color: "#09090b",
                  }}
                >
                  MOST POPULAR
                </div>
              )}

              {/* Plan name */}
              <h3
                className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[3px] mb-1"
                style={{
                  color: plan.highlighted ? "#22d3ee" : "#F5F0E8",
                }}
              >
                {plan.name}
              </h3>

              {/* Price */}
              <div className="flex items-baseline gap-1.5 mb-3">
                <span
                  className="font-[family-name:var(--font-bebas)] text-[56px] leading-none"
                  style={{ color: "#F5F0E8" }}
                >
                  {plan.price}
                </span>
                <span
                  className="font-[family-name:var(--font-space)] text-sm"
                  style={{ color: "#71717a" }}
                >
                  {plan.period}
                </span>
              </div>

              {/* Description */}
              <p
                className="font-[family-name:var(--font-space)] text-[14px] mb-6 leading-snug"
                style={{ color: "#a1a1aa" }}
              >
                {plan.description}
              </p>

              {/* Feature list */}
              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature) => {
                  const value = feature[plan.id];
                  return (
                    <li
                      key={feature.label}
                      className="flex items-center gap-3"
                    >
                      <span className="shrink-0 w-4 flex justify-center">
                        <FeatureValue value={value} />
                      </span>
                      <span
                        className="font-[family-name:var(--font-space)] text-[13px]"
                        style={{
                          color:
                            value === false ? "#52525b" : "#d4d4d8",
                        }}
                      >
                        {feature.label}
                      </span>
                    </li>
                  );
                })}
              </ul>

              {/* CTA */}
              {plan.isExternal ? (
                <a
                  href={plan.ctaHref}
                  className="block text-center py-3 px-6 font-[family-name:var(--font-bebas)] text-[18px] tracking-[2px] border transition-colors duration-200"
                  style={{
                    borderColor: "rgba(63,63,70,0.8)",
                    color: "#F5F0E8",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                      "rgba(63,63,70,0.4)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLAnchorElement).style.backgroundColor =
                      "transparent";
                  }}
                >
                  {plan.cta}
                </a>
              ) : (
                <Link
                  href={plan.ctaHref}
                  className="block text-center py-3 px-6 font-[family-name:var(--font-bebas)] text-[18px] tracking-[2px] transition-colors duration-200"
                  style={
                    plan.highlighted
                      ? { backgroundColor: "#22d3ee", color: "#09090b" }
                      : {
                          border: "1px solid rgba(63,63,70,0.8)",
                          color: "#F5F0E8",
                          backgroundColor: "transparent",
                        }
                  }
                >
                  {plan.cta}
                </Link>
              )}
            </div>
          </ScrollReveal>
        ))}
      </div>

      {/* BYOK note */}
      <ScrollReveal>
        <p
          className="mt-10 max-w-[640px] font-[family-name:var(--font-space)] text-[13px] leading-relaxed"
          style={{
            color: "#52525b",
            borderLeft: "2px solid rgba(34,211,238,0.25)",
            paddingLeft: "12px",
          }}
        >
          <span style={{ color: "#22d3ee" }}>BYOK:</span> Bring your own
          Anthropic or OpenRouter API key for unlimited research queries on any
          plan.
        </p>
      </ScrollReveal>
    </section>
  );
}
