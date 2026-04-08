"use client";

import { useRef, useCallback, useState, useEffect, createContext, useContext } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { YouTubePlayer } from "@/components/player/youtube-player";
import { RadioPlayer } from "@/components/player/radio-player";
import { Sidebar, useSidebar } from "@/components/sidebar/sidebar";
import { MobileSidebar } from "@/components/sidebar/mobile-sidebar";
import { NewChatButton } from "@/components/sidebar/new-chat-button";
import { SearchBar } from "@/components/sidebar/search-bar";
import { CratesSection } from "@/components/sidebar/crates-section";
import { StarredSection } from "@/components/sidebar/starred-section";
import { RecentsSection } from "@/components/sidebar/recents-section";
import { ArtifactsSection } from "@/components/sidebar/artifacts-section";
import { PlaylistsSection } from "@/components/sidebar/playlists-section";
import { CollectionSection } from "@/components/sidebar/collection-section";
import { PublishedSection } from "@/components/sidebar/published-section";
import { WikiSection } from "@/components/sidebar/wiki-section";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

interface MobileNavContextValue {
  mobileView: "chat" | "sidebar" | "settings";
  setMobileView: (view: "chat" | "sidebar" | "settings") => void;
  isMobile: boolean;
}

const MobileNavContext = createContext<MobileNavContextValue | null>(null);

export function useMobileNav() {
  return useContext(MobileNavContext);
}

function SidebarContent() {
  const { toggle } = useSidebar();
  const searchRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const params = useParams();
  const { userId: clerkId } = useAuth();
  const user = useQuery(api.users.getByClerkId, clerkId ? { clerkId } : "skip");
  const createSession = useMutation(api.sessions.create);
  const toggleStar = useMutation(api.sessions.toggleStar);

  const handleNewChat = useCallback(async () => {
    if (!user) return;
    const id = await createSession({ userId: user._id });
    router.push(`/w/${id}`);
  }, [user, createSession, router]);

  const handleToggleStar = useCallback(async () => {
    const sessionId = params?.sessionId as string | undefined;
    if (!sessionId) return;
    await toggleStar({ id: sessionId as Id<"sessions"> });
  }, [params, toggleStar]);

  useKeyboardShortcuts({
    onNewChat: handleNewChat,
    onToggleSidebar: toggle,
    onFocusSearch: () => searchRef.current?.focus(),
    onToggleStar: handleToggleStar,
  });

  return (
    <>
      <NewChatButton />
      <SearchBar ref={searchRef} />
      <div className="mt-2 space-y-1">
        <CratesSection />
        <PlaylistsSection />
        <CollectionSection />
        <WikiSection />
        <PublishedSection />
        <StarredSection />
        <RecentsSection />
        <ArtifactsSection />
      </div>
    </>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [mobileView, setMobileView] = useState<"chat" | "sidebar" | "settings">("chat");
  const params = useParams();

  useEffect(() => {
    if (isMobile) setMobileView("chat");
  }, [params?.sessionId, isMobile]);

  return (
    <MobileNavContext.Provider value={{ mobileView, setMobileView, isMobile }}>
      <PlayerProvider>
        <div className="flex h-screen bg-zinc-950">
          {/* Desktop sidebar */}
          {!isMobile && (
            <Sidebar>
              <SidebarContent />
            </Sidebar>
          )}

          {/* Mobile sidebar overlay */}
          {isMobile && (
            <MobileSidebar
              open={mobileView === "sidebar"}
              onClose={() => setMobileView("chat")}
            >
              <SidebarContent />
            </MobileSidebar>
          )}

          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-hidden">{children}</main>
            <PlayerBar />
          </div>
          <YouTubePlayer />
          <RadioPlayer />
        </div>
      </PlayerProvider>
    </MobileNavContext.Provider>
  );
}
