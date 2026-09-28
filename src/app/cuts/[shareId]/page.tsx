import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { ShareRenderer } from "./share-renderer";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default async function SharePage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const share = await convex.query(api.shares.getByShareId, { shareId });

  if (!share || !share.isPublic) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Deep Cut Not Found</h1>
          <p className="mt-2 text-zinc-400">This deep cut is no longer available.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-md bg-cyan-600 px-4 py-2 text-sm text-white hover:bg-cyan-500"
          >
            Dig Deeper at Crate
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="border-b border-zinc-800 px-6 py-4">
        <Link href="/">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            style={{ height: "40px", width: "auto" }}
          />
        </Link>
      </header>

      {/* Deep Cut content */}
      <main className="mx-auto max-w-4xl px-6 py-8">
        <ShareRenderer data={share.data} />
      </main>

      {/* CTA Footer */}
      <footer className="border-t border-zinc-800 py-8 text-center">
        <p className="text-sm text-zinc-500 mb-3">
          Created with Crate — AI-powered music research
        </p>
        <Link
          href="/sign-up"
          className="inline-block rounded-md bg-[#E8520E] px-6 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Dig Deeper at Crate
        </Link>
      </footer>
    </div>
  );
}
