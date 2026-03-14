"use client";

import { useEffect, useRef } from "react";
import { usePlayer } from "./player-provider";

const METADATA_POLL_MS = 15_000; // Poll ICY metadata every 15s

/**
 * Hidden HTML5 Audio element for streaming radio stations.
 * Works alongside YouTubePlayer — only activates for source === "radio".
 * Polls /api/radio-metadata for ICY metadata (artist/song info).
 */
export function RadioPlayer() {
  const {
    currentTrack,
    isPlaying,
    volume,
    setIsPlaying,
    updateTrackMeta,
  } = usePlayer();

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastSourceIdRef = useRef<string>("");
  const metaTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Preserve the original station name — metadata updates overwrite currentTrack.title
  const stationNameRef = useRef<string>("");

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";

    audio.addEventListener("playing", () => setIsPlaying(true));
    audio.addEventListener("pause", () => setIsPlaying(false));
    audio.addEventListener("error", () => {
      // Ignore empty src errors — happens during cleanup when switching tracks
      if (!audio.src || audio.src === window.location.href) return;
      console.error("[RadioPlayer] Stream error:", audio.error?.message);
      setIsPlaying(false);
    });

    audioRef.current = audio;

    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      audioRef.current = null;
    };
  }, [setIsPlaying]);

  // ICY metadata polling
  useEffect(() => {
    if (metaTimerRef.current) {
      clearInterval(metaTimerRef.current);
      metaTimerRef.current = null;
    }

    if (!currentTrack || currentTrack.source !== "radio" || !isPlaying) return;

    const streamUrl = currentTrack.sourceId;
    const stationName = stationNameRef.current || currentTrack.title;

    async function fetchMeta() {
      try {
        const res = await fetch(
          `/api/radio-metadata?url=${encodeURIComponent(streamUrl)}`,
        );
        if (!res.ok) return;
        const data = await res.json();

        // Validate metadata — reject empty, protocol garbage, or suspiciously short values
        const isClean = (s: string | null | undefined): s is string =>
          !!s && s.length > 1 && !s.includes("StreamUrl") && !s.includes("='") && !s.includes("';");

        if (isClean(data.artist) && isClean(data.title)) {
          updateTrackMeta(`${data.title} · ${stationName}`, data.artist);
        } else if (isClean(data.raw)) {
          updateTrackMeta(`${data.raw} · ${stationName}`, "Live Radio");
        }
        // If nothing is clean, keep the current title — don't update with garbage
      } catch {
        // Silently fail — metadata is optional
      }
    }

    // Fetch immediately, then poll
    fetchMeta();
    metaTimerRef.current = setInterval(fetchMeta, METADATA_POLL_MS);

    return () => {
      if (metaTimerRef.current) {
        clearInterval(metaTimerRef.current);
        metaTimerRef.current = null;
      }
    };
  }, [currentTrack?.sourceId, currentTrack?.source, isPlaying, currentTrack, updateTrackMeta]);

  // Load new radio stream when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || currentTrack.source !== "radio") {
      // Stop radio if switched to a non-radio track
      if (audioRef.current && lastSourceIdRef.current) {
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
        lastSourceIdRef.current = "";
        stationNameRef.current = "";
      }
      return;
    }

    // Skip if same stream is already loaded
    if (currentTrack.sourceId === lastSourceIdRef.current) return;
    lastSourceIdRef.current = currentTrack.sourceId;
    // Preserve original station name before metadata overwrites it
    stationNameRef.current = currentTrack.title;

    audio.src = currentTrack.sourceId;
    audio.load();
    audio.play().catch((err) => {
      // Ignore AbortError — happens when play() is interrupted by a new load
      if (err instanceof DOMException && err.name === "AbortError") return;
      console.error("[RadioPlayer] Play failed:", err);
    });
  }, [currentTrack]);

  // Sync play/pause
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || currentTrack.source !== "radio") return;

    if (isPlaying && audio.paused) {
      audio.play().catch(() => {});
    } else if (!isPlaying && !audio.paused) {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume / 100;
    }
  }, [volume]);

  return null; // No visible UI — PlayerBar handles display
}
