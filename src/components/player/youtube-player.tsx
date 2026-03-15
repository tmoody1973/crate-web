"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePlayer } from "./player-provider";

/**
 * Hidden YouTube IFrame Player that handles actual audio playback.
 * Renders a 1x1 off-screen iframe; all UI is in PlayerBar.
 */

// Extend window for YouTube IFrame API
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

/** Extract YouTube video ID from various URL formats. */
function extractVideoId(urlOrId: string): string | null {
  // Already a bare ID (11 chars, alphanumeric + dash/underscore)
  if (/^[\w-]{11}$/.test(urlOrId)) return urlOrId;

  try {
    const url = new URL(urlOrId);
    // youtube.com/watch?v=ID
    if (url.searchParams.has("v")) return url.searchParams.get("v");
    // youtu.be/ID
    if (url.hostname === "youtu.be") return url.pathname.slice(1);
    // youtube.com/embed/ID
    const embedMatch = url.pathname.match(/\/embed\/([\w-]{11})/);
    if (embedMatch) return embedMatch[1];
  } catch {
    // Not a URL
  }
  return null;
}

let apiLoaded = false;
let apiReady = false;
const apiReadyCallbacks: (() => void)[] = [];

function loadYouTubeAPI(): Promise<void> {
  if (apiReady) return Promise.resolve();

  return new Promise((resolve) => {
    apiReadyCallbacks.push(resolve);

    if (apiLoaded) return; // Already loading, just wait
    apiLoaded = true;

    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);

    window.onYouTubeIframeAPIReady = () => {
      apiReady = true;
      for (const cb of apiReadyCallbacks) cb();
      apiReadyCallbacks.length = 0;
    };
  });
}

export function YouTubePlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    registerSeek,
    next,
  } = usePlayer();

  const playerRef = useRef<YT.Player | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSourceIdRef = useRef<string>("");

  // Time tracking interval
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        setCurrentTime(p.getCurrentTime());
      }
    }, 500);
  }, [setCurrentTime]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Initialize YouTube player
  useEffect(() => {
    let mounted = true;

    loadYouTubeAPI().then(() => {
      if (!mounted || !containerRef.current || playerRef.current) return;

      playerRef.current = new window.YT.Player(containerRef.current, {
        height: "1",
        width: "1",
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onStateChange: (event: YT.OnStateChangeEvent) => {
            switch (event.data) {
              case window.YT.PlayerState.PLAYING:
                setIsPlaying(true);
                if (event.target?.getDuration) {
                  setDuration(event.target.getDuration());
                }
                startTimer();
                break;
              case window.YT.PlayerState.PAUSED:
                setIsPlaying(false);
                stopTimer();
                break;
              case window.YT.PlayerState.ENDED:
                setIsPlaying(false);
                stopTimer();
                next();
                break;
            }
          },
        },
      });

      // Register seek callback
      registerSeek((time: number) => {
        playerRef.current?.seekTo(time, true);
      });
    });

    return () => {
      mounted = false;
      stopTimer();
      playerRef.current?.destroy();
      playerRef.current = null;
    };
  }, [setIsPlaying, setDuration, startTimer, stopTimer, next, registerSeek]);

  // Load new track when currentTrack changes
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;

    // If track switched AWAY from YouTube, stop playback
    if (!currentTrack || currentTrack.source !== "youtube") {
      if (lastSourceIdRef.current) {
        p.pauseVideo?.();
        stopTimer();
        lastSourceIdRef.current = "";
      }
      return;
    }

    const videoId = extractVideoId(currentTrack.sourceId);
    if (!videoId || videoId === lastSourceIdRef.current) return;
    lastSourceIdRef.current = videoId;

    // Wait for player to be ready
    if (p.loadVideoById) {
      p.loadVideoById(videoId);
    }
  }, [currentTrack, stopTimer]);

  // Sync play/pause state — only when YouTube is the active source
  useEffect(() => {
    const p = playerRef.current;
    if (!p?.getPlayerState) return;
    if (!currentTrack || currentTrack.source !== "youtube") return;

    const state = p.getPlayerState();
    if (isPlaying && state !== window.YT?.PlayerState?.PLAYING) {
      p.playVideo?.();
    } else if (!isPlaying && state === window.YT?.PlayerState?.PLAYING) {
      p.pauseVideo?.();
    }
  }, [isPlaying, currentTrack]);

  // Sync volume
  useEffect(() => {
    playerRef.current?.setVolume?.(volume);
  }, [volume]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none fixed -left-[9999px] -top-[9999px] h-px w-px opacity-0"
      aria-hidden
    />
  );
}
