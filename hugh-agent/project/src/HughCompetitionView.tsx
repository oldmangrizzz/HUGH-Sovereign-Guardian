import { useEffect, useRef, useState } from "react";

// ARC-AGI standard 10-color palette
const ARC_PALETTE = [
  "#000000", // 0 black
  "#0074D9", // 1 blue
  "#FF4136", // 2 red
  "#2ECC40", // 3 green
  "#FFDC00", // 4 yellow
  "#AAAAAA", // 5 grey
  "#F012BE", // 6 fuchsia
  "#FF851B", // 7 orange
  "#7FDBFF", // 8 azure
  "#870C25", // 9 maroon
];

const WS_URL = "ws://localhost:8765";

// Previous AI best and frontier benchmarks
const PREV_AI_BEST  = 12.58;
const FRONTIER_AVG  = 0.26;
const HUMAN_BASELINE = 100;

interface HughLive {
  grid?:         number[][];
  action?:       string;
  hypothesis?:   string;
  confidence?:   number;
  strategy?:     string;
  score?:        number;
  episode?:      number;
  totalEpisodes?: number;
  worker?:       string;
  events?:       string[];
}

export default function HughCompetitionView({ className }: { className?: string }) {
  const [ws_ok, setWsOk]     = useState(false);
  const [live, setLive]       = useState<HughLive>({ events: [], score: 0, episode: 0, totalEpisodes: 400 });
  const logRef                = useRef<HTMLDivElement>(null);
  const evLog                 = useRef<string[]>([]);

  useEffect(() => {
    let sock: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      try {
        sock = new WebSocket(WS_URL);
        sock.onopen    = ()  => setWsOk(true);
        sock.onclose   = ()  => { setWsOk(false); retryTimer = setTimeout(connect, 3000); };
        sock.onerror   = ()  => sock?.close();
        sock.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string) as { type: string; payload: unknown };
            dispatch(msg);
          } catch { /* malformed — ignore */ }
        };
      } catch {
        retryTimer = setTimeout(connect, 3000);
      }
    };

    const dispatch = (msg: { type: string; payload: unknown }) => {
      switch (msg.type) {
        case "state": {
          setLive(prev => ({ ...prev, ...(msg.payload as Partial<HughLive>) }));
          break;
        }
        case "event": {
          const text = `[${new Date().toLocaleTimeString("en-US", { hour12: false })}] ${msg.payload as string}`;
          evLog.current = [text, ...evLog.current].slice(0, 60);
          setLive(prev => ({ ...prev, events: [...evLog.current] }));
          break;
        }
        case "score": {
          setLive(prev => ({ ...prev, score: msg.payload as number }));
          break;
        }
        case "hypothesis": {
          const p = msg.payload as { hypothesis?: string; confidence?: number; strategy?: string };
          setLive(prev => ({ ...prev, ...p }));
          break;
        }
        case "grid": {
          setLive(prev => ({ ...prev, grid: msg.payload as number[][] }));
          break;
        }
      }
    };

    connect();
    return () => { clearTimeout(retryTimer); sock?.close(); };
  }, []);

  const score = live.score ?? 0;

  return (
    <div
      className={className}
      style={{ width: "100%", height: "100%", background: "#000", color: "#00ff41", fontFamily: "'JetBrains Mono', 'Courier New', monospace", display: "flex", flexDirection: "column", overflow: "hidden" }}
    >
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", borderBottom: "1px solid #002200", background: "#000a00", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: ws_ok ? "#00ff41" : "#ef4444", boxShadow: ws_ok ? "0 0 6px #00ff41" : "none" }} />
          <span style={{ fontSize: 9, letterSpacing: "0.18em", color: "#00aa44" }}>
            {ws_ok ? "LIVE · HUGH COMPETING" : "WAITING FOR HARNESS  (python broadcaster.py &)"}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "#00aa44" }}>
          ARC-AGI-3 · EP {live.episode ?? 0} / {live.totalEpisodes ?? 400}
          {live.worker ? ` · ${live.worker}` : ""}
        </span>
        <span style={{ fontSize: 10, fontWeight: 700, color: score > PREV_AI_BEST ? "#00ff41" : "#00cc33" }}>
          GM: {score.toFixed(2)}%
        </span>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* LEFT — ARC grid + current action */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderRight: "1px solid #001500", padding: 16, gap: 12 }}>
          <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#004400" }}>EPISODE STATE</div>
          {live.grid ? (
            <ARCGrid grid={live.grid} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, color: "#002200" }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                <polygon points="12,2 22,20 2,20" />
              </svg>
              <span style={{ fontSize: 9, letterSpacing: "0.2em" }}>AWAITING GRID</span>
            </div>
          )}
          {live.action && (
            <div style={{ padding: "5px 14px", border: "1px solid #003300", background: "#000800", fontSize: 9, letterSpacing: "0.15em", color: "#00ff41" }}>
              ACTION → {live.action}
            </div>
          )}
        </div>

        {/* RIGHT — hypothesis + score race + log */}
        <div style={{ width: 280, display: "flex", flexDirection: "column", overflow: "hidden" }}>

          {/* Hypothesis block */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #001500", flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#004400", marginBottom: 6 }}>HYPOTHESIS</div>
            <div style={{ fontSize: 9, lineHeight: 1.55, color: "#00cc33", minHeight: 36 }}>
              {live.hypothesis ?? "—"}
            </div>
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 7, color: "#004400", letterSpacing: "0.12em" }}>CONF</span>
              <div style={{ flex: 1, height: 3, background: "#001500", borderRadius: 2 }}>
                <div style={{ width: `${(live.confidence ?? 0) * 100}%`, height: "100%", background: "#00ff41", borderRadius: 2, transition: "width 0.35s ease", boxShadow: "0 0 4px #00ff41" }} />
              </div>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#00ff41", minWidth: 28, textAlign: "right" }}>
                {((live.confidence ?? 0) * 100).toFixed(0)}%
              </span>
            </div>
            {live.strategy && (
              <div style={{ marginTop: 5, fontSize: 7, letterSpacing: "0.15em", color: "#006622" }}>
                STRATEGY: {live.strategy}
              </div>
            )}
          </div>

          {/* Score race */}
          <div style={{ padding: "10px 12px", borderBottom: "1px solid #001500", flexShrink: 0 }}>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#004400", marginBottom: 8 }}>SCORE RACE</div>
            <ScoreBar label="GRIZZLYMEDICINE"  score={score}          max={HUMAN_BASELINE} color="#00ff41" isUs />
            <ScoreBar label="PREV AI BEST"     score={PREV_AI_BEST}   max={HUMAN_BASELINE} color="#f59e0b" />
            <ScoreBar label="FRONTIER AVG"     score={FRONTIER_AVG}   max={HUMAN_BASELINE} color="#ef4444" />
            <ScoreBar label="HUMAN BASELINE"   score={HUMAN_BASELINE} max={HUMAN_BASELINE} color="#60a5fa" />
          </div>

          {/* Event log */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "10px 12px", overflow: "hidden" }}>
            <div style={{ fontSize: 8, letterSpacing: "0.2em", color: "#004400", marginBottom: 6, flexShrink: 0 }}>EVENT LOG</div>
            <div ref={logRef} style={{ flex: 1, overflowY: "auto", scrollbarWidth: "none" }}>
              {(live.events ?? []).length === 0 ? (
                <div style={{ fontSize: 8, color: "#002200" }}>No events yet</div>
              ) : (
                (live.events ?? []).map((ev, i) => (
                  <div key={i} style={{ fontSize: 8, lineHeight: 1.5, color: i === 0 ? "#00ff41" : "#003a00", borderBottom: "1px solid #001100", paddingBottom: 2, marginBottom: 2 }}>
                    {ev}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ARC Grid renderer ────────────────────────────────────────────────────────
function ARCGrid({ grid }: { grid: number[][] }) {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 1;
  const cell = Math.min(Math.floor(230 / Math.max(rows, cols, 1)), 28);

  return (
    <div style={{ display: "inline-grid", gridTemplateRows: `repeat(${rows}, ${cell}px)`, gridTemplateColumns: `repeat(${cols}, ${cell}px)`, gap: 1, background: "#001100", padding: 2, boxShadow: "0 0 20px rgba(0,255,65,0.08)" }}>
      {grid.flat().map((v, i) => (
        <div
          key={i}
          style={{
            width: cell,
            height: cell,
            background: ARC_PALETTE[v] ?? "#222",
            boxShadow: v > 0 ? `inset 0 0 3px rgba(0,0,0,0.5)` : "none",
          }}
        />
      ))}
    </div>
  );
}

// ── Score bar ────────────────────────────────────────────────────────────────
function ScoreBar({ label, score, max, color, isUs }: { label: string; score: number; max: number; color: string; isUs?: boolean }) {
  const pct = Math.min((score / max) * 100, 100);
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
        <span style={{ fontSize: 7, letterSpacing: "0.12em", color: isUs ? color : "#004a00", fontWeight: isUs ? 700 : 400 }}>{label}</span>
        <span style={{ fontSize: 8, fontWeight: 700, color }}>{score.toFixed(2)}%</span>
      </div>
      <div style={{ height: 5, background: "#001500", borderRadius: 3 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 3, boxShadow: isUs ? `0 0 8px ${color}` : "none", transition: "width 0.5s ease" }} />
      </div>
    </div>
  );
}
