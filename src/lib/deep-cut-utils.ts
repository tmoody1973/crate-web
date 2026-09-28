/**
 * Shared utilities for Deep Cuts (saved research artifacts).
 * Used by both the panel component and the artifact provider.
 */

export type DeepCutType = "influence" | "playlist" | "showprep" | "artist" | "other";

/** Detect the Deep Cut type from OpenUI Lang content. */
export function detectDeepCutType(content: string): DeepCutType {
  if (content.includes("InfluenceChain(") || content.includes("InfluencePathTrace(")) return "influence";
  if (content.includes("TrackList(") || content.includes("SpotifyPlaylist(") || content.includes("SpotifyPlaylists(")) return "playlist";
  if (content.includes("ShowPrepPackage(")) return "showprep";
  if (content.includes("ArtistCard(") || content.includes("ArtistProfileCard(")) return "artist";
  return "other";
}

/** Color map for Deep Cut type dots. */
export const DEEP_CUT_COLORS: Record<DeepCutType, string> = {
  influence: "#8b5cf6",
  playlist: "#22c55e",
  showprep: "#f59e0b",
  artist: "#06b6d4",
  other: "#71717a",
};

/** Tailwind classes for Deep Cut type dots. */
export const DEEP_CUT_DOT_CLASSES: Record<DeepCutType, string> = {
  influence: "bg-violet-500",
  playlist: "bg-green-500",
  showprep: "bg-amber-500",
  artist: "bg-cyan-500",
  other: "bg-zinc-500",
};

/** Human-readable labels for Deep Cut types. */
export const DEEP_CUT_LABELS: Record<DeepCutType, string> = {
  influence: "Influence",
  playlist: "Playlist",
  showprep: "Show Prep",
  artist: "Artist",
  other: "Research",
};

export type ActionKey = "spotify" | "spotifyExport" | "slack" | "publish";

export const DEEP_CUT_ACTIONS: Record<DeepCutType, ActionKey[]> = {
  influence: ["spotifyExport", "slack", "publish"],
  playlist: ["spotify", "slack", "publish"],
  showprep: ["slack", "publish"],
  artist: ["spotify", "slack", "publish"],
  other: ["publish"],
};
