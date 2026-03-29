"use node";
/**
 * kvm.ts — H.U.G.H. multi-node shell execution
 *
 * Dynamic routing: H.U.G.H. specifies "target" in KVM_EXEC blocks.
 * Convex looks up the agentUrl from agentRegistry at runtime.
 * Falls back to KVM_AGENT_URL env var if target is "vps" or unspecified.
 *
 * KVM_EXEC block format:
 *   <KVM_EXEC>
 *   {"command": "...", "target": "macbook-air", "notes": "..."}
 *   </KVM_EXEC>
 *
 * Targets: any nodeId in agentRegistry, or omit for default VPS.
 */

import { action, internalAction, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

type ExecResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  durationMs: number;
  zone: string;
  targetNodeId: string;
};

function classifyZone(cmd: string): "green" | "yellow" | "red" {
  const lower = cmd.trim().toLowerCase();
  if (/\b(rm\s+-rf|mkfs|dd\s+if|shutdown|reboot|halt|poweroff|fdisk|parted|wipefs|kill\s+-9|pkill|iptables\s+-F|ufw\s+disable)\b/.test(lower)) {
    return "red";
  }
  if (/\b(apt|yum|dnf|pip|npm\s+install|systemctl\s+(stop|restart|disable)|chmod|chown|crontab|visudo|passwd|useradd|userdel|groupadd|brew\s+install)\b/.test(lower)) {
    return "yellow";
  }
  return "green";
}

const sanitizeCmd = (s: string): string => {
  let out = "";
  const mapping: Record<number, string> = {
    0x0441: "|", 0xFF5C: "|", 0x2502: "|", 0x2503: "|",
    0x2013: "-", 0x2014: "-", 0x2212: "-",
    0x2018: "'", 0x2019: "'",
    0x201C: '"', 0x201D: '"',
  };

  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (mapping[c]) {
      out += mapping[c];
    } else if (c >= 0x20 && c <= 0x7E) {
      const char = s[i];
      if (!["`", "$", "(", ")", ";", "<", ">", "\\"].includes(char)) {
        out += char;
      } else {
        out += " ";
      }
    }
  }
  return out.trim();
};

// ── RESOLVE AGENT URL + SECRET ────────────────────────────────────────────
async function resolveAgent(
  ctx: ActionCtx,
  targetNodeId?: string
): Promise<{ agentUrl: string; agentSecret: string; resolvedNodeId: string } | null> {
  // If a specific target is requested, look it up in the registry
  if (targetNodeId && targetNodeId !== "vps") {
    const node = await ctx.runQuery(internal.agentRegistry.getNode, { nodeId: targetNodeId }) as {
      agentUrl: string; secretHash: string; status: string;
    } | null;
    if (node && node.status === "online") {
      const secret = process.env[`KVM_SECRET_${targetNodeId.toUpperCase().replace(/-/g, "_")}`]
        ?? process.env.KVM_AGENT_SECRET
        ?? "";
      return { agentUrl: node.agentUrl, agentSecret: secret, resolvedNodeId: targetNodeId };
    }
    return null;
  }

  // Default: use env var (legacy VPS or primary agent)
  const agentUrl = process.env.KVM_AGENT_URL;
  const agentSecret = process.env.KVM_AGENT_SECRET;
  if (!agentUrl || !agentSecret) return null;
  return { agentUrl, agentSecret, resolvedNodeId: targetNodeId ?? "vps-primary" };
}

// ── INTERNAL: EXECUTE COMMAND ─────────────────────────────────────────────
export const execInternal = internalAction({
  args: {
    command: v.string(),
    workingDir: v.optional(v.string()),
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
    notes: v.optional(v.string()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecResult> => {
    const command = sanitizeCmd(args.command);
    const zone = classifyZone(command);
    const truncate = (s: string) => s.length > 8000 ? s.slice(0, 8000) + "\n[TRUNCATED]" : s;

    const agent = await resolveAgent(ctx, args.targetNodeId);

    if (!agent) {
      await ctx.runMutation(internal.kvmDb.logCommand, {
        issuedBy: args.issuedBy,
        sessionId: args.sessionId,
        command,
        workingDir: args.workingDir,
        success: false,
        zone,
        errorMessage: args.targetNodeId
          ? `Agent node "${args.targetNodeId}" not found or offline in registry`
          : "KVM_AGENT_URL or KVM_AGENT_SECRET not configured",
        notes: args.notes,
        targetNodeId: args.targetNodeId ?? "vps-primary",
      });
      throw new Error(
        args.targetNodeId
          ? `Agent node "${args.targetNodeId}" not found or offline. Check agentRegistry.`
          : "KVM agent not configured. Set KVM_AGENT_URL + KVM_AGENT_SECRET in Convex env vars."
      );
    }

    const { agentUrl, agentSecret, resolvedNodeId } = agent;
    const defaultCwd = (resolvedNodeId === "macbook-air" || resolvedNodeId.includes("mac")) && !resolvedNodeId.includes("proxmox") ? "/Users" : "/root";
    const start = Date.now();

    try {
      const res = await fetch(`${agentUrl}/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Secret": agentSecret,
        },
        body: JSON.stringify({
          command,
          cwd: args.workingDir ?? defaultCwd,
        }),
        signal: AbortSignal.timeout(60000),
      });

      const durationMs = Date.now() - start;

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Agent HTTP ${res.status}: ${errText}`);
      }

      const data = await res.json() as { stdout: string; stderr: string; exitCode: number };
      const success = data.exitCode === 0;

      await ctx.runMutation(internal.kvmDb.logCommand, {
        issuedBy: args.issuedBy,
        sessionId: args.sessionId,
        command,
        workingDir: args.workingDir,
        stdout: truncate(data.stdout ?? ""),
        stderr: truncate(data.stderr ?? ""),
        exitCode: data.exitCode,
        success,
        durationMs,
        zone,
        notes: args.notes,
        targetNodeId: resolvedNodeId,
      });

      return {
        success,
        stdout: truncate(data.stdout ?? ""),
        stderr: truncate(data.stderr ?? ""),
        exitCode: data.exitCode,
        durationMs,
        zone,
        targetNodeId: resolvedNodeId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - start;
      await ctx.runMutation(internal.kvmDb.logCommand, {
        issuedBy: args.issuedBy,
        sessionId: args.sessionId,
        command,
        workingDir: args.workingDir,
        success: false,
        durationMs,
        zone,
        errorMessage: msg,
        notes: args.notes,
        targetNodeId: resolvedNodeId,
      });
      throw new Error(`KVM agent exec failed [${resolvedNodeId}]: ${msg}`);
    }
  },
});

// ── PUBLIC: ADMIN EXEC ────────────────────────────────────────────────────
export const adminExec = action({
  args: {
    command: v.string(),
    workingDir: v.optional(v.string()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.runAction(internal.kvm.execInternal, {
      command: args.command,
      workingDir: args.workingDir,
      issuedBy: `admin:${identity.subject}`,
      notes: "Manual admin execution",
      targetNodeId: args.targetNodeId,
    }) as ExecResult;
  },
});

// ── PUBLIC: HUGH EXEC ─────────────────────────────────────────────────────
export const hughExec = action({
  args: {
    command: v.string(),
    workingDir: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    notes: v.optional(v.string()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<ExecResult> => {
    return await ctx.runAction(internal.kvm.execInternal, {
      command: args.command,
      workingDir: args.workingDir,
      issuedBy: "hugh-primary",
      sessionId: args.sessionId,
      notes: args.notes,
      targetNodeId: args.targetNodeId,
    }) as ExecResult;
  },
});

// ── PUBLIC: GET COMMAND LOG ───────────────────────────────────────────────
export const getCommandLog = action({
  args: {
    limit: v.optional(v.number()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<unknown[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    return await ctx.runQuery(internal.kvmDb.getRecentLog, {
      limit: args.limit ?? 50,
      targetNodeId: args.targetNodeId,
    }) as unknown[];
  },
});

// ── PUBLIC: VPS STATUS SNAPSHOT ───────────────────────────────────────────
export const getVpsStatus = action({
  args: { targetNodeId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<ExecResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const target = args.targetNodeId;
    const isMac = target === "macbook-air" || (target?.includes("mac") && !target?.includes("proxmox"));
    const statusCmd = isMac
      ? [
          "echo '=== UPTIME ===' && uptime",
          "echo '=== DISK ===' && df -h /",
          "echo '=== MEMORY ===' && vm_stat | head -10",
          "echo '=== CPU ===' && sysctl -n machdep.cpu.brand_string",
          "echo '=== LOAD ===' && sysctl -n vm.loadavg",
        ].join(" && ")
      : [
          "echo '=== UPTIME ===' && uptime",
          "echo '=== DISK ===' && df -h /",
          "echo '=== MEMORY ===' && free -h",
          "echo '=== LOAD ===' && cat /proc/loadavg",
          "echo '=== SERVICES ===' && systemctl list-units --type=service --state=running --no-pager --no-legend 2>/dev/null | head -20 || echo 'systemctl unavailable'",
        ].join(" && ");
    return await ctx.runAction(internal.kvm.execInternal, {
      command: statusCmd,
      issuedBy: "admin:status-check",
      notes: "Status snapshot",
      targetNodeId: target,
    }) as ExecResult;
  },
});

// ── PUBLIC: PING AGENT ────────────────────────────────────────────────────
export const pingAgent = action({
  args: { targetNodeId: v.optional(v.string()) },
  handler: async (ctx, args): Promise<{ online: boolean; nodeId: string; status?: number; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const agent = await resolveAgent(ctx, args.targetNodeId);
    const nodeId = args.targetNodeId ?? "vps-primary";

    if (!agent) {
      return { online: false, nodeId, error: "Agent not configured or offline in registry" };
    }

    try {
      const res = await fetch(`${agent.agentUrl}/ping`, {
        headers: { "X-Agent-Secret": agent.agentSecret },
        signal: AbortSignal.timeout(5000),
      });
      return { online: res.ok, nodeId, status: res.status };
    } catch (err: unknown) {
      return { online: false, nodeId, error: err instanceof Error ? err.message : String(err) };
    }
  },
});

// ── PUBLIC: PING ALL AGENTS ───────────────────────────────────────────────
export const pingAllAgents = action({
  args: {},
  handler: async (ctx): Promise<Array<{ online: boolean; nodeId: string; label: string; platform: string; status?: number; error?: string }>> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");

    const nodes = await ctx.runQuery(internal.agentRegistry.getAllNodes, {}) as Array<{
      nodeId: string; label: string; platform: string; agentUrl: string; status: string;
    }>;

    if (nodes.length === 0) {
      // Fall back to legacy env-var agent
      const agentUrl = process.env.KVM_AGENT_URL;
      const agentSecret = process.env.KVM_AGENT_SECRET;
      if (agentUrl && agentSecret) {
        try {
          const res = await fetch(`${agentUrl}/ping`, {
            headers: { "X-Agent-Secret": agentSecret },
            signal: AbortSignal.timeout(5000),
          });
          return [{ online: res.ok, nodeId: "vps-primary", label: "VPS (env)", platform: "linux", status: res.status }];
        } catch (err: unknown) {
          return [{ online: false, nodeId: "vps-primary", label: "VPS (env)", platform: "linux", error: err instanceof Error ? err.message : String(err) }];
        }
      }
      return [];
    }

    const results = await Promise.allSettled(
      nodes.map(async (node) => {
        const secret = process.env[`KVM_SECRET_${node.nodeId.toUpperCase().replace(/-/g, "_")}`]
          ?? process.env.KVM_AGENT_SECRET
          ?? "";
        try {
          const res = await fetch(`${node.agentUrl}/ping`, {
            headers: { "X-Agent-Secret": secret },
            signal: AbortSignal.timeout(5000),
          });
          return { online: res.ok, nodeId: node.nodeId, label: node.label, platform: node.platform, status: res.status };
        } catch (err: unknown) {
          return { online: false, nodeId: node.nodeId, label: node.label, platform: node.platform, error: err instanceof Error ? err.message : String(err) };
        }
      })
    );

    return results.map(r =>
      r.status === "fulfilled"
        ? r.value
        : { online: false, nodeId: "unknown", label: "unknown", platform: "unknown", error: "ping failed" }
    );
  },
});
