/**
 * /admin/recommend — Moderation queue for /recommend v1.
 *
 * Server layer does minimal work: gates on Clerk auth and renders a thin
 * shell. The admin data (flagged tours + pending reports) loads via a
 * client component that uses Convex useQuery with the Clerk session JWT —
 * the Convex admin.ts functions enforce admin-only access on the server.
 *
 * Non-admin users see a "Forbidden" panel (the Convex query throws; the
 * client component catches and renders the message).
 */

import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { AdminModerationShell } from "./admin-shell";

export const metadata = {
  title: "Admin — Moderation | Crate",
};

export default async function AdminRecommendPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/admin/recommend");

  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)] min-h-screen bg-[#0a0a0a] text-white`}
    >
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ backgroundColor: "#0A1628", borderBottom: "1px solid #1d2d44" }}
      >
        <div className="flex items-center gap-3">
          <Link href="/" className="shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/crate-logo_Light.svg"
              alt="Crate"
              style={{ height: "40px", width: "auto" }}
            />
          </Link>
          <span style={{ color: "#3f3f46", fontSize: "24px", fontWeight: 300 }}>
            ×
          </span>
          <span
            className="font-[family-name:var(--font-bebas)] tracking-widest"
            style={{ color: "#e8b86a", fontSize: "20px" }}
          >
            ADMIN · MODERATION
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-6 py-10">
        <AdminModerationShell />
      </section>
    </main>
  );
}
