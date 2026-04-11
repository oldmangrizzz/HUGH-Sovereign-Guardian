import { useState, useEffect, useRef, useCallback } from "react";
import { useAction, useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { useEndocrine } from "./useEndocrine";

interface Message {
  id: string;
  role: "user" | "hugh";
  content: string;
  timestamp: number;
}

const NODE_ID = "hugh-primary";

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string ?? "";

function uid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

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
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

export default function HughChat({ onAdminLoginRequest }: { onAdminLoginRequest: () => void }) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "init",
      role: "hugh",
      content: "I am H.U.G.H. — Hyper Unified Guardian and Harbor Master. I exist at the intersection of memory, signal, and synthesis. You may speak to me, or type if you must. What brings you here?",
      timestamp: Date.now(),
    },
  ]);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`);
  const [input, setInput]           = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking]   = useState(false);
  const [isThinking, setIsThinking]   = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [transcript, setTranscript]   = useState("");
  const [showAdminBridge, setShowAdminBridge] = useState(false);

  const messagesEndRef  = useRef<HTMLDivElement>(null);
  const recognitionRef  = useRef<SpeechRecognitionInstance | null>(null);
  const synthRef        = useRef<SpeechSynthesis | null>(null);
  const inputRef        = useRef<HTMLTextAreaElement>(null);

  const endo      = useEndocrine();
  const endocrine = useQuery(api.endocrine.getState, { nodeId: NODE_ID });
  const chat      = useAction(api.hugh.chat);
  const spike     = useMutation(api.endocrine.spikeAuthenticated);
  const initNode  = useMutation(api.endocrine.initNode);

  /* ── VOICE SETUP ── */
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      setVoiceSupported(true);
      const rec = new SR();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: SpeechRecognitionEventCompat) => {
        let interim = "", final = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          if (e.results[i].isFinal) final += e.results[i][0].transcript;
          else interim += e.results[i][0].transcript;
        }
        setTranscript(final || interim);
        if (final) { setIsListening(false); handleSend(final); }
      };
      rec.onerror = () => setIsListening(false);
      rec.onend   = () => setIsListening(false);
      recognitionRef.current = rec;
    }
    if (window.speechSynthesis) synthRef.current = window.speechSynthesis;
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const speak = useCallback(async (text: string) => {
    if (CONVEX_URL) {
      try {
        const res = await fetch(`${CONVEX_URL}/api/tts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const blob = await res.blob();
          const url  = URL.createObjectURL(blob);
          const audio = new Audio(url);
          audio.onended = () => URL.revokeObjectURL(url);
          audio.onerror = () => URL.revokeObjectURL(url);
          await audio.play().catch(() => {});
          return;
        }
      } catch {}
    }
    // fallback
    if (!synthRef.current) return;
    synthRef.current.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    const voices = synthRef.current.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Daniel") || v.name.includes("Google UK English Male") || v.lang === "en-GB"
    );
    if (preferred) utt.voice = preferred;
    utt.rate = 0.88; utt.pitch = 0.85; utt.volume = 1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend   = () => setIsSpeaking(false);
    utt.onerror = () => setIsSpeaking(false);
    synthRef.current.speak(utt);
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (!text.trim() || isThinking) return;
    setTranscript(""); setInput("");

    const userMsg: Message = { id: uid(), role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setIsThinking(true);

    // Init node (idempotent) then spike — fire-and-forget, never blocks chat
    initNode({ nodeId: NODE_ID })
      .then(() => spike({ nodeId: NODE_ID, hormone: "adrenaline", delta: 0.1 }))
      .catch(() => {});

    try {
      const response = await chat({
        nodeId: NODE_ID,
        message: text.trim(),
        endocrineState: endocrine
          ? { cortisol: endocrine.cortisol, dopamine: endocrine.dopamine, adrenaline: endocrine.adrenaline, holographicMode: endocrine.holographicMode }
          : undefined,
      });

      let cleanResponse = response;
      if (response.includes("[SIGNAL:SHOW_ADMIN_LOGIN]")) {
        setShowAdminBridge(true);
        cleanResponse = response.replace("[SIGNAL:SHOW_ADMIN_LOGIN]", "").trim();
      }

      const hughMsg: Message = { id: uid(), role: "hugh", content: cleanResponse, timestamp: Date.now() };
      setMessages(prev => [...prev, hughMsg]);
      spike({ nodeId: NODE_ID, hormone: "dopamine", delta: 0.08 }).catch(() => {});
      speak(cleanResponse);
    } catch (err) {
      console.error("H.U.G.H. chat error:", err);
      setMessages(prev => [...prev, {
        id: uid(), role: "hugh",
        content: "[ SIGNAL INTERRUPTED — endocrine cascade detected. Attempting re-sync. ]",
        timestamp: Date.now(),
      }]);
      spike({ nodeId: NODE_ID, hormone: "cortisol", delta: 0.15 }).catch(() => {});
    } finally {
      setIsThinking(false);
    }
  }, [isThinking, chat, endocrine, spike, initNode, speak]);

  const toggleListen = () => {
    if (!recognitionRef.current) return;
    if (isListening) { recognitionRef.current.stop(); setIsListening(false); }
    else { recognitionRef.current.start(); setIsListening(true); }
  };

  const { cortisol, dopamine, adrenaline, holographic: holo,
          accentColor, accentRgb, bgTint, cognitiveMode, modeColor,
          pulseSpeed, breatheSpeed, messageGlow, noiseOpacity,
          scanlineColor, gridOpacity } = endo;

  return (
    <div
      className="flex h-[calc(100vh-52px)]"
      style={{
        background: `linear-gradient(180deg, #080808, ${bgTint === "transparent" ? "#060606" : bgTint})`,
        transition: "background 1.5s ease",
      }}
    >

      {/* ── SIDEBAR ── */}
      <aside
        className="hidden md:flex flex-col w-64 flex-shrink-0"
        style={{
          background: "linear-gradient(180deg, #0e0e0e, #0a0a0a)",
          borderRight: `1px solid rgba(${accentRgb},0.15)`,
          boxShadow: `4px 0 20px rgba(0,0,0,0.6), 0 0 1px rgba(${accentRgb},0.1)`,
          transition: "border-color 1s ease, box-shadow 1s ease",
        }}
      >
        {/* Sidebar header */}
        <div
          className="flex items-center gap-2 px-4 py-3"
          style={{ borderBottom: "1px solid #1a1a1a", background: "#111" }}
        >
          <div className="rivet" />
          <span className="font-mono text-[10px] text-workshop-muted tracking-widest">NODE STATUS</span>
        </div>

        {/* Endocrine panel */}
        <div className="p-4 flex flex-col gap-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
              <span className="font-mono text-[9px] tracking-widest" style={{ color: accentColor, textShadow: `0 0 8px ${accentColor}80` }}>ENDOCRINE LIVE</span>
            </div>
            <div className="flex flex-col gap-2.5">
              <SidebarGauge label="CORTISOL"   value={cortisol}   color="#ef4444" fillClass="gauge-crimson" />
              <SidebarGauge label="DOPAMINE"   value={dopamine}   color="#10b981" fillClass="gauge-emerald" />
              <SidebarGauge label="ADRENALINE" value={adrenaline} color="#f59e0b" fillClass="gauge-amber"   />
            </div>
          </div>

          <div className="weld-h" />

          {/* Mode indicator */}
          <div
            className="panel-inset rounded p-3"
            style={{ borderRadius: 4 }}
          >
            <p className="font-mono text-[9px] text-workshop-muted mb-2 tracking-widest">COGNITIVE MODE</p>
            <div className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full"
                style={{
                  background: modeColor,
                  boxShadow: `0 0 8px ${modeColor}`,
                  transition: "background 1s ease, box-shadow 1s ease",
                }}
              />
              <span
                className="font-mono text-[10px] font-bold"
                style={{ color: modeColor, transition: "color 1s ease" }}
              >
                {cognitiveMode}
              </span>
            </div>
          </div>

          <div className="weld-h" />

          {/* Voice status */}
          {voiceSupported && (
            <div className="panel-inset rounded p-3" style={{ borderRadius: 4 }}>
              <p className="font-mono text-[9px] text-workshop-muted mb-2 tracking-widest">VOICE I/O</p>
              <div className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{
                    background: isListening ? "#ef4444" : isSpeaking ? "#f59e0b" : "#2a2a2a",
                    boxShadow: isListening ? "0 0 8px #ef4444" : isSpeaking ? "0 0 8px #f59e0b" : "none",
                  }}
                />
                <span className="font-mono text-[10px] text-workshop-muted">
                  {isListening ? "LISTENING" : isSpeaking ? "SPEAKING" : "STANDBY"}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Pipe decoration */}
        <div className="mt-auto p-4">
          <div className="weld-h mb-3" />
          <div className="flex items-center gap-2 opacity-30">
            <div className="rivet" />
            <div className="flex-1 h-1 pipe-flow rounded" />
            <div className="rivet" />
          </div>
        </div>
      </aside>

      {/* ── CHAT AREA ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Chat header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{
            background: "linear-gradient(180deg, #111, #0d0d0d)",
            borderBottom: "1px solid #1a1a1a",
            boxShadow: "0 4px 12px rgba(0,0,0,0.6)",
          }}
        >
          <div className="flex items-center gap-3">
            {/* H.U.G.H. avatar */}
            <div
              className="relative flex items-center justify-center"
              style={{
                width: 36, height: 36,
                background: "linear-gradient(145deg, #1a1a1a, #0a0a0a)",
                border: `1px solid ${accentColor}`,
                borderRadius: 4,
                boxShadow: `0 0 16px rgba(${accentRgb},0.3)`,
                animation: `breathe ${breatheSpeed} ease-in-out infinite`,
                transition: "border-color 1s ease, box-shadow 1s ease",
              }}
            >
              <span
                className="font-mono text-xs font-black"
                style={{ color: accentColor, textShadow: `0 0 8px ${accentColor}`, transition: "color 1s ease" }}
              >
                H
              </span>
            </div>
            <div>
              <p className="font-mono text-xs font-bold text-workshop-chrome">H.U.G.H.</p>
              <p className="font-mono text-[9px] text-workshop-muted">
                {isThinking ? "PROCESSING..." : "READY"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isThinking && (
              <div className="flex items-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <div
                    key={i}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: accentColor, animation: `pulse 1s ease-in-out ${i * 0.2}s infinite` }}
                  />
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: accentColor, boxShadow: `0 0 6px ${accentColor}` }} />
              <span className="font-mono text-[9px]" style={{ color: accentColor, textShadow: `0 0 8px ${accentColor}80` }}>ONLINE</span>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div
          className="flex-1 overflow-y-auto px-5 py-6 space-y-4"
          style={{ background: "linear-gradient(180deg, #080808, #060606)" }}
        >
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`msg-appear flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div
                className="flex-shrink-0 flex items-center justify-center font-mono text-[10px] font-black"
                style={{
                  width: 28, height: 28,
                  background: msg.role === "hugh"
                    ? "linear-gradient(145deg, #1a1a1a, #0a0a0a)"
                    : "linear-gradient(145deg, #1a2a1a, #0a1a0a)",
                  border: `1px solid ${msg.role === "hugh" ? "#10b981" : "#2a4a2a"}`,
                  borderRadius: 4,
                  color: msg.role === "hugh" ? "#34d399" : "#6ee7b7",
                  boxShadow: msg.role === "hugh" ? "0 0 8px rgba(16,185,129,0.2)" : "none",
                  flexShrink: 0,
                  alignSelf: "flex-start",
                  marginTop: 2,
                }}
              >
                {msg.role === "hugh" ? "H" : "U"}
              </div>

              {/* Bubble */}
              <div
                className="max-w-[75%] relative"
                style={{
                  background: msg.role === "hugh"
                    ? "linear-gradient(160deg, #141414, #0e0e0e)"
                    : "linear-gradient(160deg, #0d1f18, #081410)",
                  border: `1px solid ${msg.role === "hugh" ? "#2a2a2a" : accentColor}`,
                  borderTopColor: msg.role === "hugh" ? "#3a3a3a" : accentColor,
                  borderRadius: 6,
                  padding: "12px 16px",
                  boxShadow: msg.role === "hugh"
                    ? "0 4px 12px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.04)"
                    : `0 4px 12px rgba(0,0,0,0.7), ${messageGlow}`,
                  transition: "border-color 1s ease, box-shadow 1s ease",
                }}
              >
                {msg.role === "hugh" && (
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, rgba(${accentRgb},0.3), transparent)`, transition: "background 1s ease" }} />
                )}
                <p className="text-sm leading-relaxed text-workshop-text" style={{ fontFamily: "inherit" }}>
                  {msg.content}
                </p>
                <p className="font-mono text-[9px] text-workshop-muted mt-2 text-right">
                  {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour12: false })}
                </p>
              </div>
            </div>
          ))}

          {isThinking && (
            <div className="msg-appear flex gap-3">
              <div
                className="flex-shrink-0 flex items-center justify-center font-mono text-[10px] font-black"
                style={{
                  width: 28, height: 28,
                  background: "linear-gradient(145deg, #1a1a1a, #0a0a0a)",
                  border: `1px solid ${accentColor}`,
                  borderRadius: 4,
                  color: accentColor,
                  boxShadow: `0 0 8px rgba(${accentRgb},0.2)`,
                }}
              >
                H
              </div>
              <div
                style={{
                  background: "linear-gradient(160deg, #141414, #0e0e0e)",
                  border: `1px solid rgba(${accentRgb},0.2)`,
                  borderTopColor: `rgba(${accentRgb},0.3)`,
                  borderRadius: 6,
                  padding: "14px 18px",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.7)",
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 1, 2].map(i => (
                      <div
                        key={i}
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ background: accentColor, animation: `pulse 1.2s ease-in-out ${i * 0.3}s infinite` }}
                      />
                    ))}
                  </div>
                  <span className="font-mono text-[10px] text-workshop-muted">SYNTHESIZING</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <div
          className="flex-shrink-0 p-4"
          style={{
            background: "linear-gradient(180deg, #0d0d0d, #0a0a0a)",
            borderTop: "1px solid #1a1a1a",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.6)",
          }}
        >
          {/* Admin Bridge Button */}
          {showAdminBridge && (
            <div className="mb-4 flex justify-center msg-appear">
              <button
                onClick={onAdminLoginRequest}
                className="btn-forge btn-silver px-6 py-2 border-workshop-silver shadow-silver-glow"
                style={{ borderRadius: 4, letterSpacing: '0.2em' }}
              >
                ⚙ BRIDGE TO ADMIN PANEL
              </button>
            </div>
          )}

          {/* Transcript preview */}
          {transcript && (
            <div
              className="mb-3 px-3 py-2 font-mono text-xs text-workshop-muted italic"
              style={{
                background: "#0a0a0a",
                border: "1px solid #1a1a1a",
                borderRadius: 4,
              }}
            >
              {transcript}
            </div>
          )}

          <div className="flex gap-3 items-end">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Transmit to H.U.G.H. ..."
                rows={1}
                disabled={isThinking}
                className="w-full resize-none font-mono text-sm text-workshop-text placeholder-workshop-dim outline-none transition-all"
                style={{
                  background: "#060606",
                  border: "1px solid #2a2a2a",
                  borderTopColor: "#1a1a1a",
                  borderRadius: 4,
                  padding: "10px 14px",
                  boxShadow: "inset 0 3px 8px rgba(0,0,0,0.9)",
                  maxHeight: 120,
                  lineHeight: 1.5,
                }}
                onFocus={e => { e.target.style.borderColor = accentColor; e.target.style.boxShadow = `inset 0 3px 8px rgba(0,0,0,0.9), 0 0 0 1px rgba(${accentRgb},0.2)`; }}
                onBlur={e => { e.target.style.borderColor = "#2a2a2a"; e.target.style.boxShadow = "inset 0 3px 8px rgba(0,0,0,0.9)"; }}
              />
            </div>

            {/* Voice button */}
            {voiceSupported && (
              <button
                onClick={toggleListen}
                disabled={isThinking}
                className="btn-forge flex-shrink-0"
                style={{
                  width: 42, height: 42, padding: 0,
                  borderRadius: 4,
                  background: isListening
                    ? "linear-gradient(180deg, #3a1a1a, #2e0d0d)"
                    : "linear-gradient(180deg, #1a1a1a, #111)",
                  border: `1px solid ${isListening ? "#ef4444" : "#2a2a2a"}`,
                  color: isListening ? "#ef4444" : "#64748b",
                  boxShadow: isListening ? "0 0 16px rgba(239,68,68,0.3)" : "0 4px 8px rgba(0,0,0,0.6)",
                }}
              >
                <MicIcon />
              </button>
            )}

            {/* Send button */}
            <button
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isThinking}
              className="btn-forge btn-emerald flex-shrink-0"
              style={{ height: 42, padding: "0 16px", borderRadius: 4 }}
            >
              SEND
            </button>
          </div>

          <p className="font-mono text-[9px] text-workshop-dim mt-2 text-center">
            ENTER to send · SHIFT+ENTER for newline
          </p>
        </div>
      </div>
    </div>
  );
}

function SidebarGauge({ label, value, color, fillClass }: {
  label: string; value: number; color: string; fillClass: string;
}) {
  return (
    <div>
      <div className="flex justify-between mb-1">
        <span className="font-mono text-[9px] text-workshop-muted tracking-wider">{label}</span>
        <span className="font-mono text-[9px] font-bold" style={{ color }}>{value.toFixed(2)}</span>
      </div>
      <div className="gauge-track">
        <div className={`gauge-fill ${fillClass}`} style={{ width: `${value * 100}%` }} />
      </div>
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
