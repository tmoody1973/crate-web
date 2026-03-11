"use client";

import { ArtifactProvider } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";
import { ArtifactSlideIn } from "@/components/workspace/artifact-slide-in";

export default function SessionPage() {
  return (
    <ArtifactProvider>
      <div className="flex h-full">
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
        <ArtifactSlideIn />
      </div>
    </ArtifactProvider>
  );
}
