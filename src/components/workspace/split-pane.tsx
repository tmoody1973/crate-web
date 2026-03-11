"use client";

import { Group, Panel, Separator } from "react-resizable-panels";
import { ChatPanel } from "./chat-panel";
import { ArtifactsPanel } from "./artifacts-panel";

export function SplitPane() {
  return (
    <Group orientation="horizontal" className="h-full">
      <Panel defaultSize="40%" minSize="25%">
        <ChatPanel />
      </Panel>
      <Separator className="w-1 bg-zinc-800 hover:bg-zinc-600 transition-colors" />
      <Panel defaultSize="60%" minSize="25%">
        <ArtifactsPanel />
      </Panel>
    </Group>
  );
}
