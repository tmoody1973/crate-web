"use client";

interface TinyDeskNode {
  name: string;
  role: string;
  era?: string;
  connection: string;
  strength: number;
  source?: string;
  sourceUrl?: string;
  videoId: string;
  videoTitle: string;
}

interface VideoInfluenceChainProps {
  nodes: TinyDeskNode[];
}

function getDotColor(strength: number): string {
  if (strength > 0.8) return "#22C55E";
  if (strength > 0.5) return "#EAB308";
  return "#F97316";
}

export function VideoInfluenceChain({ nodes }: VideoInfluenceChainProps) {
  return (
    <div className="relative w-full">
      {nodes.map((node, index) => {
        const dotColor = getDotColor(node.strength);
        const isLast = index === nodes.length - 1;

        return (
          <div key={`${node.name}-${index}`} className="relative flex gap-6 md:gap-8">
            {/* Left timeline column */}
            <div className="relative flex flex-col items-center" style={{ minWidth: "24px" }}>
              {/* Vertical line above dot (not for first node) */}
              {index > 0 && (
                <div
                  className="w-0.5 flex-shrink-0"
                  style={{
                    backgroundColor: "#3f3f46",
                    height: "48px",
                    marginBottom: "-4px",
                  }}
                />
              )}
              {index === 0 && <div style={{ height: "8px" }} />}

              {/* Dot */}
              <div
                className="relative z-10 flex-shrink-0 rounded-full"
                style={{
                  width: "16px",
                  height: "16px",
                  backgroundColor: dotColor,
                  boxShadow: `0 0 0 3px rgba(9,9,11,1), 0 0 0 5px ${dotColor}40`,
                  marginTop: index > 0 ? "0" : "0",
                }}
              />

              {/* Vertical line below dot */}
              {!isLast && (
                <div
                  className="w-0.5 flex-grow"
                  style={{
                    backgroundColor: "#3f3f46",
                    minHeight: "48px",
                  }}
                />
              )}
            </div>

            {/* Right content column */}
            <div
              className="flex-1 rounded-xl p-5 md:p-6"
              style={{
                backgroundColor: "#18181b",
                border: "1px solid #27272a",
                marginBottom: isLast ? "0" : "0",
                marginTop: index > 0 ? "48px" : "0",
              }}
            >
              {/* Artist name + era badge */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h3
                  className="font-bold"
                  style={{ color: "#ffffff", fontSize: "18px" }}
                >
                  {node.name}
                </h3>
                {node.era && (
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={{ backgroundColor: "#3f3f46", color: "#a1a1aa" }}
                  >
                    {node.era}
                  </span>
                )}
              </div>

              {/* Role tag */}
              <div className="mb-3">
                <span
                  className="rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: "rgba(8,145,178,0.2)", color: "#22d3ee" }}
                >
                  {node.role}
                </span>
              </div>

              {/* Connection text */}
              <p
                className="mb-3 leading-relaxed"
                style={{ color: "#d4d4d8", fontSize: "14px" }}
              >
                {node.connection}
              </p>

              {/* Source citation */}
              {node.source && (
                <p className="mb-4" style={{ color: "#71717a", fontSize: "11px" }}>
                  Source:{" "}
                  {node.sourceUrl ? (
                    <a
                      href={node.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline hover:opacity-80 transition-opacity"
                      style={{ color: "#71717a" }}
                    >
                      {node.source}
                    </a>
                  ) : (
                    node.source
                  )}
                </p>
              )}

              {/* YouTube embed - 16:9 aspect ratio */}
              <div
                className="relative w-full overflow-hidden rounded-lg"
                style={{ paddingTop: "56.25%" }}
              >
                <iframe
                  src={`https://www.youtube.com/embed/${node.videoId}`}
                  title={node.videoTitle}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                />
              </div>
              <p
                className="mt-2 text-center"
                style={{ color: "#52525b", fontSize: "11px" }}
              >
                {node.videoTitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
