"use client";

interface TinyDeskNode {
  name: string;
  role: string;
  era?: string;
  connection: string;
  strength: number;
  source?: string;
  sourceUrl?: string;
  sourceQuote?: string;
  sonicDna?: string[];
  keyWorks?: Array<{ title: string; year: string }>;
  videoId: string;
  videoTitle: string;
}

interface VideoInfluenceChainProps {
  nodes: TinyDeskNode[];
}

function getStrengthLabel(strength: number): string {
  if (strength > 0.85) return "Direct influence";
  if (strength > 0.7) return "Strong connection";
  if (strength > 0.55) return "Notable thread";
  return "Cultural echo";
}

function getStrengthColor(strength: number): string {
  if (strength > 0.85) return "#22C55E";
  if (strength > 0.7) return "#06B6D4";
  if (strength > 0.55) return "#EAB308";
  return "#A78BFA";
}

export function VideoInfluenceChain({ nodes }: VideoInfluenceChainProps) {
  return (
    <div className="w-full">
      {nodes.map((node, index) => {
        const strengthColor = getStrengthColor(node.strength);
        const strengthLabel = getStrengthLabel(node.strength);

        return (
          <div key={`${node.name}-${index}`}>
            {/* Divider between sections */}
            {index > 0 && (
              <div className="flex flex-col items-center py-8 md:py-12">
                <div
                  className="w-px"
                  style={{ height: "40px", backgroundColor: "#27272a" }}
                />
                <div
                  className="my-3 rounded-full px-4 py-1.5 text-[11px] font-medium tracking-widest uppercase"
                  style={{
                    backgroundColor: "#18181b",
                    border: "1px solid #27272a",
                    color: "#52525b",
                  }}
                >
                  influenced
                </div>
                <div
                  className="w-px"
                  style={{ height: "40px", backgroundColor: "#27272a" }}
                />
                <svg width="12" height="8" viewBox="0 0 12 8" fill="none" style={{ marginTop: "-1px" }}>
                  <path d="M6 8L0 0H12L6 8Z" fill="#27272a" />
                </svg>
              </div>
            )}

            {/* Full-width artist section */}
            <section className="px-4 md:px-0">
              {/* Section number + artist name */}
              <div className="mb-6 md:mb-8">
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold"
                    style={{
                      backgroundColor: `${strengthColor}20`,
                      color: strengthColor,
                      border: `1px solid ${strengthColor}40`,
                    }}
                  >
                    {index + 1}
                  </span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider"
                      style={{
                        backgroundColor: `${strengthColor}15`,
                        color: strengthColor,
                        border: `1px solid ${strengthColor}30`,
                      }}
                    >
                      {strengthLabel}
                    </span>
                    {node.era && (
                      <span
                        className="rounded-full px-2.5 py-0.5 text-[10px] font-medium"
                        style={{ backgroundColor: "#27272a", color: "#71717a" }}
                      >
                        {node.era}
                      </span>
                    )}
                  </div>
                </div>

                <h2
                  className="text-3xl md:text-4xl font-bold tracking-tight"
                  style={{ color: "#ffffff" }}
                >
                  {node.name}
                </h2>
                <p
                  className="mt-1 text-sm md:text-base font-medium"
                  style={{ color: "#06B6D4" }}
                >
                  {node.role}
                </p>
              </div>

              {/* Video embed - large, cinematic */}
              <div
                className="relative w-full overflow-hidden rounded-xl md:rounded-2xl"
                style={{
                  paddingTop: "56.25%",
                  boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)",
                }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${node.videoId}?rel=0&modestbranding=1`}
                  title={node.videoTitle}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <p
                className="mt-3 text-center"
                style={{ color: "#3f3f46", fontSize: "12px" }}
              >
                {node.videoTitle}
              </p>

              {/* Connection story + enrichments */}
              <div className="mt-8 md:mt-10 max-w-2xl mx-auto">
                {/* Strength badge */}
                <div className="flex items-center gap-3 mb-5">
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-1.5"
                    style={{ backgroundColor: `${strengthColor}10`, border: `1px solid ${strengthColor}25` }}
                  >
                    <div
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: strengthColor }}
                    />
                    <span
                      className="text-sm font-semibold tabular-nums"
                      style={{ color: strengthColor }}
                    >
                      {node.strength.toFixed(2)}
                    </span>
                  </div>
                  <span style={{ color: "#52525b", fontSize: "12px" }}>
                    influence strength
                  </span>
                </div>

                {/* Connection text */}
                <p
                  className="text-base md:text-lg leading-relaxed md:leading-loose"
                  style={{ color: "#d4d4d8" }}
                >
                  {node.connection}
                </p>

                {/* Pull quote from source */}
                {node.sourceQuote && (
                  <blockquote
                    className="mt-6 pl-4 py-1"
                    style={{ borderLeft: `2px solid ${strengthColor}50` }}
                  >
                    <p
                      className="text-sm md:text-base italic leading-relaxed"
                      style={{ color: "#a1a1aa" }}
                    >
                      "{node.sourceQuote}"
                    </p>
                    {node.source && (
                      <cite
                        className="mt-2 block text-xs not-italic"
                        style={{ color: "#52525b" }}
                      >
                        {node.sourceUrl ? (
                          <a
                            href={node.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-500 transition-colors"
                          >
                            {node.source} ↗
                          </a>
                        ) : (
                          node.source
                        )}
                      </cite>
                    )}
                  </blockquote>
                )}

                {/* Source footnote (when no pull quote) */}
                {!node.sourceQuote && node.source && (
                  <p className="mt-4" style={{ color: "#52525b", fontSize: "12px" }}>
                    {node.sourceUrl ? (
                      <a
                        href={node.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-zinc-700 underline-offset-2 hover:decoration-zinc-500 transition-colors"
                        style={{ color: "#52525b" }}
                      >
                        {node.source} ↗
                      </a>
                    ) : (
                      node.source
                    )}
                  </p>
                )}

                {/* Sonic DNA tags */}
                {node.sonicDna && node.sonicDna.length > 0 && (
                  <div className="mt-6">
                    <p
                      className="text-[10px] font-medium uppercase tracking-widest mb-2"
                      style={{ color: "#52525b" }}
                    >
                      Sonic DNA
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {node.sonicDna.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                          style={{
                            backgroundColor: "#18181b",
                            border: "1px solid #27272a",
                            color: "#a1a1aa",
                          }}
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Works */}
                {node.keyWorks && node.keyWorks.length > 0 && (
                  <div className="mt-5">
                    <p
                      className="text-[10px] font-medium uppercase tracking-widest mb-2"
                      style={{ color: "#52525b" }}
                    >
                      Key Works
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {node.keyWorks.map((work) => (
                        <span
                          key={work.title}
                          className="text-xs"
                          style={{ color: "#71717a" }}
                        >
                          <span style={{ color: "#d4d4d8" }}>{work.title}</span>
                          {" "}
                          <span style={{ color: "#3f3f46" }}>({work.year})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        );
      })}
    </div>
  );
}
