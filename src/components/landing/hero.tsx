import Link from "next/link";

export function Hero() {
  return (
    <section
      className="relative min-h-[600px] overflow-hidden"
      style={{ backgroundColor: "var(--cream)" }}
    >
      {/* 1. Orange accent block — hidden on mobile */}
      <div
        className="absolute max-md:hidden"
        style={{
          right: "100px",
          top: "30px",
          width: "320px",
          height: "380px",
          backgroundColor: "var(--orange)",
          opacity: 0.9,
          clipPath: "polygon(0% 4%, 100% 0%, 96% 100%, 4% 94%)",
        }}
        aria-hidden="true"
      />

      {/* 2. Photo div */}
      <div
        className="absolute max-md:relative max-md:h-[300px] max-md:w-full"
        role="img"
        aria-label="Record store wall filled with vinyl crates"
        style={{
          right: "-30px",
          top: "50px",
          width: "52%",
          height: "480px",
          backgroundImage:
            "url('/photos/mick-haupt-CbNBjnXXhNg-unsplash.jpg')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          clipPath: "polygon(12% 0%, 100% 0%, 100% 82%, 0% 100%)",
          filter: "grayscale(40%) contrast(1.1)",
          opacity: 0.85,
        }}
      />

      {/* 3. Headline */}
      <div
        className="absolute max-md:relative max-md:px-5 max-md:pt-10"
        style={{ left: "48px", top: "60px", zIndex: 3 }}
      >
        <div
          className="flex flex-col font-[family-name:var(--font-bebas)] leading-[0.88] tracking-[-3px] text-[140px] max-lg:text-[120px] max-md:text-[72px] max-[375px]:text-[56px]"
        >
          <span style={{ color: "var(--midnight)" }}>DIG</span>
          <span style={{ color: "var(--orange)", zIndex: 4, position: "relative" }}>
            DEEP
          </span>
          <span style={{ color: "var(--midnight)" }}>ER.</span>
        </div>
      </div>

      {/* 4. Tagline */}
      <div
        className="absolute max-md:relative max-md:mt-4 max-md:px-5"
        style={{ left: "52px", top: "400px", zIndex: 5 }}
      >
        <p
          className="font-[family-name:var(--font-bebas)] text-[28px] tracking-[2px] max-md:text-xl"
          style={{ color: "var(--orange)" }}
        >
          Crate is Spotify for The Curious
        </p>
      </div>

      {/* 5. Subhead */}
      <div
        className="absolute max-md:relative max-md:mt-2 max-md:px-5"
        style={{ left: "52px", top: "450px", zIndex: 5, maxWidth: "360px" }}
      >
        <p
          className="font-[family-name:var(--font-space)] text-[17px] leading-snug"
          style={{ color: "#3a4a5c" }}
        >
          AI-powered music research for DJs, producers, and crate diggers. 19
          sources. One agent. Zero tabs.
        </p>
      </div>

      {/* 6. CTAs */}
      <div
        className="absolute flex gap-3 max-md:relative max-md:mt-6 max-md:flex-col max-md:px-5"
        style={{ left: "52px", top: "520px", zIndex: 5 }}
      >
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] rounded px-8 py-3.5 text-[16px] tracking-[2px] transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--orange)", color: "var(--cream)" }}
        >
          START DIGGING
        </Link>
        <a
          href="#how-it-works"
          className="font-[family-name:var(--font-bebas)] rounded border-2 bg-transparent px-8 py-3.5 text-[16px] tracking-[2px] transition-opacity hover:opacity-70"
          style={{ borderColor: "var(--midnight)", color: "var(--midnight)" }}
        >
          HOW IT WORKS
        </a>
      </div>

      {/* 7. Vertical text right */}
      <p
        className="absolute max-md:hidden"
        style={{
          right: "16px",
          top: "100px",
          writingMode: "vertical-rl",
          fontFamily: "var(--font-bebas)",
          fontSize: "11px",
          letterSpacing: "5px",
          color: "var(--orange)",
          opacity: 0.5,
        }}
        aria-hidden="true"
      >
        AI-POWERED MUSIC INTELLIGENCE
      </p>

      {/* 8. Vertical text left */}
      <p
        className="absolute max-md:hidden"
        style={{
          left: "16px",
          bottom: "60px",
          writingMode: "vertical-rl",
          transform: "rotate(180deg)",
          fontFamily: "var(--font-bebas)",
          fontSize: "10px",
          letterSpacing: "4px",
          color: "var(--midnight)",
          opacity: 0.15,
        }}
        aria-hidden="true"
      >
        CRATE — MILWAUKEE 2024
      </p>

      {/* 9. Edition mark */}
      <p
        className="absolute max-md:hidden"
        style={{
          right: "48px",
          bottom: "16px",
          fontFamily: "var(--font-bebas)",
          fontSize: "11px",
          letterSpacing: "3px",
          color: "var(--midnight)",
          opacity: 0.2,
        }}
        aria-hidden="true"
      >
        VOL. 1 — WEB EDITION
      </p>
    </section>
  );
}
