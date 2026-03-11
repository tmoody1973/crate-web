import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";
import { Sidebar } from "@/components/sidebar/sidebar";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen bg-zinc-950">
        <Sidebar>
          {/* Sidebar sections added in Task 7 */}
          <div />
        </Sidebar>
        <div className="flex flex-1 flex-col overflow-hidden">
          <main className="flex-1 overflow-hidden">{children}</main>
          <PlayerBar />
        </div>
      </div>
    </PlayerProvider>
  );
}
