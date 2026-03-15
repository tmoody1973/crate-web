import Link from "next/link";
import { bebasNeue, spaceGrotesk } from "@/lib/landing-fonts";
import { Nav } from "@/components/landing/nav";
import { Footer } from "@/components/landing/footer";
import { GuideHero } from "@/components/guide/guide-hero";
import { PersonaSection } from "@/components/guide/persona-section";
import { FeatureChecklist } from "@/components/guide/feature-checklist";
import { GuideTips } from "@/components/guide/guide-tips";

const personas = [
  {
    number: "01",
    name: "THE DJ",
    tagline: "SAMPLE HEADS & SET BUILDERS",
    description:
      "For DJs who dig for samples, build sets from deep cuts, and need to trace the lineage of breaks and beats.",
    categories: [
      {
        name: "Sample Discovery",
        prompts: [
          {
            prompt:
              'Who sampled "Amen Brother" by The Winstons?',
            expected:
              "Sample chain showing the Amen Break's use across hip-hop, jungle, and drum & bass. Sources: WhoSampled, Discogs, Wikipedia.",
          },
          {
            prompt:
              'Trace the sample history of "It\'s a New Day" by Skull Snaps',
            expected:
              "Deep sample archaeology — dozens of hip-hop tracks that sampled this break.",
          },
          {
            prompt:
              'What songs sample "Impeach the President" by The Honey Drippers?',
            expected:
              "List of tracks with years, artists, and links back to source databases.",
          },
        ],
      },
      {
        name: "Set Building",
        prompts: [
          {
            prompt:
              "Build me a 10-track playlist of deep house tracks from the late 90s Chicago scene",
            expected:
              "Curated playlist with verified track names, artists, labels. Playable via YouTube.",
          },
          {
            prompt:
              'Find tracks similar to "Mystery of Love" by Mr. Fingers',
            expected:
              "Similar tracks from Last.fm similarity data + Bandcamp discovery.",
          },
          {
            prompt: "What's playing on NTS Radio right now?",
            expected:
              "Live radio station search results with stream links.",
          },
        ],
      },
      {
        name: "Crate Digging",
        prompts: [
          {
            prompt:
              "Show me rare funk 45s on the Stax label worth over $50",
            expected:
              "Discogs marketplace data with pressing details, median prices, and condition notes.",
          },
          {
            prompt:
              "What are the most valuable Northern Soul records?",
            expected:
              "Vinyl valuation data from Discogs with pressing info and market stats.",
          },
        ],
      },
    ],
  },
  {
    number: "02",
    name: "THE RADIO HOST",
    tagline: "SHOW PREP & ON-AIR RESEARCH",
    description:
      "For radio hosts who need artist research, show prep packages, and quick access to music news and events.",
    categories: [
      {
        name: "Artist Research",
        prompts: [
          {
            prompt:
              "Give me a deep dive on Khruangbin — I'm interviewing them next week",
            expected:
              "Comprehensive artist profile — bio, discography, influences, touring history, scene context. Triggers the Artist Deep Dive skill.",
          },
          {
            prompt:
              "Tell me everything about Noname — her career, influences, and what makes her unique",
            expected:
              "Multi-source research from Wikipedia, MusicBrainz, Genius, Last.fm, and Bandcamp.",
          },
          {
            prompt:
              "What are the connections between Erykah Badu, J Dilla, and Madlib?",
            expected:
              "Influence network mapping showing collaboration history, shared samples, and artistic connections.",
          },
        ],
      },
      {
        name: "Show Prep",
        prompts: [
          {
            prompt: "/news 5",
            expected:
              "5 music news stories from today from Pitchfork, Stereogum, Resident Advisor, The Quietus, etc.",
          },
          {
            prompt:
              "What concerts are happening in Milwaukee this month?",
            expected:
              "Ticketmaster event listings with dates, venues, and ticket links.",
          },
          {
            prompt:
              "What's the story behind the Numero Group label?",
            expected:
              "Label research from Discogs, Wikipedia, and Bandcamp.",
          },
        ],
      },
      {
        name: "Publishing",
        prompts: [
          {
            prompt:
              "Publish a deep dive on Milwaukee's hip-hop scene to Telegraph",
            expected:
              "Agent creates a Telegraph page with formatted content and returns a shareable link.",
          },
        ],
      },
    ],
  },
  {
    number: "03",
    name: "THE RECORD COLLECTOR",
    tagline: "VINYL VALUATION & CATALOG RESEARCH",
    description:
      "For collectors who identify pressings, track values, manage collections, and research label catalogs.",
    categories: [
      {
        name: "Vinyl ID & Valuation",
        prompts: [
          {
            prompt:
              'I have a first pressing of "Blue Train" by John Coltrane on Blue Note — what\'s it worth?',
            expected:
              "Triggers Vinyl Valuation skill. Returns pressing details (BLP 1577), matrix numbers, and Discogs marketplace prices by condition.",
          },
          {
            prompt:
              'How do I identify an original pressing of Stevie Wonder "Songs in the Key of Life"?',
            expected:
              "Matrix/runout info, label variations, and price ranges from Discogs.",
          },
          {
            prompt:
              "What are the most valuable jazz records from the Prestige label?",
            expected:
              "Label catalog search with marketplace stats for top releases.",
          },
        ],
      },
      {
        name: "Collection Management",
        prompts: [
          {
            prompt:
              'Add "Kind of Blue" by Miles Davis to my collection — 1959 Columbia original, VG+ condition',
            expected:
              "Record added to collection with metadata.",
          },
          {
            prompt:
              'Show me everything in my collection tagged "jazz"',
            expected:
              "Collection search results with all saved records matching the tag.",
          },
          {
            prompt: "What's the total value of my collection?",
            expected:
              "Collection stats with count, estimated value range, and tag breakdown.",
          },
        ],
      },
      {
        name: "Label Deep Dives",
        prompts: [
          {
            prompt:
              "Map out the Blue Note Records catalog from the 1960s — key artists and essential releases",
            expected:
              "Discogs label search + MusicBrainz cross-reference.",
          },
          {
            prompt:
              "Compare the ECM and Blue Note approaches to recording jazz",
            expected:
              "Multi-source research comparing label philosophies.",
          },
        ],
      },
    ],
  },
  {
    number: "04",
    name: "THE MUSIC LOVER",
    tagline: "DISCOVERY, RABBIT HOLES & PLAYBACK",
    description:
      "For curious listeners who want personalized recommendations, deep rabbit holes, and seamless playback.",
    categories: [
      {
        name: "Discovery",
        prompts: [
          {
            prompt:
              "I love Radiohead — what else should I listen to?",
            expected:
              "Similar artists from Last.fm + influence tracing. Mix of obvious and surprising recommendations.",
          },
          {
            prompt:
              "What's the best music coming out of Nigeria right now?",
            expected:
              "Scene mapping of Afrobeats, Afropop, and alternative scenes.",
          },
          {
            prompt:
              "Recommend some albums for a rainy Sunday afternoon",
            expected:
              "Curated suggestions with album artwork and play links.",
          },
        ],
      },
      {
        name: "Rabbit Holes",
        prompts: [
          {
            prompt:
              "How did punk rock in the 1970s influence electronic music?",
            expected:
              "Influence path tracing from punk to electronic.",
          },
          {
            prompt:
              "Map the influence chain from Robert Johnson to Jack White",
            expected:
              "Multi-hop influence path through blues, rock & roll, garage rock.",
          },
          {
            prompt:
              "What's the connection between Brazilian Tropicalia and modern indie rock?",
            expected:
              "Cultural/musical influence tracing.",
          },
        ],
      },
      {
        name: "Playback",
        prompts: [
          {
            prompt: "/play Massive Attack - Teardrop",
            expected:
              "YouTube search and playback in the persistent player bar.",
          },
          {
            prompt:
              'Create a playlist called "Late Night Drives" with 8 tracks — mix of trip-hop, downtempo, and ambient',
            expected:
              "Playlist created with verified tracks.",
          },
          {
            prompt: '/play playlist Late Night Drives',
            expected: "Starts playing the saved playlist.",
          },
        ],
      },
    ],
  },
  {
    number: "05",
    name: "THE MUSIC JOURNALIST",
    tagline: "INVESTIGATIVE RESEARCH & PUBLISHING",
    description:
      "For writers who need deep research, comparative analysis, scene reporting, and publishing tools.",
    categories: [
      {
        name: "Investigative Research",
        prompts: [
          {
            prompt:
              "Deep dive into the history of sampling lawsuits — key cases and how they changed music",
            expected:
              "Multi-source research from Wikipedia, Genius, and web search.",
          },
          {
            prompt:
              "How has streaming changed the economics of independent music?",
            expected:
              "Research combining industry data and perspectives.",
          },
          {
            prompt:
              "What's the current state of the vinyl revival? Sales numbers, key labels, pressing plant capacity",
            expected:
              "Data-driven research with citations.",
          },
        ],
      },
      {
        name: "Artist Profiles",
        prompts: [
          {
            prompt:
              "Write a profile of Floating Points — his academic background, musical evolution, and the Promises collaboration with Pharoah Sanders",
            expected: "Comprehensive artist research.",
          },
          {
            prompt:
              "Compare the careers and artistic approaches of Kendrick Lamar and J. Cole",
            expected: "Side-by-side analysis.",
          },
        ],
      },
      {
        name: "Scene Reporting",
        prompts: [
          {
            prompt:
              "Map the current electronic music scene in Berlin — key clubs, labels, and artists",
            expected: "Triggers Scene Mapping skill.",
          },
          {
            prompt:
              "What's happening in the Amapiano scene? Origin, key artists, and global spread",
            expected: "Genre research.",
          },
        ],
      },
      {
        name: "Publishing",
        prompts: [
          {
            prompt:
              "Publish my research on Berlin's electronic scene as a Telegraph article",
            expected:
              "Formatted article posted to Telegraph.",
          },
        ],
      },
    ],
  },
];

export default function GuidePage() {
  return (
    <main
      className={`${bebasNeue.variable} ${spaceGrotesk.variable} font-[family-name:var(--font-space)]`}
    >
      <Nav />
      <GuideHero />
      <GuideNav />
      {personas.map((persona, i) => (
        <PersonaSection
          key={persona.number}
          persona={persona}
          dark={i % 2 !== 0}
        />
      ))}
      <FeatureChecklist />
      <GuideTips />
      <Footer />
    </main>
  );
}

function GuideNav() {
  const sections = [
    { label: "DJ", href: "#the-dj" },
    { label: "RADIO HOST", href: "#the-radio-host" },
    { label: "COLLECTOR", href: "#the-record-collector" },
    { label: "MUSIC LOVER", href: "#the-music-lover" },
    { label: "JOURNALIST", href: "#the-music-journalist" },
    { label: "CHECKLIST", href: "#checklist" },
    { label: "TIPS", href: "#tips" },
  ];

  return (
    <nav
      className="sticky top-20 z-40 py-3 px-12 max-md:px-5 overflow-x-auto"
      style={{
        backgroundColor: "#0A1628",
        borderBottom: "1px solid rgba(245,240,232,0.06)",
      }}
    >
      <div className="flex gap-6 max-md:gap-4 whitespace-nowrap">
        {sections.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="font-[family-name:var(--font-bebas)] text-[13px] tracking-[2px] transition-opacity hover:opacity-100"
            style={{ color: "#F5F0E8", opacity: 0.5 }}
          >
            {s.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
