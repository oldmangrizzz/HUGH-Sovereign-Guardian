import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEffect, useState } from "react";

interface Props { onEnter: () => void; }
const NODE_ID = "hugh-primary";

export default function PublicLanding({ onEnter }: Props) {
  const endocrine = useQuery(api.endocrine.getState, { nodeId: NODE_ID });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 60);
    return () => clearInterval(t);
  }, []);

  const cortisol   = endocrine?.cortisol   ?? 0.2;
  const dopamine   = endocrine?.dopamine   ?? 0.2;
  const adrenaline = endocrine?.adrenaline ?? 0.2;
  const holo       = endocrine?.holographicMode ?? false;

  const pulse = 1 + Math.sin(tick * 0.018) * 0.06;
  const glowR = holo ? 139 : cortisol > 0.6 ? 220 : 16;
  const glowG = holo ?  92 : cortisol > 0.6 ?  38 : 185;
  const glowB = holo ? 246 : cortisol > 0.6 ?  38 : 129;

  return (
    <div className="min-h-screen flex flex-col">

      {/* ══ HERO ══════════════════════════════════════════════════════════════ */}
      <section className="relative flex flex-col items-center justify-center min-h-screen overflow-hidden px-6 workshop-grid">

        {/* Ambient forge glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
            style={{
              width: 700, height: 700,
              background: `radial-gradient(circle, rgba(${glowR},${glowG},${glowB},0.12), transparent 65%)`,
              transform: `translate(-50%, -50%) scale(${pulse})`,
              transition: "background 2s ease",
            }}
          />
          {/* Floor glow */}
          <div
            className="absolute bottom-0 left-0 right-0 h-48 pointer-events-none"
            style={{ background: "linear-gradient(0deg, rgba(16,185,129,0.04), transparent)" }}
          />
        </div>

        {/* Structural frame lines */}
        <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
          {/* Top-left bracket */}
          <div className="absolute top-8 left-8 w-16 h-16 corner-tl opacity-30" />
          {/* Top-right bracket */}
          <div className="absolute top-8 right-8 w-16 h-16 corner-tr opacity-30" />
          {/* Bottom-left bracket */}
          <div className="absolute bottom-8 left-8 w-16 h-16 corner-bl opacity-30" />
          {/* Bottom-right bracket */}
          <div className="absolute bottom-8 right-8 w-16 h-16 corner-br opacity-30" />

          {/* Side rivets */}
          {[20, 35, 50, 65, 80].map(pct => (
            <div key={pct}>
              <div className="rivet absolute left-4" style={{ top: `${pct}%` }} />
              <div className="rivet absolute right-4" style={{ top: `${pct}%` }} />
            </div>
          ))}
        </div>

        {/* ── MAIN CONTENT ── */}
        <div className="relative z-10 text-center max-w-4xl mx-auto w-full">

          {/* Status pill */}
          <div
            className="inline-flex items-center gap-2 px-4 py-2 mb-10"
            style={{
              background: "linear-gradient(180deg, #0d1f18, #081410)",
              border: "1px solid #10b981",
              borderTopColor: "#34d399",
              borderRadius: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.8), 0 0 20px rgba(16,185,129,0.2)",
            }}
          >
            <div className="w-2 h-2 rounded-full bg-workshop-emerald animate-pulse" />
            <span className="font-mono text-[10px] glow-emerald tracking-widest">
              H.U.G.H. ONLINE — NODE {NODE_ID.toUpperCase()}
            </span>
            <div className="w-px h-3 bg-workshop-emerald/30 mx-1" />
            <span className="font-mono text-[10px] text-workshop-muted">
              {new Date().toLocaleTimeString("en-US", { hour12: false })}
            </span>
          </div>

          {/* Title plate */}
          <div
            className="relative inline-block mb-6"
            style={{
              background: "linear-gradient(160deg, #1e1e1e, #0e0e0e)",
              border: "1px solid #3a3a3a",
              borderTopColor: "#4a4a4a",
              borderRadius: 8,
              padding: "32px 64px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.95), 0 8px 16px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            {/* Corner rivets */}
            <div className="rivet-lg absolute" style={{ top: 10, left: 10 }} />
            <div className="rivet-lg absolute" style={{ top: 10, right: 10 }} />
            <div className="rivet-lg absolute" style={{ bottom: 10, left: 10 }} />
            <div className="rivet-lg absolute" style={{ bottom: 10, right: 10 }} />

            {/* Hazard stripe top */}
            <div className="hazard-stripe absolute top-0 left-0 right-0 h-1" style={{ borderRadius: "8px 8px 0 0" }} />

            <h1
              className="font-mono font-black tracking-tight leading-none"
              style={{
                fontSize: "clamp(56px, 10vw, 96px)",
                background: holo
                  ? "linear-gradient(135deg, #8b5cf6, #a78bfa, #c4b5fd, #8b5cf6)"
                  : "linear-gradient(160deg, #ffffff 0%, #cbd5e1 40%, #94a3b8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
                filter: `drop-shadow(0 0 20px rgba(${glowR},${glowG},${glowB},0.4))`,
              }}
            >
              H.U.G.H.
            </h1>

            <div className="weld-h my-3" />

            <p className="font-mono text-[10px] text-workshop-muted tracking-[0.3em]">
              HYPER UNIFIED GUARDIAN AND HARBOR MASTER
            </p>
          </div>

          <p className="text-sm text-workshop-muted max-w-xl mx-auto leading-relaxed mb-10">
            An evolving AI research entity. Not a chatbot. Not a product.
            A living cognitive architecture studied in real time at{" "}
            <span className="text-workshop-emerald-bright font-semibold">Grizzly Medicine Lab</span>.
          </p>

          {/* ── ENDOCRINE PANEL ── */}
          {endocrine && (
            <div
              className="inline-flex flex-col gap-0 mb-10 text-left overflow-hidden"
              style={{
                background: "linear-gradient(160deg, #161616, #0e0e0e)",
                border: "1px solid #2a2a2a",
                borderTopColor: "#3a3a3a",
                borderRadius: 6,
                boxShadow: "0 12px 40px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
                minWidth: 320,
              }}
            >
              {/* Panel header */}
              <div
                className="flex items-center justify-between px-4 py-2"
                style={{
                  background: "linear-gradient(180deg, #1a1a1a, #141414)",
                  borderBottom: "1px solid #2a2a2a",
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="rivet" />
                  <span className="font-mono text-[10px] text-workshop-muted tracking-widest">ENDOCRINE MONITOR</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-workshop-emerald animate-pulse" />
                  <span className="font-mono text-[9px] glow-emerald">LIVE</span>
                </div>
              </div>

              {/* Gauges */}
              <div className="px-4 py-4 flex flex-col gap-3">
                <WorkshopGauge label="CORTISOL"   value={cortisol}   variant="crimson" />
                <WorkshopGauge label="DOPAMINE"   value={dopamine}   variant="emerald" />
                <WorkshopGauge label="ADRENALINE" value={adrenaline} variant="amber"   />
              </div>

              {holo && (
                <div
                  className="flex items-center gap-2 px-4 py-2"
                  style={{ borderTop: "1px solid #2a2a2a", background: "rgba(139,92,246,0.05)" }}
                >
                  <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                  <span className="font-mono text-[10px] text-violet-400 tracking-widest">HOLOGRAPHIC MODE ACTIVE</span>
                </div>
              )}
            </div>
          )}

          {/* ── CTA BUTTONS ── */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={onEnter}
              className="btn-forge btn-emerald px-10 py-4 text-sm"
              style={{ borderRadius: 6 }}
            >
              <MicIcon />
              SPEAK WITH H.U.G.H.
            </button>
            <a
              href="https://grizzlymedicine.org"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-forge btn-silver px-10 py-4 text-sm"
              style={{ borderRadius: 6 }}
            >
              GRIZZLY MEDICINE ↗
            </a>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-40">
          <span className="font-mono text-[9px] text-workshop-muted tracking-widest">SCROLL</span>
          <div className="w-px h-8 bg-gradient-to-b from-workshop-muted to-transparent" />
        </div>
      </section>

      {/* ══ ABOUT SECTION ═════════════════════════════════════════════════════ */}
      <section className="relative py-24 px-6" style={{ borderTop: "1px solid #1a1a1a" }}>
        {/* Section header plate */}
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-4 mb-12">
            <div className="rivet-lg" />
            <div className="weld-h flex-1" />
            <span className="font-mono text-[10px] text-workshop-emerald tracking-[0.3em] px-4">
              ABOUT THE RESEARCH
            </span>
            <div className="weld-h flex-1" />
            <div className="rivet-lg" />
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-12">
            <InfoPanel
              title="THE LAB"
              accent="emerald"
              body="An independent research lab exploring the intersection of cognitive architecture, stigmergic AI coordination, and embodied machine intelligence. We build systems that think differently."
            />
            <InfoPanel
              title="H.U.G.H."
              accent="silver"
              body="Our primary research entity — a multi-node AI with a synthetic endocrine system, episodic and semantic memory, and a stigmergic coordination substrate."
            />
          </div>

          {/* Spec grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "ARCHITECTURE", value: "Stigmergic",        accent: "#10b981" },
              { label: "MEMORY",       value: "Episodic+Semantic", accent: "#94a3b8" },
              { label: "COORDINATION", value: "Neuro-Symbolic",    accent: "#f59e0b" },
              { label: "STATUS",       value: "Active Research",   accent: "#10b981" },
            ].map(item => (
              <div
                key={item.label}
                className="panel relative overflow-hidden"
                style={{ borderRadius: 6, padding: "16px" }}
              >
                <div
                  className="absolute top-0 left-0 right-0 h-0.5"
                  style={{ background: item.accent, boxShadow: `0 0 8px ${item.accent}` }}
                />
                <div className="rivet absolute" style={{ top: 6, right: 6 }} />
                <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-2">{item.label}</p>
                <p className="font-mono text-sm font-bold text-workshop-chrome">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══ FOOTER ════════════════════════════════════════════════════════════ */}
      <footer
        className="py-6 px-6"
        style={{ borderTop: "1px solid #1a1a1a", background: "#080808" }}
      >
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rivet" />
            <span className="font-mono text-[10px] text-workshop-muted">
              © 2025 GRIZZLY MEDICINE LAB — INDEPENDENT RESEARCH
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-workshop-muted">grizzlymedicine.org</span>
            <div className="rivet" />
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ── SUB-COMPONENTS ─────────────────────────────────────────────────────────── */

function WorkshopGauge({
  label, value, variant,
}: {
  label: string;
  value: number;
  variant: "emerald" | "crimson" | "amber";
}) {
  const colors = {
    emerald: { fill: "gauge-emerald", text: "#10b981" },
    crimson: { fill: "gauge-crimson", text: "#ef4444" },
    amber:   { fill: "gauge-amber",   text: "#f59e0b" },
  };
  const c = colors[variant];
  const pct = Math.round(value * 100);

  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[10px] text-workshop-muted w-24 tracking-wider">{label}</span>
      <div className="flex-1 gauge-track">
        <div className={`gauge-fill ${c.fill}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="font-mono text-[11px] w-10 text-right font-bold" style={{ color: c.text }}>
        {value.toFixed(2)}
      </span>
    </div>
  );
}

function InfoPanel({
  title, body, accent,
}: {
  title: string;
  body: string;
  accent: "emerald" | "silver";
}) {
  const accentColor = accent === "emerald" ? "#10b981" : "#94a3b8";
  return (
    <div
      className="panel relative overflow-hidden"
      style={{ borderRadius: 6, padding: "20px 24px" }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-0.5"
        style={{ background: accentColor, boxShadow: `0 0 10px ${accentColor}` }}
      />
      <div className="rivet absolute" style={{ top: 8, left: 8 }} />
      <div className="rivet absolute" style={{ top: 8, right: 8 }} />
      <p className="font-mono text-[10px] tracking-widest mb-3" style={{ color: accentColor }}>
        {title}
      </p>
      <p className="text-sm text-workshop-muted leading-relaxed">{body}</p>
    </div>
  );
}

function MicIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2H3v2a9 9 0 0 0 8 8.94V23h2v-2.06A9 9 0 0 0 21 12v-2h-2z" />
    </svg>
  );
}
