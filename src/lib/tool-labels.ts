/**
 * Human-readable labels for tool calls, matching the CLI's progress messages.
 */

export interface ToolStep {
  id: string;
  tool: string;
  server: string;
  label: string;
  status: "active" | "done";
}

export function getToolLabel(
  tool: string,
  server: string,
  input: unknown,
): string {
  const inp = (input ?? {}) as Record<string, unknown>;

  switch (tool) {
    // MusicBrainz
    case "search_artist":
      return `Searching MusicBrainz for "${inp.query}"`;
    case "get_artist":
      return "Fetching artist details";
    case "search_release":
      return inp.artist
        ? `Searching releases by ${inp.artist}`
        : `Searching for "${inp.query}"`;
    case "get_release":
      return "Fetching release details";
    case "search_recording":
      return inp.artist
        ? `Searching tracks by ${inp.artist}`
        : `Searching for "${inp.query}"`;
    case "get_recording_credits":
      return "Fetching recording credits";

    // Discogs
    case "search_discogs":
      return `Searching Discogs for "${inp.query}"`;
    case "get_artist_discogs":
      return "Fetching Discogs artist profile";
    case "get_artist_releases":
      return "Fetching artist discography from Discogs";
    case "get_label":
      return "Fetching label profile from Discogs";
    case "get_label_releases":
      return "Fetching label catalog from Discogs";
    case "get_master":
      return "Fetching master release from Discogs";
    case "get_release_full":
      return "Fetching full release details from Discogs";
    case "get_marketplace_stats":
      return "Fetching marketplace pricing from Discogs";

    // Genius
    case "search_songs":
      return `Searching Genius for "${inp.query}"`;
    case "get_song":
      return "Fetching song details from Genius";
    case "get_song_annotations":
      return "Fetching song annotations from Genius";
    case "get_artist_genius":
      return "Fetching artist profile from Genius";
    case "get_artist_songs_genius":
      return "Fetching artist songs from Genius";

    // Wikipedia
    case "search_articles":
      return `Searching Wikipedia for "${inp.query}"`;
    case "get_summary":
      return `Reading Wikipedia summary for "${inp.title}"`;
    case "get_article":
      return `Reading Wikipedia article on "${inp.title}"`;

    // Bandcamp
    case "search_bandcamp":
      return inp.location
        ? `Searching Bandcamp for "${inp.query}" in ${inp.location}`
        : `Searching Bandcamp for "${inp.query}"`;
    case "get_artist_page":
      return "Fetching Bandcamp artist page";
    case "get_album":
      return "Fetching album from Bandcamp";
    case "get_artist_tracks":
      return `Finding tracks on Bandcamp`;
    case "discover_music":
      return `Browsing Bandcamp ${inp.tag ?? "music"} releases`;

    // Last.fm
    case "get_artist_info":
      return `Looking up Last.fm stats for "${inp.artist}"`;
    case "get_album_info":
      return `Looking up "${inp.album}" by ${inp.artist} on Last.fm`;
    case "get_track_info":
      return `Looking up "${inp.track}" on Last.fm`;
    case "get_similar_artists":
      return `Finding artists similar to "${inp.artist}"`;
    case "get_similar_tracks":
      return `Finding similar tracks on Last.fm`;
    case "get_top_tracks":
      return `Fetching top tracks for "${inp.artist}"`;

    // YouTube
    case "search_tracks":
      return `Searching YouTube for "${inp.query}"`;
    case "play_track":
      return inp.url ? "Playing track" : `Playing "${inp.query}"`;

    // Web search
    case "web_search":
      return `Searching the web for "${inp.query}"`;

    // WhoSampled
    case "search_whosampled":
      return `Searching WhoSampled for "${inp.artist} – ${inp.track}"`;
    case "get_track_samples":
      return "Fetching sample relationships from WhoSampled";
    case "get_artist_connections":
      return `Fetching sampling connections for "${inp.artist}"`;

    // iTunes
    case "search_itunes_songs":
      return `Searching iTunes for "${inp.query}"`;
    case "search_itunes_albums":
      return `Searching iTunes albums for "${inp.query}"`;
    case "search_itunes_artists":
      return `Searching iTunes artists for "${inp.query}"`;
    case "lookup_itunes_album":
      return `Looking up iTunes album #${inp.albumId}`;

    // Browser (Kernel)
    case "browse_url":
      return `Reading page: ${inp.url}`;
    case "screenshot_url":
      return `Taking screenshot: ${inp.url}`;

    // Events
    case "search_events":
      return `Searching events for "${inp.keyword ?? inp.query}"`;

    // Influence
    case "build_influence_network":
      return `Building influence network for "${inp.artist}"`;

    default:
      return `Using ${server}: ${tool}`;
  }
}

/** Contextual label shown between tool calls instead of generic "Thinking..." */
export function getThinkingLabel(doneSteps: ToolStep[]): string {
  if (doneSteps.length === 0) return "Thinking...";
  const lastTool = doneSteps[doneSteps.length - 1].tool;
  switch (lastTool) {
    case "lookup_influences":
    case "build_influence_network":
      return "Analyzing influence connections...";
    case "search_web":
    case "web_search":
      return "Processing research results...";
    case "search_reviews":
      return "Reading reviews and citations...";
    case "enrich_connections":
      return "Enriching with quotes and sources...";
    case "search_artist":
    case "get_artist":
    case "get_artist_info":
      return "Building artist profile...";
    case "search_release":
    case "get_release":
    case "get_artist_releases":
      return "Analyzing discography...";
    case "search_songs":
    case "get_song":
      return "Analyzing track details...";
    case "get_similar_artists":
      return "Mapping similar artists...";
    case "search_whosampled":
    case "get_track_samples":
    case "get_artist_connections":
      return "Tracing sample connections...";
    case "search_tracks":
    case "play_track":
      return "Preparing playback...";
    case "browse_url":
      return "Reading source material...";
    case "create_spotify_playlist":
    case "add_tracks_to_playlist":
      return "Building playlist...";
    case "read_spotify_library":
    case "read_playlist_tracks":
      return "Loading Spotify data...";
    case "send_to_slack":
      return "Formatting message...";
    case "read_tumblr_dashboard":
    case "read_tumblr_tagged":
      return "Loading Tumblr posts...";
    case "search_events":
      return "Finding upcoming shows...";
    default:
      return "Composing response...";
  }
}
