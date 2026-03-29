import { useState } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";

export default function AdminLogin({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const verifyAdmin = useAction(api.adminAuth.verifyAdmin);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    setError("");
    try {
      const result = await verifyAdmin({ username: username.trim(), password });
      if (result.ok && result.token) {
        sessionStorage.setItem("hugh_admin_token", result.token);
        onSuccess(result.token);
      } else {
        setError("ACCESS DENIED — INVALID CREDENTIALS");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Authentication error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-8 workshop-grid" style={{ background: "#080808" }}>
      <div
        className="panel-raised w-full max-w-sm relative"
        style={{ borderRadius: 8 }}
      >
        {/* Corner rivets */}
        <div className="rivet-lg absolute" style={{ top: 10, left: 10 }} />
        <div className="rivet-lg absolute" style={{ top: 10, right: 10 }} />
        <div className="rivet-lg absolute" style={{ bottom: 10, left: 10 }} />
        <div className="rivet-lg absolute" style={{ bottom: 10, right: 10 }} />

        {/* Hazard stripe header */}
        <div className="hazard-stripe h-1.5 rounded-t -mx-0" style={{ borderRadius: "8px 8px 0 0" }} />

        <div className="p-8">
          {/* Header */}
          <div className="text-center mb-6">
            <div className="flex items-center justify-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="font-mono text-[10px] text-red-400 tracking-widest">RESTRICTED ACCESS</span>
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            </div>
            <div
              className="inline-flex items-center justify-center mb-3"
              style={{
                width: 56, height: 56,
                background: "linear-gradient(145deg, #1e1e1e, #0a0a0a)",
                border: "1px solid #3a3a3a",
                borderTopColor: "#4a4a4a",
                borderRadius: 6,
                boxShadow: "0 4px 12px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <span className="font-mono text-xl font-black glow-emerald">GM</span>
            </div>
            <h2 className="font-mono text-sm font-black glow-silver tracking-widest">ADMIN PORTAL</h2>
            <p className="font-mono text-[9px] text-workshop-muted mt-1 tracking-widest">H.U.G.H. CONTROL SYSTEM</p>
          </div>

          <div className="weld-h mb-6" />

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1.5">
                USERNAME
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                placeholder="admin"
                className="w-full bg-black border border-workshop-dim px-3 py-2.5 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-emerald-500 transition-colors"
                style={{ borderRadius: 4 }}
              />
            </div>

            <div>
              <label className="font-mono text-[9px] text-workshop-muted tracking-widest block mb-1.5">
                PASSWORD
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                placeholder="••••••••"
                className="w-full bg-black border border-workshop-dim px-3 py-2.5 font-mono text-xs text-workshop-chrome focus:outline-none focus:border-emerald-500 transition-colors"
                style={{ borderRadius: 4 }}
              />
            </div>

            {error && (
              <div
                className="panel-inset relative overflow-hidden px-3 py-2"
                style={{ borderRadius: 4 }}
              >
                <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#ef4444" }} />
                <p className="font-mono text-[9px] text-red-400 tracking-widest">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim() || !password.trim()}
              className="w-full btn-forge btn-emerald font-mono text-[10px] py-3 tracking-widest"
              style={{ borderRadius: 4 }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  AUTHENTICATING...
                </span>
              ) : (
                "⚿ AUTHENTICATE"
              )}
            </button>
          </form>

          <div className="weld-h mt-6" />
          <p className="font-mono text-[8px] text-workshop-dim text-center tracking-widest mt-3">
            GRIZZLY MEDICINE LAB — AUTHORIZED PERSONNEL ONLY
          </p>
        </div>
      </div>
    </div>
  );
}
