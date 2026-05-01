"use client";

import { useSidebar } from "./sidebar";

export function SidebarHeader() {
  const { collapsed, toggle } = useSidebar();

  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-3">
      {!collapsed && (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/crate-logo_Light.svg"
            alt="Crate"
            className="h-7 w-auto"
          />
          <span className="rounded bg-[#E8520E]/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[#E8520E]">
            Beta
          </span>
        </div>
      )}
      <button
        onClick={toggle}
        className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          {collapsed ? (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          ) : (
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
          )}
        </svg>
      </button>
    </div>
  );
}
