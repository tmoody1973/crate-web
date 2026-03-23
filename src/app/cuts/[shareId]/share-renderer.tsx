"use client";

import { Renderer } from "@openuidev/react-lang";
import { crateLibrary } from "@/lib/openui/library";

export function ShareRenderer({ data }: { data: string }) {
  return <Renderer library={crateLibrary} response={data} isStreaming={false} />;
}
