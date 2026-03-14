"use client";

import { useState, useEffect } from "react";

interface OrgKeyInfo {
  isAdmin: boolean;
  adminDomains: Array<{ domain: string; keys: Record<string, string> }>;
  sharedKeysAvailable: boolean;
  email: string;
}

export function TeamSharing({ refreshKey, hasKeys }: { refreshKey: number; hasKeys: boolean }) {
  const [info, setInfo] = useState<OrgKeyInfo | null>(null);
  const [domain, setDomain] = useState("");
  const [sharing, setSharing] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetch("/api/org-keys")
      .then((r) => r.json())
      .then((data) => setInfo(data))
      .catch(() => {});
  }, [refreshKey]);

  const handleShare = async () => {
    if (!domain.trim()) return;
    setSharing(true);
    setStatus("idle");
    setErrorMsg("");
    try {
      const res = await fetch("/api/org-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: domain.trim().toLowerCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setErrorMsg(data.error || "Failed to share keys");
        return;
      }
      setStatus("success");
      // Refresh info
      const infoRes = await fetch("/api/org-keys");
      const infoData = await infoRes.json();
      setInfo(infoData);
    } catch {
      setStatus("error");
      setErrorMsg("Network error");
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="mt-8 border-t border-zinc-800 pt-6">
      <h3 className="mb-3 text-sm font-semibold uppercase text-zinc-400">
        Team Sharing
      </h3>
      <p className="mb-3 text-xs text-zinc-500">
        Share your API keys with anyone who signs in with a specific email domain.
        Team members won&apos;t need to configure their own keys.
      </p>

      {info?.sharedKeysAvailable && !info?.isAdmin && (
        <div className="mb-3 rounded-lg border border-green-900 bg-green-950/30 p-3">
          <p className="text-xs text-green-400">
            Your organization has shared keys available. All services are active.
          </p>
        </div>
      )}

      {info?.adminDomains && info.adminDomains.length > 0 && (
        <div className="mb-3 space-y-2">
          {info.adminDomains.map((d) => (
            <div key={d.domain} className="rounded-lg border border-zinc-800 bg-zinc-800/50 p-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-white">@{d.domain}</p>
                  <p className="text-[10px] text-zinc-500">
                    {Object.keys(d.keys).length} keys shared
                  </p>
                </div>
                <span className="text-xs text-green-400">Active</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {Object.keys(d.keys).map((k) => (
                  <span key={k} className="rounded bg-zinc-700 px-1.5 py-0.5 text-[10px] text-zinc-400">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {hasKeys ? (
        <>
          <div className="flex gap-2">
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="radiomilwaukee.org"
              className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-white focus:border-zinc-500 focus:outline-none"
            />
            <button
              onClick={handleShare}
              disabled={sharing || !domain.trim()}
              className="rounded bg-white px-3 py-1.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:opacity-50"
            >
              {sharing ? "..." : "Share"}
            </button>
          </div>

          {status === "success" && (
            <p className="mt-2 text-xs text-green-400">
              Keys shared with @{domain}. Anyone signing in with that domain will have access.
            </p>
          )}
          {status === "error" && (
            <p className="mt-2 text-xs text-red-400">{errorMsg}</p>
          )}
        </>
      ) : (
        <p className="text-xs text-zinc-500">
          Add your own API keys above before sharing with your team.
        </p>
      )}

      <p className="mt-3 text-[10px] text-zinc-600">
        Team members&apos; own keys always take priority over shared keys.
        Only you (the admin) can update shared keys.
      </p>
    </div>
  );
}
