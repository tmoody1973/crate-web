import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import type { Id } from "../../../convex/_generated/dataModel";
import { slugify } from "@/lib/slug";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export const metadata = {
  title: "Your Music Wiki | Crate",
  description: "Your personal music encyclopedia. Every research session makes it smarter.",
};

export default async function WikiIndexPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) {
    redirect("/sign-in");
  }

  // Look up Convex user
  const user = await convex.query(api.users.getByClerkId, { clerkId });
  if (!user) {
    redirect("/sign-in");
  }

  const entries = await convex.query(api.wiki.listUserPages, {
    userId: user._id as Id<"users">,
  });

  const username = slugify(user.name ?? user.email.split("@")[0]);

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen`}
      style={{ backgroundColor: "#09090b", color: "#f4f4f5" }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4"
        style={{ borderBottom: "1px solid #27272a" }}
      >
        <Link href="/" className="text-sm tracking-widest opacity-60 hover:opacity-100">
          crate
        </Link>
      </header>

      <div className="max-w-3xl mx-auto px-6 py-12">
        <h1
          className="font-[family-name:var(--font-bebas)] text-4xl md:text-6xl tracking-tight text-center mb-2"
          style={{ color: "#fafaf9" }}
        >
          YOUR MUSIC WIKI
        </h1>
        <p className="text-center text-sm mb-10" style={{ color: "#71717a" }}>
          {entries.length} {entries.length === 1 ? "entry" : "entries"}
        </p>

        {entries.length === 0 ? (
          /* Empty state: example at 30% opacity with CTA */
          <div className="relative rounded-lg overflow-hidden" style={{ minHeight: "300px" }}>
            {/* Faded example */}
            <div className="opacity-30 pointer-events-none px-6 py-8" style={{ backgroundColor: "#18181b" }}>
              <div className="font-[family-name:var(--font-bebas)] text-3xl tracking-tight mb-2">
                KHRUANGBIN
              </div>
              <div className="flex gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#27272a" }}>
                  psychedelic soul
                </span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: "#27272a" }}>
                  funk
                </span>
              </div>
              <div className="text-sm" style={{ color: "#a1a1aa" }}>
                An American musical trio known for blending global influences...
              </div>
            </div>

            {/* Overlay CTA */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-lg font-medium mb-2" style={{ color: "#fafaf9" }}>
                Your wiki grows automatically as you research music
              </p>
              <p className="text-sm mb-6" style={{ color: "#a1a1aa" }}>
                Every artist you explore becomes a page in your personal music encyclopedia
              </p>
              <Link
                href="/w"
                className="px-6 py-3 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: "#fafaf9",
                  color: "#09090b",
                }}
              >
                Start researching
              </Link>
            </div>
          </div>
        ) : (
          /* Artist list: Variant B bold editorial */
          <div className="space-y-0">
            {entries.map((entry) => (
              <Link
                key={entry.slug}
                href={`/wiki/${username}/${entry.slug}`}
                className="block py-4 group transition-colors"
                style={{ borderBottom: "1px solid #27272a" }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div
                      className="font-[family-name:var(--font-bebas)] text-xl tracking-tight group-hover:underline"
                      style={{ color: "#fafaf9" }}
                    >
                      {entry.entityName.toUpperCase()}
                    </div>
                    {/* Genre tags would come from the page metadata, but index entries don't have them yet */}
                  </div>
                  <div className="flex items-center gap-4 text-xs shrink-0" style={{ color: "#71717a" }}>
                    <span>{entry.sourceCount} source{entry.sourceCount !== 1 ? "s" : ""}</span>
                    <span>{timeAgo(entry.lastUpdated)}</span>
                    <span
                      className="px-2 py-0.5 rounded-full capitalize"
                      style={{
                        backgroundColor: "#27272a",
                        color: "#a1a1aa",
                      }}
                    >
                      {entry.visibility ?? "Private"}
                    </span>
                  </div>
                </div>
                {entry.summary && (
                  <p className="text-sm mt-1 line-clamp-1" style={{ color: "#52525b" }}>
                    {entry.summary}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}
