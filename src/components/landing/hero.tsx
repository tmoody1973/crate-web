import Link from "next/link";

export function Hero() {
  return (
    <section
      className="relative min-h-[700px] overflow-hidden pb-20"
      style={{ backgroundColor: "#F5F0E8" }}
    >
      {/* 1. Orange accent block — behind photo, z-1 */}
      <div
        className="absolute max-md:hidden"
        style={{
          right: "40px",
          top: "10px",
          width: "480px",
          height: "620px",
          backgroundColor: "#E8520E",
          clipPath: "polygon(0% 4%, 100% 0%, 96% 100%, 4% 94%)",
          zIndex: 1,
        }}
        aria-hidden="true"
      />

      {/* 2. Photo — on top of orange block, z-2 */}
      <div
        className="absolute max-md:relative max-md:right-auto max-md:top-auto max-md:h-[300px] max-md:w-full"
        role="img"
        aria-label="Record store shelves with vinyl albums"
        style={{
          right: "-20px",
          top: "20px",
          width: "58%",
          height: "560px",
          backgroundImage:
            "url('/photos/mick-haupt-CbNBjnXXhNg-unsplash.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: "polygon(12% 0%, 100% 0%, 100% 82%, 0% 100%)",
          filter: "grayscale(40%) contrast(1.1)",
          opacity: 0.85,
          zIndex: 2,
        }}
      />

      {/* 3. Headline — z-3, with DEEP at z-4 to overlap photo */}
      <div
        className="absolute flex items-start gap-5 max-md:relative max-md:left-auto max-md:top-auto max-md:px-5 max-md:pt-10 max-md:gap-3"
        style={{ left: "48px", top: "60px", zIndex: 3 }}
      >
        {/* Wordmark — stretches top-to-bottom of headline */}
        <div className="self-stretch max-md:hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_wordmark.svg"
            alt="Crate"
            style={{ height: "100%", width: "auto", objectFit: "contain" }}
          />
        </div>

        {/* Headline text */}
        <div>
          <span
            className="block font-[family-name:var(--font-bebas)] text-[140px] max-lg:text-[120px] max-md:text-[72px] max-[375px]:text-[56px]"
            style={{
              color: "#0A1628",
              lineHeight: "0.88",
              letterSpacing: "-3px",
            }}
          >
            DIG
          </span>
          <span
            className="block font-[family-name:var(--font-bebas)] text-[140px] max-lg:text-[120px] max-md:text-[72px] max-[375px]:text-[56px] relative"
            style={{
              color: "#E8520E",
              lineHeight: "0.88",
              letterSpacing: "-3px",
              zIndex: 4,
            }}
          >
            DEEP
          </span>
          <span
            className="block font-[family-name:var(--font-bebas)] text-[140px] max-lg:text-[120px] max-md:text-[72px] max-[375px]:text-[56px]"
            style={{
              color: "#0A1628",
              lineHeight: "0.88",
              letterSpacing: "-3px",
            }}
          >
            ER.
          </span>
        </div>
      </div>

      {/* 4. Tagline */}
      <div
        className="absolute max-md:relative max-md:left-auto max-md:top-auto max-md:mt-4 max-md:px-5"
        style={{ left: "52px", top: "410px", zIndex: 5 }}
      >
        <p
          className="font-[family-name:var(--font-bebas)] text-[28px] max-md:text-xl tracking-[2px]"
          style={{ color: "#E8520E" }}
        >
          Crate is Spotify for The Curious
        </p>
      </div>

      {/* 5. Subhead */}
      <div
        className="absolute max-md:relative max-md:left-auto max-md:top-auto max-md:mt-2 max-md:px-5 max-md:max-w-none"
        style={{ left: "52px", top: "460px", zIndex: 5, maxWidth: "360px" }}
      >
        <p
          className="font-[family-name:var(--font-space)] text-[17px] max-md:text-[15px] leading-relaxed"
          style={{ color: "#3a4a5c" }}
        >
          AI-powered music research for DJs, producers, and crate diggers. 19
          sources. One agent. Zero tabs.
        </p>
      </div>

      {/* 6. CTAs */}
      <div
        className="absolute flex gap-3 max-md:relative max-md:left-auto max-md:top-auto max-md:mt-6 max-md:flex-col max-md:px-5"
        style={{ left: "52px", top: "560px", zIndex: 5 }}
      >
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] px-8 py-3.5 text-[16px] tracking-[2px] border-none transition-all hover:opacity-90 hover:-translate-y-px text-center"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          START DIGGING
        </Link>
        <a
          href="#how-it-works"
          className="font-[family-name:var(--font-bebas)] border-2 bg-transparent px-8 py-3.5 text-[16px] tracking-[2px] transition-all hover:opacity-80 text-center"
          style={{ borderColor: "#0A1628", color: "#0A1628" }}
        >
          HOW IT WORKS
        </a>
      </div>

      {/* 7. Vertical text right */}
      <div
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          right: "16px",
          top: "100px",
          writingMode: "vertical-rl",
          fontSize: "11px",
          letterSpacing: "5px",
          color: "#E8520E",
          opacity: 0.5,
          zIndex: 2,
        }}
        aria-hidden="true"
      >
        AI-POWERED MUSIC INTELLIGENCE
      </div>

      {/* 8. Vertical text left */}
      <div
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          left: "16px",
          bottom: "60px",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontSize: "10px",
          letterSpacing: "4px",
          color: "#0A1628",
          opacity: 0.15,
          zIndex: 2,
        }}
        aria-hidden="true"
      >
        CRATE — MILWAUKEE 2024
      </div>

      {/* 9. Edition mark */}
      <div
        className="absolute max-md:hidden font-[family-name:var(--font-bebas)]"
        style={{
          right: "48px",
          bottom: "16px",
          fontSize: "11px",
          letterSpacing: "3px",
          color: "#0A1628",
          opacity: 0.2,
        }}
        aria-hidden="true"
      >
        VOL. 1 — WEB EDITION
      </div>
    </section>
  );
}
