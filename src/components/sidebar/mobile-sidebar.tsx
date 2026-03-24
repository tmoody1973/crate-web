"use client";

import { useEffect, useRef } from "react";
import { SidebarFooter } from "./sidebar-footer";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <div
        ref={sidebarRef}
        className="absolute inset-y-0 left-0 w-full bg-zinc-950 flex flex-col animate-in slide-in-from-left duration-200"
      >
        {/* Header */}
        <div className="flex h-11 items-center justify-between border-b border-zinc-800 px-3">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/crate-logo_Light.svg"
              alt="Crate"
              className="h-5 w-auto"
            />
            <span className="rounded bg-[#E8520E]/20 px-1 py-0.5 text-[8px] font-bold uppercase tracking-wider text-[#E8520E]">
              Beta
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-11 w-11 items-center justify-center text-zinc-400 hover:text-white"
            aria-label="Close menu"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {children}
        </div>

        {/* Footer: user, help, feedback, settings */}
        <SidebarFooter />
      </div>
    </div>
  );
}
