"use client";

import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";
import { PlayerProvider } from "@/components/player/player-provider";
import { PlayerBar } from "@/components/player/player-bar";
import { YouTubePlayer } from "@/components/player/youtube-player";

export function ShareRenderer({ data }: { data: string }) {
  return (
    <PlayerProvider>
      <Renderer library={crateLibrary} response={data} isStreaming={false} />
      <div className="fixed bottom-0 left-0 right-0 z-40">
        <PlayerBar />
      </div>
      <YouTubePlayer />
    </PlayerProvider>
  );
}
