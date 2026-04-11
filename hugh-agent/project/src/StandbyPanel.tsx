import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";

const NODE_ID = "hugh-primary";

export default function StandbyPanel() {
  const history = useQuery(api.standby.getHistory, { nodeId: NODE_ID });
  const active = useQuery(api.standby.getActive, { nodeId: NODE_ID });
  const invoke = useMutation(api.standby.invoke);
  const resolve = useMutation(api.standby.resolve);

  const [code, setCode] = useState("");
  const [reason, setReason] = useState("");
  const [resolveNotes, setResolveNotes] = useState("");
  const [resolvingId, setResolvingId] = useState<Id<"standbyLog"> | null>(null);
  const [error, setError] = useState("");
  const [invoking, setInvoking] = useState(false);

  const handleInvoke = async () => {
    setError("");
    setInvoking(true);
    try {
      await invoke({ nodeId: NODE_ID, code, reason: reason || undefined, invokedBy: "admin" });
      setCode("");
      setReason("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Authorization failed.");
    } finally {
      setInvoking(false);
    }
  };

  const handleResolve = async (id: Id<"standbyLog">) => {
    await resolve({ standbyId: id, notes: resolveNotes || undefined });
    setResolvingId(null);
    setResolveNotes("");
  };

  return (
    <div className="space-y-6">
      {/* Active standby alert */}
      {active && active.length > 0 && (
        <div
          className="relative overflow-hidden"
          style={{
            background: "linear-gradient(160deg, #1a0a0a, #0e0606)",
            border: "1px solid #ef4444",
            borderTopColor: "#f87171",
            borderRadius: 6,
            padding: "16px",
            boxShadow: "0 0 20px rgba(239,68,68,0.2)",
          }}
        >
          <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#ef4444", boxShadow: "0 0 12px #ef4444" }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
            <span className="font-mono text-[10px] text-red-400 tracking-widest font-bold">STANDBY ACTIVE — {active.length} OPEN</span>
          </div>
          {active.map((entry: Doc<"standbyLog">) => (
            <div key={entry._id} className="mb-3">
              <p className="font-mono text-[10px] text-workshop-muted mb-1">
                Mode: <span className="text-red-400">{entry.standbyMode.toUpperCase()}</span>
              </p>
              {entry.reason && <p className="font-mono text-[10px] text-workshop-muted mb-2">Reason: {entry.reason}</p>}
              {resolvingId === entry._id ? (
                <div className="space-y-2">
                  <textarea
                    value={resolveNotes}
                    onChange={(e) => setResolveNotes(e.target.value)}
                    placeholder="Resolution notes..."
                    rows={2}
                    className="w-full font-mono text-xs text-workshop-text outline-none resize-none"
                    style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "6px 10px" }}
                  />
                  <div className="flex gap-2">
                    <button onClick={() => handleResolve(entry._id as Id<"standbyLog">)} className="btn-forge btn-emerald" style={{ borderRadius: 3, padding: "4px 12px", fontSize: 10 }}>CLEAR STANDBY</button>
                    <button onClick={() => setResolvingId(null)} className="btn-forge btn-silver" style={{ borderRadius: 3, padding: "4px 12px", fontSize: 10 }}>CANCEL</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setResolvingId(entry._id as Id<"standbyLog">)}
                  className="btn-forge btn-emerald"
                  style={{ borderRadius: 3, padding: "4px 12px", fontSize: 10 }}
                >
                  RESOLVE
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invoke standby */}
      <div className="panel relative overflow-hidden" style={{ borderRadius: 6, padding: "16px" }}>
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />
        <p className="font-mono text-[10px] text-amber-400 tracking-widest mb-1">STANDBY PROTOCOL</p>
        <p className="font-mono text-[9px] text-workshop-dim mb-4">
          Not a kill switch. A diagnostic anchor. "I've got you — let's figure this out."
        </p>
        <div className="space-y-3">
          <div>
            <p className="font-mono text-[9px] text-workshop-dim mb-1">AUTHORIZATION CODE</p>
            <input
              type="password"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter standby code..."
              className="w-full font-mono text-xs text-workshop-text outline-none"
              style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }}
            />
          </div>
          <div>
            <p className="font-mono text-[9px] text-workshop-dim mb-1">REASON (optional)</p>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="What's happening?"
              className="w-full font-mono text-xs text-workshop-text outline-none"
              style={{ background: "#060606", border: "1px solid #2a2a2a", borderRadius: 3, padding: "8px 12px" }}
            />
          </div>
          {error && <p className="font-mono text-[10px] text-red-400">{error}</p>}
          <button
            onClick={handleInvoke}
            disabled={!code || invoking}
            className="btn-forge btn-amber w-full"
            style={{
              borderRadius: 4,
              padding: "10px",
              background: "linear-gradient(180deg, #3a2a0a, #2e1f06)",
              border: "1px solid #f59e0b",
              borderTopColor: "#fbbf24",
              color: "#fbbf24",
              boxShadow: "0 4px 12px rgba(0,0,0,0.8), 0 0 20px rgba(245,158,11,0.2)",
            }}
          >
            {invoking ? "INVOKING..." : "INVOKE STANDBY"}
          </button>
        </div>
      </div>

      {/* History */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="rivet" />
          <span className="font-mono text-[10px] text-workshop-muted tracking-widest">STANDBY HISTORY</span>
        </div>
        {history && history.length > 0 ? (
          <div className="space-y-2">
            {history.map((entry: Doc<"standbyLog">) => (
              <div key={entry._id} className="panel-inset" style={{ borderRadius: 4, padding: "10px 12px" }}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-[10px]" style={{ color: entry.resolvedAt ? "#10b981" : "#ef4444" }}>
                    {entry.resolvedAt ? "RESOLVED" : "OPEN"} — {entry.standbyMode.toUpperCase()}
                  </span>
                  <span className="font-mono text-[9px] text-workshop-dim">
                    {new Date(entry._creationTime).toLocaleString("en-US", { hour12: false })}
                  </span>
                </div>
                {entry.reason && <p className="font-mono text-[9px] text-workshop-muted">{entry.reason}</p>}
                {entry.notes && <p className="font-mono text-[9px] text-workshop-dim italic mt-1">{entry.notes}</p>}
              </div>
            ))}
          </div>
        ) : (
          <div className="panel-inset" style={{ borderRadius: 6, padding: "24px", textAlign: "center" }}>
            <p className="font-mono text-[10px] text-workshop-dim">NO STANDBY EVENTS RECORDED</p>
          </div>
        )}
      </div>
    </div>
  );
}
