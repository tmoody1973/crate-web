"use client";

/**
 * Mounts the global Crate audio player on the public tour page.
 *
 * The /r/[slug] page is server-rendered for SEO, so we need a tiny client
 * wrapper to set up PlayerProvider + the hidden YouTube iframe player +
 * the pinned PlayerBar. PlayerBar renders null when no track is playing,
 * so anonymous visitors see nothing until they tap PLAY on an artist.
 */

import type { ReactNode } from "react";
import { PlayerProvider } from "@/components/player/player-provider";
import { PlayerBar } from "@/components/player/player-bar";
import { YouTubePlayer } from "@/components/player/youtube-player";

export function TourPlayerShell({ children }: { children: ReactNode }) {
  return (
    <PlayerProvider>
      {children}
      <YouTubePlayer />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-zinc-800 bg-zinc-950">
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
