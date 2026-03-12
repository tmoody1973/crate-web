"use client";

import { useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useAuth } from "@clerk/nextjs";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { YouTubePlayer } from "@/components/player/youtube-player";
import { Sidebar, useSidebar } from "@/components/sidebar/sidebar";
import { NewChatButton } from "@/components/sidebar/new-chat-button";
import { SearchBar } from "@/components/sidebar/search-bar";
import { CratesSection } from "@/components/sidebar/crates-section";
import { StarredSection } from "@/components/sidebar/starred-section";
import { RecentsSection } from "@/components/sidebar/recents-section";
import { ArtifactsSection } from "@/components/sidebar/artifacts-section";
import { PlaylistsSection } from "@/components/sidebar/playlists-section";
import { CollectionSection } from "@/components/sidebar/collection-section";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";

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
        <StarredSection />
        <RecentsSection />
        <ArtifactsSection />
      </div>
    </>
  );
}

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          <SidebarContent />
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
        <YouTubePlayer />
      </div>
    </PlayerProvider>
  );
}
