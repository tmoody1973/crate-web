"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface SpotifyPlayerProps {
  /** Spotify playlist ID to play */
  playlistId: string;
  /** Playlist name for display */
  playlistName?: string;
  /** Compact mode — smaller height */
  compact?: boolean;
}

interface PlaybackState {
  trackName: string;
  artistName: string;
  albumName: string;
  albumArt: string;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

// Extend Window for Spotify SDK types
declare global {
  interface Window {
    onSpotifyWebPlaybackSDKReady?: () => void;
    Spotify?: {
      Player: new (config: {
        name: string;
        getOAuthToken: (cb: (token: string) => void) => void;
        volume: number;
      }) => SpotifyPlayerInstance;
    };
  }
}

interface SpotifyPlayerInstance {
  addListener: (event: string, cb: (data: Record<string, unknown>) => void) => void;
  connect: () => Promise<boolean>;
  disconnect: () => void;
  togglePlay: () => Promise<void>;
  nextTrack: () => Promise<void>;
  previousTrack: () => Promise<void>;
  seek: (positionMs: number) => Promise<void>;
  getCurrentState: () => Promise<Record<string, unknown> | null>;
}

let sdkScriptLoaded = false;

export function SpotifyWebPlayer({ playlistId, playlistName, compact }: SpotifyPlayerProps) {
  const [token, setToken] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [playback, setPlayback] = useState<PlaybackState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const playerRef = useRef<SpotifyPlayerInstance | null>(null);
  const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch token from Token Vault
  useEffect(() => {
    fetch("/api/spotify/token")
      .then((r) => r.json())
      .then((data) => {
        if (data.access_token) {
          setToken(data.access_token);
        } else {
          setError(data.error || "Failed to get Spotify token");
          setLoading(false);
        }
      })
      .catch(() => {
        setError("Failed to connect to Spotify");
        setLoading(false);
      });
  }, []);

  // Initialize SDK once we have a token
  useEffect(() => {
    if (!token) return;

    const initPlayer = () => {
      if (!window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "Crate Music Research",
        getOAuthToken: (cb) => cb(token),
        volume: 0.5,
      });

      player.addListener("ready", (data) => {
        const id = data.device_id as string;
        setDeviceId(id);
        setLoading(false);
      });

      player.addListener("not_ready", () => {
        setError("Spotify player went offline");
      });

      player.addListener("initialization_error", (data) => {
        setError(`Player init error: ${data.message}`);
        setLoading(false);
      });

      player.addListener("authentication_error", (data) => {
        setError(`Auth error: ${data.message}. Try reconnecting Spotify in Settings.`);
        setLoading(false);
      });

      player.addListener("account_error", (data) => {
        setError(`${data.message}. Spotify Premium is required for full playback.`);
        setLoading(false);
      });

      player.addListener("player_state_changed", (state) => {
        if (!state) return;
        const track = state.track_window as Record<string, unknown> | undefined;
        const current = (track?.current_track as Record<string, unknown>) ?? {};
        const artists = (current.artists as Array<{ name: string }>) ?? [];
        const album = (current.album as Record<string, unknown>) ?? {};
        const images = (album.images as Array<{ url: string }>) ?? [];

        setPlayback({
          trackName: (current.name as string) ?? "",
          artistName: artists.map((a) => a.name).join(", "),
          albumName: (album.name as string) ?? "",
          albumArt: images[0]?.url ?? "",
          isPlaying: !(state.paused as boolean),
          positionMs: (state.position as number) ?? 0,
          durationMs: (current.duration_ms as number) ?? 0,
        });
      });

      player.connect();
      playerRef.current = player;
    };

    if (window.Spotify) {
      initPlayer();
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer;

      if (!sdkScriptLoaded) {
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
        sdkScriptLoaded = true;
      }
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, [token]);

  // Start playing the playlist when device is ready
  const playPlaylist = useCallback(async () => {
    if (!token || !deviceId) return;

    try {
      const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          context_uri: `spotify:playlist:${playlistId}`,
          position_ms: 0,
        }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (res.status === 403) {
          setError("Spotify Premium required for full playback.");
        } else {
          setError(`Playback failed: ${res.status} ${detail.slice(0, 100)}`);
        }
      }
    } catch {
      setError("Failed to start playback");
    }
  }, [token, deviceId, playlistId]);

  // Progress bar updater
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current);

    if (playback?.isPlaying) {
      progressInterval.current = setInterval(() => {
        setPlayback((prev) => prev ? { ...prev, positionMs: prev.positionMs + 500 } : prev);
      }, 500);
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [playback?.isPlaying]);

  function formatTime(ms: number): string {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  const progress = playback?.durationMs ? Math.min((playback.positionMs / playback.durationMs) * 100, 100) : 0;

  if (error) {
    return (
      <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-4 py-3">
        <p className="text-sm text-red-400">{error}</p>
        <p className="mt-1 text-xs text-red-500/70">
          Make sure you have Spotify Premium and have reconnected Spotify in Settings with the new permissions.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-green-500 border-t-transparent" />
        <span className="text-sm text-zinc-400">Connecting to Spotify...</span>
      </div>
    );
  }

  // Ready but not playing yet
  if (!playback) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3">
        <span className="text-sm text-zinc-400">
          {playlistName || "Playlist"} ready
        </span>
        <button
          onClick={playPlaylist}
          className="flex items-center gap-2 rounded-full bg-green-500 px-5 py-2 text-sm font-semibold text-black hover:bg-green-400 transition-colors"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
            <path d="M8 5v14l11-7z" />
          </svg>
          Play
        </button>
      </div>
    );
  }

  // Now playing
  return (
    <div className={`rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden ${compact ? "" : ""}`}>
      <div className="flex items-center gap-3 p-3">
        {/* Album art */}
        {playback.albumArt && (
          <img
            src={playback.albumArt}
            alt={playback.albumName}
            className="h-12 w-12 rounded-md object-cover shrink-0"
          />
        )}

        {/* Track info */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-white truncate">{playback.trackName}</p>
          <p className="text-xs text-zinc-400 truncate">{playback.artistName}</p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => playerRef.current?.previousTrack()}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Previous"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z" />
            </svg>
          </button>
          <button
            onClick={() => playerRef.current?.togglePlay()}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform"
            title={playback.isPlaying ? "Pause" : "Play"}
          >
            {playback.isPlaying ? (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4 ml-0.5">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>
          <button
            onClick={() => playerRef.current?.nextTrack()}
            className="p-2 text-zinc-400 hover:text-white transition-colors"
            title="Next"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="px-3 pb-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-8 text-right">{formatTime(playback.positionMs)}</span>
          <div
            className="relative flex-1 h-1 bg-zinc-800 rounded-full cursor-pointer group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const pct = (e.clientX - rect.left) / rect.width;
              playerRef.current?.seek(Math.floor(pct * playback.durationMs));
            }}
          >
            <div
              className="absolute inset-y-0 left-0 bg-green-500 rounded-full group-hover:bg-green-400 transition-colors"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-[10px] text-zinc-500 w-8">{formatTime(playback.durationMs)}</span>
        </div>
      </div>
    </div>
  );
}
