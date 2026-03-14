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
  // Track whether radio is the active source so listeners don't interfere with YouTube
  const isRadioActiveRef = useRef(false);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "none";

    audio.addEventListener("playing", () => {
      if (isRadioActiveRef.current) setIsPlaying(true);
    });
    audio.addEventListener("pause", () => {
      if (isRadioActiveRef.current) setIsPlaying(false);
    });
    audio.addEventListener("error", () => {
      // Ignore empty src errors — happens during cleanup when switching tracks
      if (!audio.src || audio.src === window.location.href) return;
      if (!isRadioActiveRef.current) return;
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

  // ICY metadata polling — depends only on stable keys, not the full currentTrack object
  const sourceId = currentTrack?.sourceId;
  const source = currentTrack?.source;

  useEffect(() => {
    if (metaTimerRef.current) {
      clearInterval(metaTimerRef.current);
      metaTimerRef.current = null;
    }

    if (!sourceId || source !== "radio" || !isPlaying) return;

    const streamUrl = sourceId;
    const stationName = stationNameRef.current || "Radio";

    // Use a request ID to ignore stale responses
    const requestId = Symbol();
    let currentRequestId: symbol = requestId;

    async function fetchMeta() {
      try {
        const res = await fetch(
          `/api/radio-metadata?url=${encodeURIComponent(streamUrl)}`,
        );
        if (!res.ok) return;
        if (currentRequestId !== requestId) return; // stale
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
      currentRequestId = Symbol(); // invalidate in-flight requests
      if (metaTimerRef.current) {
        clearInterval(metaTimerRef.current);
        metaTimerRef.current = null;
      }
    };
  }, [sourceId, source, isPlaying, updateTrackMeta]);

  // Load new radio stream when track changes
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack || currentTrack.source !== "radio") {
      // Stop radio if switched to a non-radio track
      isRadioActiveRef.current = false;
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
    isRadioActiveRef.current = true;

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
