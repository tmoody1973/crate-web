"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { api } from "../../../convex/_generated/api";

export function PublishedSection() {
  const [expanded, setExpanded] = useState(false);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const stats = useQuery(
    api.published.stats,
    user ? { userId: user._id } : "skip",
  );
  const items = useQuery(
    api.published.listAll,
    user && expanded ? { userId: user._id } : "skip",
  );

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        <span>
          Published
          {stats && stats.total > 0 && (
            <span className="ml-1 text-[10px] font-normal text-zinc-600">
              ({stats.total})
            </span>
          )}
        </span>
        <span className="text-[10px]">{expanded ? "▼" : "►"}</span>
      </button>

      {expanded && (
        <div className="mt-1 space-y-0.5">
          {/* Platform badges */}
          {stats && stats.total > 0 && (
            <div className="flex flex-wrap gap-1 px-2 py-1">
              {stats.telegraph > 0 && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  Telegraph: {stats.telegraph}
                </span>
              )}
              {stats.tumblr > 0 && (
                <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                  Tumblr: {stats.tumblr}
                </span>
              )}
            </div>
          )}

          {/* Published items */}
          {items?.slice(0, 15).map((item) => (
            <a
              key={item._id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] text-zinc-600">
                {item.platform === "telegraph" ? "T" : "t"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs">{item.title}</p>
                <p className="truncate text-[10px] text-zinc-600">
                  {item.category
                    ? `${item.category} · `
                    : ""}
                  {new Date(item.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
              <span className="shrink-0 text-[10px] text-zinc-700 opacity-0 transition-opacity group-hover:opacity-100">
                ↗
              </span>
            </a>
          ))}

          {(!items || items.length === 0) && (
            <p className="px-2 text-[10px] text-zinc-600">
              Use /publish to share your research
            </p>
          )}

          {items && items.length > 15 && (
            <p className="px-2 text-[10px] text-zinc-600">
              +{items.length - 15} more
            </p>
          )}
        </div>
      )}
    </div>
  );
}
