import { Navbar } from "@/components/workspace/navbar";
import { PlayerBar } from "@/components/player/player-bar";
import { PlayerProvider } from "@/components/player/player-provider";

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlayerProvider>
      <div className="flex h-screen flex-col bg-zinc-950">
        <Navbar />
        <main className="flex-1 overflow-hidden">{children}</main>
        <PlayerBar />
      </div>
    </PlayerProvider>
  );
}
