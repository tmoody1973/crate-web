"use client";

import { useState, createContext, useContext, ReactNode } from "react";
import { SidebarHeader } from "./sidebar-header";
import { SidebarFooter } from "./sidebar-footer";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
}

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) throw new Error("useSidebar must be used within Sidebar");
  return ctx;
}

export function Sidebar({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <SidebarContext.Provider value={{ collapsed, toggle: () => setCollapsed((c) => !c) }}>
      <aside
        className={`flex h-full flex-col border-r border-zinc-800 bg-zinc-950 transition-[width] duration-200 ${
          collapsed ? "w-12" : "w-[260px]"
        }`}
      >
        <SidebarHeader />
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          {!collapsed && children}
        </div>
        <SidebarFooter />
      </aside>
    </SidebarContext.Provider>
  );
}
