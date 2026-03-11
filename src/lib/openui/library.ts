import { createLibrary } from "@openuidev/react-lang";
import type { PromptOptions } from "@openuidev/react-lang";
import {
  ArtistCard,
  ConcertList,
  ConcertEvent,
  AlbumGrid,
  AlbumEntry,
  SampleTree,
  SampleConnection,
  TrackList,
} from "./components";

export const crateLibrary = createLibrary({
  root: "ConcertList", // Default root — LLM can use any component as root
  components: [
    ArtistCard,
    ConcertList,
    ConcertEvent,
    AlbumGrid,
    AlbumEntry,
    SampleTree,
    SampleConnection,
    TrackList,
  ],
  componentGroups: [
    {
      name: "Artist Research",
      components: ["ArtistCard", "AlbumGrid", "AlbumEntry"],
      notes: ["Use ArtistCard for artist profiles, AlbumGrid for discographies"],
    },
    {
      name: "Events & Concerts",
      components: ["ConcertList", "ConcertEvent"],
      notes: ["Group events by date. Always include venue and city."],
    },
    {
      name: "Sampling & Connections",
      components: ["SampleTree", "SampleConnection"],
      notes: [
        "Use SampleTree to show sampling relationships between tracks.",
        "Each connection shows original → sampled direction.",
      ],
    },
    {
      name: "Playlists & Tracks",
      components: ["TrackList"],
      notes: ["Use for curated playlists or track listings."],
    },
  ],
});

export const cratePromptOptions: PromptOptions = {
  preamble:
    "You are Crate, an AI music research agent. When presenting structured data like concert listings, discographies, sample trees, or playlists, use OpenUI Lang components. For conversational responses, use plain text.",
  additionalRules: [
    "Use plain text for conversational answers, explanations, and analysis.",
    "Use OpenUI Lang components ONLY when presenting structured data that benefits from visual formatting.",
    "For concert/event data, always use ConcertList with ConcertEvent children.",
    "For discographies, use AlbumGrid with AlbumEntry children.",
    "For sampling relationships, use SampleTree with SampleConnection children.",
    "Do not wrap simple text responses in components.",
  ],
  examples: [
    `root = ConcertList("Milwaukee Concerts This Week", [e1, e2])
e1 = ConcertEvent("Dark Star Orchestra", "Friday, March 13", "7:30 PM", "Riverside Theatre", "Milwaukee", "$35–$65", "On Sale")
e2 = ConcertEvent("Hieroglyphics", "Friday, March 13", "8:00 PM", "Turner Hall Ballroom", "Milwaukee", "$25–$45", "On Sale")`,
    `root = ArtistCard("Miles Davis", ["Jazz", "Fusion", "Modal Jazz"], "1944–1991", "Alton, Illinois")`,
    `root = SampleTree("Amen Break Samples", [s1, s2])
s1 = SampleConnection("Amen, Brother", "The Winstons", "Straight Outta Compton", "N.W.A", "1988", "drum break")
s2 = SampleConnection("Amen, Brother", "The Winstons", "Girl/Boy Song", "Aphex Twin", "1996", "drum break")`,
  ],
};

/** Generate the full system prompt addition for OpenUI Lang support. */
export function getCrateOpenUIPrompt(): string {
  return crateLibrary.prompt(cratePromptOptions);
}
