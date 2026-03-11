"use client";

import { ArtifactProvider } from "@/components/workspace/artifact-provider";
import { ChatPanel } from "@/components/workspace/chat-panel";

export default function SessionPage() {
  return (
    <ArtifactProvider>
      <ChatPanel />
    </ArtifactProvider>
  );
}
