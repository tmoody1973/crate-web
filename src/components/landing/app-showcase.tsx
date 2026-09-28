import Image from "next/image";
import { ScrollReveal } from "./scroll-reveal";

export function AppShowcase() {
  return (
    <section
      className="py-16 px-12 max-md:px-5 max-md:py-10"
      style={{ backgroundColor: "#0A1628" }}
    >
      <ScrollReveal>
        <div className="mx-auto max-w-5xl">
          <p
            className="font-[family-name:var(--font-bebas)] text-[14px] tracking-[3px] text-center mb-6"
            style={{ color: "#E8520E" }}
          >
            SEE IT IN ACTION
          </p>
          <div
            className="relative rounded-lg overflow-hidden"
            style={{
              border: "1px solid rgba(245,240,232,0.1)",
              boxShadow:
                "0 25px 50px -12px rgba(0,0,0,0.5), 0 0 0 1px rgba(232,82,14,0.15)",
            }}
          >
            <Image
              src="/photos/crate-app-screenshot.png"
              alt="Crate app — Ezra Collective influence chain with playlist"
              width={1920}
              height={1080}
              className="w-full h-auto"
              priority
            />
          </div>
          <p
            className="font-[family-name:var(--font-space)] text-[13px] text-center mt-4"
            style={{ color: "rgba(245,240,232,0.4)" }}
          >
            Researching Ezra Collective&apos;s influence chain — 23 tracks, 5 sections, one query.
          </p>
        </div>
      </ScrollReveal>
    </section>
  );
}
