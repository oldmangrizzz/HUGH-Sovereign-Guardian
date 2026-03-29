import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

type KvmEntry = {
  _id: string;
  _creationTime: number;
  issuedBy: string;
  command: string;
  workingDir?: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  success: boolean;
  durationMs?: number;
  errorMessage?: string;
  zone: string;
  notes?: string;
  targetNodeId?: string;
};

type AgentNode = {
  _id: string;
  _creationTime: number;
  nodeId: string;
  label: string;
  agentUrl: string;
  platform: string;
  arch?: string;
  hostname: string;
  nodeVersion?: string;
  agentVersion?: string;
  status: string;
  lastHeartbeat: number;
  registeredAt: number;
  lastTunnelUrl?: string;
};

type LiveKitRoom = {
  name: string;
  numParticipants: number;
  maxParticipants: number;
  creationTime: number;
  metadata?: string;
  activeRecording: boolean;
};

const ZONE_COLORS: Record<string, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

const PLATFORM_ICON: Record<string, string> = {
  darwin: "🍎",
  linux: "🐧",
  win32: "🪟",
};

function timeSince(ms: number): string {
  const s = Math.floor((Date.now() - ms) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

export default function InfraPanel() {
  const [activeSection, setActiveSection] = useState<"nodes" | "kvm" | "livekit">("nodes");

  // Live agent registry (real-time subscription)
  const agentNodes = useQuery(api.agentRegistry.listNodes) as AgentNode[] | undefined;

  // KVM state
  const [commandLog, setCommandLog] = useState<KvmEntry[]>([]);
  const [command, setCommand] = useState("");
  const [workingDir, setWorkingDir] = useState("/root");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [executing, setExecuting] = useState(false);
  const [execResult, setExecResult] = useState<KvmEntry | null>(null);
  const [loadingLog, setLoadingLog] = useState(false);
  const [vpsStatus, setVpsStatus] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<KvmEntry | null>(null);
  const [pingResults, setPingResults] = useState<Record<string, boolean>>({});
  const [pinging, setPinging] = useState(false);

  // LiveKit state
  const [rooms, setRooms] = useState<LiveKitRoom[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const [tokenRoom, setTokenRoom] = useState("");
  const [tokenIdentity, setTokenIdentity] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [generatingToken, setGeneratingToken] = useState(false);

  const adminExec = useAction(api.kvm.adminExec);
  const getCommandLog = useAction(api.kvm.getCommandLog);
  const getVpsStatus = useAction(api.kvm.getVpsStatus);
  const pingAllAgents = useAction(api.kvm.pingAllAgents);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deregisterNode = useAction(api.agentRegistry.deregisterNode as any);
  const listRooms = useAction(api.livekit.listRooms);
  const ensureRoom = useAction(api.livekit.ensureRoom);
  const deleteRoom = useAction(api.livekit.deleteRoom);
  const generateToken = useAction(api.livekit.generateToken);

  const loadLog = async () => {
    setLoadingLog(true);
    try {
      const log = await getCommandLog({ limit: 50 });
      setCommandLog(log as KvmEntry[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLog(false);
    }
  };

  const loadRooms = async () => {
    setLoadingRooms(true);
    try {
      const r = await listRooms({});
      setRooms(r as LiveKitRoom[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRooms(false);
    }
  };

  const handlePingAll = async () => {
    setPinging(true);
    try {
      const results = await pingAllAgents({}) as Array<{ nodeId: string; online: boolean }>;
      const map: Record<string, boolean> = {};
      for (const r of results) map[r.nodeId] = r.online;
      setPingResults(map);
    } catch (e) {
      console.error(e);
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    if (activeSection === "kvm") loadLog();
    if (activeSection === "livekit") loadRooms();
    if (activeSection === "nodes") handlePingAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  const handleExec = async () => {
    if (!command.trim()) return;
    setExecuting(true);
    setExecResult(null);
    try {
      const result = await adminExec({
        command: command.trim(),
        workingDir: workingDir || undefined,
        targetNodeId: targetNodeId || undefined,
      });
      setExecResult(result as unknown as KvmEntry);
      setCommand("");
      await loadLog();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setExecResult({ _id: "err", _creationTime: Date.now(), issuedBy: "admin", command, success: false, errorMessage: msg, zone: "red" });
    } finally {
      setExecuting(false);
    }
  };

  const handleVpsStatus = async () => {
    setLoadingStatus(true);
    setVpsStatus(null);
    try {
      const result = await getVpsStatus({ targetNodeId: targetNodeId || undefined });
      setVpsStatus((result as { stdout?: string }).stdout ?? "No output");
      await loadLog();
    } catch (e: unknown) {
      setVpsStatus(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoadingStatus(false);
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim()) return;
    try {
      await ensureRoom({ roomName: newRoomName.trim() });
      setNewRoomName("");
      await loadRooms();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRoom = async (name: string) => {
    try {
      await deleteRoom({ roomName: name });
      await loadRooms();
    } catch (e) {
      console.error(e);
    }
  };

  const handleGenerateToken = async () => {
    if (!tokenRoom.trim() || !tokenIdentity.trim()) return;
    setGeneratingToken(true);
    try {
      const result = await generateToken({
        roomName: tokenRoom.trim(),
        participantName: tokenIdentity.trim(),
        canPublish: true,
        canSubscribe: true,
      });
      setGeneratedToken((result as { token: string }).token);
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingToken(false);
    }
  };

  const nodes = agentNodes ?? [];
  const onlineCount = nodes.filter(n => n.status === "online").length;

  return (
    <div className="space-y-6">
      {/* Section tabs */}
      <div className="flex gap-2">
        {[
          { id: "nodes" as const, label: `◈ NODES (${onlineCount}/${nodes.length})`, color: "#a78bfa" },
          { id: "kvm" as const, label: "⬡ KVM SHELL", color: "#10b981" },
          { id: "livekit" as const, label: "◈ LIVEKIT", color: "#60a5fa" },
        ].map((s) => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className="font-mono text-[10px] px-4 py-2 border transition-all tracking-widest"
            style={{
              borderRadius: 4,
              borderColor: activeSection === s.id ? s.color : "#2a2a2a",
              color: activeSection === s.id ? s.color : "#64748b",
              background: activeSection === s.id ? `${s.color}15` : "transparent",
              boxShadow: activeSection === s.id ? `0 0 12px ${s.color}30` : "none",
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* ── NODES SECTION ── */}
      {activeSection === "nodes" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "12px 16px" }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#a78bfa", boxShadow: "0 0 8px #a78bfa" }} />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] font-bold tracking-widest mb-1" style={{ color: "#a78bfa" }}>
                  HOLOGRAPHIC SATELLITE NODES
                </p>
                <p className="font-mono text-[9px] text-workshop-muted">
                  Agents self-register via POST /api/agent/register · Heartbeat every 30s
                </p>
              </div>
              <button
                onClick={handlePingAll}
                disabled={pinging}
                className="font-mono text-[9px] px-3 py-1.5 border transition-all"
                style={{ borderRadius: 3, borderColor: "#a78bfa40", color: "#a78bfa", background: "#a78bfa10" }}
              >
                {pinging ? "PINGING..." : "⟳ PING ALL"}
              </button>
            </div>
          </div>

          {/* Registration endpoint info */}
          <div className="panel-inset" style={{ borderRadius: 6, padding: "12px 16px" }}>
            <p className="font-mono text-[9px] text-workshop-dim tracking-widest mb-2">REGISTRATION ENDPOINT</p>
            <code className="font-mono text-[10px] text-emerald-400 block mb-1">
              POST https://effervescent-toucan-715.convex.site/api/agent/register
            </code>
            <code className="font-mono text-[10px] text-emerald-400 block">
              POST https://effervescent-toucan-715.convex.site/api/agent/heartbeat
            </code>
            <p className="font-mono text-[9px] text-workshop-dim mt-2">
              Body: {"{ nodeId, label, agentUrl, agentSecret, platform, hostname }"}
            </p>
          </div>

          {/* Node list */}
          {nodes.length === 0 ? (
            <div className="panel-inset" style={{ borderRadius: 6, padding: "32px", textAlign: "center" }}>
              <div className="flex flex-col items-center gap-3">
                <div className="pipe-flow w-24 h-0.5 rounded" />
                <p className="font-mono text-[10px] text-workshop-dim tracking-widest">AWAITING FIRST HANDSHAKE</p>
                <p className="font-mono text-[9px] text-workshop-dim">
                  Start hugh-agent on any machine to see it appear here in real-time
                </p>
                <div className="pipe-flow w-24 h-0.5 rounded" />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {nodes.map((node) => {
                const isOnline = node.status === "online";
                const pingOnline = pingResults[node.nodeId];
                const heartbeatAge = Date.now() - node.lastHeartbeat;
                const stale = heartbeatAge > 90_000; // >90s = stale
                const platformIcon = PLATFORM_ICON[node.platform] ?? "💻";
                const accentColor = isOnline ? "#10b981" : "#ef4444";

                return (
                  <div
                    key={node._id}
                    className="panel relative overflow-hidden"
                    style={{ borderRadius: 6 }}
                  >
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5"
                      style={{ background: accentColor, boxShadow: `0 0 8px ${accentColor}` }}
                    />
                    <div className="p-4">
                      {/* Top row */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{platformIcon}</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-workshop-chrome">{node.label}</span>
                              <span
                                className="font-mono text-[8px] px-1.5 py-0.5"
                                style={{
                                  background: `${accentColor}20`,
                                  border: `1px solid ${accentColor}40`,
                                  borderRadius: 2,
                                  color: accentColor,
                                }}
                              >
                                {isOnline ? (stale ? "STALE" : "ONLINE") : "OFFLINE"}
                              </span>
                              {pingResults[node.nodeId] !== undefined && (
                                <span
                                  className="font-mono text-[8px] px-1.5 py-0.5"
                                  style={{
                                    background: pingOnline ? "#10b98120" : "#ef444420",
                                    border: `1px solid ${pingOnline ? "#10b98140" : "#ef444440"}`,
                                    borderRadius: 2,
                                    color: pingOnline ? "#10b981" : "#ef4444",
                                  }}
                                >
                                  {pingOnline ? "REACHABLE" : "UNREACHABLE"}
                                </span>
                              )}
                            </div>
                            <p className="font-mono text-[9px] text-workshop-muted mt-0.5">
                              {node.nodeId} · {node.hostname} · {node.platform}/{node.arch ?? "?"}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => deregisterNode({ nodeId: node.nodeId })}
                          className="font-mono text-[8px] px-2 py-1 border border-red-900 text-red-500 hover:border-red-700 transition-colors flex-shrink-0"
                          style={{ borderRadius: 3 }}
                        >
                          DEREGISTER
                        </button>
                      </div>

                      {/* Details grid */}
                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3">
                        <div>
                          <span className="font-mono text-[8px] text-workshop-dim tracking-widest">AGENT URL</span>
                          <p className="font-mono text-[9px] text-workshop-chrome truncate">{node.agentUrl}</p>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] text-workshop-dim tracking-widest">LAST HEARTBEAT</span>
                          <p className="font-mono text-[9px]" style={{ color: stale ? "#f59e0b" : "#10b981" }}>
                            {timeSince(node.lastHeartbeat)}
                          </p>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] text-workshop-dim tracking-widest">NODE.JS</span>
                          <p className="font-mono text-[9px] text-workshop-chrome">{node.nodeVersion ?? "—"}</p>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] text-workshop-dim tracking-widest">AGENT VERSION</span>
                          <p className="font-mono text-[9px] text-workshop-chrome">{node.agentVersion ?? "—"}</p>
                        </div>
                        <div>
                          <span className="font-mono text-[8px] text-workshop-dim tracking-widest">REGISTERED</span>
                          <p className="font-mono text-[9px] text-workshop-chrome">
                            {new Date(node.registeredAt).toLocaleString("en-US", { hour12: false })}
                          </p>
                        </div>
                        {node.lastTunnelUrl && (
                          <div>
                            <span className="font-mono text-[8px] text-workshop-dim tracking-widest">PREV TUNNEL</span>
                            <p className="font-mono text-[9px] text-workshop-dim truncate">{node.lastTunnelUrl}</p>
                          </div>
                        )}
                      </div>

                      {/* Quick exec button */}
                      <button
                        onClick={() => {
                          setTargetNodeId(node.nodeId);
                          setActiveSection("kvm");
                        }}
                        className="mt-3 font-mono text-[9px] px-3 py-1.5 border transition-all"
                        style={{ borderRadius: 3, borderColor: "#10b98140", color: "#10b981", background: "#10b98110" }}
                      >
                        ▶ OPEN SHELL → {node.nodeId}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── KVM SECTION ── */}
      {activeSection === "kvm" && (
        <div className="space-y-6">
          {/* Notice */}
          <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "12px 16px" }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />
            <div className="flex items-start gap-3">
              <span className="font-mono text-[10px] text-emerald-400 mt-0.5">◈</span>
              <div>
                <p className="font-mono text-[10px] text-emerald-400 font-bold tracking-widest mb-1">HUMAN-ON-THE-LOOP — KVM SELF-MANAGEMENT</p>
                <p className="font-mono text-[9px] text-workshop-muted">
                  H.U.G.H. manages nodes autonomously. Every command is logged here. You observe — you do not gate.
                  Leave target blank to use the default VPS (KVM_AGENT_URL env var).
                </p>
              </div>
            </div>
          </div>

          {/* Quick status */}
          <div className="flex gap-3 items-center flex-wrap">
            <button
              onClick={handleVpsStatus}
              disabled={loadingStatus}
              className="btn-forge btn-emerald font-mono text-[10px] px-4 py-2"
              style={{ borderRadius: 4 }}
            >
              {loadingStatus ? "SCANNING..." : "▶ STATUS SNAPSHOT"}
            </button>
            <button
              onClick={loadLog}
              disabled={loadingLog}
              className="btn-forge btn-silver font-mono text-[10px] px-4 py-2"
              style={{ borderRadius: 4 }}
            >
              {loadingLog ? "LOADING..." : "↻ REFRESH LOG"}
            </button>
            {/* Node selector */}
            {nodes.length > 0 && (
              <select
                value={targetNodeId}
                onChange={e => setTargetNodeId(e.target.value)}
                className="font-mono text-[10px] bg-black border border-workshop-dim px-3 py-2 text-workshop-chrome focus:outline-none focus:border-emerald-500"
                style={{ borderRadius: 4 }}
              >
                <option value="">Default VPS</option>
                {nodes.map(n => (
                  <option key={n.nodeId} value={n.nodeId}>
                    {n.label} ({n.nodeId})
                  </option>
                ))}
              </select>
            )}
          </div>

          {vpsStatus && (
            <div className="panel-inset" style={{ borderRadius: 6, padding: "12px 16px" }}>
              <p className="font-mono text-[9px] text-workshop-muted mb-2 tracking-widest">STATUS OUTPUT</p>
              <pre className="font-mono text-[10px] text-workshop-chrome whitespace-pre-wrap overflow-auto max-h-64">{vpsStatus}</pre>
            </div>
          )}

          {/* Command terminal */}
          <div className="panel relative overflow-hidden" style={{ borderRadius: 6 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#10b981", boxShadow: "0 0 10px #10b981" }} />
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1a1a1a", background: "rgba(0,0,0,0.3)" }}>
              <div className="rivet" />
              <span className="font-mono text-[10px] tracking-widest text-emerald-400">ADMIN TERMINAL</span>
              {targetNodeId && (
                <span className="font-mono text-[9px] px-2 py-0.5" style={{ background: "#a78bfa20", border: "1px solid #a78bfa40", borderRadius: 2, color: "#a78bfa" }}>
                  → {targetNodeId}
                </span>
              )}
              <div className="flex-1" />
              <div className="rivet" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1">COMMAND</label>
                  <input
                    value={command}
                    onChange={(e) => setCommand(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleExec()}
                    placeholder="systemctl status nginx"
                    className="w-full bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-emerald-500"
                    style={{ borderRadius: 4 }}
                  />
                </div>
                <div style={{ width: 160 }}>
                  <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1">WORKING DIR</label>
                  <input
                    value={workingDir}
                    onChange={(e) => setWorkingDir(e.target.value)}
                    placeholder="/root"
                    className="w-full bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-emerald-500"
                    style={{ borderRadius: 4 }}
                  />
                </div>
              </div>
              <button
                onClick={handleExec}
                disabled={executing || !command.trim()}
                className="btn-forge btn-emerald font-mono text-[10px] px-6 py-2"
                style={{ borderRadius: 4 }}
              >
                {executing ? "EXECUTING..." : "▶ EXECUTE"}
              </button>

              {execResult && (
                <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 4, padding: "12px" }}>
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: execResult.success ? "#10b981" : "#ef4444" }} />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: execResult.success ? "#10b981" : "#ef4444" }} />
                    <span className="font-mono text-[10px] text-workshop-chrome">{execResult.command}</span>
                    <span className="font-mono text-[9px] text-workshop-dim ml-auto">
                      exit: {execResult.exitCode ?? "?"} | {execResult.durationMs ?? 0}ms
                    </span>
                  </div>
                  {execResult.stdout && (
                    <pre className="font-mono text-[10px] text-workshop-chrome whitespace-pre-wrap overflow-auto max-h-48 mb-2">{execResult.stdout}</pre>
                  )}
                  {execResult.stderr && (
                    <pre className="font-mono text-[10px] text-red-400 whitespace-pre-wrap overflow-auto max-h-24">{execResult.stderr}</pre>
                  )}
                  {execResult.errorMessage && (
                    <p className="font-mono text-[10px] text-red-400">{execResult.errorMessage}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Command log */}
          <div>
            <div className="flex items-center gap-3 mb-3">
              <div className="rivet" />
              <span className="font-mono text-[10px] text-workshop-muted tracking-widest">COMMAND LOG — LAST 50</span>
            </div>
            {commandLog.length === 0 ? (
              <div className="panel-inset" style={{ borderRadius: 6, padding: "24px", textAlign: "center" }}>
                <p className="font-mono text-[10px] text-workshop-dim">NO COMMANDS LOGGED</p>
                <p className="font-mono text-[9px] text-workshop-dim mt-1">Configure KVM env vars and execute a command to begin</p>
              </div>
            ) : (
              <div className="space-y-1">
                {commandLog.map((entry) => {
                  const zoneColor = ZONE_COLORS[entry.zone] ?? "#64748b";
                  const isHugh = entry.issuedBy === "hugh-primary";
                  return (
                    <div
                      key={entry._id}
                      className="panel-inset cursor-pointer hover:bg-white/5 transition-colors"
                      style={{ borderRadius: 4, padding: "8px 12px" }}
                      onClick={() => setSelectedEntry(selectedEntry?._id === entry._id ? null : entry)}
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: entry.success ? "#10b981" : "#ef4444" }} />
                        <span
                          className="font-mono text-[8px] px-1.5 py-0.5 flex-shrink-0"
                          style={{ background: `${zoneColor}20`, border: `1px solid ${zoneColor}40`, borderRadius: 2, color: zoneColor }}
                        >
                          {entry.zone.toUpperCase()}
                        </span>
                        {isHugh && (
                          <span className="font-mono text-[8px] px-1.5 py-0.5 flex-shrink-0" style={{ background: "#a78bfa20", border: "1px solid #a78bfa40", borderRadius: 2, color: "#a78bfa" }}>
                            H.U.G.H.
                          </span>
                        )}
                        {entry.targetNodeId && entry.targetNodeId !== "vps-primary" && (
                          <span className="font-mono text-[8px] px-1.5 py-0.5 flex-shrink-0" style={{ background: "#f59e0b20", border: "1px solid #f59e0b40", borderRadius: 2, color: "#f59e0b" }}>
                            @{entry.targetNodeId}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-workshop-chrome truncate flex-1">{entry.command}</span>
                        {entry.durationMs && <span className="font-mono text-[9px] text-workshop-dim flex-shrink-0">{entry.durationMs}ms</span>}
                        <span className="font-mono text-[9px] text-workshop-dim flex-shrink-0">
                          {new Date(entry._creationTime).toLocaleTimeString("en-US", { hour12: false })}
                        </span>
                      </div>
                      {selectedEntry?._id === entry._id && (
                        <div className="mt-3 space-y-2">
                          {entry.notes && <p className="font-mono text-[9px] text-workshop-muted italic">{entry.notes}</p>}
                          {entry.stdout && (
                            <pre className="font-mono text-[9px] text-workshop-chrome whitespace-pre-wrap overflow-auto max-h-48 bg-black/50 p-2 rounded">{entry.stdout}</pre>
                          )}
                          {entry.stderr && (
                            <pre className="font-mono text-[9px] text-red-400 whitespace-pre-wrap overflow-auto max-h-24 bg-black/50 p-2 rounded">{entry.stderr}</pre>
                          )}
                          {entry.errorMessage && (
                            <p className="font-mono text-[9px] text-red-400">{entry.errorMessage}</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── LIVEKIT SECTION ── */}
      {activeSection === "livekit" && (
        <div className="space-y-6">
          <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "12px 16px" }}>
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#60a5fa", boxShadow: "0 0 8px #60a5fa" }} />
            <div className="flex items-start gap-3">
              <span className="font-mono text-[10px] text-blue-400 mt-0.5">◈</span>
              <div>
                <p className="font-mono text-[10px] text-blue-400 font-bold tracking-widest mb-1">LIVEKIT — wss://tonyai-yqw0fr0p.livekit.cloud</p>
                <p className="font-mono text-[9px] text-workshop-muted">
                  Room management and token generation. Credentials are pre-configured.
                </p>
              </div>
            </div>
          </div>

          <div className="panel relative overflow-hidden" style={{ borderRadius: 6 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#60a5fa", boxShadow: "0 0 10px #60a5fa" }} />
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1a1a1a", background: "rgba(0,0,0,0.3)" }}>
              <div className="rivet" />
              <span className="font-mono text-[10px] tracking-widest text-blue-400">ACTIVE ROOMS</span>
              <div className="flex-1" />
              <button onClick={loadRooms} disabled={loadingRooms} className="font-mono text-[9px] text-workshop-muted hover:text-blue-400 transition-colors">
                {loadingRooms ? "LOADING..." : "↻ REFRESH"}
              </button>
              <div className="rivet" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <input
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                  placeholder="room-name"
                  className="flex-1 bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-blue-500"
                  style={{ borderRadius: 4 }}
                />
                <button
                  onClick={handleCreateRoom}
                  disabled={!newRoomName.trim()}
                  className="btn-forge font-mono text-[10px] px-4 py-2"
                  style={{ borderRadius: 4, borderColor: "#60a5fa", color: "#60a5fa", background: "#60a5fa15" }}
                >
                  + CREATE ROOM
                </button>
              </div>
              {rooms.length === 0 ? (
                <div className="panel-inset" style={{ borderRadius: 4, padding: "20px", textAlign: "center" }}>
                  <p className="font-mono text-[10px] text-workshop-dim">NO ACTIVE ROOMS</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {rooms.map((room) => (
                    <div key={room.name} className="panel-inset relative overflow-hidden" style={{ borderRadius: 4, padding: "10px 14px" }}>
                      <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#60a5fa" }} />
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-mono text-xs text-workshop-chrome font-bold">{room.name}</span>
                          <div className="flex items-center gap-3 mt-1">
                            <span className="font-mono text-[9px] text-workshop-muted">
                              {room.numParticipants} / {room.maxParticipants || "∞"} participants
                            </span>
                            {room.activeRecording && <span className="font-mono text-[8px] text-red-400">● RECORDING</span>}
                            <span className="font-mono text-[9px] text-workshop-dim">
                              created {new Date(room.creationTime * 1000).toLocaleTimeString("en-US", { hour12: false })}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleDeleteRoom(room.name)}
                          className="font-mono text-[9px] text-red-400 hover:text-red-300 transition-colors px-2 py-1 border border-red-900 hover:border-red-700"
                          style={{ borderRadius: 3 }}
                        >
                          DELETE
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="panel relative overflow-hidden" style={{ borderRadius: 6 }}>
            <div className="absolute top-0 left-0 right-0 h-0.5" style={{ background: "#a78bfa", boxShadow: "0 0 10px #a78bfa" }} />
            <div className="flex items-center gap-3 px-4 py-3" style={{ borderBottom: "1px solid #1a1a1a", background: "rgba(0,0,0,0.3)" }}>
              <div className="rivet" />
              <span className="font-mono text-[10px] tracking-widest" style={{ color: "#a78bfa" }}>TOKEN GENERATOR</span>
              <div className="flex-1" />
              <div className="rivet" />
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1">ROOM NAME</label>
                  <input value={tokenRoom} onChange={(e) => setTokenRoom(e.target.value)} placeholder="my-room"
                    className="w-full bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-purple-500" style={{ borderRadius: 4 }} />
                </div>
                <div className="flex-1">
                  <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1">PARTICIPANT IDENTITY</label>
                  <input value={tokenIdentity} onChange={(e) => setTokenIdentity(e.target.value)} placeholder="user-001"
                    className="w-full bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-purple-500" style={{ borderRadius: 4 }} />
                </div>
              </div>
              <button onClick={handleGenerateToken} disabled={generatingToken || !tokenRoom.trim() || !tokenIdentity.trim()}
                className="btn-forge font-mono text-[10px] px-6 py-2"
                style={{ borderRadius: 4, borderColor: "#a78bfa", color: "#a78bfa", background: "#a78bfa15" }}>
                {generatingToken ? "GENERATING..." : "⚿ GENERATE TOKEN"}
              </button>
              {generatedToken && (
                <div className="panel-inset" style={{ borderRadius: 4, padding: "12px" }}>
                  <p className="font-mono text-[9px] text-workshop-muted mb-2 tracking-widest">ACCESS TOKEN (1hr TTL)</p>
                  <div className="flex items-start gap-2">
                    <pre className="font-mono text-[9px] text-workshop-chrome break-all whitespace-pre-wrap flex-1 overflow-hidden">{generatedToken}</pre>
                    <button onClick={() => navigator.clipboard.writeText(generatedToken)}
                      className="font-mono text-[9px] text-workshop-muted hover:text-workshop-chrome transition-colors flex-shrink-0 px-2 py-1 border border-workshop-dim" style={{ borderRadius: 3 }}>
                      COPY
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
