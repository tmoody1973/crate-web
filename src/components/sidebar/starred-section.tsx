"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";

export function StarredSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sessions = useQuery(api.sessions.listStarred, user ? { userId: user._id } : "skip");
  const toggleStar = useMutation(api.sessions.toggleStar);

  if (!sessions || sessions.length === 0) return null;

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Starred
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1">
          {(sessions as any[]).map((s) => (
            <SessionItem
              key={s._id}
              id={s._id}
              title={s.title}
              isStarred={true}
              onToggleStar={() => toggleStar({ id: s._id })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
