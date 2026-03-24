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
  ReviewSourceCard,
  ArtistProfileCard,
  InfluenceChain,
  InfluenceCard,
  InfluencePathTrace,
  SpotifyPlaylists,
  SpotifyPlaylist,
  SlackMessage,
  SlackChannelPicker,
  StoryCard,
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
    ReviewSourceCard,
    ArtistProfileCard,
    InfluenceChain,
    InfluenceCard,
    InfluencePathTrace,
    SpotifyPlaylists,
    SpotifyPlaylist,
    SlackMessage,
    SlackChannelPicker,
    StoryCard,
  ],
  componentGroups: [
    {
      name: "Connected Services",
      components: ["SpotifyPlaylists", "SpotifyPlaylist", "SlackMessage", "SlackChannelPicker"],
      notes: [
        "ALWAYS use SpotifyPlaylists when read_spotify_library returns type=playlists. Pass the playlists array as JSON.",
        "ALWAYS use SpotifyPlaylist when read_playlist_tracks returns tracks for a single playlist. Pass the tracks array as JSON.",
        "ALWAYS use SlackChannelPicker when the user says 'send to Slack' — call list_slack_channels first, then render the picker. Never ask the user to type a channel name.",
        "Use SlackMessage to preview what will be sent to Slack before calling send_to_slack.",
        "SlackMessage sections: [{type:'header',content:'...'}, {type:'text',content:'...'}, {type:'bullets',items:['a','b']}, {type:'divider'}, {type:'quote',content:'...'}]",
      ],
    },
    {
      name: "Stories & Deep Dives",
      components: ["StoryCard"],
      notes: [
        "Use StoryCard when the user asks about the story, history, making, or origin of an album, artist, genre, event, or label.",
        "StoryCard is for NARRATIVE content — stories with chapters, context, and human interest. NOT for simple facts (use ArtistCard) or connections (use InfluenceChain).",
        "Include a YouTube videoId when you find a relevant documentary, interview, or performance video.",
        "Include keyPeople for anyone mentioned who the user might want to explore further.",
        "Each chapter should be 2-4 paragraphs. 3-5 chapters is ideal.",
      ],
    },
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
      components: ["TrackList", "TrackItem", "AddToPlaylist", "SpotifyPlaylist"],
      notes: [
        "Use TrackList with TrackItem children for NEW playlists.",
        "Use AddToPlaylist with TrackItem children to add tracks to an EXISTING playlist.",
        "Use SpotifyPlaylist when displaying the user's Spotify playlist data from read_playlist_tracks. Pass the tracks array as a JSON string.",
      ],
    },
    {
      name: "Influence Mapping",
      components: ["InfluenceChain", "InfluenceCard", "InfluencePathTrace", "ReviewSourceCard", "ArtistProfileCard"],
      notes: [
        "Use InfluenceChain for deep influence dives — vertical timeline with weight-colored dots.",
        "Use InfluenceCard for compact inline influence mentions.",
        "Use InfluencePathTrace to show how two artists are connected.",
        "ReviewSourceCard shows individual review sources with publication badges.",
        "ArtistProfileCard is an enhanced ArtistCard with influence summary.",
        "connections prop is a JSON string array — see prompt examples for exact format.",
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
    `root = ArtistCard("J Dilla", ["Hip-Hop", "Instrumental Hip-Hop", "Neo-Soul"], "1974–2006", "Detroit, Michigan", "", "James Dewitt Yancey", ["Stones Throw", "MCA", "BBE"], [{"title":"Donuts","year":"2006"},{"title":"The Shining","year":"2006"},{"title":"Ruff Draft","year":"2003"}], ["A Tribe Called Quest", "Erykah Badu", "Common", "Madlib"], "Off-kilter swing, dusty MPC chops, humanized drums that breathe", ["Pete Rock", "DJ Premier", "A Tribe Called Quest"], ["Flying Lotus", "Kaytranada", "Knxwledge", "Mac Miller"], "Dilla made Donuts from his hospital bed — finished it 3 days before he passed. Every track is a love letter to the craft.")`,
    `root = SampleTree("Amen Break Samples", [s1, s2])
s1 = SampleConnection("Amen, Brother", "The Winstons", "Straight Outta Compton", "N.W.A", "1988", "drum break")
s2 = SampleConnection("Amen, Brother", "The Winstons", "Girl/Boy Song", "Aphex Twin", "1996", "drum break")`,
    `root = TrackList("Essential Jazz Playlist", [t1, t2, t3])
t1 = TrackItem("So What", "Miles Davis", "Kind of Blue", "1959")
t2 = TrackItem("A Love Supreme Pt. 1", "John Coltrane", "A Love Supreme", "1965")
t3 = TrackItem("Maiden Voyage", "Herbie Hancock", "Maiden Voyage", "1965")`,
    `root = SpotifyPlaylists(32, "[{\\"name\\":\\"HYFIN tracks\\",\\"trackCount\\":272,\\"playlistId\\":\\"3cEYpjA9oz9GiPac4AsH4n\\"},{\\"name\\":\\"Soulection Radio\\",\\"trackCount\\":688,\\"playlistId\\":\\"5Rrf7mqN8uus2AaQQQNdc1\\"}]")`,
    `root = SlackMessage("#hyfin-evening", "Show Prep: Khruangbin → Little Simz", "[{\\"type\\":\\"header\\",\\"content\\":\\"Tonight's Set Flow\\"},{\\"type\\":\\"text\\",\\"content\\":\\"From Texas barn funk to London grime — here's the thread connecting tonight's set.\\"},{\\"type\\":\\"bullets\\",\\"items\\":[\\"Khruangbin — Time (You and I)\\",\\"Little Simz — Gorilla\\",\\"Noname — Song 31\\"]},{\\"type\\":\\"divider\\"},{\\"type\\":\\"quote\\",\\"content\\":\\"Thai funk cassettes > Texas barn > London independence > Chicago poetry\\"}]", "sent", "https://slack.com/archives/C123/p456")`,
    `root = SpotifyPlaylist("HYFIN Evening Set", 45, "3cEYpjA9oz9GiPac4AsH4n", "https://open.spotify.com/playlist/3cEYpjA9oz9GiPac4AsH4n", "[{\\"position\\":1,\\"name\\":\\"Time (You and I)\\",\\"artist\\":\\"Khruangbin\\",\\"album\\":\\"Con Todo El Mundo\\",\\"year\\":\\"2018\\",\\"durationSec\\":234},{\\"position\\":2,\\"name\\":\\"Gorilla\\",\\"artist\\":\\"Little Simz\\",\\"album\\":\\"Sometimes I Might Be Introvert\\",\\"year\\":\\"2021\\",\\"durationSec\\":198}]")`,
    `root = ShowPrepPackage("HYFIN", "Thursday", "Tarik", "evening", [tc1], [tb1], [sp1], [], [ev1])
tc1 = TrackContextCard("Khruangbin", "Time (You and I)", "Born from the trio's deep immersion in 1960s Thai funk cassettes.", "Recorded at their rural Texas barn studio with vintage Fender Rhodes.", "Thai funk, surf rock, psychedelic soul", "Thai funk cassettes > Khruangbin > modern psych-soul", "The band learned Thai from their Houston neighbor.", "Khruangbin proves deep connections cross every border.", "high", "Playing Riverside Theatre March 22", "crew-ANG-bin")
tb1 = TalkBreakCard("transition", "Time (You and I)", "Gorilla", "From Texas barn funk to London grime.", "That was Khruangbin taking you to Thailand via Texas. Now Little Simz turned down every label twice.", "Khruangbin learned their sound from Thai funk cassettes. Little Simz learned hers watching Lauryn Hill. Two paths to uncompromising art.", "Texas barn funk, Thai cassettes, Mercury Prize", "Hit before the beat drops at 0:04", "crew-ANG-bin")
sp1 = SocialPostCard("Khruangbin > Little Simz", "From Thai funk to London grime. Tonight's HYFIN set traces Khruangbin's Texas barn to Little Simz's independence.", "Thai funk > Texas barn > London grime > Mercury Prize. Tonight on HYFIN.", "Tonight on HYFIN: how Thai funk cassettes and a London rapper's refusal to sign connect across oceans.", "#HYFIN, #MKE, #Khruangbin, #LittleSimz")
ev1 = ConcertEvent("Khruangbin", "Saturday, March 22", "8:00 PM", "Riverside Theatre", "Milwaukee", "$45-$75", "On Sale")`,
    `root = StoryCard("Donuts", "J Dilla · 2006 · Stones Throw Records", "https://upload.wikimedia.org/wikipedia/en/5/54/J_Dilla_-_Donuts.jpg", "The Story Behind", "[{\\"label\\":\\"tracks\\",\\"value\\":\\"31\\"},{\\"label\\":\\"samples\\",\\"value\\":\\"34\\"},{\\"label\\":\\"minutes\\",\\"value\\":\\"43\\"},{\\"label\\":\\"RS 500\\",\\"value\\":\\"#386\\"}]", "[{\\"title\\":\\"The Health Crisis\\",\\"subtitle\\":\\"How TTP changed everything\\",\\"content\\":\\"In early 2002, J Dilla was diagnosed with TTP, a rare blood disease. His condition deteriorated over three years, eventually confining him to Cedars-Sinai Medical Center.\\"},{\\"title\\":\\"The Recording\\",\\"subtitle\\":\\"Hospital bed, Boss SP-303\\",\\"content\\":\\"Despite his declining health, Dilla recorded using a portable sampler brought to his hospital room. His mother Ma Dukes brought vinyl records and massaged his swollen hands so he could work.\\"}]", "aiqK2rFEXHc", "J Dilla — Still Shining Documentary", "[{\\"name\\":\\"Ma Dukes\\",\\"role\\":\\"Mother\\"},{\\"name\\":\\"Madlib\\",\\"role\\":\\"Collaborator\\"},{\\"name\\":\\"Questlove\\",\\"role\\":\\"Advocate\\"}]", "[{\\"name\\":\\"Wikipedia\\",\\"url\\":\\"https://en.wikipedia.org/wiki/Donuts_(album)\\"},{\\"name\\":\\"Classic Album Sundays\\",\\"url\\":\\"https://classicalbumsundays.com/j-dilla-donuts/\\"}]")`,
  ],
};

/** Generate the full system prompt addition for OpenUI Lang support. */
export function getCrateOpenUIPrompt(): string {
  return crateLibrary.prompt(cratePromptOptions);
}
