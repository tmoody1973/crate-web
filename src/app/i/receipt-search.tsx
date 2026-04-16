"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";

export function ReceiptSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = query.trim();
      if (!trimmed) return;
      const slug = trimmed
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      router.push(`/i/${slug}`);
    },
    [query, router],
  );

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Type any artist name..."
        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-base text-white placeholder:text-white/30 focus:outline-none focus:border-white/25 transition-colors"
        aria-label="Search for an artist to generate an influence receipt"
        autoFocus
      />
      <button
        type="submit"
        className="bg-[#4ade80] hover:bg-[#22c55e] text-[#0a0a0a] font-semibold rounded-lg px-6 py-3 text-base transition-colors"
      >
        Go
      </button>
    </form>
  );
}
