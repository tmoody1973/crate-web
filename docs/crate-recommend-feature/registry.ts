// convex/ingestion/publications/registry.ts

import type { PublicationAdapter } from "./types";
import { pitchforkAdapter } from "./pitchfork";

// Add new adapters here. The pipeline doesn't need to change.
const adapters: Record<string, PublicationAdapter> = {
  [pitchforkAdapter.slug]: pitchforkAdapter,
};

export function getAdapter(slug: string): PublicationAdapter {
  const adapter = adapters[slug];
  if (!adapter) throw new Error(`No adapter registered for publication: ${slug}`);
  return adapter;
}

export function listAdapters(): PublicationAdapter[] {
  return Object.values(adapters);
}
