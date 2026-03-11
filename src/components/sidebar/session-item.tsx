"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Id } from "../../../convex/_generated/dataModel";

interface SessionItemProps {
  id: Id<"sessions">;
  title: string | undefined;
  isStarred: boolean;
  onToggleStar?: () => void;
}

export function SessionItem({ id, title, isStarred, onToggleStar }: SessionItemProps) {
  const params = useParams();
  const isActive = params?.sessionId === id;
  const displayTitle = title || "New chat";

  return (
    <Link
      href={`/w/${id}`}
      className={`group flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
        isActive
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
      }`}
    >
      <span className="flex-1 truncate">{displayTitle}</span>
      {onToggleStar && (
        <button
          onClick={(e) => {
            e.preventDefault();
            onToggleStar();
          }}
          className={`shrink-0 opacity-0 group-hover:opacity-100 ${
            isStarred ? "text-yellow-500 opacity-100" : "text-zinc-500"
          }`}
        >
          {isStarred ? "★" : "☆"}
        </button>
      )}
    </Link>
  );
}
