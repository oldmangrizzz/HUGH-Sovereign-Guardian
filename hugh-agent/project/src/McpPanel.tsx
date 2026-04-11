import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Doc, Id } from "../convex/_generated/dataModel";

const NODE_ID = "hugh-primary";

const ZONE_COLORS: Record<string, string> = {
  green: "#10b981",
  yellow: "#f59e0b",
  red: "#ef4444",
};

export default function McpPanel() {
  const tools = useQuery(api.mcp.listAllTools);
  const callLog = useQuery(api.mcp.getCallLog, { nodeId: NODE_ID, limit: 20 });
  const setToolEnabled = useMutation(api.mcp.setToolEnabled);

  return (
    <div className="space-y-6">
      {/* Infrastructure boundary notice */}
      <div
        className="panel-inset relative overflow-hidden"
        style={{ borderRadius: 6, padding: "12px 16px" }}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: "#f59e0b", boxShadow: "0 0 8px #f59e0b" }} />
        <div className="flex items-start gap-3">
          <span className="font-mono text-[10px] text-amber-400 mt-0.5">⚠</span>
          <div>
            <p className="font-mono text-[10px] text-amber-400 font-bold tracking-widest mb-1">INFRASTRUCTURE BOUNDARY ACTIVE</p>
            <p className="font-mono text-[9px] text-workshop-muted">
              All MCP tool calls are restricted to Grizzly Medicine infrastructure. No external API calls. Identity and knowledge protection is non-negotiable.
            </p>
          </div>
        </div>
      </div>

      {/* Tool registry */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="rivet" />
          <span className="font-mono text-[10px] text-workshop-muted tracking-widest">REGISTERED TOOLS</span>
        </div>
        {tools && tools.length > 0 ? (
          <div className="space-y-2">
            {tools.map((tool: Doc<"mcpTools">) => {
              const zoneColor = ZONE_COLORS[tool.zone] ?? "#64748b";
              return (
                <div key={tool._id} className="panel relative overflow-hidden" style={{ borderRadius: 6, padding: "12px 14px" }}>
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: zoneColor, boxShadow: `0 0 6px ${zoneColor}` }} />
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-workshop-chrome font-bold">{tool.name}</span>
                        <span className="font-mono text-[8px] px-1.5 py-0.5" style={{ background: `${zoneColor}20`, border: `1px solid ${zoneColor}40`, borderRadius: 2, color: zoneColor }}>
                          {tool.zone.toUpperCase()}
                        </span>
                        {tool.requiresAuth && (
                          <span className="font-mono text-[8px] px-1.5 py-0.5" style={{ background: "#1a1a1a", border: "1px solid #2a2a2a", borderRadius: 2, color: "#64748b" }}>
                            AUTH
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-workshop-muted mb-1">{tool.description}</p>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[9px] text-workshop-dim">calls: {tool.callCount}</span>
                        {tool.lastCalledAt && (
                          <span className="font-mono text-[9px] text-workshop-dim">
                            last: {new Date(tool.lastCalledAt).toLocaleTimeString("en-US", { hour12: false })}
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setToolEnabled({ toolId: tool._id as Id<"mcpTools">, enabled: !tool.enabled })}
                      className={`btn-forge flex-shrink-0 ${tool.enabled ? "btn-crimson" : "btn-emerald"}`}
                      style={{ borderRadius: 3, padding: "4px 10px", fontSize: 9 }}
                    >
                      {tool.enabled ? "DISABLE" : "ENABLE"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel-inset" style={{ borderRadius: 6, padding: "24px", textAlign: "center" }}>
            <p className="font-mono text-[10px] text-workshop-dim">NO TOOLS REGISTERED</p>
            <p className="font-mono text-[9px] text-workshop-dim mt-1">Tools are registered programmatically via the MCP scaffold</p>
          </div>
        )}
      </div>

      {/* Call log */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <div className="rivet" />
          <span className="font-mono text-[10px] text-workshop-muted tracking-widest">CALL LOG — LAST 20</span>
        </div>
        {callLog && callLog.length > 0 ? (
          <div className="space-y-1">
            {callLog.map((entry: Doc<"mcpCallLog">) => {
              const zoneColor = ZONE_COLORS[entry.zone] ?? "#64748b";
              return (
                <div key={entry._id} className="panel-inset" style={{ borderRadius: 4, padding: "8px 12px" }}>
                  <div className="flex items-center gap-3">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: entry.success ? "#10b981" : "#ef4444" }} />
                    <span className="font-mono text-[10px] text-workshop-chrome">{entry.toolName}</span>
                    <span className="font-mono text-[8px] px-1 py-0.5" style={{ background: `${zoneColor}20`, borderRadius: 2, color: zoneColor }}>{entry.zone}</span>
                    {entry.durationMs && <span className="font-mono text-[9px] text-workshop-dim">{entry.durationMs}ms</span>}
                    <span className="font-mono text-[9px] text-workshop-dim ml-auto">
                      {new Date(entry._creationTime).toLocaleTimeString("en-US", { hour12: false })}
                    </span>
                  </div>
                  {entry.errorMessage && (
                    <p className="font-mono text-[9px] text-red-400 mt-1 ml-4">{entry.errorMessage}</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="panel-inset" style={{ borderRadius: 6, padding: "24px", textAlign: "center" }}>
            <p className="font-mono text-[10px] text-workshop-dim">NO CALLS LOGGED</p>
          </div>
        )}
      </div>
    </div>
  );
}
