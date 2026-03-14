import Link from "next/link";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { DocsHero } from "@/components/docs/docs-hero";
import { GettingStarted } from "@/components/docs/getting-started";
import { Commands } from "@/components/docs/commands";
import { PromptExamples } from "@/components/docs/prompt-examples";
import { UseCases } from "@/components/docs/use-cases";
import { DataSources } from "@/components/docs/data-sources";
import { ApiKeys } from "@/components/docs/api-keys";
import { DocsFaq } from "@/components/docs/docs-faq";

export default function DocsPage() {
  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)]`}
    >
      <Nav />
      <DocsHero />
      <DocsNav />
      <GettingStarted />
      <Commands />
      <PromptExamples />
      <UseCases />
      <DataSources />
      <ApiKeys />
      <DocsFaq />
      <Footer />
    </main>
  );
}

function DocsNav() {
  const sections = [
    { label: "GETTING STARTED", href: "#getting-started" },
    { label: "COMMANDS", href: "#commands" },
    { label: "PROMPTS", href: "#prompts" },
    { label: "USE CASES", href: "#use-cases" },
    { label: "SOURCES", href: "#sources" },
    { label: "API KEYS", href: "#api-keys" },
    { label: "FAQ", href: "#faq" },
  ];

  return (
    <nav
      className="sticky top-20 z-40 py-3 px-12 max-md:px-5 overflow-x-auto"
      style={{
        backgroundColor: "#0A1628",
        borderBottom: "1px solid rgba(245,240,232,0.06)",
      }}
    >
      <div className="flex gap-6 max-md:gap-4 whitespace-nowrap">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[2px] transition-opacity hover:opacity-100"
            style={{ color: "#F5F0E8", opacity: 0.5 }}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
