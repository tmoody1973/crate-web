"use client";

import { useSidebar } from "./sidebar";

export function SidebarHeader() {
  const { collapsed, toggle } = useSidebar();

  return (
    <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-3">
      {!collapsed && (
        <span className="text-lg font-bold text-white">Crate</span>
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
