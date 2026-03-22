"use client";

import { useState } from "react";
import { UserButton } from "@clerk/nextjs";
import { SettingsDrawer } from "@/components/settings/settings-drawer";
import { FeedbackButton } from "@/components/feedback/canny-widget";
import { useSidebar } from "./sidebar";

export function SidebarFooter() {
  const { collapsed } = useSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  return (
    <>
      <div className={`flex items-center border-t border-zinc-800 p-3 ${collapsed ? "justify-center" : "justify-between"}`}>
        <UserButton />
        {!collapsed && (
          <div className="flex items-center gap-1">
            <a
              href="/help"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Help"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <circle cx="12" cy="12" r="10" strokeWidth={2} />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 17h.01" />
              </svg>
            </a>
            <FeedbackButton className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white" />
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="rounded p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white"
              aria-label="Settings"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        )}
      </div>
      <SettingsDrawer isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </>
  );
}
