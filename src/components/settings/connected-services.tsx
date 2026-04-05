"use client";

import { useState, useEffect } from "react";

interface ConnectionStatus {
  configured: boolean;
  connections: {
    spotify: boolean;
    slack: boolean;
    google: boolean;
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
    description: "Save research to Google Docs",
    icon: "📄",
  },
];

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
      },
    });

    // Check for callback params (connected or error)
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("auth0_connected");
    if (connected && (connected === "spotify" || connected === "slack" || connected === "google")) {
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
          },
        });
      })
      .catch(() => {});
  }, []);

  if (!status?.configured) return null;

  const handleConnect = (serviceId: string) => {
    setConnecting(serviceId);
    try {
      localStorage.setItem("auth0_return_url", window.location.pathname);
    } catch { /* ignore */ }
    window.location.href = `/api/auth0/connect?service=${serviceId}`;
  };

  const handleDisconnect = async (serviceId: string) => {
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
              className="flex items-center justify-between rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{service.icon}</span>
                <div>
                  <p className="text-sm font-medium text-white">{service.name}</p>
                  <p className="text-xs text-zinc-500">{service.description}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isConnected && (
                  <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-400">
                    Connected
                  </span>
                )}
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
          );
        })}
      </div>
    </div>
  );
}
