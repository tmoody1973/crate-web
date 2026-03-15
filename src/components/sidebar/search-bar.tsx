"use client";

import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";

export const SearchBar = forwardRef<HTMLInputElement>(function SearchBar(_props, ref) {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => inputRef.current!, []);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  const results = useQuery(
    api.messages.search,
    debouncedQuery.trim() ? { query: debouncedQuery.trim() } : "skip",
  );

  // Group results by session
  const grouped = results
    ? Object.entries(
        results.reduce(
          (acc, msg) => {
            const key = msg.sessionId;
            if (!acc[key]) acc[key] = [];
            acc[key].push(msg);
            return acc;
          },
          {} as Record<string, typeof results>,
        ),
      )
    : [];

  return (
    <div className="relative mx-3 mt-2">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsOpen(true);
        }}
        onFocus={() => query && setIsOpen(true)}
        onBlur={() => setTimeout(() => setIsOpen(false), 200)}
        placeholder="Search research history..."
        className="w-full rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:border-zinc-600 focus:outline-none"
      />
      <svg
        className="absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>

      {/* Results dropdown */}
      {isOpen && debouncedQuery && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-md border border-zinc-800 bg-zinc-900 shadow-xl">
          {grouped.length === 0 ? (
            <p className="p-3 text-xs text-zinc-500">No results</p>
          ) : (
            grouped.map(([sessionId, msgs]) => (
              <button
                key={sessionId}
                onClick={() => {
                  router.push(`/w/${sessionId}`);
                  setQuery("");
                  setIsOpen(false);
                }}
                className="flex w-full flex-col border-b border-zinc-800 px-3 py-2 text-left last:border-0 hover:bg-zinc-800"
              >
                <span className="text-xs text-zinc-300">
                  {msgs[0].content.slice(0, 80)}
                  {msgs[0].content.length > 80 ? "..." : ""}
                </span>
                <span className="text-[10px] text-zinc-600">
                  {msgs.length} match{msgs.length > 1 ? "es" : ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
});
