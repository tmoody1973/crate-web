"use client";

import { useState, useEffect } from "react";
import posthog from "posthog-js";

interface ConnectionStatus {
  configured: boolean;
  connections: {
    spotify: boolean;
    slack: boolean;
    google: boolean;
    tumblr: boolean;
  };
}

const SERVICES = [
  {
    id: "spotify" as const,
    name: "Spotify",
    description: "Read your library, export playlists",
    icon: "🎵",
  },
  {
    id: "slack" as const,
    name: "Slack",
    description: "Send research to your team",
    icon: "💬",
  },
  {
    id: "google" as const,
    name: "Google",
    description: "Save to Google Docs, search YouTube, create video playlists",
    icon: "📄",
  },
  {
    id: "tumblr" as const,
    name: "Tumblr",
    description: "Discover music, publish research",
    icon: "📝",
  },
];

const SERVICE_PERMISSIONS: Record<string, string[]> = {
  spotify: [
    "Read your saved tracks, playlists, and top artists",
    "Create new playlists in your account",
    "Stream tracks via Web Playback SDK",
  ],
  tumblr: [
    "Read posts from blogs you follow",
    "Search posts by tag across Tumblr",
    "Publish research to your blog",
  ],
  slack: [
    "List your workspace channels",
    "Send messages to channels and DMs",
  ],
  google: [
    "Create new Google Docs in your Drive",
    "Search YouTube for music videos, performances, and documentaries",
    "Read your YouTube playlists and liked videos",
    "Create YouTube playlists from research",
    "Only accesses files Crate creates, not your entire Drive",
  ],
};

const STORAGE_KEY = "auth0_connected_services";

function getStoredConnections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function storeConnection(service: string) {
  try {
    const current = getStoredConnections();
    current[service] = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // localStorage unavailable
  }
}

export function ConnectedServices() {
  const [status, setStatus] = useState<ConnectionStatus | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);

  useEffect(() => {
    // Load connection status from localStorage
    const stored = getStoredConnections();
    setStatus({
      configured: true,
      connections: {
        spotify: stored.spotify ?? false,
        slack: stored.slack ?? false,
        google: stored.google ?? false,
        tumblr: stored.tumblr ?? false,
      },
    });

    // Check for callback params (connected or error)
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("auth0_connected");
    if (connected && (connected === "spotify" || connected === "slack" || connected === "google" || connected === "tumblr")) {
      storeConnection(connected);
      setStatus((prev) => prev ? {
        ...prev,
        connections: { ...prev.connections, [connected]: true },
      } : prev);
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Also check server-side status
  useEffect(() => {
    fetch("/api/auth0/status")
      .then((r) => r.json())
      .then((data: ConnectionStatus) => {
        if (!data.configured) {
          setStatus(data);
          return;
        }
        // Merge server status with localStorage (either source = connected)
        const stored = getStoredConnections();
        setStatus({
          configured: true,
          connections: {
            spotify: data.connections.spotify || stored.spotify || false,
            slack: data.connections.slack || stored.slack || false,
            google: data.connections.google || stored.google || false,
            tumblr: data.connections.tumblr || stored.tumblr || false,
          },
        });
      })
      .catch(() => {});
  }, []);

  if (!status?.configured) return null;

  const handleConnect = (serviceId: string) => {
    posthog.capture("service_connect_clicked", { service: serviceId });
    setConnecting(serviceId);
    try {
      localStorage.setItem("auth0_return_url", window.location.pathname);
    } catch { /* ignore */ }
    window.location.href = `/api/auth0/connect?service=${serviceId}`;
  };

  const handleDisconnect = async (serviceId: string) => {
    posthog.capture("service_disconnected", { service: serviceId });
    setConnecting(serviceId);
    try {
      const res = await fetch("/api/auth0/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service: serviceId }),
      });
      if (res.ok) {
        // Update localStorage
        const current = getStoredConnections();
        delete current[serviceId];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        // Update state
        setStatus((prev) => prev ? {
          ...prev,
          connections: { ...prev.connections, [serviceId]: false },
        } : prev);
      }
    } catch { /* ignore */ }
    setConnecting(null);
  };

  return (
    <div className="mb-6">
      <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        Connected Services
      </h3>
      <div className="space-y-2">
        {SERVICES.map((service) => {
          const isConnected = status.connections[service.id];
          return (
            <div
              key={service.id}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-lg shrink-0">{service.icon}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white">{service.name}</p>
                      {isConnected && (
                        <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[10px] text-green-400 shrink-0">
                          Connected
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-500 truncate">{service.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                {isConnected && (
                  <button
                    onClick={() => handleDisconnect(service.id)}
                    disabled={connecting === service.id}
                    className="rounded-md border border-red-800 px-3 py-1.5 text-xs text-red-400 hover:border-red-600 hover:text-red-300 disabled:opacity-50"
                  >
                    {connecting === service.id ? "..." : "Disconnect"}
                  </button>
                )}
                <button
                  onClick={() => handleConnect(service.id)}
                  disabled={connecting === service.id}
                  className={
                    isConnected
                      ? "rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-400 hover:text-zinc-300 disabled:opacity-50"
                      : "rounded-md bg-cyan-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-cyan-500 disabled:opacity-50"
                  }
                >
                  {connecting === service.id
                    ? "Connecting..."
                    : isConnected
                      ? "Reconnect"
                      : "Connect"}
                </button>
                </div>
              </div>
              {/* Permissions — subtle, below the main row */}
              {isConnected && SERVICE_PERMISSIONS[service.id] && (
                <div className="mt-2 pt-2 border-t border-zinc-700/50 flex flex-wrap gap-x-4 gap-y-1 pl-9">
                  {SERVICE_PERMISSIONS[service.id].map((permission) => (
                    <span key={permission} className="text-[10px] text-zinc-600">
                      {permission}
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
