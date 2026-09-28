"use client";

import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useParams } from "next/navigation";

export default function SharedSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const session = useQuery(api.sessions.get, {
    id: sessionId as Id<"sessions">,
  });
  const messages = useQuery(api.messages.list, {
    sessionId: sessionId as Id<"sessions">,
  });

  if (!session) return <div className="p-8 text-zinc-500">Loading...</div>;
  if (!session.isShared)
    return <div className="p-8 text-zinc-500">This session is not shared.</div>;

  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">
        {session.title ?? "Research Session"}
      </h1>
      <div className="space-y-4">
        {messages?.map((m) => (
          <div key={m._id}>
            <span className="text-xs font-semibold uppercase text-zinc-500">
              {m.role === "user" ? "Researcher" : "Crate"}
            </span>
            <div className="mt-1 whitespace-pre-wrap text-zinc-300">
              {m.content}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
