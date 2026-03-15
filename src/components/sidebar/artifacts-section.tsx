"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export function ArtifactsSection() {
  const [expanded, setExpanded] = useState(false);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const artifacts = useQuery(api.artifacts.listByUser, user ? { userId: user._id } : "skip");
  const router = useRouter();

  if (!artifacts || artifacts.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Artifacts
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1">
          {artifacts.map((a) => (
            <button
              key={a._id}
              onClick={() => router.push(`/w/${a.sessionId}?artifact=${a._id}`)}
              className="flex w-full flex-col rounded px-2 py-1.5 text-left text-sm transition-colors hover:bg-zinc-900"
            >
              <span className="truncate text-zinc-300">{a.label}</span>
              <span className="text-[10px] text-zinc-600">
                {new Date(a.createdAt).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
