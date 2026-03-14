import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCta() {
  return (
    <section
      className="py-24 px-12 max-md:px-5 max-md:py-16 text-center relative overflow-hidden"
      style={{ backgroundColor: "#0A1628" }}
    >
      {/* Vertical text left */}
      <p
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          left: "16px",
          top: "50%",
          writingMode: "vertical-rl",
          transform: "translateY(-50%) rotate(180deg)",
          fontSize: "10px",
          letterSpacing: "5px",
          color: "#E8520E",
          opacity: 0.2,
        }}
        aria-hidden="true"
      >
        RESEARCH • DISCOVER • CREATE • SHARE
      </p>

      {/* Vertical text right */}
      <p
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          right: "16px",
          top: "50%",
          writingMode: "vertical-rl",
          transform: "translateY(-50%)",
          fontSize: "10px",
          letterSpacing: "5px",
          color: "#F5F0E8",
          opacity: 0.08,
        }}
        aria-hidden="true"
      >
        CRATE — AI-POWERED MUSIC INTELLIGENCE — VOL. 1
      </p>

      <ScrollReveal>
        <h2
          className="font-[family-name:var(--font-bebas)] text-[96px] max-lg:text-[80px] max-md:text-[56px] max-[375px]:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
          style={{ color: "#F5F0E8" }}
        >
          START
          <br />
          <span style={{ color: "#E8520E" }}>DIGGING.</span>
        </h2>

        <p
          className="font-[family-name:var(--font-space)] text-[18px] max-md:text-[16px] mb-8 max-w-[500px] mx-auto"
          style={{ color: "#6a7a8a" }}
        >
          Free to use. Bring your own API keys or use ours. Your research, your
          crates, your music.
        </p>

        <Link
          href="/sign-in"
          className="inline-block font-[family-name:var(--font-bebas)] text-[20px] tracking-[2px] px-12 py-4 transition-all duration-200 hover:opacity-90 hover:-translate-y-px"
          style={{
            backgroundColor: "#E8520E",
            color: "#F5F0E8",
            paddingTop: "18px",
            paddingBottom: "18px",
          }}
        >
          GET STARTED — IT&apos;S FREE
        </Link>

        <p
          className="font-[family-name:var(--font-bebas)] text-[11px] tracking-[4px] mt-12"
          style={{ color: "rgba(245,240,232,0.15)" }}
        >
          CRATE VOL. 1 — WEB EDITION — MILWAUKEE, WI
        </p>
      </ScrollReveal>
    </section>
  );
}
