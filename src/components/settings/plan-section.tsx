"use client";

import { useState, useEffect } from "react";

interface PlanData {
  plan: string;
  agentQueriesUsed: number;
  agentQueriesLimit: number;
  periodEnd: string;
  hasBYOK: boolean;
}

export function PlanSection() {
  const [data, setData] = useState<PlanData | null>(null);

  useEffect(() => {
    fetch("/api/subscription/status")
      .then((r) => r.json())
      .then(setData)
      .catch(() => {});
  }, []);

  if (!data) return null;

  const isPaid = data.plan === "pro" || data.plan === "team";
  const priceLabel = data.plan === "team" ? "$25/mo" : data.plan === "pro" ? "$15/mo" : "";

  return (
    <div className="mb-6 rounded-lg border border-zinc-700 bg-zinc-800 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase text-zinc-400">Your Plan</h3>
        <span className="rounded-full bg-zinc-700 px-2 py-0.5 text-xs font-medium text-white">
          {data.plan.charAt(0).toUpperCase() + data.plan.slice(1)}
          {isPaid && ` (${priceLabel})`}
        </span>
      </div>

      <div className="space-y-1 text-sm text-zinc-300">
        <p>
          Agent queries: {data.hasBYOK ? "Unlimited (BYOK)" : `${data.agentQueriesUsed} of ${data.agentQueriesLimit} used`}
        </p>
        <p>Chat queries: Unlimited</p>
        {data.periodEnd && (
          <p className="text-zinc-500">Period resets: {data.periodEnd}</p>
        )}
      </div>

      <div className="mt-3 flex gap-2">
        {isPaid ? (
          <button
            onClick={async () => {
              const res = await fetch("/api/stripe/portal", { method: "POST" });
              const d = await res.json();
              if (d.url) window.location.href = d.url;
            }}
            className="rounded-md border border-zinc-600 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-400"
          >
            Manage Subscription
          </button>
        ) : (
          <button
            onClick={async () => {
              const res = await fetch("/api/stripe/checkout", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_MONTHLY_PRICE_ID,
                }),
              });
              const d = await res.json();
              if (d.url) window.location.href = d.url;
            }}
            className="rounded-md bg-amber-500 px-3 py-1.5 text-xs font-medium text-black hover:bg-amber-400"
          >
            Upgrade to Pro — $15/mo
          </button>
        )}
      </div>
    </div>
  );
}
