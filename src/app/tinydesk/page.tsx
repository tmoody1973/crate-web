import { readdir, readFile } from "fs/promises";
import { join } from "path";
import Link from "next/link";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";

interface TinyDeskData {
  artist: string;
  slug: string;
  tagline: string;
  tinyDeskVideoId: string;
}

export const metadata = {
  title: "Tiny Desk Companion — Musical DNA | Crate",
  description:
    "Explore the influence chains behind NPR Tiny Desk performances. Dig into the musical DNA of your favorite artists.",
  openGraph: {
    title: "Tiny Desk Companion — Musical DNA | Crate",
    description:
      "Explore the influence chains behind NPR Tiny Desk performances.",
    type: "website",
    url: "https://digcrate.app/tinydesk",
  },
};

async function getAllArtists(): Promise<TinyDeskData[]> {
  const dir = join(process.cwd(), "public", "tinydesk");

  try {
    const files = await readdir(dir);
    const jsonFiles = files.filter((f) => f.endsWith(".json"));

    const artists = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await readFile(join(dir, file), "utf-8");
          const data = JSON.parse(raw) as TinyDeskData;
          return data;
        } catch {
          return null;
        }
      })
    );

    return artists.filter((a): a is TinyDeskData => a !== null);
  } catch {
    return [];
  }
}

export default async function TinyDeskIndexPage() {
  const artists = await getAllArtists();

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen`}
      style={{ backgroundColor: "#09090b", color: "#f4f4f5" }}
    >
      {/* Header */}
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: "#0A1628", borderBottom: "1px solid #1d2d44" }}
      >
        <Link href="/" className="shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] rounded px-5 py-2 text-sm tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          GET STARTED FREE
        </Link>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 py-16 md:py-20 text-center">
        <p
          className="font-[family-name:var(--font-bebas)] tracking-widest mb-3"
          style={{ color: "#22d3ee", fontSize: "14px" }}
        >
          POWERED BY CRATE
        </p>
        <h1
          className="font-[family-name:var(--font-bebas)] leading-none mb-4"
          style={{ color: "#f4f4f5", fontSize: "clamp(48px,8vw,88px)" }}
        >
          Tiny Desk Companion
        </h1>
        <p
          className="mx-auto max-w-2xl"
          style={{ color: "#a1a1aa", fontSize: "20px", lineHeight: "1.6" }}
        >
          Explore the musical DNA behind the performance. Every Tiny Desk Concert has a story — we traced it.
        </p>
      </section>

      {/* Artist Grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        {artists.length === 0 ? (
          <p className="text-center" style={{ color: "#52525b" }}>
            No companions available yet. Check back soon.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {artists.map((artist) => (
              <Link
                key={artist.slug}
                href={`/tinydesk/${artist.slug}`}
                className="group block rounded-xl overflow-hidden transition-transform hover:-translate-y-1"
                style={{
                  backgroundColor: "#18181b",
                  border: "1px solid #27272a",
                }}
              >
                {/* YouTube thumbnail */}
                <div className="relative w-full overflow-hidden" style={{ paddingTop: "56.25%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://img.youtube.com/vi/${artist.tinyDeskVideoId}/mqdefault.jpg`}
                    alt={`${artist.artist} — NPR Tiny Desk`}
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background:
                        "linear-gradient(to top, rgba(9,9,11,0.8) 0%, transparent 60%)",
                    }}
                  />
                </div>

                {/* Card content */}
                <div className="p-5">
                  <h2
                    className="font-[family-name:var(--font-bebas)] tracking-wide mb-1 group-hover:text-cyan-400 transition-colors"
                    style={{ color: "#f4f4f5", fontSize: "26px" }}
                  >
                    {artist.artist}
                  </h2>
                  <p
                    className="line-clamp-2"
                    style={{ color: "#71717a", fontSize: "13px", lineHeight: "1.5" }}
                  >
                    {artist.tagline}
                  </p>
                  <p
                    className="mt-3 font-[family-name:var(--font-bebas)] tracking-widest text-xs"
                    style={{ color: "#22d3ee" }}
                  >
                    EXPLORE INFLUENCE CHAIN →
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* CTA Section */}
      <section
        className="border-t py-16 text-center"
        style={{ borderColor: "#27272a", backgroundColor: "#0A1628" }}
      >
        <h2
          className="font-[family-name:var(--font-bebas)] tracking-wide mb-4"
          style={{ color: "#f4f4f5", fontSize: "36px" }}
        >
          Want to Dig Even Deeper?
        </h2>
        <p
          className="mx-auto mb-8 max-w-lg"
          style={{ color: "#71717a", fontSize: "16px" }}
        >
          Crate gives you AI-powered music research across 20+ sources. Build your own influence chains, discover samples, and trace the DNA of any artist.
        </p>
        <Link
          href="/sign-in"
          className="font-[family-name:var(--font-bebas)] inline-block rounded-lg px-10 py-4 text-lg tracking-widest transition-opacity hover:opacity-90"
          style={{ backgroundColor: "#E8520E", color: "#F5F0E8" }}
        >
          DIG DEEPER — TRY CRATE FREE
        </Link>
      </section>
    </main>
  );
}
