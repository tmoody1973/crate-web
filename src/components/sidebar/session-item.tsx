"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface SessionItemProps {
  id: Id<"sessions">;
  title: string | undefined;
  isStarred: boolean;
  onToggleStar?: () => void;
}

export function SessionItem({ id, title, isStarred, onToggleStar }: SessionItemProps) {
  const params = useParams();
  const router = useRouter();
  const isActive = params?.sessionId === id;
  const displayTitle = title || "New chat";
  const removeSession = useMutation(api.sessions.remove);

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await removeSession({ id });
    if (isActive) {
      router.push("/w");
    }
  };

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
      <div className="flex shrink-0 items-center gap-1">
        {onToggleStar && (
          <button
            onClick={(e) => {
              e.preventDefault();
              onToggleStar();
            }}
            className={`opacity-0 group-hover:opacity-100 ${
              isStarred ? "text-yellow-500 opacity-100" : "text-zinc-500"
            }`}
          >
            {isStarred ? "★" : "☆"}
          </button>
        )}
        <button
          onClick={handleDelete}
          className="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
          title="Delete chat"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </Link>
  );
}
