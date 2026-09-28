import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Pricing } from "@/components/landing/pricing";
import { Footer } from "@/components/landing/footer";

export const metadata = {
  title: "Pricing — Crate",
  description:
    "Start free, upgrade when you need it. Crate plans for DJs, journalists, and music organizations.",
};

export default async function PricingPage() {
  const { userId } = await auth();

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)]`}
      style={{ backgroundColor: "#09090b" }}
    >
      <Nav />

      {/* Back-to-app link for signed-in users */}
      {userId && (
        <div
          className="px-12 max-md:px-5 py-4 border-b"
          style={{
            borderColor: "rgba(63,63,70,0.4)",
            backgroundColor: "#18181b",
          }}
        >
          <Link
            href="/w"
            className="font-[family-name:var(--font-bebas)] text-[14px] tracking-[2px] transition-colors duration-200"
            style={{ color: "#22d3ee" }}
          >
            ← BACK TO APP
          </Link>
        </div>
      )}

      <Pricing />

      <Footer />
    </main>
  );
}
