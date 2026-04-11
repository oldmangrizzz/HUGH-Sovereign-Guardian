import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// ── Node in the 3D neural cloud ─────────────────────────────────────────────
interface NNode {
  x: number; y: number; z: number;
  charge: number;
  refract: number;       // refractory countdown
  neighbors: number[];
}

const MAX_CONN_DIST   = 0.52;   // max edge length in unit-cube coords
const MAX_NEIGHBORS   = 5;
const FIRE_THRESHOLD  = 0.70;
const DECAY           = 0.935;
const PROPAGATION     = 0.64;
const SPONTANEOUS     = 0.00075;
const REFRACTORY_TICKS = 20;

export default function HughNeuralField({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const metrics = useQuery(api.memory.getMindMetrics);
  const appState = useQuery(api.appState.getFullState);

  // Growth-driven node count: expands as H.U.G.H. gains semantic knowledge
  const dynamicNodeCount = Math.min(2000, 200 + Math.floor((metrics?.semanticCount ?? 0) * 1.5));

  // Use a ref to keep the latest appState accessible inside the tick loop without re-triggering the animation useEffect
  const appStateRef = useRef(appState);
  useEffect(() => {
    appStateRef.current = appState;
  }, [appState]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Build node cloud ────────────────────────────────────────────────────
    const nodes: NNode[] = Array.from({ length: dynamicNodeCount }, () => ({
      x: (Math.random() - 0.5) * 2,
      y: (Math.random() - 0.5) * 2,
      z: (Math.random() - 0.5) * 2,
      charge: Math.random() * 0.25,
      refract: 0,
      neighbors: [],
    }));

    // Precompute adjacency — nearest MAX_NEIGHBORS within MAX_CONN_DIST
    for (let i = 0; i < nodes.length; i++) {
      const ni = nodes[i];
      const dists: [number, number][] = [];
      for (let j = 0; j < nodes.length; j++) {
        if (i === j) continue;
        const nj = nodes[j];
        const dx = ni.x - nj.x, dy = ni.y - nj.y, dz = ni.z - nj.z;
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (d < MAX_CONN_DIST) dists.push([d, j]);
      }
      dists.sort((a, b) => a[0] - b[0]);
      ni.neighbors = dists.slice(0, MAX_NEIGHBORS).map(d => d[1]);
    }

    let angle = 0;
    let raf: number;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Main loop ───────────────────────────────────────────────────────────
    const tick = () => {
      angle += 0.00038;

      const W = canvas.width;
      const H = canvas.height;
      const cx = W * 0.5;
      const cy = H * 0.5;
      const scale = Math.min(W, H) * 0.41;

      const cosA = Math.cos(angle);
      const sinA = Math.sin(angle);

      // Reactivity logic from latest app state
      const isFlaring = Date.now() - (appStateRef.current?.lastWakeWordTs ?? 0) < 800;
      const currentSpontaneous = (appStateRef.current?.isAttentive ?? false) ? SPONTANEOUS * 5 : SPONTANEOUS;

      // ── Physics ──────────────────────────────────────────────────────────
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];

        if (isFlaring) {
          // Pulse the entire field on wake word
          n.charge = 1.0;
        } else {
          // Spontaneous ignition
          if (n.refract === 0 && Math.random() < currentSpontaneous) n.charge = 1.0;
        }

        // Fire + propagate
        if (n.charge >= FIRE_THRESHOLD && n.refract === 0) {
          n.refract = REFRACTORY_TICKS;
          const strength = n.charge * PROPAGATION;
          for (const j of n.neighbors) {
            if (nodes[j].refract === 0) {
              nodes[j].charge = Math.min(1.0, nodes[j].charge + strength);
            }
          }
        }

        // Decay
        n.charge *= DECAY;
        if (n.charge < 0.002) n.charge = 0;
        if (n.refract > 0) n.refract--;
      }

      // ── Project to 2D ────────────────────────────────────────────────────
      const proj = nodes.map(n => {
        const rx = n.x * cosA - n.z * sinA;
        const ry = n.y;
        const rz = n.x * sinA + n.z * cosA;
        const d  = 1 / (1.8 + rz * 0.4);
        return { px: cx + rx * scale * d, py: cy + ry * scale * d, d };
      });

      // ── Render ───────────────────────────────────────────────────────────
      // Motion blur trail
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, 0, W, H);

      // Edges
      for (let i = 0; i < nodes.length; i++) {
        const ni = nodes[i];
        if (!ni.neighbors.length) continue;
        const { px: x1, py: y1 } = proj[i];

        for (const j of ni.neighbors) {
          const flow = (ni.charge + nodes[j].charge) * 0.5;
          if (flow < 0.04) continue;
          const { px: x2, py: y2 } = proj[j];

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);

          if (flow > 0.55) {
            ctx.strokeStyle = `rgba(0,255,65,${Math.min(flow * 0.85, 0.85)})`;
            ctx.lineWidth = flow * 1.8;
          } else if (flow > 0.2) {
            ctx.strokeStyle = `rgba(0,170,68,${flow * 0.7})`;
            ctx.lineWidth = flow * 1.1;
          } else {
            ctx.strokeStyle = `rgba(0,55,15,${flow * 0.55})`;
            ctx.lineWidth = 0.6;
          }
          ctx.stroke();
        }
      }

      // Nodes
      for (let i = 0; i < nodes.length; i++) {
        const n   = nodes[i];
        const { px, py, d } = proj[i];
        const r   = d * 3.8 * (1 + n.charge * 2.2);

        if (n.charge > 0.60) {
          // FIRING — white core + neon halo
          const gr = ctx.createRadialGradient(px, py, 0, px, py, r * 4);
          gr.addColorStop(0,    `rgba(255,255,255,${n.charge * 0.92})`);
          gr.addColorStop(0.22, `rgba(0,255,65,${n.charge * 0.95})`);
          gr.addColorStop(0.65, `rgba(0,190,45,${n.charge * 0.42})`);
          gr.addColorStop(1,    "rgba(0,0,0,0)");
          ctx.beginPath();
          ctx.arc(px, py, r * 4, 0, Math.PI * 2);
          ctx.fillStyle = gr;
          ctx.fill();
        } else if (n.charge > 0.18) {
          // MID-CHARGE
          ctx.beginPath();
          ctx.arc(px, py, r * 1.4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,170,68,${n.charge * 0.78})`;
          ctx.fill();
        } else {
          // DEEP REST — nearly dark, barely visible
          ctx.beginPath();
          ctx.arc(px, py, Math.max(0.5, r * 0.55), 0, Math.PI * 2);
          ctx.fillStyle = `rgba(0,22,0,${0.35 + n.charge * 1.5})`;
          ctx.fill();
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", background: "#000000", width: "100%", height: "100%", ...style }}
    />
  );
}
