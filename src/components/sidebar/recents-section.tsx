"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";
import { SessionItem } from "./session-item";

function groupByDate(sessions: Array<{ _id: string; lastMessageAt: number; title?: string; isStarred: boolean }>) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);

  const groups: Record<string, typeof sessions> = {
    Today: [],
    Yesterday: [],
    "This Week": [],
    Older: [],
  };

  for (const s of sessions) {
    const d = new Date(s.lastMessageAt);
    if (d >= today) groups.Today.push(s);
    else if (d >= yesterday) groups.Yesterday.push(s);
    else if (d >= weekAgo) groups["This Week"].push(s);
    else groups.Older.push(s);
  }

  return groups;
}

export function RecentsSection() {
  const [expanded, setExpanded] = useState(true);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const sessions = useQuery(api.sessions.listRecent, user ? { userId: user._id } : "skip");
  const toggleStar = useMutation(api.sessions.toggleStar);

  if (!sessions || sessions.length === 0) return null;

  const groups = groupByDate(sessions as any);

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        Recents
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>
      {expanded && (
        <div className="mt-1 space-y-2">
          {Object.entries(groups).map(([label, items]) =>
            items.length > 0 ? (
              <div key={label}>
                <p className="px-2 text-[10px] font-medium uppercase text-zinc-600">{label}</p>
                {items.map((s: any) => (
                  <SessionItem
                    key={s._id}
                    id={s._id}
                    title={s.title}
                    isStarred={s.isStarred}
                    onToggleStar={() => toggleStar({ id: s._id })}
                  />
                ))}
              </div>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
