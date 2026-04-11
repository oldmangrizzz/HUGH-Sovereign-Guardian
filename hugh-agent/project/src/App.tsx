import { useState, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Toaster } from "sonner";
import PublicLanding from "./PublicLanding";
import AdminDashboard from "./AdminDashboard";
import HughChat from "./HughChat";
import TacticalMap from "./TacticalMap";
import AdminLogin from "./AdminLogin";
import HughKioskDisplay from "./HughKioskDisplay";
import { useEndocrine } from "./useEndocrine";

type View = "landing" | "chat" | "admin" | "map" | "kiosk";

export default function App() {
  const [view, setView] = useState<View>(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("kiosk") === "1") return "kiosk";
    if (window.location.hostname === "workshop.grizzlymedicine.icu") return "kiosk";
    return "landing";
  });
  const endo = useEndocrine();

  // ── Admin auth state ──────────────────────────────────────────────────────
  const [adminToken, setAdminToken] = useState<string | null>(() =>
    sessionStorage.getItem("hugh_admin_token")
  );
  const [tokenChecked, setTokenChecked] = useState(false);

  const validateAdminToken = useAction(api.adminAuth.validateAdminToken);

  // On mount, validate any stored token
  useEffect(() => {
    const stored = sessionStorage.getItem("hugh_admin_token");
    if (!stored) {
      setTokenChecked(true);
      return;
    }
    validateAdminToken({ token: stored })
      .then((r) => {
        if (!r.valid) {
          sessionStorage.removeItem("hugh_admin_token");
          setAdminToken(null);
        } else {
          setAdminToken(stored);
        }
      })
      .catch(() => {
        sessionStorage.removeItem("hugh_admin_token");
        setAdminToken(null);
      })
      .finally(() => setTokenChecked(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdminLogin = (token: string) => {
    setAdminToken(token);
  };

  const handleAdminLogout = () => {
    sessionStorage.removeItem("hugh_admin_token");
    setAdminToken(null);
    setView("landing");
  };

  const isAdmin = !!adminToken;

  return (
    <div className="min-h-screen bg-workshop-forge text-workshop-text">
      <div
        className="scanline"
        style={{ background: `linear-gradient(90deg, transparent, ${endo.scanlineColor}, transparent)` }}
      />
      <div
        className="noise-overlay"
        style={{ opacity: endo.noiseOpacity * 0.6 }}
      />

      {/* ── NAV ── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-5 py-0"
        style={{
          background: "linear-gradient(180deg, #111 0%, #0d0d0d 100%)",
          borderBottom: "1px solid #2a2a2a",
          boxShadow: "0 4px 20px rgba(0,0,0,0.9), inset 0 -1px 0 rgba(255,255,255,0.04)",
          height: "52px",
        }}
      >
        {/* Logo */}
        <button
          onClick={() => setView("landing")}
          className="flex items-center gap-3 group"
        >
          <div
            className="relative flex items-center justify-center"
            style={{
              width: 36, height: 36,
              background: "linear-gradient(145deg, #1e1e1e, #0a0a0a)",
              border: "1px solid #3a3a3a",
              borderTopColor: "#4a4a4a",
              borderRadius: 4,
              boxShadow: "0 4px 8px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)",
            }}
          >
            <span className="font-mono text-xs font-black glow-emerald">GM</span>
            <div className="rivet absolute" style={{ top: 2, left: 2, width: 4, height: 4 }} />
            <div className="rivet absolute" style={{ top: 2, right: 2, width: 4, height: 4 }} />
            <div className="rivet absolute" style={{ bottom: 2, left: 2, width: 4, height: 4 }} />
            <div className="rivet absolute" style={{ bottom: 2, right: 2, width: 4, height: 4 }} />
          </div>
          <div className="flex flex-col items-start">
            <span className="font-mono text-xs font-bold text-workshop-chrome leading-none">GRIZZLY MEDICINE</span>
            <span className="font-mono text-[9px] text-workshop-pewter leading-none tracking-widest mt-0.5">THE WORKSHOP</span>
          </div>
        </button>

        {/* Weld seam center decoration */}
        <div className="hidden md:flex items-center gap-1 opacity-30">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="w-1 h-1 rounded-full bg-workshop-pewter" />
          ))}
        </div>

        {/* Nav buttons */}
        <div className="flex items-center gap-2">
          <NavBtn active={view === "map"} color="amber" onClick={() => setView("map")}>
            ⬡ TACTICAL
          </NavBtn>

          <NavBtn active={view === "chat"} color="emerald" onClick={() => setView("chat")}>
            ◈ H.U.G.H.
          </NavBtn>

          {isAdmin && (
            <NavBtn active={view === "admin"} color="silver" onClick={() => setView("admin")}>
              ⚙ ADMIN
            </NavBtn>
          )}

          {isAdmin && (
            <button
              onClick={handleAdminLogout}
              className="font-mono text-[10px] px-3 py-1.5 rounded border transition-all tracking-widest border-red-900 text-red-500 hover:border-red-700 hover:text-red-400"
            >
              ⏻ LOCK
            </button>
          )}
        </div>
      </nav>

      {/* ── CONTENT ── */}
      <main className="pt-[52px]">
        {view === "landing" && <PublicLanding onEnter={() => setView("chat")} />}
        {view === "chat"    && <HughChat onAdminLoginRequest={() => setView("admin")} />}
        {view === "map"     && <TacticalMap />}
        {view === "kiosk"   && <HughKioskDisplay />}
        {view === "admin"   && (
          tokenChecked ? (
            isAdmin
              ? <AdminDashboard onLogout={handleAdminLogout} onKiosk={() => setView("kiosk")} />
              : <AdminLogin onSuccess={handleAdminLogin} />
          ) : (
            <div className="min-h-screen flex items-center justify-center" style={{ background: "#080808" }}>
              <div className="flex flex-col items-center gap-3">
                <div className="pipe-flow w-32 h-1 rounded" />
                <p className="font-mono text-[10px] text-workshop-muted tracking-widest animate-pulse">VERIFYING SESSION...</p>
              </div>
            </div>
          )
        )}
      </main>

      <Toaster
        theme="dark"
        toastOptions={{
          style: {
            background: "#111",
            border: "1px solid #2a2a2a",
            color: "#e2e8f0",
            fontFamily: "JetBrains Mono, monospace",
            fontSize: "11px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.9)",
          },
        }}
      />
    </div>
  );
}

function NavBtn({
  children, active, color, onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  color: "emerald" | "silver" | "crimson" | "amber";
  onClick: () => void;
}) {
  const colors = {
    emerald: {
      active:   "border-workshop-emerald text-workshop-emerald-bright bg-workshop-emerald/10 shadow-emerald-glow",
      inactive: "border-workshop-dim text-workshop-muted hover:border-workshop-emerald/40 hover:text-workshop-emerald",
    },
    silver: {
      active:   "border-workshop-silver text-workshop-chrome bg-workshop-silver/10",
      inactive: "border-workshop-dim text-workshop-muted hover:border-workshop-silver/40 hover:text-workshop-chrome",
    },
    crimson: {
      active:   "border-workshop-crimson text-workshop-crimson-bright bg-workshop-crimson/10 shadow-crimson-glow",
      inactive: "border-workshop-dim text-workshop-muted hover:border-workshop-crimson/40 hover:text-workshop-crimson-bright",
    },
    amber: {
      active:   "border-amber-500 text-amber-400 bg-amber-500/10",
      inactive: "border-workshop-dim text-workshop-muted hover:border-amber-500/40 hover:text-amber-400",
    },
  };
  return (
    <button
      onClick={onClick}
      className={`font-mono text-[10px] px-3 py-1.5 rounded border transition-all tracking-widest ${
        active ? colors[color].active : colors[color].inactive
      }`}
    >
      {children}
    </button>
  );
}
