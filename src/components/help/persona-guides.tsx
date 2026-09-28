import type { PersonaId } from "./persona-picker";

interface WorkflowGuide {
  id: string;
  title: string;
  description: string;
  example: string;
  agentBehavior: string;
  tip: string;
}

const GUIDES: Record<Exclude<PersonaId, "new-user">, WorkflowGuide[]> = {
  "radio-host": [
    {
      id: "show-prep",
      title: "Show Prep",
      description:
        "Generate a complete show prep package in one prompt. Crate returns track context, suggested talk breaks, artist background, and social copy ready for Twitter/Instagram — everything you need before you go on air.",
      example: "/show-prep 4 tracks starting with Khruangbin for HYFIN evening show",
      agentBehavior:
        "The agent pulls track metadata, artist bios, release context, and recent news, then formats everything as a print-ready briefing sheet with customizable talk break scripts.",
      tip: "Specify your station name and daypart (morning drive, evening chill) so the tone matches your show.",
    },
    {
      id: "interview-research",
      title: "Interview Research",
      description:
        "Prepare deep background on any artist before a live on-air interview. Ask Crate for career arc, key albums, stylistic evolution, and what makes them unique — delivered as a structured briefing you can skim in 5 minutes.",
      example:
        "Research Hiatus Kaiyote for an interview — history, key albums, what makes them unique",
      agentBehavior:
        "The agent synthesizes Wikipedia, AllMusic, Pitchfork, and Resident Advisor sources into a structured brief, highlighting notable quotes and likely conversation angles.",
      tip: "Follow up with 'Give me 5 interview questions based on this' and Crate will draft them for you.",
    },
    {
      id: "influence-mapping",
      title: "Influence Mapping",
      description:
        "Use the /influence command to trace an artist's full musical lineage — who they cite, who cited them, and what publications document the connections. Great for contextualizing new music for your audience.",
      example: "/influence Flying Lotus",
      agentBehavior:
        "The agent searches review databases and Wikipedia for co-mentions and citation patterns, building a weighted influence graph with source links for every connection it surfaces.",
      tip: "Pair influence maps with show prep to give your talk breaks historical context that sets your show apart.",
    },
    {
      id: "publishing",
      title: "Publishing Your Research",
      description:
        "Turn any research session into a shareable article with one command. /publish formats your last response and sends it to Telegraph (free, no account) or Tumblr (requires API key in Settings).",
      example: "/publish",
      agentBehavior:
        "The agent takes the previous response, structures it with headings and source citations, and publishes to your configured destination — returning a public URL you can share in your show notes.",
      tip: "Great for building a public archive of your show research. Listeners can read background on the music you played.",
    },
  ],
  dj: [
    {
      id: "sample-digging",
      title: "Sample Digging",
      description:
        "Ask Crate to reveal the sample DNA of any album or producer. WhoSampled integration lets you trace original breaks, chord progressions, and vocal chops back to their source records — essential for crate diggers going deep.",
      example: "What samples did Madlib use on Shades of Blue?",
      agentBehavior:
        "The agent queries WhoSampled and cross-references Discogs to return sample origins with release dates, labels, and similar records you might want to dig for.",
      tip: "Follow up with 'Find the original Blue Note pressings of these samples on Discogs' to jump straight into vinyl research.",
    },
    {
      id: "genre-exploration",
      title: "Genre Exploration",
      description:
        "Explore Bandcamp tags to surface the best releases in any micro-genre. Crate pulls top releases, new arrivals, and editor picks filtered by tag — perfect for staying ahead of emerging sounds before they hit the mainstream.",
      example: "Explore the vaporwave tag on Bandcamp — show me the best releases",
      agentBehavior:
        "The agent calls the Bandcamp tag API, filters by fan favorites and recent uploads, and returns an AlbumGrid with embeddable previews so you can audition tracks directly in the chat.",
      tip: "Use nested tags like 'lo-fi jazz' or 'ambient techno' for more targeted results.",
    },
    {
      id: "playlist-building",
      title: "DJ Set Building",
      description:
        "Describe where you want your set to start and end and Crate builds a 10-20 track arc with BPM and key notes. Useful for planning transitions and building tension across a long set.",
      example: "Build a 10-track DJ set that goes from deep house to Detroit techno",
      agentBehavior:
        "The agent generates a sequenced TrackList with tempo and mood annotations at each transition point, drawing on its knowledge of house and techno canon to suggest real tracks.",
      tip: "Add constraints like 'vinyl only' or 'released before 1995' to shape the set for your context.",
    },
    {
      id: "bandcamp-discovery",
      title: "Bandcamp Discovery",
      description:
        "Run deep Bandcamp searches beyond the tag browser. Ask for experimental albums in a specific genre, label, geography, or time range — Crate uses search_bandcamp to find releases you'd never stumble on otherwise.",
      example: "Find experimental jazz albums on Bandcamp from the last year",
      agentBehavior:
        "The agent runs targeted Bandcamp searches and returns an AlbumGrid of results with stream links, so you can preview and save directly from the chat interface.",
      tip: "Bookmark albums with the save button on any AlbumGrid card to add them to your workspace library.",
    },
  ],
  collector: [
    {
      id: "collection-management",
      title: "Collection Management",
      description:
        "Browse any label's catalog filtered by era, genre, or catalog number. Crate pulls Discogs data and presents it as a sortable AlbumGrid — ideal for identifying gaps in your collection or planning your next dig.",
      example: "Show me all Blue Note releases from 1963-1967",
      agentBehavior:
        "The agent queries Discogs and MusicBrainz for label releases, returns an AlbumGrid with pressing details and Discogs marketplace links, and lets you save specific records to your workspace.",
      tip: "Filter by format — add 'LP only' or 'original pressing' to the prompt to narrow results to what matters.",
    },
    {
      id: "album-research",
      title: "Album Research",
      description:
        "Get an exhaustive deep dive on any album: production notes, sample sources, original pressings, critical reception over time, and collector demand. Everything you need to truly understand what you're holding.",
      example: "Deep dive on Madvillainy — production, samples, reception, pressings",
      agentBehavior:
        "The agent synthesizes data from Discogs, MusicBrainz, Pitchfork, AllMusic, and WhoSampled into a structured report covering creation, reception, and collecting considerations.",
      tip: "Ask 'What are the most sought-after pressings of this album?' as a follow-up to get Discogs marketplace context.",
    },
    {
      id: "discography-dives",
      title: "Discography Deep Dives",
      description:
        "Walk through a label, artist, or era's full discography in chronological order. Crate maps stylistic shifts, notable releases, and turning points — giving you the narrative arc behind a body of work.",
      example: "Walk me through the Stones Throw Records catalog 2000-2010",
      agentBehavior:
        "The agent pulls the full discography from Discogs and MusicBrainz, annotates key releases with critical context from review archives, and returns a timeline view you can scroll through.",
      tip: "Try label discographies for eras you're actively collecting — it surfaces overlooked records that belong in your crate.",
    },
  ],
  "music-lover": [
    {
      id: "artist-discovery",
      title: "Artist Discovery",
      description:
        "Find artists you've never heard of but will immediately love. Describe what you like about a current favorite and Crate surfaces lesser-known artists with genuine sonic and stylistic overlap — not just algorithm neighbors.",
      example: "Find artists similar to Khruangbin that I might not know",
      agentBehavior:
        "The agent generates ArtistCards with bios, key albums, and embed links — drawing on Last.fm similar artist data and editorial sources to surface recommendations beyond the obvious.",
      tip: "Be specific about what you love: 'Find artists with the same dusty, reverb-drenched guitar sound as Khruangbin' gets better results than a generic similarity search.",
    },
    {
      id: "playlist-creation",
      title: "Playlist Creation",
      description:
        "Describe a mood, moment, or vibe and Crate builds you a playlist. TrackList components are generated with playable embeds so you can audition the mix directly in the chat before saving it.",
      example: "Create a Sunday morning playlist — mellow, jazzy, warm",
      agentBehavior:
        "The agent generates a sequenced TrackList pulling from its music knowledge, with YouTube and Bandcamp embed links on each track. Save the full playlist to your workspace with one click.",
      tip: "Add context like 'for cooking breakfast' or 'instrumental only' to help Crate tune the mood more precisely.",
    },
    {
      id: "genre-exploration",
      title: "Genre Exploration",
      description:
        "Ask Crate to explain any genre from first principles — history, key artists, essential albums, and how it connects to what you already know. A great entry point any time a new sound catches your ear.",
      example: "What is shoegaze? Give me the essential albums and artists",
      agentBehavior:
        "The agent writes a structured genre primer drawing on AllMusic, Pitchfork, and Wikipedia, returning an AlbumGrid of essential records alongside artist bios and historical context.",
      tip: "Follow up with 'What are the best modern artists working in this style?' to bridge the genre's history to new releases.",
    },
  ],
  journalist: [
    {
      id: "artist-research",
      title: "Artist Research",
      description:
        "Generate a comprehensive artist profile in minutes. Crate pulls career arc, major collaborations, critical reception, and discography context from multiple sources — formatted as structured copy ready to adapt for publication.",
      example: "Write a comprehensive profile of Thundercat — career arc, collaborations, discography",
      agentBehavior:
        "The agent synthesizes Pitchfork, AllMusic, Wikipedia, and review archives into a narrative profile with inline source citations, giving you a research foundation you can build your piece on.",
      tip: "Ask for 'a profile suitable for a 1500-word feature article' to tune the depth and structure to your format.",
    },
    {
      id: "influence-mapping",
      title: "Influence Mapping",
      description:
        "The /influence command builds a sourced influence map for any artist — who shaped them, who they've shaped, and which publications have documented those connections. Essential for contextualizing an artist's place in music history.",
      example: "/influence J Dilla",
      agentBehavior:
        "The agent searches review databases and editorial archives for co-mentions and citation patterns, returning a weighted influence graph with a source link for every documented connection.",
      tip: "Include influence maps as visual elements in published pieces — readers can explore the lineage interactively.",
    },
    {
      id: "publishing",
      title: "Publishing",
      description:
        "Publish research directly to Telegraph or Tumblr with /publish. Your article is formatted with headings, source citations, and any embedded images from the research session — ready to share in minutes.",
      example: "/publish",
      agentBehavior:
        "The agent takes your last research response, applies article formatting, and publishes to your configured destination — returning a public URL and copying it to your clipboard.",
      tip: "Set up your Tumblr API key in Settings to publish to your existing audience. Telegraph needs no account and works immediately.",
    },
    {
      id: "source-citations",
      title: "Source Citations",
      description:
        "Find all coverage of a topic across specific publications. Crate's ReviewSourceCard pulls Pitchfork, Resident Advisor, The Wire, and other critical outlets — useful for tracking how an artist has been received over time.",
      example: "Find all Pitchfork and Resident Advisor reviews mentioning Four Tet",
      agentBehavior:
        "The agent searches indexed review sources and returns ReviewSourceCards with publication, date, score, and excerpt — giving you a sourced timeline of critical reception you can cite directly.",
      tip: "Use source searches to spot critical consensus shifts — great for anniversary pieces or reassessment articles.",
    },
  ],
};

function GuideCard({ guide }: { guide: WorkflowGuide }) {
  return (
    <section
      id={guide.id}
      className="rounded-xl border p-5 mb-4 transition-colors hover:border-[#E8520E]"
      style={{ backgroundColor: "#18181b", borderColor: "rgba(245,240,232,0.06)" }}
    >
      <h3
        className="text-[18px] font-semibold mb-2"
        style={{ color: "#F5F0E8" }}
      >
        {guide.title}
      </h3>
      <p className="text-[14px] leading-relaxed mb-4" style={{ color: "#a1a1aa" }}>
        {guide.description}
      </p>

      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-wider mb-2" style={{ color: "#7a8a9a" }}>
          Example
        </p>
        <div
          className="rounded-lg border px-4 py-3 font-mono text-[13px]"
          style={{
            backgroundColor: "#0a0a0a",
            borderColor: "rgba(245,240,232,0.1)",
            color: "#E8520E",
          }}
        >
          {guide.example}
        </div>
      </div>

      <p className="text-[13px] leading-relaxed mb-4" style={{ color: "#a1a1aa" }}>
        <span className="font-medium" style={{ color: "#F5F0E8" }}>What the agent does: </span>
        {guide.agentBehavior}
      </p>

      <div
        className="rounded-lg border px-4 py-3 text-[13px]"
        style={{
          backgroundColor: "rgba(232,82,14,0.06)",
          borderColor: "rgba(232,82,14,0.2)",
          color: "#a1a1aa",
        }}
      >
        <span className="font-semibold" style={{ color: "#E8520E" }}>Tip: </span>
        {guide.tip}
      </div>
    </section>
  );
}

export function PersonaGuides({ persona }: { persona: PersonaId }) {
  if (persona === "new-user") {
    return null;
  }

  const guides = GUIDES[persona];

  return (
    <section id="persona-guides" className="mb-16">
      <h2
        className="text-[32px] font-bold tracking-[-1px] mb-1"
        style={{ fontFamily: "var(--font-bebas)", color: "#F5F0E8" }}
      >
        WORKFLOW GUIDES
      </h2>
      <p className="text-[15px] mb-8" style={{ fontFamily: "var(--font-space)", color: "#7a8a9a" }}>
        Step-by-step guides for your specific workflow.
      </p>

      <div className="space-y-2">
        {guides.map((guide) => (
          <GuideCard key={guide.id} guide={guide} />
        ))}
      </div>
    </section>
  );
}
