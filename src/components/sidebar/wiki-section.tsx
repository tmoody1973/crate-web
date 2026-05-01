"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export function WikiSection() {
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const entryCount = useQuery(
    api.wiki.getEntryCount,
    user ? { userId: user._id } : "skip",
  );

  return (
    <div className="px-2">
      <Link
        href="/wiki"
        className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
      >
        <span className="truncate">Wiki</span>
        {entryCount != null && entryCount > 0 && (
          <span className="ml-2 shrink-0 rounded-full bg-zinc-800 px-1.5 py-0.5 text-xs text-zinc-500">
            {entryCount}
          </span>
        )}
      </Link>
    </div>
  );
}
