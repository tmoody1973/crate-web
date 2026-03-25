"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import dynamic from "next/dynamic";
import { useIsMobile } from "@/hooks/use-is-mobile";
import {
  type GraphNode,
  type GraphLink,
  type GraphData,
  type ExpandResponse,
  GROUP_COLORS,
  seedGraphData,
} from "./influence-graph-types";

// ── Dynamic import — ForceGraph2D is canvas-only, no SSR ────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2DRaw = dynamic(() => import("react-force-graph-2d").then((m) => m.default as any), {
  ssr: false,
});

// Cast to any to accept our custom props including ref
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ForceGraph2D = ForceGraph2DRaw as any;

// ── injectChatMessage (inline, not imported) ─────────────────────
function injectChatMessage(msg: string) {
  const input = document.querySelector<HTMLTextAreaElement>("textarea");
  if (input) {
    const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    nativeSet?.call(input, msg);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }
}

// ── Types ────────────────────────────────────────────────────────
type ParsedConnection = {
  name: string;
  weight: number;
  relationship: string;
  context?: string;
  pullQuote?: string;
  pullQuoteAttribution?: string;
  sonicElements?: string[];
  keyWorks?: string;
  sources?: Array<{ name: string; url: string; snippet?: string }>;
  imageUrl?: string;
};

interface InfluenceGraphProps {
  artist: string;
  connections: ParsedConnection[];
  isPro: boolean;
}

// ForceGraph node at runtime includes x/y from simulation
interface RuntimeNode extends GraphNode {
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number;
  fy?: number;
}

const NODE_CAP = 60;

// ── Main component ───────────────────────────────────────────────
export default function InfluenceGraph({ artist, connections, isPro }: InfluenceGraphProps) {
  const isMobile = useIsMobile();
  const graphRef = useRef<{ d3ReheatSimulation: () => void } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 600, height: 400 });

  const [graphData, setGraphData] = useState<GraphData>(() =>
    seedGraphData(artist, connections),
  );
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set([artist.toLowerCase()]));
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [breadcrumb, setBreadcrumb] = useState<string[]>([artist]);
  const [showBottomSheet, setShowBottomSheet] = useState(false);
  const [capWarning, setCapWarning] = useState(false);
  const [pulseAngle, setPulseAngle] = useState(0);

  // ── ResizeObserver ────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width: Math.max(width, 200), height: Math.max(height, 200) });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // ── Pulse animation timer ─────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAngle((a) => (a + 0.1) % (Math.PI * 2));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  // ── Reheat for loading nodes ──────────────────────────────────
  useEffect(() => {
    if (loadingNodes.size === 0) return;
    const interval = setInterval(() => {
      graphRef.current?.d3ReheatSimulation();
    }, 100);
    return () => clearInterval(interval);
  }, [loadingNodes.size]);

  // ── Batch image fetch for nodes missing images ────────────────
  useEffect(() => {
    const missing = graphData.nodes.filter((n) => !n.imageUrl);
    if (missing.length === 0) return;
    let cancelled = false;

    const fetchImages = async () => {
      await Promise.allSettled(
        missing.map(async (node) => {
          try {
            const res = await fetch(
              `/api/artwork?q=${encodeURIComponent(node.name)}&type=artist&source=spotify`,
            );
            if (!res.ok || cancelled) return;
            const data = await res.json();
            const imageUrl = data?.results?.[0]?.image;
            if (!imageUrl || cancelled) return;
            setGraphData((prev) => ({
              ...prev,
              nodes: prev.nodes.map((n) =>
                n.id === node.id ? { ...n, imageUrl } : n,
              ),
            }));
          } catch {
            // ignore
          }
        }),
      );
    };
    fetchImages();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphData.nodes.length]);

  // ── Node expansion ────────────────────────────────────────────
  const expandNode = useCallback(
    async (node: GraphNode) => {
      if (node.loading || expandedNodes.has(node.id)) return;
      if (graphData.nodes.length >= NODE_CAP) {
        setCapWarning(true);
        return;
      }

      setExpandedNodes((prev) => new Set([...prev, node.id]));
      setLoadingNodes((prev) => new Set([...prev, node.id]));

      // Mark node as loading in graph data
      setGraphData((prev) => ({
        ...prev,
        nodes: prev.nodes.map((n) =>
          n.id === node.id ? { ...n, loading: true } : n,
        ),
      }));

      try {
        const res = await fetch("/api/influence/expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ artist: node.name, tier: isPro ? "pro" : "free" }),
        });
        if (!res.ok) throw new Error("Expand failed");
        const data: ExpandResponse = await res.json();

        setGraphData((prev) => {
          const existingIds = new Set(prev.nodes.map((n) => n.id));
          const newNodes: GraphNode[] = [];
          const newLinks: GraphLink[] = [];

          for (const conn of data.connections) {
            const nodeId = conn.name.toLowerCase();
            if (existingIds.has(nodeId)) continue;
            if (prev.nodes.length + newNodes.length >= NODE_CAP) break;
            existingIds.add(nodeId);

            newNodes.push({
              id: nodeId,
              name: conn.name,
              group: "built",
              weight: conn.weight ?? 0.5,
              imageUrl: conn.imageUrl,
              context: conn.context,
              pullQuote: conn.pullQuote,
              pullQuoteAttribution: conn.pullQuoteAttribution,
              sonicElements: conn.sonicElements,
              keyWorks: conn.keyWorks,
              sources: conn.sources,
              relationship: conn.relationship,
              expanded: false,
              loading: false,
            });

            newLinks.push({
              source: node.id,
              target: nodeId,
              relationship: conn.relationship ?? "connected",
              weight: conn.weight ?? 0.5,
            });
          }

          return {
            nodes: [
              ...prev.nodes.map((n) =>
                n.id === node.id ? { ...n, loading: false, expanded: true } : n,
              ),
              ...newNodes,
            ],
            links: [...prev.links, ...newLinks],
          };
        });
      } catch {
        setGraphData((prev) => ({
          ...prev,
          nodes: prev.nodes.map((n) =>
            n.id === node.id ? { ...n, loading: false } : n,
          ),
        }));
      } finally {
        setLoadingNodes((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
    },
    [expandedNodes, graphData.nodes.length, isPro],
  );

  // ── Connected node IDs for opacity ────────────────────────────
  const connectedIds = useCallback(
    (nodeId: string): Set<string> => {
      const ids = new Set<string>([nodeId]);
      for (const link of graphData.links) {
        const src = typeof link.source === "object"
          ? (link.source as RuntimeNode).id
          : link.source;
        const tgt = typeof link.target === "object"
          ? (link.target as RuntimeNode).id
          : link.target;
        if (src === nodeId) ids.add(tgt);
        if (tgt === nodeId) ids.add(src);
      }
      return ids;
    },
    [graphData.links],
  );

  // ── Canvas node renderer ──────────────────────────────────────
  const nodeCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as RuntimeNode;
      const isCentral = n.group === "central";
      const radius = isCentral ? 18 : 6 + (n.weight ?? 0.5) * 10;
      const color = GROUP_COLORS[n.group] ?? "#a1a1aa";
      const isSelected = selectedNode?.id === n.id;
      const focus = selectedNode ? connectedIds(selectedNode.id) : null;
      const opacity = focus ? (focus.has(n.id) ? 1.0 : 0.2) : 1.0;
      const x = n.x ?? 0;
      const y = n.y ?? 0;

      ctx.save();
      ctx.globalAlpha = opacity;

      // Loading pulse ring
      if (n.loading) {
        const pulse = 0.5 + 0.5 * Math.sin(pulseAngle);
        ctx.beginPath();
        ctx.arc(x, y, radius + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = opacity * 0.4 * pulse;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      }

      // Selected glow ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.globalAlpha = opacity * 0.8;
        ctx.stroke();
        ctx.globalAlpha = opacity;
      }

      // Node image or circle
      if (n.imageUrl) {
        // Draw circular clipped image
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }

      // Label
      const fontSize = Math.max((isCentral ? 12 : 10) / globalScale, 2);
      ctx.font = `${isCentral ? "600 " : ""}${fontSize}px sans-serif`;
      ctx.fillStyle = "#f4f4f5";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(n.name, x, y + radius + fontSize + 1);

      ctx.restore();
    },
    [selectedNode, connectedIds, pulseAngle],
  );

  // ── Canvas link renderer ──────────────────────────────────────
  const linkCanvasObject = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (link: any, ctx: CanvasRenderingContext2D) => {
      const l = link as GraphLink & { source: RuntimeNode; target: RuntimeNode };
      const src = l.source;
      const tgt = l.target;
      if (!src?.x || !tgt?.x) return;

      const focus = selectedNode ? connectedIds(selectedNode.id) : null;
      const srcId = src.id;
      const tgtId = tgt.id;
      const isConnected = focus ? (focus.has(srcId) && focus.has(tgtId)) : true;

      ctx.save();
      ctx.globalAlpha = isConnected ? 0.5 : 0.08;
      ctx.strokeStyle = "#a1a1aa";
      ctx.lineWidth = Math.max(0.5, (l.weight ?? 0.5) * 2);
      ctx.beginPath();
      ctx.moveTo(src.x ?? 0, src.y ?? 0);
      ctx.lineTo(tgt.x ?? 0, tgt.y ?? 0);
      ctx.stroke();
      ctx.restore();
    },
    [selectedNode, connectedIds],
  );

  // ── Node click ────────────────────────────────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleNodeClick = useCallback((node: any) => {
    const n = node as GraphNode;
    setSelectedNode((prev) => (prev?.id === n.id ? null : n));
    if (isMobile) setShowBottomSheet(true);
    setBreadcrumb((prev) => {
      if (prev[prev.length - 1] === n.name) return prev;
      return [...prev, n.name];
    });
    // Expand on click if not yet expanded
    expandNode(n);
  }, [expandNode, isMobile]);

  // ── Reset ─────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    setGraphData(seedGraphData(artist, connections));
    setSelectedNode(null);
    setExpandedNodes(new Set([artist.toLowerCase()]));
    setLoadingNodes(new Set());
    setBreadcrumb([artist]);
    setShowBottomSheet(false);
    setCapWarning(false);
    graphRef.current?.d3ReheatSimulation();
  }, [artist, connections]);

  // ── Detail panel content ──────────────────────────────────────
  const renderDetail = (node: GraphNode) => (
    <div className="flex flex-col gap-3 p-4 text-sm text-zinc-300">
      <div className="flex items-center gap-2">
        <span
          className="inline-block h-3 w-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: GROUP_COLORS[node.group] }}
        />
        <span className="font-semibold text-zinc-100 truncate">{node.name}</span>
      </div>
      {node.relationship && (
        <p className="text-xs text-zinc-500 capitalize">{node.relationship}</p>
      )}
      {node.context && (
        <p className="text-xs leading-relaxed text-zinc-400">{node.context}</p>
      )}
      {node.pullQuote && (
        <blockquote className="border-l-2 border-zinc-600 pl-3 italic text-xs text-zinc-400">
          <p>&ldquo;{node.pullQuote}&rdquo;</p>
          {node.pullQuoteAttribution && (
            <footer className="mt-1 text-zinc-500 not-italic">— {node.pullQuoteAttribution}</footer>
          )}
        </blockquote>
      )}
      {node.sonicElements && node.sonicElements.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Sonic Elements</p>
          <div className="flex flex-wrap gap-1">
            {node.sonicElements.map((el) => (
              <span key={el} className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-400">
                {el}
              </span>
            ))}
          </div>
        </div>
      )}
      {node.keyWorks && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Key Works</p>
          <p className="text-xs text-zinc-400">{node.keyWorks}</p>
        </div>
      )}
      {node.sources && node.sources.length > 0 && (
        <div>
          <p className="text-xs font-medium text-zinc-500 mb-1">Sources</p>
          <ul className="space-y-1">
            {node.sources.map((src) => (
              <li key={src.url}>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-violet-400 hover:underline"
                >
                  {src.name}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const nodeCount = graphData.nodes.length;
  const linkCount = graphData.links.length;

  return (
    <div className="flex flex-col h-full w-full bg-[#09090b] text-zinc-200 select-none">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-b border-[#27272a] px-3 py-2 text-xs text-zinc-400">
        {breadcrumb.length > 1 && (
          <button
            className="mr-1 flex items-center gap-1 rounded px-1.5 py-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            onClick={() =>
              setBreadcrumb((prev) => {
                const next = prev.slice(0, -1);
                setSelectedNode(null);
                setShowBottomSheet(false);
                return next;
              })
            }
          >
            ←
          </button>
        )}
        <div className="flex items-center gap-1 flex-1 min-w-0 overflow-hidden">
          {breadcrumb.map((crumb, i) => (
            <span key={`${crumb}-${i}`} className="flex items-center gap-1 min-w-0">
              {i > 0 && <span className="text-zinc-600">/</span>}
              <span
                className={`truncate ${i === breadcrumb.length - 1 ? "text-zinc-200" : "text-zinc-500 cursor-pointer hover:text-zinc-300"}`}
                onClick={() => {
                  if (i < breadcrumb.length - 1) {
                    setBreadcrumb(breadcrumb.slice(0, i + 1));
                    setSelectedNode(null);
                    setShowBottomSheet(false);
                  }
                }}
              >
                {crumb}
              </span>
            </span>
          ))}
        </div>
        <span className="ml-auto shrink-0 text-zinc-600">
          {nodeCount} nodes · {linkCount} edges
        </span>
      </div>

      {/* ── Cap warning ──────────────────────────────────────────── */}
      {capWarning && (
        <div className="flex items-center justify-between border-b border-yellow-900/40 bg-yellow-950/30 px-3 py-1.5 text-xs text-yellow-400">
          <span>Graph is at the 60-node limit. Reset to explore a different branch.</span>
          <button
            className="ml-3 underline hover:no-underline"
            onClick={() => setCapWarning(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main content area ─────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Graph canvas */}
        <div ref={containerRef} className="flex-1 min-w-0 min-h-0 relative">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData as unknown as object}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="#09090b"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => "replace"}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => "replace"}
            onNodeClick={handleNodeClick}
            nodePointerAreaPaint={(node: unknown, color: string, ctx: CanvasRenderingContext2D) => {
              const n = node as RuntimeNode;
              const isCentral = n.group === "central";
              const radius = isCentral ? 18 : 6 + (n.weight ?? 0.5) * 10;
              ctx.fillStyle = color;
              ctx.beginPath();
              ctx.arc(n.x ?? 0, n.y ?? 0, radius + 4, 0, Math.PI * 2);
              ctx.fill();
            }}
            cooldownTicks={120}
            d3AlphaDecay={0.02}
            d3VelocityDecay={0.3}
          />
        </div>

        {/* Detail panel — desktop only */}
        {!isMobile && selectedNode && (
          <div className="w-60 shrink-0 border-l border-[#27272a] bg-[#18181b] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] px-3 py-2">
              <span className="text-xs font-medium text-zinc-400">Details</span>
              <button
                className="text-zinc-500 hover:text-zinc-300 transition-colors text-xs"
                onClick={() => setSelectedNode(null)}
              >
                ✕
              </button>
            </div>
            {renderDetail(selectedNode)}
          </div>
        )}
      </div>

      {/* ── Action bar ───────────────────────────────────────────── */}
      <div className="flex items-center gap-2 border-t border-[#27272a] px-3 py-2">
        <button
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          onClick={handleReset}
        >
          Reset
        </button>
        <button
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          onClick={() =>
            injectChatMessage(
              `Export the ${artist} influence graph as a Spotify playlist covering these connections: ${graphData.nodes
                .filter((n) => n.group !== "central")
                .map((n) => n.name)
                .slice(0, 12)
                .join(", ")}`,
            )
          }
        >
          Export Playlist
        </button>
        <button
          className="rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200 transition-colors"
          onClick={() =>
            injectChatMessage(
              `Send the ${artist} influence graph summary to Slack`,
            )
          }
        >
          Slack
        </button>
        {selectedNode && !isMobile && (
          <button
            className="ml-auto rounded-md border border-violet-700 bg-violet-950/40 px-3 py-1.5 text-xs text-violet-400 hover:bg-violet-900/40 hover:text-violet-200 transition-colors"
            onClick={() =>
              injectChatMessage(
                `/influence ${selectedNode.name}`,
              )
            }
          >
            Dive into {selectedNode.name} →
          </button>
        )}
      </div>

      {/* ── Mobile bottom sheet ──────────────────────────────────── */}
      {isMobile && showBottomSheet && selectedNode && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowBottomSheet(false);
              setSelectedNode(null);
            }
          }}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div className="relative z-10 rounded-t-xl bg-[#18181b] border-t border-[#27272a] max-h-[70vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#27272a] px-4 py-3">
              <span className="text-sm font-medium text-zinc-200">Details</span>
              <button
                className="text-zinc-400 hover:text-zinc-200 transition-colors"
                onClick={() => {
                  setShowBottomSheet(false);
                  setSelectedNode(null);
                }}
              >
                ✕
              </button>
            </div>
            {renderDetail(selectedNode)}
            <div className="px-4 pb-4">
              <button
                className="w-full rounded-md border border-violet-700 bg-violet-950/40 py-2 text-sm text-violet-400 hover:bg-violet-900/40 transition-colors"
                onClick={() => {
                  injectChatMessage(`/influence ${selectedNode.name}`);
                  setShowBottomSheet(false);
                }}
              >
                Dive into {selectedNode.name} →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
