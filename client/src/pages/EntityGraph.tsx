import CactiLayout from "@/components/CactiLayout";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Network, Search, Users, Building, MapPin, Hexagon, Calendar, DollarSign, Link2 } from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

const ENTITY_TYPE_COLORS: Record<string, string> = {
  person: "#06b6d4",
  organization: "#a855f7",
  location: "#22c55e",
  date: "#f59e0b",
  money: "#ef4444",
};

const ENTITY_TYPE_ICONS: Record<string, React.ElementType> = {
  person: Users,
  organization: Building,
  location: MapPin,
  date: Calendar,
  money: DollarSign,
};

interface GraphNode {
  id: string;
  name: string;
  type: string;
  count: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

// Strength label based on weight
function getStrengthLabel(weight: number): { label: string; color: string } {
  if (weight >= 5) return { label: "STRONG", color: "#22c55e" };
  if (weight >= 3) return { label: "MODERATE", color: "#06b6d4" };
  if (weight >= 2) return { label: "WEAK", color: "#f59e0b" };
  return { label: "MINIMAL", color: "#6b7280" };
}

function ForceGraph({
  nodes,
  edges,
  onNodeSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  onNodeSelect: (node: GraphNode | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const nodesRef = useRef<GraphNode[]>([]);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

  useEffect(() => {
    const container = canvasRef.current?.parentElement;
    if (container) {
      const obs = new ResizeObserver((entries) => {
        const { width, height } = entries[0].contentRect;
        setDimensions({ width: Math.max(400, width), height: Math.max(300, height) });
      });
      obs.observe(container);
      return () => obs.disconnect();
    }
  }, []);

  // Max edge weight for normalization
  const maxWeight = useMemo(() => Math.max(1, ...edges.map((e) => e.weight)), [edges]);

  useEffect(() => {
    nodesRef.current = nodes.map((n, i) => ({
      ...n,
      x: dimensions.width / 2 + Math.cos((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      y: dimensions.height / 2 + Math.sin((i / nodes.length) * Math.PI * 2) * 150 + (Math.random() - 0.5) * 50,
      vx: 0,
      vy: 0,
    }));

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const nodeMap = new Map(nodesRef.current.map((n) => [n.id, n]));

    function simulate() {
      const ns = nodesRef.current;
      const cx = dimensions.width / 2;
      const cy = dimensions.height / 2;

      for (const n of ns) {
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
      }

      for (let i = 0; i < ns.length; i++) {
        const ri = 4 + Math.min(ns[i].count * 2, 16);
        for (let j = i + 1; j < ns.length; j++) {
          const rj = 4 + Math.min(ns[j].count * 2, 16);
          const dx = ns[j].x - ns[i].x;
          const dy = ns[j].y - ns[i].y;
          const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
          const minDist = ri + rj + 80;
          if (dist < minDist) {
            const overlap = (minDist - dist) * 0.12;
            ns[i].vx -= (dx / dist) * overlap;
            ns[i].vy -= (dy / dist) * overlap;
            ns[j].vx += (dx / dist) * overlap;
            ns[j].vy += (dy / dist) * overlap;
          } else if (dist < 350) {
            const force = 50 / (dist * dist) * 100;
            ns[i].vx -= (dx / dist) * force;
            ns[i].vy -= (dy / dist) * force;
            ns[j].vx += (dx / dist) * force;
            ns[j].vy += (dy / dist) * force;
          }
        }
      }

      for (const e of edges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x;
        const dy = t.y - s.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const force = (dist - 200) * 0.0025 * Math.sqrt(e.weight);
        s.vx += (dx / dist) * force;
        s.vy += (dy / dist) * force;
        t.vx -= (dx / dist) * force;
        t.vy -= (dy / dist) * force;
      }

      for (const n of ns) {
        n.vx *= 0.80;
        n.vy *= 0.80;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(30, Math.min(dimensions.width - 30, n.x));
        n.y = Math.max(30, Math.min(dimensions.height - 30, n.y));
      }
    }

    function draw() {
      if (!ctx) return;
      const ns = nodesRef.current;
      const dpr = window.devicePixelRatio || 1;
      canvas!.width = dimensions.width * dpr;
      canvas!.height = dimensions.height * dpr;
      ctx.scale(dpr, dpr);

      ctx.fillStyle = "oklch(0.14 0.012 260)";
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Grid
      ctx.strokeStyle = "oklch(0.22 0.01 260)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < dimensions.width; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, dimensions.height);
        ctx.stroke();
      }
      for (let y = 0; y < dimensions.height; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(dimensions.width, y);
        ctx.stroke();
      }

      const selId = selectedNode?.id;
      const hovId = hoveredNode?.id;
      const highlightId = selId || hovId;

      // Connected edges for highlight
      const connectedEdges = highlightId
        ? new Set(
            edges
              .filter((e) => e.source === highlightId || e.target === highlightId)
              .map((e) => `${e.source}-${e.target}`)
          )
        : null;

      const connectedNodes = highlightId
        ? new Set(
            edges
              .filter((e) => e.source === highlightId || e.target === highlightId)
              .flatMap((e) => [e.source, e.target])
          )
        : null;

      // Draw edges with strength-based width and opacity
      for (const e of edges) {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) continue;

        const normalizedWeight = e.weight / maxWeight;
        const edgeKey = `${e.source}-${e.target}`;
        const isHighlighted = connectedEdges?.has(edgeKey);
        const isDimmed = connectedEdges && !isHighlighted;

        // Edge width: 0.5 to 4px based on weight
        const lineWidth = 0.5 + normalizedWeight * 3.5;
        // Edge opacity: 0.08 to 0.6 based on weight
        const baseOpacity = 0.08 + normalizedWeight * 0.52;
        const opacity = isDimmed ? 0.03 : isHighlighted ? Math.min(baseOpacity * 1.8, 0.9) : baseOpacity;

        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(t.x, t.y);

        if (isHighlighted) {
          // Highlighted edges use the source node color
          const sourceColor = ENTITY_TYPE_COLORS[s.type] || "#06b6d4";
          const targetColor = ENTITY_TYPE_COLORS[t.type] || "#06b6d4";
          const grad = ctx.createLinearGradient(s.x, s.y, t.x, t.y);
          grad.addColorStop(0, sourceColor + Math.round(opacity * 255).toString(16).padStart(2, "0"));
          grad.addColorStop(1, targetColor + Math.round(opacity * 255).toString(16).padStart(2, "0"));
          ctx.strokeStyle = grad;
        } else {
          ctx.strokeStyle = `rgba(6, 182, 212, ${opacity})`;
        }
        ctx.lineWidth = isHighlighted ? lineWidth * 1.5 : lineWidth;
        ctx.stroke();

        // Draw strength dots on strong connections
        if (e.weight >= 3 && !isDimmed) {
          const midX = (s.x + t.x) / 2;
          const midY = (s.y + t.y) / 2;
          ctx.beginPath();
          ctx.arc(midX, midY, 2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(6, 182, 212, ${opacity * 1.5})`;
          ctx.fill();
        }
      }

      // Draw nodes
      for (const n of ns) {
        const color = ENTITY_TYPE_COLORS[n.type] || "#06b6d4";
        const radius = 4 + Math.min(n.count * 2, 16);
        const isHovered = hovId === n.id;
        const isSelected = selId === n.id;
        const isConnected = connectedNodes?.has(n.id);
        const isDimmed = connectedNodes && !isConnected && n.id !== highlightId;

        if (isDimmed) {
          // Dimmed node
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
          ctx.fillStyle = color + "10";
          ctx.fill();
          ctx.strokeStyle = color + "30";
          ctx.lineWidth = 0.5;
          ctx.stroke();

          continue;
        }

        // Glow for hovered/selected
        if (isHovered || isSelected) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, radius + 10, 0, Math.PI * 2);
          const grad = ctx.createRadialGradient(n.x, n.y, radius, n.x, n.y, radius + 10);
          grad.addColorStop(0, color + "50");
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.fill();
        }

        // Pulse ring for selected
        if (isSelected) {
          const pulseRadius = radius + 4 + Math.sin(Date.now() / 300) * 3;
          ctx.beginPath();
          ctx.arc(n.x, n.y, pulseRadius, 0, Math.PI * 2);
          ctx.strokeStyle = color + "60";
          ctx.lineWidth = 1;
          ctx.stroke();
        }

        // Node circle
        ctx.beginPath();
        ctx.arc(n.x, n.y, radius, 0, Math.PI * 2);
        ctx.fillStyle = isConnected || isHovered || isSelected ? color + "50" : color + "30";
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = isHovered || isSelected ? 2.5 : isConnected ? 1.5 : 1;
        ctx.stroke();

        // Label — show only for frequently-mentioned (count >= 3) or interactively prominent nodes
        const showLabel = n.count >= 3 || isHovered || isSelected || isConnected;
        if (showLabel) {
          ctx.fillStyle = isHovered || isSelected || isConnected ? "oklch(0.95 0.02 195)" : "oklch(0.85 0.02 195)";
          ctx.font = `${isHovered || isSelected ? "12px" : isConnected ? "11px" : "10px"} 'Inter', sans-serif`;
          ctx.textAlign = "center";
          ctx.fillText(n.name, n.x, n.y + radius + 12);
        }
      }

      // Strength legend in bottom-right
      const legendX = dimensions.width - 160;
      const legendY = dimensions.height - 70;
      ctx.fillStyle = "oklch(0.16 0.012 260 / 0.9)";
      ctx.fillRect(legendX - 10, legendY - 15, 160, 65);
      ctx.strokeStyle = "oklch(0.25 0.01 260)";
      ctx.lineWidth = 0.5;
      ctx.strokeRect(legendX - 10, legendY - 15, 160, 65);

      ctx.fillStyle = "oklch(0.6 0.01 195)";
      ctx.font = "10px 'Inter', sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("CONNECTION STRENGTH", legendX, legendY);

      const strengths = [
        { label: "Strong (5+)", width: 4, opacity: 0.6 },
        { label: "Moderate (3-4)", width: 2.5, opacity: 0.35 },
        { label: "Weak (1-2)", width: 1, opacity: 0.15 },
      ];
      strengths.forEach((s, i) => {
        const y = legendY + 12 + i * 14;
        ctx.beginPath();
        ctx.moveTo(legendX, y);
        ctx.lineTo(legendX + 30, y);
        ctx.strokeStyle = `rgba(6, 182, 212, ${s.opacity})`;
        ctx.lineWidth = s.width;
        ctx.stroke();
        ctx.fillStyle = "oklch(0.7 0.01 195)";
        ctx.font = "9px 'Inter', sans-serif";
        ctx.fillText(s.label, legendX + 38, y + 3);
      });

      simulate();
      animRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [nodes, edges, dimensions, hoveredNode, selectedNode, maxWeight]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const found = nodesRef.current.find((n) => {
      const r = 4 + Math.min(n.count * 2, 16);
      return Math.sqrt((n.x - x) ** 2 + (n.y - y) ** 2) < r + 5;
    });
    setHoveredNode(found || null);
  }, []);

  const handleClick = useCallback(() => {
    if (hoveredNode) {
      const isSame = selectedNode?.id === hoveredNode.id;
      setSelectedNode(isSame ? null : hoveredNode);
      onNodeSelect(isSame ? null : hoveredNode);
    } else {
      setSelectedNode(null);
      onNodeSelect(null);
    }
  }, [hoveredNode, selectedNode, onNodeSelect]);

  // Get connections for hovered node tooltip
  const hoveredConnections = useMemo(() => {
    if (!hoveredNode) return [];
    return edges
      .filter((e) => e.source === hoveredNode.id || e.target === hoveredNode.id)
      .map((e) => {
        const otherId = e.source === hoveredNode.id ? e.target : e.source;
        const otherNode = nodes.find((n) => n.id === otherId);
        return { name: otherNode?.name || otherId, weight: e.weight, type: otherNode?.type || "unknown" };
      })
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 5);
  }, [hoveredNode, edges, nodes]);

  return (
    <div className="relative w-full h-[500px]">
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg cursor-crosshair"
        style={{ width: dimensions.width, height: dimensions.height }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredNode(null)}
        onClick={handleClick}
      />
      {hoveredNode && (
        <div
          className="absolute pointer-events-none cacti-card p-3 text-xs min-w-[180px] z-10"
          style={{
            left: Math.min(hoveredNode.x + 15, dimensions.width - 200),
            top: Math.max(hoveredNode.y - 10, 10),
            fontFamily: "var(--font-mono)",
          }}
        >
          <p className="text-foreground font-medium text-sm">{hoveredNode.name}</p>
          <p className="text-muted-foreground capitalize">{hoveredNode.type}</p>
          <p className="text-muted-foreground">Mentions: {hoveredNode.count}</p>
          {hoveredConnections.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border/50">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                Top Connections
              </p>
              {hoveredConnections.map((c, i) => {
                const strength = getStrengthLabel(c.weight);
                return (
                  <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                    <span className="text-foreground/80 truncate">{c.name}</span>
                    <span className="text-[9px] shrink-0" style={{ color: strength.color }}>
                      {strength.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function EntityGraph() {
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const entities = trpc.entities.graph.useQuery();

  const graphData = useMemo(() => {
    if (!entities.data) return { nodes: [], edges: [] };
    const data = entities.data as { nodes: any[]; edges: any[] };
    const filteredNodes = search
      ? data.nodes.filter((n: any) =>
          n.name.toLowerCase().includes(search.toLowerCase())
        )
      : data.nodes;
    const nodeIds = new Set(filteredNodes.map((n: any) => n.id));
    const filteredEdges = data.edges.filter(
      (e: any) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );
    return {
      nodes: filteredNodes.map((n: any) => ({ ...n, count: n.mentions || n.count || 1, x: 0, y: 0, vx: 0, vy: 0 })),
      edges: filteredEdges,
    };
  }, [entities.data, search]);

  const typeStats = useMemo(() => {
    if (!entities.data) return {};
    const data = entities.data as { nodes: any[] };
    const stats: Record<string, number> = {};
    data.nodes.forEach((n: any) => {
      stats[n.type] = (stats[n.type] || 0) + 1;
    });
    return stats;
  }, [entities.data]);

  // Connection stats for selected node
  const selectedConnections = useMemo(() => {
    if (!selectedNode || !graphData.edges.length) return [];
    return graphData.edges
      .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
      .map((e) => {
        const otherId = e.source === selectedNode.id ? e.target : e.source;
        const otherNode = graphData.nodes.find((n) => n.id === otherId);
        return {
          name: otherNode?.name || otherId,
          type: otherNode?.type || "unknown",
          weight: e.weight,
          strength: getStrengthLabel(e.weight),
        };
      })
      .sort((a, b) => b.weight - a.weight);
  }, [selectedNode, graphData]);

  return (
    <CactiLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-xl md:text-2xl tracking-wider text-primary"
              style={{ fontFamily: "var(--font-display)" }}
            >
              ENTITY GRAPH
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Interactive relationship network with connection strength indicators
            </p>
          </div>
        </div>

        {/* Stats + Search */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex gap-3 flex-wrap">
            {Object.entries(typeStats).map(([type, count]) => {
              const Icon = ENTITY_TYPE_ICONS[type] || Hexagon;
              return (
                <div key={type} className="flex items-center gap-1.5">
                  <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: ENTITY_TYPE_COLORS[type] }}
                  />
                  <span className="text-xs text-muted-foreground capitalize">
                    {type}
                  </span>
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {count}
                  </Badge>
                </div>
              );
            })}
          </div>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Filter entities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 bg-card border-border"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Graph */}
          <div className="flex-1 min-w-0">
            <Card className="bg-card border-border overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle
                  className="text-xs tracking-wider text-muted-foreground uppercase flex items-center gap-2"
                  style={{ fontFamily: "var(--font-mono)", fontSize: "10px" }}
                >
                  <Network className="h-3.5 w-3.5 text-primary" />
                  Relationship Network &middot; {graphData.nodes.length} entities &middot;{" "}
                  {graphData.edges.length} connections
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0" data-tour="entity-graph-canvas">
                {entities.isLoading ? (
                  <Skeleton className="h-[500px]" />
                ) : graphData.nodes.length === 0 ? (
                  <div className="h-[500px] flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <Network className="h-12 w-12 mx-auto opacity-30" />
                      <p>No entity data available</p>
                      <p className="text-xs">Run AI analysis on documents to extract entities</p>
                    </div>
                  </div>
                ) : (
                  <ForceGraph
                    nodes={graphData.nodes}
                    edges={graphData.edges}
                    onNodeSelect={setSelectedNode}
                  />
                )}
              </CardContent>
            </Card>
          </div>

          {/* Selected Node Detail Panel */}
          {selectedNode && (
            <div className="w-[280px] shrink-0">
              <Card className="bg-card border-border sticky top-4">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-sm">
                    <Link2 className="h-4 w-4 text-primary" />
                    <span
                      className="tracking-wider text-primary uppercase"
                      style={{ fontFamily: "var(--font-display)", fontSize: "11px" }}
                    >
                      Entity Detail
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-foreground font-medium">{selectedNode.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge
                        variant="outline"
                        className="text-[10px] capitalize"
                        style={{ borderColor: ENTITY_TYPE_COLORS[selectedNode.type] + "50", color: ENTITY_TYPE_COLORS[selectedNode.type] }}
                      >
                        {selectedNode.type}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {selectedNode.count} mentions
                      </span>
                    </div>
                  </div>

                  <div>
                    <p
                      className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2"
                      style={{ fontFamily: "var(--font-mono)" }}
                    >
                      Connections ({selectedConnections.length})
                    </p>
                    <div className="space-y-1.5 max-h-[350px] overflow-y-auto">
                      {selectedConnections.map((conn, i) => {
                        const typeColor = ENTITY_TYPE_COLORS[conn.type] || "#6b7280";
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-2 p-2 rounded-lg bg-muted/20"
                          >
                            <div
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: typeColor }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground truncate">{conn.name}</p>
                              <p className="text-[10px] text-muted-foreground capitalize">{conn.type}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-[10px] font-medium" style={{ color: conn.strength.color }}>
                                {conn.strength.label}
                              </p>
                              <p className="text-[9px] text-muted-foreground">
                                weight: {conn.weight}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                      {selectedConnections.length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          No connections found
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 justify-center">
          {Object.entries(ENTITY_TYPE_COLORS).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div
                className="w-3 h-3 rounded-full border"
                style={{ backgroundColor: color + "30", borderColor: color }}
              />
              <span className="text-xs text-muted-foreground capitalize">{type}</span>
            </div>
          ))}
        </div>
      </div>
    </CactiLayout>
  );
}
