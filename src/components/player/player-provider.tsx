"use client";

import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";

interface Track {
  title: string;
  artist: string;
  source: "youtube" | "bandcamp" | "radio";
  sourceId: string;
  imageUrl?: string;
  isRadio?: boolean;
}

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  currentIndex: number;
  isPlaying: boolean;
  volume: number;
  currentTime: number;
  duration: number;
}

interface PlayerContextValue extends PlayerState {
  play: (track: Track) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  addToQueue: (track: Track) => void;
  setVolume: (volume: number) => void;
  seek: (time: number) => void;
  registerSeek: (fn: (time: number) => void) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
  updateTrackMeta: (title: string, artist: string) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

/** Safe version that returns null outside PlayerProvider (e.g. public share pages). */
export function usePlayerSafe() {
  return useContext(PlayerContext);
}

export function PlayerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    volume: 80,
    currentTime: 0,
    duration: 0,
  });

  const play = useCallback((track: Track) => {
    setState((prev) => ({
      ...prev,
      currentTrack: track,
      queue: [...prev.queue, track],
      currentIndex: prev.queue.length,
      isPlaying: true,
      currentTime: 0,
      duration: 0,
    }));
  }, []);

  const pause = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: false }));
  }, []);

  const resume = useCallback(() => {
    setState((prev) => ({ ...prev, isPlaying: true }));
  }, []);

  const next = useCallback(() => {
    setState((prev) => {
      const nextIndex = prev.currentIndex + 1;
      if (nextIndex >= prev.queue.length) return { ...prev, isPlaying: false };
      return {
        ...prev,
        currentIndex: nextIndex,
        currentTrack: prev.queue[nextIndex] ?? null,
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const previous = useCallback(() => {
    setState((prev) => {
      const prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) return prev;
      return {
        ...prev,
        currentIndex: prevIndex,
        currentTrack: prev.queue[prevIndex] ?? null,
        isPlaying: true,
        currentTime: 0,
      };
    });
  }, []);

  const addToQueue = useCallback((track: Track) => {
    setState((prev) => ({ ...prev, queue: [...prev.queue, track] }));
  }, []);

  const setVolume = useCallback((volume: number) => {
    setState((prev) => ({ ...prev, volume }));
  }, []);

  const seekCallbackRef = useRef<((time: number) => void) | null>(null);

  const registerSeek = useCallback((fn: (time: number) => void) => {
    seekCallbackRef.current = fn;
  }, []);

  const seek = useCallback((time: number) => {
    seekCallbackRef.current?.(time);
    setState((prev) => ({ ...prev, currentTime: time }));
  }, []);

  const setCurrentTime = useCallback((currentTime: number) => {
    setState((prev) => ({ ...prev, currentTime }));
  }, []);

  const setDuration = useCallback((duration: number) => {
    setState((prev) => ({ ...prev, duration }));
  }, []);

  const setIsPlaying = useCallback((isPlaying: boolean) => {
    setState((prev) => ({ ...prev, isPlaying }));
  }, []);

  const updateTrackMeta = useCallback((title: string, artist: string) => {
    setState((prev) => {
      if (!prev.currentTrack) return prev;
      return {
        ...prev,
        currentTrack: { ...prev.currentTrack, title, artist },
      };
    });
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        ...state,
        play,
        pause,
        resume,
        next,
        previous,
        addToQueue,
        setVolume,
        seek,
        registerSeek,
        setCurrentTime,
        setDuration,
        setIsPlaying,
        updateTrackMeta,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
