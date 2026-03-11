"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface Track {
  title: string;
  artist: string;
  source: "youtube" | "bandcamp";
  sourceId: string;
  imageUrl?: string;
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
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (playing: boolean) => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
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

  const seek = useCallback((_time: number) => {
    // YouTube player seek handled via ref in youtube-embed
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
        setCurrentTime,
        setDuration,
        setIsPlaying,
      }}
    >
      {children}
    </PlayerContext.Provider>
  );
}
