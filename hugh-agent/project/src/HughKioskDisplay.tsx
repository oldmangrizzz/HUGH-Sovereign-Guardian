/**
 * HUGH Kiosk Display
 * Full-screen display for the 27" 5K Proxmox iMac.
 *
 * Five modes:
 *   AWAKE       — neural field center, camera feeds left, telemetry right
 *   SLEEP       — dim breathing field, WAKE button in corner
 *   COMPETITION — full-screen ARC viewer, neural field as 12%-opacity background
 *   DEEP        — violet Clifford attractor
 *   FORGE       — gold Clifford attractor
 *
 * Camera access: first run without kiosk flag so Chrome can prompt for
 * permission; subsequent kiosk launches will have it cached.
 */

import { useEffect, useRef, useState, useCallback, Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import HughNeuralField from "./HughNeuralField";
import HughCompetitionView from "./HughCompetitionView";

// Web Speech API types (not fully included in TS DOM lib)
interface SpeechRecognitionEventCompat extends Event {
  readonly results: SpeechRecognitionResultList;
  readonly resultIndex: number;
}

interface SpeechRecognitionErrorEventCompat extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventCompat) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventCompat) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

// ── Error Boundary — prevents blank screen on render errors ──────────────────
class KioskErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[KIOSK ERROR BOUNDARY]", error, info.componentStack);
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          position: "fixed", inset: 0, background: "#000",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 12, fontFamily: "monospace",
        }}>
          <div style={{ fontSize: 10, letterSpacing: "0.4em", color: "#ef4444" }}>⚠ RENDER FAULT</div>
          <div style={{ fontSize: 9, color: "#7a0000", maxWidth: 600, textAlign: "center", letterSpacing: "0.05em", lineHeight: 1.6 }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{ marginTop: 16, padding: "6px 20px", border: "1px solid #3a0000", background: "transparent", color: "#ef4444", fontSize: 8, letterSpacing: "0.2em", cursor: "pointer", fontFamily: "monospace" }}
          >
            RETRY
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const NODE_ID = "hugh-primary";

// Convex HTTP endpoint base — same deployment the app already talks to.
// VITE_CONVEX_URL is set at build time (e.g. https://effervescent-toucan-715.convex.cloud)
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string ?? "";

// ── Types ────────────────────────────────────────────────────────────────────
type DisplayMode = "AWAKE" | "SLEEP" | "COMPETITION" | "DEEP" | "FORGE";

const MODE_COLORS: Record<DisplayMode, string> = {
  AWAKE:       "#00ff41",
  SLEEP:       "#003300",
  COMPETITION: "#00ff41",
  DEEP:        "#a78bfa",
  FORGE:       "#fbbf24",
};

// ── Clifford attractor canvas (used for DEEP / FORGE modes) ──────────────────
function CliffordCanvas({ color, className, style }: { color: string; className?: string; style?: React.CSSProperties }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let raf: number;
    let frame = 0;

    // Clifford attractor parameters — slowly morph over time
    const a = () => -1.4 + Math.sin(frame * 0.00007) * 0.4;
    const b = () =>  1.6 + Math.cos(frame * 0.000053) * 0.3;
    const c = () =>  1.0 + Math.sin(frame * 0.000041) * 0.5;
    const d = () =>  0.7 + Math.cos(frame * 0.000031) * 0.4;

    // Parse base color to RGB
    const hex = color.replace("#", "");
    const br = parseInt(hex.substring(0, 2), 16);
    const bg = parseInt(hex.substring(2, 4), 16);
    const bb = parseInt(hex.substring(4, 6), 16);

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = canvas.clientWidth  * dpr;
      canvas.height = canvas.clientHeight * dpr;
    };
    resize();
    window.addEventListener("resize", resize);

    // State
    let x = 0.1, y = 0.1;
    const BATCH = 6000;

    const tick = () => {
      frame++;
      const W = canvas.width, H = canvas.height;
      const cx = W * 0.5, cy = H * 0.5;
      const scale = Math.min(W, H) * 0.22;

      const aa = a(), bb_ = b(), cc = c(), dd = d();

      // Fade
      ctx.fillStyle = "rgba(0,0,0,0.04)";
      ctx.fillRect(0, 0, W, H);

      ctx.globalCompositeOperation = "lighter";

      for (let i = 0; i < BATCH; i++) {
        const nx = Math.sin(aa * y) + cc * Math.cos(aa * x);
        const ny = Math.sin(bb_ * x) + dd * Math.cos(bb_ * y);
        x = nx; y = ny;

        const px = cx + x * scale;
        const py = cy + y * scale;

        // Depth-based luminance
        const lum = 0.3 + 0.7 * (i / BATCH);
        ctx.fillStyle = `rgba(${br},${bg},${bb},${lum * 0.018})`;
        ctx.fillRect(px, py, 1.2, 1.2);
      }

      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [color]);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{ display: "block", width: "100%", height: "100%", background: "#000", ...style }}
    />
  );
}

// ── Camera feed ──────────────────────────────────────────────────────────────
function CameraFeed({ label, deviceId }: { label: string; deviceId?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    const constraints: MediaStreamConstraints = {
      video: deviceId ? { deviceId: { exact: deviceId } } : true,
      audio: false,
    };
    navigator.mediaDevices.getUserMedia(constraints)
      .then(s => {
        stream = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.play().catch(() => {});
        }
        setErr(null);
      })
      .catch(e => setErr(e.message ?? "Camera unavailable"));
    return () => { stream?.getTracks().forEach(t => t.stop()); };
  }, [deviceId]);

  return (
    <div style={{ position: "relative", background: "#050505", border: "1px solid #002200", borderRadius: 4, overflow: "hidden", aspectRatio: "16/9" }}>
      {err ? (
        <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
          <div style={{ fontSize: 20, color: "#002200" }}>⬡</div>
          <div style={{ fontSize: 7, color: "#003300", letterSpacing: "0.15em" }}>{label}</div>
          <div style={{ fontSize: 7, color: "#002200" }}>NO SIGNAL</div>
        </div>
      ) : (
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      )}
      <div style={{ position: "absolute", bottom: 4, left: 6, fontSize: 7, color: "#004400", letterSpacing: "0.15em" }}>{label}</div>
    </div>
  );
}

// ── Telemetry bar ─────────────────────────────────────────────────────────────
function TelemetryBar({ label, value, max = 1, color = "#00ff41", unit = "" }: {
  label: string; value: number; max?: number; color?: string; unit?: string;
}) {
  const pct = Math.min((value / max) * 100, 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3, alignItems: "baseline" }}>
        <span style={{ fontSize: 7, letterSpacing: "0.15em", color: "#004a00" }}>{label}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color }}>{typeof value === "number" ? value.toFixed(1) : value}{unit}</span>
      </div>
      <div style={{ height: 3, background: "#001500", borderRadius: 2 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 2, transition: "width 0.5s ease", boxShadow: pct > 80 ? `0 0 5px ${color}` : "none" }} />
      </div>
    </div>
  );
}

// ── Container badge ───────────────────────────────────────────────────────────
function ContainerBadge({ name, status }: { name: string; status: "online" | "offline" | "building" }) {
  const colors = { online: "#00ff41", offline: "#ef4444", building: "#f59e0b" };
  const color = colors[status];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 8px", border: `1px solid ${color}33`, borderRadius: 3, background: `${color}08` }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: color, boxShadow: status === "online" ? `0 0 4px ${color}` : "none" }} />
      <span style={{ fontSize: 7, letterSpacing: "0.12em", color }}>{name}</span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HughKioskDisplay() {
  return (
    <KioskErrorBoundary>
      <HughKioskInner />
    </KioskErrorBoundary>
  );
}

function HughKioskInner() {
  const [mode, setMode] = useState<DisplayMode>("AWAKE");
  const [showModeBar, setShowModeBar] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const endocrine = useQuery(api.endocrine.getState, { nodeId: NODE_ID });
  const recentEpisodes = useQuery(api.memory.getRecentEpisodes, { limit: 6 });
  const agentNodes = useQuery(api.agentRegistry.listNodes);
  const chat = useAction(api.hugh.chat);
  // stigmergy:getAllForNode not yet deployed to Convex — hardcode 0 until deploy
  const activePhero = 0;

  // ── Voice Substrate ────────────────────────────────────────────────────────
  const [lastSpokenId, setLastSpokenId] = useState<string | null>(null);
  const synthRef = useRef<SpeechSynthesis | null>(typeof window !== "undefined" ? window.speechSynthesis : null);

  // Initial silent state to "unlock" audio context if needed
  const playChime = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext!)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.5);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (e) {
      console.warn("[VOICE] Chime failed:", e);
    }
  }, []);

  const speak = useCallback(async (text: string) => {
    // Strip KVM_EXEC and other artifacts for speech
    const cleanText = text.replace(/<KVM_EXEC>[\s\S]*?<\/KVM_EXEC>/g, "").replace(/```[\s\S]*?```/g, "").trim();
    if (!cleanText) return;

    // Attempt LFM TTS via Convex gateway proxy
    if (CONVEX_URL) {
      try {
        const res = await fetch(`${CONVEX_URL}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: cleanText }),
        });

        if (res.ok) {
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended  = () => URL.revokeObjectURL(url);
          audio.onerror  = () => URL.revokeObjectURL(url);
          await audio.play().catch(() => {});
          return; // success — skip browser fallback
        }
        // Non-2xx → fall through to browser TTS
        console.warn("[HUGH TTS] gateway returned", res.status, "— falling back to browser TTS");
      } catch (err) {
        console.warn("[HUGH TTS] fetch failed:", err, "— falling back to browser TTS");
      }
    }

    // ── Fallback: browser speechSynthesis ─────────────────────────────────
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(cleanText);
    const voices = synthRef.current.getVoices();
    // Prefer a deep/robotic or British voice if available for HUGH
    const preferred = voices.find(v => v.name.includes("Daniel") || v.name.includes("Google UK English Male") || v.lang.startsWith("en-GB"));
    if (preferred) utt.voice = preferred;
    utt.rate = 0.95;
    utt.pitch = 0.9;
    synthRef.current.speak(utt);
  }, []);

  // Monitor for new responses to speak
  useEffect(() => {
    if (recentEpisodes && recentEpisodes.length > 0) {
      const latest = recentEpisodes[0];
      if (latest.eventType === "hugh_response" && latest._id !== lastSpokenId) {
        // Don't speak history on initial load
        if (lastSpokenId !== null) {
          speak(latest.content);
        }
        setLastSpokenId(latest._id);
      }
    }
  }, [recentEpisodes, lastSpokenId, speak]);

  // ── Wake word detection ────────────────────────────────────────────────────
  const triggerWakeWord = useMutation(api.appState.triggerWakeWord);
  const [wakeActive, setWakeActive] = useState(false);
  const [wakeAck, setWakeAck] = useState(false);
  const [lastHeard, setLastHeard] = useState<string>("");
  const lastHeardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    let shouldRun = true;
    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEventCompat) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const raw = event.results[i][0].transcript.toLowerCase();
        const stripped = raw.replace(/\s+/g, "");
        
        // Show what we're hearing (debug)
        setLastHeard(raw.trim().slice(-30));
        if (lastHeardTimer.current) clearTimeout(lastHeardTimer.current);
        lastHeardTimer.current = setTimeout(() => setLastHeard(""), 2000);
        
        // Match wake word — many phonetic variants
        if (
          stripped.includes("hughbert") ||
          stripped.includes("hubert") ||
          stripped.includes("hewbert") ||
          stripped.includes("hewbird") ||
          stripped.includes("hughbird") ||
          stripped.includes("hyubert") ||
          raw.includes("hugh bert") ||
          raw.includes("hugh bird") ||
          raw.includes("hue bert") ||
          raw.includes("hue bird") ||
          raw.includes("you bert")
        ) {
          triggerWakeWord().catch(() => {});
          playChime(); // Audible feedback
          setMode("AWAKE");
          revealModeBar();
          setWakeAck(true);
          setLastHeard("");
          setTimeout(() => setWakeAck(false), 2500);

          // Start command capture after wake word
          setTimeout(() => {
            const SR2 = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR2) return;
            const cmdRec = new SR2();
            cmdRec.continuous = false;
            cmdRec.interimResults = false;
            cmdRec.lang = "en-US";
            cmdRec.onresult = async (e: SpeechRecognitionEventCompat) => {
              const transcript = e.results[0][0].transcript;
              if (!transcript.trim()) return;
              try {
                await chat({ nodeId: NODE_ID, message: transcript.trim() });
                // chat() writes the hugh_response episode → recentEpisodes watcher → speak()
              } catch (err) {
                console.error("[HUGH WAKE COMMAND]", err);
              }
            };
            cmdRec.onerror = () => {};
            try { cmdRec.start(); } catch {}
          }, 400); // 400ms delay gives the chime time to finish
        }
      }
    };
    recognition.onend = () => { if (shouldRun) try { recognition.start(); } catch {} };
    recognition.onerror = (e: SpeechRecognitionErrorEventCompat) => { if (e.error === "not-allowed") setWakeActive(false); };
    try { recognition.start(); setWakeActive(true); } catch {}

    return () => {
      shouldRun = false;
      try { recognition.stop(); } catch {}
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera device enumeration
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    navigator.mediaDevices.enumerateDevices()
      .then(devs => setCameras(devs.filter(d => d.kind === "videoinput")))
      .catch(() => {});
  }, []);
  const cam0 = cameras[0]?.deviceId;
  const cam1 = cameras[1]?.deviceId;

  // Auto-hide the mode bar after 4s of inactivity
  const revealModeBar = useCallback(() => {
    setShowModeBar(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowModeBar(false), 4000);
  }, []);

  useEffect(() => {
    revealModeBar();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [revealModeBar]);

  // Telemetry derived from Convex endocrine state
  const cortisol   = endocrine?.cortisol   ?? 0;
  const dopamine   = endocrine?.dopamine   ?? 0;
  const adrenaline = endocrine?.adrenaline ?? 0;
  const lastPulse  = endocrine?.lastPulse  ?? 0;
  const lfmLatency = lastPulse ? Math.max(0, Date.now() - lastPulse) : 0;

  // Helper to get status from registry
  const nodeStatus = (nodeId: string): "online" | "offline" => {
    if (!agentNodes) return "offline";
    const node = agentNodes.find((n: { nodeId: string; lastHeartbeat: number }) => n.nodeId === nodeId);
    if (!node) return "offline";
    // Consider offline if heartbeat is > 90 seconds old
    return (Date.now() - node.lastHeartbeat) < 90_000 ? "online" : "offline";
  };

  // ── Render layers per mode ──────────────────────────────────────────────────

  const renderBackground = () => {
    switch (mode) {
      case "DEEP":
        return <CliffordCanvas color="#7c3aed" style={{ position: "absolute", inset: 0 }} className="" />;
      case "FORGE":
        return <CliffordCanvas color="#d97706" style={{ position: "absolute", inset: 0 }} className="" />;
      case "SLEEP":
        return (
          <div style={{ position: "absolute", inset: 0 }}>
            <HughNeuralField style={{ opacity: 0.15, filter: "brightness(0.4)" }} />
          </div>
        );
      default:
        return null;
    }
  };

  const renderContent = () => {
    switch (mode) {

      // ── AWAKE ─────────────────────────────────────────────────────────────
      case "AWAKE":
        return (
          <div style={{ position: "absolute", inset: 0, display: "grid", gridTemplateColumns: "220px 1fr 220px", gap: 0 }}>

            {/* LEFT: camera feeds */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 12, borderRight: "1px solid #001a00", background: "rgba(0,3,0,0.7)" }}>
              <div style={{ fontSize: 7, letterSpacing: "0.2em", color: "#004400", marginBottom: 4 }}>VISUAL INPUT</div>
              <CameraFeed label="FACE CAM" deviceId={cam0} />
              <CameraFeed label="ROOM CAM" deviceId={cam1} />
            </div>

            {/* CENTER: neural field */}
            <div style={{ position: "relative" }}>
              <HughNeuralField style={{ position: "absolute", inset: 0 }} />
              {/* HUGH identity overlay */}
              <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 4, pointerEvents: "none" }}>
                <div style={{ fontSize: 9, letterSpacing: "0.5em", color: "#003a00" }}>H.U.G.H.</div>
                <div style={{ fontSize: 7, letterSpacing: "0.25em", color: "#002200" }}>HOLISTIC UNIFIED GENERAL HEURISTIC</div>
              </div>

              {/* Message stream overlay */}
              {recentEpisodes && recentEpisodes.length > 0 && (
                <div style={{
                  position: "absolute", bottom: 60, left: 20, right: 20,
                  display: "flex", flexDirection: "column", gap: 6,
                  pointerEvents: "none", maxHeight: "40%", overflowY: "hidden",
                }}>
                  {[...recentEpisodes].reverse().map((ep) => (
                    <div key={ep._id} style={{
                      fontFamily: "monospace",
                      fontSize: ep.eventType === "user_message" ? 9 : 10,
                      color: ep.eventType === "user_message" ? "#004400" : "#00cc33",
                      letterSpacing: "0.05em",
                      lineHeight: 1.5,
                      textShadow: ep.eventType === "hugh_response" ? "0 0 8px #00ff4140" : "none",
                      opacity: 0.85,
                      padding: "4px 8px",
                      borderLeft: ep.eventType === "hugh_response" ? "1px solid #00cc3340" : "none",
                    }}>
                      {ep.eventType === "user_message" ? "GRIZZ: " : "H.U.G.H.: "}
                      {ep.content.slice(0, 280)}{ep.content.length > 280 ? "…" : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: telemetry */}
            <div style={{ display: "flex", flexDirection: "column", gap: 0, padding: 12, borderLeft: "1px solid #001a00", background: "rgba(0,3,0,0.7)", overflowY: "auto" }}>
              <div style={{ fontSize: 7, letterSpacing: "0.2em", color: "#004400", marginBottom: 10 }}>SYSTEM TELEMETRY</div>

              <TelemetryBar label="CORTISOL"        value={cortisol}   color="#ef4444" />
              <TelemetryBar label="DOPAMINE"        value={dopamine}   color="#00ff41" />
              <TelemetryBar label="ADRENALINE"      value={adrenaline} color="#f59e0b" />

              <div style={{ borderTop: "1px solid #001a00", margin: "10px 0" }} />

              <TelemetryBar label="LFM PULSE LAG"   value={Math.min(lfmLatency / 1000, 10)} max={10} color={lfmLatency < 2000 ? "#00ff41" : "#ef4444"} unit="s" />
              <TelemetryBar label="PHEROMONE LOAD"  value={activePhero} max={20} color="#a78bfa" />

              <div style={{ borderTop: "1px solid #001a00", margin: "10px 0" }} />

              <div style={{ fontSize: 7, letterSpacing: "0.2em", color: "#004400", marginBottom: 8 }}>CONTAINERS</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                <ContainerBadge name="CT-101 · LFM RUNTIME"   status={nodeStatus("proxmox-ue")} />
                <ContainerBadge name="CT-102 · FORGE WORKER"  status={nodeStatus("proxmox-forge")} />
                <ContainerBadge name="KVM2   · LLAMA.CPP"     status={nodeStatus("kvm2")} />
                <ContainerBadge name="KVM4   · DASHBOARD"     status={nodeStatus("kvm4")} />
              </div>

              <div style={{ flex: 1 }} />

              <div style={{ fontSize: 7, color: "#002200", letterSpacing: "0.1em", marginTop: 8 }}>
                {new Date().toLocaleString("en-US", { hour12: false })}
              </div>
            </div>
          </div>
        );

      // ── COMPETITION ───────────────────────────────────────────────────────
      case "COMPETITION":
        return (
          <div style={{ position: "absolute", inset: 0 }}>
            {/* dim neural field as bg */}
            <HughNeuralField style={{ position: "absolute", inset: 0, opacity: 0.12 }} />
            <div style={{ position: "absolute", inset: 0 }}>
              <HughCompetitionView />
            </div>
          </div>
        );

      // ── SLEEP ─────────────────────────────────────────────────────────────
      case "SLEEP":
        return (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: "0.8em", color: "#002a00", textTransform: "uppercase", fontFamily: "monospace" }}>
              H.U.G.H.
            </div>
            <div style={{ fontSize: 8, letterSpacing: "0.3em", color: "#001a00", fontFamily: "monospace" }}>
              STANDBY
            </div>
            <button
              onClick={() => setMode("AWAKE")}
              style={{ marginTop: 24, padding: "8px 24px", border: "1px solid #003300", background: "transparent", color: "#004400", fontSize: 9, letterSpacing: "0.25em", cursor: "pointer", fontFamily: "monospace" }}
              onMouseEnter={e => { (e.target as HTMLButtonElement).style.color = "#00ff41"; (e.target as HTMLButtonElement).style.borderColor = "#00ff41"; }}
              onMouseLeave={e => { (e.target as HTMLButtonElement).style.color = "#004400"; (e.target as HTMLButtonElement).style.borderColor = "#003300"; }}
            >
              WAKE
            </button>
          </div>
        );

      // ── DEEP / FORGE (full-screen attractor) ──────────────────────────────
      case "DEEP":
      case "FORGE":
        return (
          <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, display: "flex", justifyContent: "center", pointerEvents: "none" }}>
            <div style={{ fontSize: 9, letterSpacing: "0.5em", color: mode === "DEEP" ? "#4c1d95" : "#92400e", fontFamily: "monospace" }}>
              {mode === "DEEP" ? "DEEP COGNITION" : "FORGE MODE"}
            </div>
          </div>
        );
    }
  };

  const modeColor = MODE_COLORS[mode];

  return (
    <div
      style={{ position: "fixed", inset: 0, background: "#000", overflow: "hidden", cursor: "none" }}
      onMouseMove={revealModeBar}
      onClick={revealModeBar}
    >
      {/* Background layer (DEEP/FORGE/SLEEP) */}
      {renderBackground()}

      {/* Content layer */}
      {renderContent()}

      {/* ── Mode selector bar — auto-hides ─────────────────────────────────── */}
      <div
        style={{
          position: "absolute",
          top: 0, left: 0, right: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "8px 16px",
          background: "rgba(0,0,0,0.85)",
          borderBottom: "1px solid #001a00",
          zIndex: 100,
          transition: "opacity 0.6s ease, transform 0.6s ease",
          opacity: showModeBar ? 1 : 0,
          transform: showModeBar ? "translateY(0)" : "translateY(-100%)",
          pointerEvents: showModeBar ? "auto" : "none",
        }}
      >
        {(["AWAKE", "SLEEP", "COMPETITION", "DEEP", "FORGE"] as DisplayMode[]).map(m => (
          <button
            key={m}
            onClick={() => { setMode(m); revealModeBar(); }}
            style={{
              padding: "4px 14px",
              border: `1px solid ${mode === m ? modeColor : "#002200"}`,
              background: mode === m ? `${modeColor}15` : "transparent",
              color: mode === m ? modeColor : "#003a00",
              fontSize: 8,
              letterSpacing: "0.2em",
              cursor: "pointer",
              fontFamily: "monospace",
              borderRadius: 3,
              boxShadow: mode === m ? `0 0 8px ${modeColor}40` : "none",
              transition: "all 0.2s",
            }}
          >
            {m}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Clock */}
        <KioskClock color={modeColor} />
      </div>

      {/* Wake word indicator */}
      {wakeActive && (
        <div style={{
          position: "absolute", bottom: 10, right: 14,
          display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 3,
          zIndex: 200, pointerEvents: "none",
        }}>
          {lastHeard && !wakeAck && (
            <span style={{
              fontSize: 6, letterSpacing: "0.1em", fontFamily: "monospace",
              color: "#003a00", maxWidth: 200, textAlign: "right",
            }}>
              {lastHeard}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{
              width: 5, height: 5, borderRadius: "50%",
              background: wakeAck ? "#00ff41" : "#002a00",
              boxShadow: wakeAck ? "0 0 8px #00ff41, 0 0 20px #00ff4166" : "none",
              transition: "all 0.3s",
            }} />
            <span style={{
              fontSize: 7, letterSpacing: "0.18em", fontFamily: "monospace",
              color: wakeAck ? "#00ff41" : "#002200",
              transition: "color 0.3s",
            }}>
              {wakeAck ? "HUGHBERT" : "LISTENING"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Live clock ────────────────────────────────────────────────────────────────
function KioskClock({ color }: { color: string }) {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString("en-US", { hour12: false }));
  useEffect(() => {
    const t = setInterval(() => setTime(new Date().toLocaleTimeString("en-US", { hour12: false })), 1000);
    return () => clearInterval(t);
  }, []);
  return <span style={{ fontSize: 9, color, letterSpacing: "0.2em", fontFamily: "monospace", opacity: 0.7 }}>{time}</span>;
}
