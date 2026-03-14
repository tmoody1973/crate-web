"use client";

import { usePlayer } from "./player-provider";

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

export function PlayerBar() {
  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    pause,
    resume,
    next,
    previous,
    setVolume,
    seek,
  } = usePlayer();

  if (!currentTrack) return null;

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex h-[72px] items-center border-t border-zinc-800 bg-zinc-950 px-4">
      {/* Track info */}
      <div className="flex w-1/4 items-center gap-3">
        {currentTrack.imageUrl && (
          <img
            src={currentTrack.imageUrl}
            alt=""
            className="h-12 w-12 rounded object-cover"
          />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {currentTrack.title}
          </p>
          <p className="truncate text-xs text-zinc-400">
            {currentTrack.artist}
            {currentTrack.source === "radio" && (
              <span className="ml-2 inline-block rounded bg-red-600 px-1.5 py-0.5 text-[10px] font-bold uppercase leading-none text-white">
                LIVE
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-1 flex-col items-center gap-1">
        <div className="flex items-center gap-4">
          <button onClick={previous} className="text-zinc-400 hover:text-white">
            {"\u25C4\u25C4"}
          </button>
          <button
            onClick={isPlaying ? pause : resume}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:bg-zinc-200"
          >
            {isPlaying ? "\u275A\u275A" : "\u25B6"}
          </button>
          <button onClick={next} className="text-zinc-400 hover:text-white">
            {"\u25BA\u25BA"}
          </button>
        </div>
        {/* Progress bar / Live indicator */}
        {currentTrack.source === "radio" ? (
          <div className="flex w-full max-w-md items-center justify-center gap-2">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-xs font-medium uppercase tracking-wider text-red-400">
              Live Radio
            </span>
          </div>
        ) : (
          <div className="flex w-full max-w-md items-center gap-2">
            <span className="text-xs text-zinc-500">{formatTime(currentTime)}</span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              value={currentTime}
              onChange={(e) => seek(Number(e.target.value))}
              aria-label="Seek"
              aria-valuetext={`${formatTime(currentTime)} of ${formatTime(duration)}`}
              className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-zinc-700 accent-white [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
            <span className="text-xs text-zinc-500">{formatTime(duration)}</span>
          </div>
        )}
      </div>

      {/* Volume */}
      <div className="flex w-1/4 items-center justify-end gap-2">
        <span className="text-zinc-400">{"\uD83D\uDD0A"}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          className="w-24"
        />
      </div>
    </div>
  );
}
