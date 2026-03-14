import Link from "next/link";
import { ScrollReveal } from "./scroll-reveal";

export function FinalCta() {
  return (
    <section
      className="py-24 px-12 max-md:px-5 max-md:py-16 text-center relative overflow-hidden"
      style={{ backgroundColor: "var(--midnight)" }}
    >
      {/* Vertical text left */}
      <p
        className="absolute max-md:hidden"
        style={{
          left: "16px",
          top: "50%",
          writingMode: "vertical-rl",
          transform: "translateY(-50%) rotate(180deg)",
          fontFamily: "var(--font-bebas)",
          fontSize: "10px",
          letterSpacing: "5px",
          color: "var(--orange)",
          opacity: 0.20,
        }}
        aria-hidden="true"
      >
        RESEARCH • DISCOVER • CREATE • SHARE
      </p>

      {/* Vertical text right */}
      <p
        className="absolute max-md:hidden"
        style={{
          right: "16px",
          top: "50%",
          writingMode: "vertical-rl",
          transform: "translateY(-50%)",
          fontFamily: "var(--font-bebas)",
          fontSize: "10px",
          letterSpacing: "5px",
          color: "var(--cream)",
          opacity: 0.08,
        }}
        aria-hidden="true"
      >
        CRATE — AI-POWERED MUSIC INTELLIGENCE — VOL. 1
      </p>

      <ScrollReveal>
        <h2
          className="font-[family-name:var(--font-bebas)] text-[96px] max-lg:text-[80px] max-md:text-[56px] max-[375px]:text-[44px] leading-[0.9] tracking-[-2px] mb-4"
          style={{ color: "var(--cream)" }}
        >
          START
          <br />
          <span style={{ color: "var(--orange)" }}>DIGGING.</span>
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
            backgroundColor: "var(--orange)",
            color: "var(--cream)",
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
