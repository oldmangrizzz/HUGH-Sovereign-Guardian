import { useState, useRef } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

type BrowserResult = {
  success: boolean;
  screenshotBase64?: string;
  text?: string;
  url?: string;
  title?: string;
  errorMessage?: string;
  durationMs: number;
};

type ActionMode = "navigate" | "click" | "type" | "screenshot" | "getText";

const ACTION_DEFS: { id: ActionMode; label: string; color: string; desc: string }[] = [
  { id: "navigate",   label: "NAVIGATE",    color: "#10b981", desc: "Go to URL" },
  { id: "screenshot", label: "SCREENSHOT",  color: "#60a5fa", desc: "Capture current page" },
  { id: "click",      label: "CLICK",       color: "#f59e0b", desc: "Click a CSS selector" },
  { id: "type",       label: "TYPE",        color: "#a78bfa", desc: "Fill a CSS selector" },
  { id: "getText",    label: "GET TEXT",    color: "#94a3b8", desc: "Extract text from selector" },
];

export default function BrowserPanel() {
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [pinging, setPinging] = useState(false);

  const [mode, setMode] = useState<ActionMode>("navigate");
  const [url, setUrl] = useState("https://");
  const [selector, setSelector] = useState("");
  const [typeText, setTypeText] = useState("");
  const [waitFor, setWaitFor] = useState("");

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<BrowserResult | null>(null);
  const [history, setHistory] = useState<Array<{ mode: ActionMode; result: BrowserResult; ts: number }>>([]);
  const [selectedHistory, setSelectedHistory] = useState<number | null>(null);

  const imgRef = useRef<HTMLImageElement>(null);

  const pingBrowser = useAction(api.browser.pingBrowserAgent);
  const adminBrowser = useAction(api.browser.adminBrowser);

  const handlePing = async () => {
    setPinging(true);
    try {
      const r = await pingBrowser({});
      setAgentOnline(r.online);
    } catch {
      setAgentOnline(false);
    } finally {
      setPinging(false);
    }
  };

  const handleRun = async () => {
    setRunning(true);
    setResult(null);
    try {
      const args: Parameters<typeof adminBrowser>[0] = { action: mode };
      if (mode === "navigate") { args.url = url; if (waitFor.trim()) args.waitFor = waitFor.trim(); }
      if (mode === "click")    { args.selector = selector; }
      if (mode === "type")     { args.selector = selector; args.text = typeText; }
      if (mode === "getText")  { args.selector = selector || undefined; }

      const r = await adminBrowser(args);
      setResult(r);
      setHistory(prev => [{ mode, result: r, ts: Date.now() }, ...prev.slice(0, 29)]);
      setSelectedHistory(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const r: BrowserResult = { success: false, errorMessage: msg, durationMs: 0 };
      setResult(r);
    } finally {
      setRunning(false);
    }
  };

  const displayResult = selectedHistory !== null ? history[selectedHistory]?.result : result;
  const displayMode   = selectedHistory !== null ? history[selectedHistory]?.mode   : mode;

  return (
    <div className="space-y-5">

      {/* ── AGENT STATUS BAR ── */}
      <div
        className="panel-inset relative overflow-hidden flex items-center gap-4 px-4 py-3"
        style={{ borderRadius: 6 }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: agentOnline === true ? "#10b981" : agentOnline === false ? "#ef4444" : "#2a2a2a" }}
        />
        <div
          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
          style={{
            background: agentOnline === true ? "#10b981" : agentOnline === false ? "#ef4444" : "#3a3a3a",
            boxShadow: agentOnline === true ? "0 0 8px #10b981" : agentOnline === false ? "0 0 8px #ef4444" : "none",
          }}
        />
        <div className="flex-1">
          <span className="font-mono text-[10px] tracking-widest" style={{ color: agentOnline === true ? "#10b981" : agentOnline === false ? "#ef4444" : "#64748b" }}>
            BROWSER AGENT —&nbsp;
            {agentOnline === null ? "NOT CHECKED" : agentOnline ? "ONLINE" : "OFFLINE / NOT CONFIGURED"}
          </span>
          {agentOnline === false && (
            <p className="font-mono text-[9px] text-workshop-dim mt-0.5">
              Set BROWSER_AGENT_URL + BROWSER_AGENT_SECRET in Convex env vars. Deploy browser-agent to VPS (see browserAgent.md).
            </p>
          )}
        </div>
        <button
          onClick={handlePing}
          disabled={pinging}
          className="btn-forge btn-silver font-mono text-[9px] px-4 py-1.5 flex-shrink-0"
          style={{ borderRadius: 4 }}
        >
          {pinging ? "PINGING..." : "◈ PING AGENT"}
        </button>
      </div>

      <div className="grid lg:grid-cols-5 gap-5">

        {/* ── LEFT: CONTROLS ── */}
        <div className="lg:col-span-2 space-y-4">

          {/* Action selector */}
          <div>
            <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-2">ACTION</p>
            <div className="grid grid-cols-2 gap-1.5">
              {ACTION_DEFS.map((a) => (
                <button
                  key={a.id}
                  onClick={() => setMode(a.id)}
                  className="font-mono text-[9px] px-3 py-2 border transition-all tracking-widest text-left"
                  style={{
                    borderRadius: 4,
                    borderColor: mode === a.id ? a.color : "#2a2a2a",
                    color: mode === a.id ? a.color : "#64748b",
                    background: mode === a.id ? `${a.color}15` : "transparent",
                    boxShadow: mode === a.id ? `0 0 10px ${a.color}25` : "none",
                  }}
                >
                  <span className="block font-bold">{a.label}</span>
                  <span className="block text-[8px] opacity-60 mt-0.5">{a.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Inputs */}
          <div className="space-y-3">
            {(mode === "navigate") && (
              <>
                <Field label="URL" value={url} onChange={setUrl} placeholder="https://example.com" />
                <Field label="WAIT FOR SELECTOR (optional)" value={waitFor} onChange={setWaitFor} placeholder=".main-content" />
              </>
            )}
            {(mode === "click" || mode === "type" || mode === "getText") && (
              <Field
                label="CSS SELECTOR"
                value={selector}
                onChange={setSelector}
                placeholder={mode === "getText" ? "body (leave blank for full page)" : "#submit-btn"}
              />
            )}
            {mode === "type" && (
              <Field label="TEXT TO TYPE" value={typeText} onChange={setTypeText} placeholder="Hello world" />
            )}
          </div>

          {/* Execute */}
          <button
            onClick={handleRun}
            disabled={running || (mode === "navigate" && !url.trim()) || ((mode === "click" || mode === "type") && !selector.trim()) || (mode === "type" && !typeText.trim())}
            className="w-full btn-forge btn-emerald font-mono text-[10px] py-3 tracking-widest"
            style={{ borderRadius: 4 }}
          >
            {running ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                EXECUTING...
              </span>
            ) : (
              `▶ RUN ${ACTION_DEFS.find(a => a.id === mode)?.label}`
            )}
          </button>

          {/* History */}
          {history.length > 0 && (
            <div>
              <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-2">HISTORY ({history.length})</p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {history.map((h, i) => (
                  <button
                    key={h.ts}
                    onClick={() => setSelectedHistory(selectedHistory === i ? null : i)}
                    className="w-full text-left panel-inset hover:bg-white/5 transition-colors"
                    style={{ borderRadius: 4, padding: "6px 10px" }}
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: h.result.success ? "#10b981" : "#ef4444" }}
                      />
                      <span
                        className="font-mono text-[8px] px-1.5 py-0.5 flex-shrink-0"
                        style={{
                          background: `${ACTION_DEFS.find(a => a.id === h.mode)?.color ?? "#64748b"}20`,
                          border: `1px solid ${ACTION_DEFS.find(a => a.id === h.mode)?.color ?? "#64748b"}40`,
                          borderRadius: 2,
                          color: ACTION_DEFS.find(a => a.id === h.mode)?.color ?? "#64748b",
                        }}
                      >
                        {h.mode.toUpperCase()}
                      </span>
                      <span className="font-mono text-[9px] text-workshop-chrome truncate flex-1">
                        {h.result.title ?? h.result.url ?? (h.result.errorMessage ? "ERROR" : "OK")}
                      </span>
                      <span className="font-mono text-[8px] text-workshop-dim flex-shrink-0">
                        {new Date(h.ts).toLocaleTimeString("en-US", { hour12: false })}
                      </span>
                    </div>
                    {selectedHistory === i && h.result.url && (
                      <p className="font-mono text-[8px] text-workshop-dim mt-1 truncate">{h.result.url}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── RIGHT: OUTPUT ── */}
        <div className="lg:col-span-3 space-y-4">

          {/* Screenshot viewport */}
          <div
            className="panel-inset relative overflow-hidden"
            style={{ borderRadius: 6, minHeight: 320 }}
          >
            <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#10b981", boxShadow: "0 0 8px #10b981" }} />

            {/* Browser chrome bar */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{ borderBottom: "1px solid #1a1a1a", background: "rgba(0,0,0,0.5)" }}
            >
              <div className="flex gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#ef4444" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#f59e0b" }} />
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: "#10b981" }} />
              </div>
              <div
                className="flex-1 px-3 py-1 font-mono text-[9px] text-workshop-dim truncate"
                style={{ background: "#0a0a0a", border: "1px solid #1a1a1a", borderRadius: 3 }}
              >
                {displayResult?.url ?? "about:blank"}
              </div>
              {displayResult?.durationMs ? (
                <span className="font-mono text-[8px] text-workshop-dim flex-shrink-0">{displayResult.durationMs}ms</span>
              ) : null}
            </div>

            {/* Viewport content */}
            <div className="relative" style={{ minHeight: 280 }}>
              {running && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10" style={{ background: "rgba(0,0,0,0.85)" }}>
                  <div className="pipe-flow w-32 h-1 rounded" />
                  <p className="font-mono text-[10px] text-emerald-400 tracking-widest animate-pulse">EXECUTING BROWSER ACTION...</p>
                </div>
              )}

              {displayResult?.screenshotBase64 ? (
                <img
                  ref={imgRef}
                  src={`data:image/jpeg;base64,${displayResult.screenshotBase64}`}
                  alt="Browser screenshot"
                  className="w-full block"
                  style={{ imageRendering: "auto" }}
                />
              ) : displayResult?.text ? (
                <div className="p-4">
                  <p className="font-mono text-[9px] text-workshop-muted tracking-widest mb-2">EXTRACTED TEXT</p>
                  <pre className="font-mono text-[10px] text-workshop-chrome whitespace-pre-wrap overflow-auto max-h-96">{displayResult.text}</pre>
                </div>
              ) : displayResult?.errorMessage ? (
                <div className="p-4 flex flex-col items-center justify-center gap-3" style={{ minHeight: 280 }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "#ef444420", border: "1px solid #ef4444" }}>
                    <span className="text-red-400 text-sm">✕</span>
                  </div>
                  <p className="font-mono text-[10px] text-red-400 text-center max-w-xs">{displayResult.errorMessage}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-3" style={{ minHeight: 280 }}>
                  <div className="w-12 h-12 rounded-full flex items-center justify-center opacity-20" style={{ border: "1px solid #2a2a2a" }}>
                    <span className="font-mono text-lg">⬡</span>
                  </div>
                  <p className="font-mono text-[10px] text-workshop-dim tracking-widest">NO SCREENSHOT YET</p>
                  <p className="font-mono text-[9px] text-workshop-dim">Ping agent, then run an action</p>
                </div>
              )}
            </div>
          </div>

          {/* Result metadata */}
          {displayResult && (
            <div className="panel-inset relative overflow-hidden" style={{ borderRadius: 6, padding: "12px 16px" }}>
              <div
                className="absolute top-0 left-0 right-0 h-px"
                style={{ background: displayResult.success ? "#10b981" : "#ef4444" }}
              />
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ background: displayResult.success ? "#10b981" : "#ef4444", boxShadow: `0 0 6px ${displayResult.success ? "#10b981" : "#ef4444"}` }}
                />
                <span className="font-mono text-[10px] tracking-widest" style={{ color: displayResult.success ? "#10b981" : "#ef4444" }}>
                  {displayResult.success ? "SUCCESS" : "FAILED"}
                </span>
                <span
                  className="font-mono text-[8px] px-2 py-0.5"
                  style={{
                    background: `${ACTION_DEFS.find(a => a.id === displayMode)?.color ?? "#64748b"}20`,
                    border: `1px solid ${ACTION_DEFS.find(a => a.id === displayMode)?.color ?? "#64748b"}40`,
                    borderRadius: 2,
                    color: ACTION_DEFS.find(a => a.id === displayMode)?.color ?? "#64748b",
                  }}
                >
                  {displayMode?.toUpperCase()}
                </span>
                <span className="font-mono text-[9px] text-workshop-dim ml-auto">{displayResult.durationMs}ms</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {displayResult.url && (
                  <div>
                    <p className="font-mono text-[8px] text-workshop-dim tracking-widest mb-0.5">URL</p>
                    <p className="font-mono text-[9px] text-workshop-chrome truncate">{displayResult.url}</p>
                  </div>
                )}
                {displayResult.title && (
                  <div>
                    <p className="font-mono text-[8px] text-workshop-dim tracking-widest mb-0.5">TITLE</p>
                    <p className="font-mono text-[9px] text-workshop-chrome truncate">{displayResult.title}</p>
                  </div>
                )}
              </div>
              {displayResult.errorMessage && (
                <p className="font-mono text-[10px] text-red-400 mt-2">{displayResult.errorMessage}</p>
              )}
              {displayResult.screenshotBase64 && (
                <button
                  onClick={() => {
                    const a = document.createElement("a");
                    a.href = `data:image/jpeg;base64,${displayResult.screenshotBase64}`;
                    a.download = `screenshot-${Date.now()}.jpg`;
                    a.click();
                  }}
                  className="mt-3 font-mono text-[9px] text-workshop-muted hover:text-workshop-chrome transition-colors px-3 py-1.5 border border-workshop-dim hover:border-workshop-chrome"
                  style={{ borderRadius: 3 }}
                >
                  ⬇ DOWNLOAD SCREENSHOT
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── DEPLOY INSTRUCTIONS ── */}
      <details className="panel-inset" style={{ borderRadius: 6 }}>
        <summary className="font-mono text-[9px] text-workshop-muted tracking-widest px-4 py-3 cursor-pointer hover:text-workshop-chrome transition-colors">
          ▶ BROWSER AGENT DEPLOY INSTRUCTIONS (VPS SETUP)
        </summary>
        <div className="px-4 pb-4 space-y-3">
          <p className="font-mono text-[9px] text-workshop-muted">SSH into your VPS and run:</p>
          <pre className="font-mono text-[9px] text-emerald-400 bg-black/60 p-3 rounded overflow-x-auto whitespace-pre">{`mkdir -p /root/browser-agent && cd /root/browser-agent
npm init -y
npm install playwright
npx playwright install chromium --with-deps
# Save server.js (see convex/browserAgent.md)
BROWSER_AGENT_SECRET=your-secret pm2 start server.js --name browser-agent
pm2 save`}</pre>
          <p className="font-mono text-[9px] text-workshop-muted">Then set in Convex env vars:</p>
          <div className="space-y-1">
            <code className="font-mono text-[9px] text-amber-400 block">{"BROWSER_AGENT_URL = http://<vps-ip>:7735"}</code>
            <code className="font-mono text-[9px] text-amber-400 block">BROWSER_AGENT_SECRET = your-secret</code>
          </div>
        </div>
      </details>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-black border border-workshop-dim rounded px-3 py-2 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-emerald-500 transition-colors"
        style={{ borderRadius: 4 }}
      />
    </div>
  );
}
