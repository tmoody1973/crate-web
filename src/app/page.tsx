import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { userId } = await auth();
  if (userId) {
    redirect("/w");
  }
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-white">Crate</h1>
        <p className="mt-2 text-zinc-400">AI-powered music research</p>
        <a
          href="/sign-in"
          className="mt-6 inline-block rounded-lg bg-white px-6 py-3 text-sm font-medium text-black hover:bg-zinc-200"
        >
          Get Started
        </a>
      </div>
    </main>
  );
}
