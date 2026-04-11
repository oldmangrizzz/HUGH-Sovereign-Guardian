import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc } from "../convex/_generated/dataModel";
import { useState } from "react";
import VaultPanel from "./VaultPanel";
import GrowthLogPanel from "./GrowthLogPanel";
import McpPanel from "./McpPanel";
import StandbyPanel from "./StandbyPanel";
import InfraPanel from "./InfraPanel";
import ExportPanel from "./ExportPanel";
import BrowserPanel from "./BrowserPanel";

const NODE_ID = "hugh-primary";

type AdminTab = "endocrine" | "vault" | "growth" | "mcp" | "standby" | "infra" | "browser" | "export" | "display";

const TABS: { id: AdminTab; label: string; color: string }[] = [
  { id: "endocrine", label: "ENDOCRINE",  color: "#10b981" },
  { id: "vault",     label: "VAULT",      color: "#94a3b8" },
  { id: "growth",    label: "GROWTH LOG", color: "#8b5cf6" },
  { id: "mcp",       label: "MCP",        color: "#f59e0b" },
  { id: "standby",   label: "STANDBY",    color: "#ef4444" },
  { id: "infra",     label: "INFRA",      color: "#60a5fa" },
  { id: "browser",   label: "⬡ BROWSER",  color: "#34d399" },
  { id: "export",    label: "⬆ EXPORT",   color: "#10b981" },
  { id: "display",   label: "⬡ DISPLAY",  color: "#00ff41" },
];

export default function AdminDashboard({ onLogout, onKiosk }: { onLogout?: () => void; onKiosk?: () => void }) {
  const [activeTab, setActiveTab] = useState<AdminTab>("endocrine");
  const endocrine  = useQuery(api.endocrine.getAllStates);
  const pheromones = useQuery(api.stigmergy.getAllForNode, { nodeId: NODE_ID });
  const spike      = useMutation(api.endocrine.spikeAuthenticated);
  const initNode   = useMutation(api.endocrine.initNode);
  const [spiking, setSpiking] = useState<string | null>(null);

  const doSpike = async (hormone: "cortisol" | "dopamine" | "adrenaline", delta: number) => {
    setSpiking(hormone);
    try {
      await initNode({ nodeId: NODE_ID });
      await spike({ nodeId: NODE_ID, hormone, delta });
    } finally {
      setSpiking(null);
    }
  };

  const primary = endocrine?.find((e: Doc<"endocrineState">) => e.nodeId === NODE_ID);
  const activePheromones = pheromones?.filter((p: Doc<"pheromones">) => !p.evaporated && p.expiresAt > Date.now()) ?? [];

  return (
    <div className="min-h-screen p-6 workshop-grid" style={{ background: "#080808" }}>
      <div className="max-w-6xl mx-auto">

        {/* ── PAGE HEADER ── */}
        <div className="flex items-center gap-4 mb-6">
          <div className="rivet-lg" />
          <div className="weld-h flex-1" />
          <div
            className="flex items-center gap-3 px-6 py-3"
            style={{
              background: "linear-gradient(180deg, #111, #0d0d0d)",
              border: "1px solid #2a2a2a",
              borderTopColor: "#3a3a3a",
              borderRadius: 4,
              boxShadow: "0 4px 12px rgba(0,0,0,0.8)",
            }}
          >
            <div className="w-2 h-2 rounded-full bg-workshop-emerald animate-pulse" />
            <span className="font-mono text-xs glow-emerald tracking-widest">ADMIN CONTROL PANEL</span>
          </div>
          <div className="weld-h flex-1" />
          {onLogout && (
            <button
              onClick={onLogout}
              className="font-mono text-[9px] px-3 py-1.5 border border-red-900 text-red-500 hover:border-red-700 hover:text-red-400 transition-colors"
              style={{ borderRadius: 4 }}
            >
              ⏻ LOCK SESSION
            </button>
          )}
          <div className="rivet-lg" />
        </div>

        {/* ── TABS ── */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="font-mono text-[10px] px-4 py-2 border transition-all tracking-widest"
              style={{
                borderRadius: 4,
                borderColor: activeTab === tab.id ? tab.color : "#2a2a2a",
                color: activeTab === tab.id ? tab.color : "#64748b",
                background: activeTab === tab.id ? `${tab.color}15` : "transparent",
                boxShadow: activeTab === tab.id ? `0 0 12px ${tab.color}30` : "none",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── ENDOCRINE TAB ── */}
        {activeTab === "endocrine" && (
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <SectionPanel title="ENDOCRINE CONTROL" accent="#10b981">
                {primary ? (
                  <div className="space-y-6">
                    <div className="space-y-4">
                      <AdminGauge label="CORTISOL"   value={primary.cortisol}   fillClass="gauge-crimson" color="#ef4444" onUp={() => doSpike("cortisol", 0.1)}   onDown={() => doSpike("cortisol", -0.1)}   loading={spiking === "cortisol"} />
                      <AdminGauge label="DOPAMINE"   value={primary.dopamine}   fillClass="gauge-emerald" color="#10b981" onUp={() => doSpike("dopamine", 0.1)}   onDown={() => doSpike("dopamine", -0.1)}   loading={spiking === "dopamine"} />
                      <AdminGauge label="ADRENALINE" value={primary.adrenaline} fillClass="gauge-amber"   color="#f59e0b" onUp={() => doSpike("adrenaline", 0.1)} onDown={() => doSpike("adrenaline", -0.1)} loading={spiking === "adrenaline"} />
                    </div>
                    <div className="weld-h" />
                    <div className="grid grid-cols-2 gap-3">
                      <StatTile label="COGNITIVE MODE" value={primary.holographicMode ? "HOLOGRAPHIC" : "STANDARD"} color={primary.holographicMode ? "#a78bfa" : "#34d399"} />
                      <StatTile label="LAST PULSE" value={new Date(primary.lastPulse).toLocaleTimeString("en-US", { hour12: false })} color="#94a3b8" />
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-4 py-8">
                    <p className="font-mono text-xs text-workshop-muted">NO NODE REGISTERED</p>
                    <button onClick={() => initNode({ nodeId: NODE_ID })} className="btn-forge btn-emerald px-6 py-2" style={{ borderRadius: 4 }}>INITIALIZE NODE</button>
                  </div>
                )}
              </SectionPanel>
            </div>

            <div>
              <SectionPanel title="NODE REGISTRY" accent="#94a3b8">
                <div className="space-y-3">
                  {endocrine?.map((node: Doc<"endocrineState">) => (
                    <div key={node._id} className="panel-inset rounded p-3 relative overflow-hidden" style={{ borderRadius: 4 }}>
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-mono text-[10px] text-workshop-chrome font-bold">{node.nodeId}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-workshop-emerald animate-pulse" />
                          <span className="font-mono text-[9px] glow-emerald">ONLINE</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-1">
                        {[{ l: "COR", v: node.cortisol, c: "#ef4444" }, { l: "DOP", v: node.dopamine, c: "#10b981" }, { l: "ADR", v: node.adrenaline, c: "#f59e0b" }].map(h => (
                          <div key={h.l} className="text-center">
                            <p className="font-mono text-[8px] text-workshop-muted">{h.l}</p>
                            <p className="font-mono text-[10px] font-bold" style={{ color: h.c }}>{h.v.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {(!endocrine || endocrine.length === 0) && <p className="font-mono text-[10px] text-workshop-muted text-center py-4">NO NODES</p>}
                </div>
              </SectionPanel>

              <div className="mt-6">
                <SectionPanel title="PHEROMONE SUBSTRATE" accent="#f59e0b">
                  {activePheromones.length === 0 ? (
                    <p className="font-mono text-[10px] text-workshop-muted text-center py-4">SUBSTRATE CLEAR</p>
                  ) : (
                    <div className="space-y-2">
                      {activePheromones.slice(0, 6).map((p: Doc<"pheromones">) => {
                        const zoneColor: Record<string, string> = { green: "#10b981", yellow: "#f59e0b", red: "#ef4444", black: "#64748b" };
                        const c = zoneColor[p.zone] ?? "#64748b";
                        return (
                          <div key={p._id} className="panel-inset relative overflow-hidden" style={{ borderRadius: 4, padding: "8px 10px" }}>
                            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: c }} />
                            <div className="flex justify-between">
                              <span className="font-mono text-[9px] font-bold" style={{ color: c }}>{p.type.toUpperCase()}</span>
                              <span className="font-mono text-[8px] text-workshop-dim">W:{p.weight.toFixed(2)}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </SectionPanel>
              </div>
            </div>
          </div>
        )}

        {activeTab === "vault" && (
          <SectionPanel title="VAULT — FILE STORAGE" accent="#94a3b8">
            <VaultPanel />
          </SectionPanel>
        )}

        {activeTab === "growth" && (
          <SectionPanel title="GROWTH LOG — H.U.G.H. DEVELOPMENT" accent="#8b5cf6">
            <GrowthLogPanel />
          </SectionPanel>
        )}

        {activeTab === "mcp" && (
          <SectionPanel title="MCP SCAFFOLD — INTERNAL TOOLS" accent="#f59e0b">
            <McpPanel />
          </SectionPanel>
        )}

        {activeTab === "standby" && (
          <SectionPanel title="STANDBY PROTOCOL" accent="#ef4444">
            <StandbyPanel />
          </SectionPanel>
        )}

        {activeTab === "infra" && (
          <SectionPanel title="INFRASTRUCTURE — KVM + LIVEKIT" accent="#60a5fa">
            <InfraPanel />
          </SectionPanel>
        )}

        {activeTab === "browser" && (
          <SectionPanel title="BROWSER AGENT — PLAYWRIGHT" accent="#34d399">
            <BrowserPanel />
          </SectionPanel>
        )}

        {activeTab === "export" && (
          <SectionPanel title="EXPORT TO GITHUB → VPS" accent="#10b981">
            <ExportPanel />
          </SectionPanel>
        )}

        {activeTab === "display" && (
          <SectionPanel title="DISPLAY CONTROL — 5K KIOSK" accent="#00ff41">
            <div className="space-y-6">
              <p className="font-mono text-[10px] text-workshop-muted">
                Launch the full-screen kiosk view for the Proxmox iMac (27" 5K display).
                Camera feeds, neural field, and ARC competition viewer.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={onKiosk}
                  className="btn-forge py-4 text-[11px] tracking-widest"
                  style={{ borderRadius: 4, border: "1px solid #00ff41", color: "#00ff41", background: "#00ff4115", boxShadow: "0 0 14px #00ff4130" }}
                >
                  ⬡ ENTER KIOSK DISPLAY
                </button>
                <StatTile label="DEPLOY COMMAND" value="./deploy-kiosk.sh" color="#00ff41" />
              </div>
              <div className="space-y-2">
                {[
                  { mode: "AWAKE",       desc: "Neural field + cameras + telemetry",        color: "#00ff41" },
                  { mode: "SLEEP",       desc: "Dim breathing field, WAKE button",           color: "#003300" },
                  { mode: "COMPETITION", desc: "Full-screen ARC viewer (neural bg at 12%)", color: "#00ff41" },
                  { mode: "DEEP",        desc: "Violet Clifford attractor",                  color: "#a78bfa" },
                  { mode: "FORGE",       desc: "Gold Clifford attractor",                    color: "#fbbf24" },
                ].map(m => (
                  <div key={m.mode} className="panel-inset relative overflow-hidden" style={{ borderRadius: 4, padding: "10px 14px" }}>
                    <div className="absolute top-0 left-0 right-0 h-px" style={{ background: m.color }} />
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-bold w-24" style={{ color: m.color }}>{m.mode}</span>
                      <span className="font-mono text-[9px] text-workshop-muted">{m.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </SectionPanel>
        )}

      </div>
    </div>
  );
}

/* ── SUB-COMPONENTS ─────────────────────────────────────────────────────────── */

function SectionPanel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div className="panel relative overflow-hidden" style={{ borderRadius: 6 }}>
      <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: accent, boxShadow: `0 0 10px ${accent}` }} />
      <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1a1a1a", background: "rgba(0,0,0,0.3)" }}>
        <div className="rivet" />
        <span className="font-mono text-[10px] tracking-widest" style={{ color: accent }}>{title}</span>
        <div className="flex-1" />
        <div className="rivet" />
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function AdminGauge({ label, value, fillClass, color, onUp, onDown, loading }: {
  label: string; value: number; fillClass: string; color: string;
  onUp: () => void; onDown: () => void; loading: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[10px] text-workshop-muted tracking-wider">{label}</span>
        <span className="font-mono text-sm font-black" style={{ color }}>{value.toFixed(3)}</span>
      </div>
      <div className="gauge-track mb-2" style={{ height: 10 }}>
        <div className={`gauge-fill ${fillClass}`} style={{ width: `${value * 100}%` }} />
      </div>
      <div className="flex gap-2">
        <button onClick={onDown} disabled={loading} className="btn-forge btn-silver flex-1 py-1.5 text-[10px]" style={{ borderRadius: 3 }}>▼ −0.1</button>
        <button onClick={onUp}   disabled={loading} className="btn-forge btn-crimson flex-1 py-1.5 text-[10px]" style={{ borderRadius: 3 }}>▲ +0.1</button>
      </div>
    </div>
  );
}

function StatTile({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 4, padding: "12px" }}>
      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
      <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-1">{label}</p>
      <p className="font-mono text-xs font-bold" style={{ color }}>{value}</p>
    </div>
  );
}
