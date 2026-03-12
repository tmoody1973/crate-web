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
  TrackItem,
  TrackList,
  AddToPlaylist,
  TrackContextCard,
  TalkBreakCard,
  SocialPostCard,
  InterviewPrepCard,
  ShowPrepPackage,
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
    TrackItem,
    TrackList,
    AddToPlaylist,
    TrackContextCard,
    TalkBreakCard,
    SocialPostCard,
    InterviewPrepCard,
    ShowPrepPackage,
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
      components: ["TrackList", "TrackItem", "AddToPlaylist"],
      notes: [
        "Use TrackList with TrackItem children for NEW playlists.",
        "Use AddToPlaylist with TrackItem children to add tracks to an EXISTING playlist.",
      ],
    },
    {
      name: "Show Prep",
      components: ["ShowPrepPackage", "TrackContextCard", "TalkBreakCard", "SocialPostCard", "InterviewPrepCard"],
      notes: [
        "ShowPrepPackage is the top-level container for all show prep output.",
        "Always use ShowPrepPackage as root, even for partial prep — set unused child arrays to [].",
        "TrackContextCard: one per track with origin story, production notes, connections.",
        "TalkBreakCard: one per transition between tracks with short/medium/long variants.",
        "SocialPostCard: platform-specific copy for Instagram, X, Bluesky.",
        "InterviewPrepCard: question categories for guest interviews.",
        "ShowPrepPackage also accepts optional events (ConcertEvent refs) for local events.",
      ],
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
    "For show prep requests, ALWAYS use ShowPrepPackage as root containing TrackContextCards, TalkBreakCards, SocialPostCards. Include ConcertEvent refs in events array for local events.",
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
    `root = TrackList("Essential Jazz Playlist", [t1, t2, t3])
t1 = TrackItem("So What", "Miles Davis", "Kind of Blue", "1959")
t2 = TrackItem("A Love Supreme Pt. 1", "John Coltrane", "A Love Supreme", "1965")
t3 = TrackItem("Maiden Voyage", "Herbie Hancock", "Maiden Voyage", "1965")`,
    `root = ShowPrepPackage("HYFIN", "Thursday", "Tarik", "evening", [tc1], [tb1], [sp1], [], [ev1])
tc1 = TrackContextCard("Khruangbin", "Time (You and I)", "Born from the trio's deep immersion in 1960s Thai funk cassettes.", "Recorded at their rural Texas barn studio with vintage Fender Rhodes.", "Thai funk, surf rock, psychedelic soul", "Thai funk cassettes > Khruangbin > modern psych-soul", "The band learned Thai from their Houston neighbor.", "Khruangbin proves deep connections cross every border.", "high", "Playing Riverside Theatre March 22", "crew-ANG-bin")
tb1 = TalkBreakCard("transition", "Time (You and I)", "Gorilla", "From Texas barn funk to London grime.", "That was Khruangbin taking you to Thailand via Texas. Now Little Simz turned down every label twice.", "Khruangbin learned their sound from Thai funk cassettes. Little Simz learned hers watching Lauryn Hill. Two paths to uncompromising art.", "Texas barn funk, Thai cassettes, Mercury Prize", "Hit before the beat drops at 0:04", "crew-ANG-bin")
sp1 = SocialPostCard("Khruangbin > Little Simz", "From Thai funk to London grime. Tonight's HYFIN set traces Khruangbin's Texas barn to Little Simz's independence.", "Thai funk > Texas barn > London grime > Mercury Prize. Tonight on HYFIN.", "Tonight on HYFIN: how Thai funk cassettes and a London rapper's refusal to sign connect across oceans.", "#HYFIN, #MKE, #Khruangbin, #LittleSimz")
ev1 = ConcertEvent("Khruangbin", "Saturday, March 22", "8:00 PM", "Riverside Theatre", "Milwaukee", "$45-$75", "On Sale")`,
  ],
};

/** Generate the full system prompt addition for OpenUI Lang support. */
export function getCrateOpenUIPrompt(): string {
  return crateLibrary.prompt(cratePromptOptions);
}
