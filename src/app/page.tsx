import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Marquee } from "@/components/landing/marquee";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { Features } from "@/components/landing/features";
import { Comparison } from "@/components/landing/comparison";
import { SourcesGrid } from "@/components/landing/sources-grid";
import { DjShowcase } from "@/components/landing/dj-showcase";
import { AppShowcase } from "@/components/landing/app-showcase";
import { TinyDeskShowcase } from "@/components/landing/tinydesk-showcase";
import { Pricing } from "@/components/landing/pricing";
import { FinalCta } from "@/components/landing/final-cta";
import { Footer } from "@/components/landing/footer";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/w");
  }

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)]`}
    >
      <Nav />
      <Marquee />
      <Hero />
      <AppShowcase />
      <HowItWorks />
      <Features />
      <Comparison />
      <SourcesGrid />
      <DjShowcase />
      <TinyDeskShowcase />
      <Pricing />
      <FinalCta />
      <Footer />
    </main>
  );
}
