"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { usePlayer } from "@/components/player/player-provider";
import { api } from "../../../convex/_generated/api";

function ImageWithFallback({
  src,
  className,
}: {
  src?: string | null;
  className: string;
}) {
  const [broken, setBroken] = useState(false);

  if (!src || broken) {
    return (
      <span
        className={`flex items-center justify-center bg-zinc-800 text-[10px] text-zinc-600 ${className}`}
      >
        ●
      </span>
    );
  }

  return (
    <img
      src={src}
      alt=""
      className={className}
      onError={() => setBroken(true)}
    />
  );
}

export function CollectionSection() {
  const [expanded, setExpanded] = useState(false);
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const stats = useQuery(api.collection.stats, user ? { userId: user._id } : "skip");
  const items = useQuery(api.collection.list, user && expanded ? { userId: user._id } : "skip");
  const router = useRouter();
  const { play } = usePlayer();
  const [loadingItem, setLoadingItem] = useState<string | null>(null);

  const handlePlay = async (title: string, artist: string, id: string) => {
    setLoadingItem(id);
    try {
      const res = await fetch(
        `/api/youtube?q=${encodeURIComponent(`${title} ${artist}`)}`,
      );
      if (!res.ok) return;
      const data = await res.json();
      play({
        title,
        artist,
        source: "youtube",
        sourceId: data.videoId,
        imageUrl: data.thumbnail,
      });
    } finally {
      setLoadingItem(null);
    }
  };

  return (
    <div className="px-3 py-2">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between text-xs font-semibold uppercase text-zinc-500"
      >
        <span>
          Collection
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
          {/* Quick stats */}
          {stats && stats.total > 0 && (
            <div className="flex flex-wrap gap-1 px-2 py-1">
              {Object.entries(stats.formats).map(([format, count]) => (
                <span
                  key={format}
                  className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500"
                >
                  {format}: {count as number}
                </span>
              ))}
            </div>
          )}

          {/* Recent additions */}
          {items?.slice(0, 10).map((item) => (
            <div
              key={item._id}
              className="group flex items-center gap-2 rounded px-2 py-1 text-sm text-zinc-400 hover:bg-zinc-800 hover:text-white"
            >
              <button
                onClick={() => handlePlay(item.title, item.artist, item._id)}
                disabled={loadingItem === item._id}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-zinc-600 hover:text-white disabled:opacity-50"
              >
                {loadingItem === item._id ? (
                  <span className="h-2.5 w-2.5 animate-spin rounded-full border border-zinc-500 border-t-transparent" />
                ) : (
                  <span className="text-[10px]">▶</span>
                )}
              </button>
              <ImageWithFallback
                src={item.imageUrl}
                className="h-6 w-6 rounded object-cover"
              />
              <div
                className="min-w-0 cursor-pointer"
                onClick={() =>
                  router.push(
                    `/w?q=${encodeURIComponent(`Tell me about ${item.title} by ${item.artist}`)}`,
                  )
                }
              >
                <p className="truncate text-xs">{item.title}</p>
                <p className="truncate text-[10px] text-zinc-600">{item.artist}</p>
              </div>
            </div>
          ))}

          {(!items || items.length === 0) && (
            <p className="px-2 text-[10px] text-zinc-600">
              Ask Crate to add records to your collection
            </p>
          )}

          {items && items.length > 10 && (
            <button
              onClick={() =>
                router.push(
                  `/w?q=${encodeURIComponent("Show my full record collection")}`,
                )
              }
              className="px-2 text-[10px] text-cyan-500 hover:text-cyan-400"
            >
              View all {stats?.total} items →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
