import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { Sidebar } from "@/components/sidebar/sidebar";
import { NewChatButton } from "@/components/sidebar/new-chat-button";
import { CratesSection } from "@/components/sidebar/crates-section";
import { StarredSection } from "@/components/sidebar/starred-section";
import { RecentsSection } from "@/components/sidebar/recents-section";
import { ArtifactsSection } from "@/components/sidebar/artifacts-section";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          <NewChatButton />
          <div className="mt-2 space-y-1">
            <CratesSection />
            <StarredSection />
            <RecentsSection />
            <ArtifactsSection />
          </div>
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
      </div>
    </PlayerProvider>
  );
}
