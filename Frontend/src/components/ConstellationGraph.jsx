import { Network, Orbit } from "lucide-react";
import { useMemo } from "react";

export function ConstellationGraph({ graph, selectedDocs, onToggleDoc }) {
  const nodes = graph.nodes || [];
  const links = graph.links || [];

  const positionedNodes = useMemo(() => {
    const count = nodes.length;
    if (count === 0) return [];

    if (count === 1) {
      return [{
        ...nodes[0],
        x: 50,
        y: 50,
        driftDelay: "0s",
        driftDuration: "8s",
      }];
    }

    const rawPoints = nodes.map((node, index) => {
      const rX = Math.abs(Math.sin(index * 12.9898 + 1.234)) * 43758.5453 % 1;
      const rY = Math.abs(Math.cos(index * 7.4321 + 5.678)) * 32456.8765 % 1;
      return { rX, rY };
    });

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const p of rawPoints) {
      if (p.rX < minX) minX = p.rX;
      if (p.rX > maxX) maxX = p.rX;
      if (p.rY < minY) minY = p.rY;
      if (p.rY > maxY) maxY = p.rY;
    }

    const rangeX = (maxX - minX) || 1;
    const rangeY = (maxY - minY) || 1;

    const paddingX = 15;
    const paddingY = 20;

    const usableCanvasX = 100 - (paddingX * 2);
    const usableCanvasY = 100 - (paddingY * 2);

    return nodes.map((node, index) => {
      const { rX, rY } = rawPoints[index];
      const normX = (rX - minX) / rangeX;
      const normY = (rY - minY) / rangeY;

      const x = paddingX + (normX * usableCanvasX);
      const y = paddingY + (normY * usableCanvasY);

      return {
        ...node,
        x,
        y,
        driftDelay: `${-(index % 7) * 0.8}s`,
        driftDuration: `${6 + (index % 5)}s`,
      };
    });
  }, [nodes]);

  const backgroundStars = useMemo(
    () =>
      Array.from({ length: 80 }, (_, index) => ({
        id: index,
        x: (index * 23) % 100,
        y: (index * 89) % 100,
        size: index % 3 === 0 ? 2 : 1,
        opacity: 0.1 + (index % 5) * 0.1,
        twinkleDuration: `${3 + (index % 4)}s`,
        twinkleDelay: `${-(index % 10)}s`,
      })),
    [],
  );

  const nodeMap = new Map(positionedNodes.map((node) => [node.id, node]));

  if (nodes.length === 0) {
    return (
      <div className="relative grid min-h-[280px] place-items-center overflow-hidden glass-panel rounded-2xl p-6">
        <div className="relative text-center uppercase tracking-wide">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl border border-white/5 bg-white/5 flex items-center justify-center backdrop-blur-md shadow-[0_0_20px_rgba(255,255,255,0.02)]">
            <Orbit className="text-white/40" size={24} />
          </div>
          <p className="text-sm font-bold text-white/80">Awaiting Telemetry</p>
          <div className="mt-3 flex justify-center gap-1 opacity-50">
            <span className="block h-1 w-4 rounded-full bg-white/30" />
            <span className="block h-1 w-2 rounded-full bg-white/20" />
            <span className="block h-1 w-8 rounded-full bg-white/30" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-[400px] overflow-hidden glass-panel rounded-2xl border border-white/5">
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-white/5 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-blue-500/5 blur-[100px] pointer-events-none" />

      <div className="absolute inset-0">
        {backgroundStars.map((star) => (
          <span
            key={star.id}
            className="absolute rounded-full bg-white/40"
            style={{
              left: `${star.x}%`,
              top: `${star.y}%`,
              width: `${star.size}px`,
              height: `${star.size}px`,
              opacity: star.opacity,
              animation: `star-twinkle ${star.twinkleDuration} ease-in-out ${star.twinkleDelay} infinite`,
            }}
          />
        ))}
      </div>

      <svg className="absolute inset-0 h-full w-full pointer-events-none" style={{ overflow: 'visible' }}>
        {links.map((link) => {
          const source = nodeMap.get(link.source);
          const target = nodeMap.get(link.target);
          if (!source || !target) return null;

          const score = Number(link.relevance) || 0;
          const isStrong = score >= 0.6;
          const strokeOpacity = isStrong ? 0.3 + (score * 0.3) : 0.05 + (score * 0.15);
          const strokeWidth = isStrong ? 1.5 : 0.75;
          const strokeDash = score < 0.3 ? "4 4" : "none";
          const strokeColor = isStrong ? "#60A5FA" : "#ffffff";

          const midX = (source.x + target.x) / 2;
          const midY = (source.y + target.y) / 2;

          return (
            <g key={`${link.source}-${link.target}`}>
              <line
                x1={`${source.x}%`}
                y1={`${source.y}%`}
                x2={`${target.x}%`}
                y2={`${target.y}%`}
                stroke={strokeColor}
                strokeDasharray={strokeDash}
                strokeOpacity={strokeOpacity}
                strokeWidth={strokeWidth}
              />

              {score >= 0.1 && (
                <g className="transition-opacity duration-300">
                  <rect
                    x={`${midX}%`}
                    y={`${midY}%`}
                    width="30"
                    height="16"
                    rx="4"
                    transform="translate(-15, -8)"
                    fill="rgba(5, 5, 5, 0.8)"
                    stroke={isStrong ? "rgba(96, 165, 250, 0.3)" : "rgba(255,255,255,0.05)"}
                    strokeWidth="1"
                    className="backdrop-blur-sm"
                  />
                  <text
                    x={`${midX}%`}
                    y={`${midY}%`}
                    fill={isStrong ? "#93C5FD" : "rgba(255,255,255,0.5)"}
                    fontSize="8"
                    textAnchor="middle"
                    alignmentBaseline="central"
                    fontFamily="monospace"
                    dy="0.5"
                  >
                    {(score * 100).toFixed(0)}%
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {positionedNodes.map((node) => {
        const active = selectedDocs.includes(node.id);
        return (
          <button
            key={node.id}
            type="button"
            onClick={() => onToggleDoc(node.id)}
            className={`absolute z-10 rounded-xl px-3 py-2 text-left transition-all ${
              active
                ? "glass-panel-active text-white shadow-[0_0_25px_rgba(255,255,255,0.08)] scale-105 border-white/20"
                : "glass-panel text-white/60 hover:bg-white/10 hover:text-white/80 border-white/5"
            }`}
            style={{
              left: `${node.x}%`,
              top: `${node.y}%`,
              transform: `translate(-50%, -50%)`,
              animation: `subtle-sway ${node.driftDuration} ease-in-out ${node.driftDelay} infinite`,
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`h-1.5 w-1.5 rounded-full ${active ? "bg-white shadow-[0_0_10px_#fff]" : "bg-white/30"}`} />
              <span className="block max-w-[110px] truncate text-xs font-semibold tracking-wide">{node.label}</span>
            </div>
            <div className="flex items-center justify-between opacity-60">
              <span className="font-mono text-[9px] uppercase tracking-widest text-white/50">
                {node.file_type}
              </span>
              <span className="font-mono text-[9px] text-white/40">
                [CH:{node.chunk_count || 0}]
              </span>
            </div>
          </button>
        );
      })}

      <div className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/5 bg-black/50 px-3 py-1.5 text-[10px] font-medium uppercase tracking-widest text-white/50 backdrop-blur-md">
        <Network size={12} className="text-white/70" />
        Vector Graph
      </div>
    </div>
  );
}
