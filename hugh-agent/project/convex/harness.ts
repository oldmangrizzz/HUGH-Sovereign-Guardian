/**
 * harness.ts — Meta-Harness Optimization Engine
 *
 * Executes harness candidates, computes Pareto frontier scores,
 * and updates CNS ternary weights based on execution outcomes.
 *
 * This is the neocortex of H.U.G.H.'s cognitive architecture:
 * - Executes candidate code via KVM_EXEC
 * - Captures execution traces (bootstrap/inference/render)
 * - Computes Pareto frontier scores (multi-objective optimization)
 * - Updates CNS weights (reinforce successful patterns, inhibit failures)
 *
 * @module harness
 */

import { action, query, mutation, internalMutation, internalAction, internalQuery, ActionCtx } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import type { ExecutionResult, ParetoMetrics, ParetoWeights, EnvironmentFeature, LogEntry } from "./harnessDb";
import { DEFAULT_PARETO_WEIGHTS } from "./harnessDb";

type ScoredCandidate = Doc<"harnessCandidates"> & { score: number };
type TraceDoc = Doc<"executionTraces">;

const NODE_ID = "hugh-primary";

// ── EXECUTE HARNESS ───────────────────────────────────────────────────────
export const executeHarness = internalAction({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args): Promise<{
    traceId: Id<"executionTraces">;
    score: number;
    success: boolean;
    exitCode: number;
    durationMs: number;
  }> => {
    // 1. Fetch candidate code
    const candidate = await ctx.runQuery(internal.harness.getCandidateInternal, { candidateId: args.candidateId });
    if (!candidate) {
      throw new Error(`Candidate ${args.candidateId} not found`);
    }

    // 2. Execute in sandbox (KVM_EXEC or containerized environment)
    const executionResult = await executeInSandbox(ctx, candidate.harnessCode, candidate.nodeId);

    // 3. Store execution trace
    const traceId = await ctx.runMutation(internal.harness.storeTrace, {
      candidateId: args.candidateId,
      nodeId: candidate.nodeId,
      traceType: "inference",
      rawLogs: JSON.stringify(executionResult.logs),
      terminalOutput: executionResult.stdout,
      success: executionResult.success,
    });

    // 4. Compute Pareto score
    const score = computeParetoScoreFromResult(executionResult);

    // 5. Update candidate score
    await ctx.runMutation(internal.harness.updateCandidateScore, {
      candidateId: args.candidateId,
      score,
    });

    // 6. CNS weight learning
    if (executionResult.success) {
      await ctx.runMutation(internal.harness.reinforceWeights, {
        candidateId: args.candidateId,
        delta: 0.1,
      });
    } else {
      await ctx.runMutation(internal.harness.inhibitWeights, {
        candidateId: args.candidateId,
        delta: -0.2,
      });
    }

    return {
      traceId,
      score,
      success: executionResult.success,
      exitCode: executionResult.exitCode,
      durationMs: executionResult.durationMs,
    };
  },
});

// ── INTERNAL QUERIES ──────────────────────────────────────────────────────
export const getCandidateInternal = internalQuery({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.candidateId);
  },
});

// ── COMPUTE PARETO SCORE ──────────────────────────────────────────────────
export const computeParetoScore = query({
  args: {
    candidateId: v.id("harnessCandidates"),
    objectives: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<number> => {
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    if (traces.length === 0) {
      return 0;
    }

    const metrics: ParetoMetrics = {
      speed: computeSpeedMetric(traces),
      accuracy: computeAccuracyMetric(traces),
      resources: computeResourceMetric(traces),
    };

    const weights: ParetoWeights = args.objectives
      ? normalizeWeights(args.objectives)
      : DEFAULT_PARETO_WEIGHTS;

    return weightedSum(metrics, weights);
  },
});

// ── GET PARETO FRONTIER ───────────────────────────────────────────────────
/**
 * Returns all candidates on the Pareto frontier.
 *
 * A candidate is on the Pareto frontier if no other candidate
 * dominates it in all objectives (speed, accuracy, resources).
 *
 * @param nodeId - Node to get frontier for
 * @returns Array of frontier candidates
 */
export const getParetoFrontier = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args): Promise<ScoredCandidate[]> => {
    const candidates = await ctx.db
      .query("harnessCandidates")
      .withIndex("by_node_and_version", (q) => q.eq("nodeId", args.nodeId))
      .collect();

    if (candidates.length === 0) {
      return [];
    }

    // Compute scores for all candidates inline (avoid circular query call)
    const scoredCandidates: ScoredCandidate[] = await Promise.all(
      candidates.map(async (c: Doc<"harnessCandidates">): Promise<ScoredCandidate> => {
        const traces: TraceDoc[] = await ctx.db
          .query("executionTraces")
          .withIndex("by_candidate", (q) => q.eq("candidateId", c._id))
          .collect();

        const score: number = traces.length === 0 ? 0 : weightedSum(
          {
            speed: computeSpeedMetric(traces),
            accuracy: computeAccuracyMetric(traces),
            resources: computeResourceMetric(traces),
          },
          DEFAULT_PARETO_WEIGHTS
        );
        return { ...c, score };
      })
    );

    // Find Pareto frontier (non-dominated candidates)
    const frontier: ScoredCandidate[] = scoredCandidates.filter((candidate: ScoredCandidate) =>
      !scoredCandidates.some((other: ScoredCandidate) =>
        other._id !== candidate._id &&
        other.score >= candidate.score &&
        (other.score > candidate.score ||
          other.version > candidate.version)
      )
    );

    // Mark frontier candidates in database
    for (const c of frontier) {
      if (!c.isParetoFrontier) {
        await ctx.db.patch(c._id, { isParetoFrontier: true });
      }
    }

    return frontier;
  },
});

// ── GET CANDIDATE TRACES ──────────────────────────────────────────────────
/**
 * Retrieves all execution traces for a candidate.
 *
 * @param candidateId - ID of the candidate
 * @returns Array of execution traces
 */
export const getCandidateTraces = query({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
  },
});

// ── GET LATEST CANDIDATES ─────────────────────────────────────────────────
/**
 * Retrieves the latest N candidates for a node.
 *
 * @param nodeId - Node ID
 * @param limit - Maximum number of candidates to return
 * @returns Array of candidates sorted by version (descending)
 */
export const getLatestCandidates = query({
  args: { nodeId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 10;
    const candidates = await ctx.db
      .query("harnessCandidates")
      .withIndex("by_node_and_version", (q) => q.eq("nodeId", args.nodeId))
      .collect();

    return candidates
      .sort((a, b) => b.version - a.version)
      .slice(0, limit);
  },
});

// ── STORE TRACE (internal) ───────────────────────────────────────────────
export const storeTrace = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    nodeId: v.string(),
    traceType: v.string(),
    rawLogs: v.string(),
    terminalOutput: v.optional(v.string()),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("executionTraces", {
      candidateId: args.candidateId,
      nodeId: args.nodeId,
      traceType: args.traceType,
      rawLogs: args.rawLogs,
      terminalOutput: args.terminalOutput,
      success: args.success,
      ts: Date.now(),
    });
  },
});

// ── UPDATE CANDIDATE SCORE (internal) ────────────────────────────────────
export const updateCandidateScore = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, { score: args.score });
  },
});

// ── REINFORCE WEIGHTS (internal) ─────────────────────────────────────────
/**
 * Reinforces CNS ternary weights for features involved in successful execution.
 *
 * Increases weight by delta (capped at +1) for features extracted from
 * successful execution traces.
 *
 * @param candidateId - ID of the successful candidate
 * @param delta - Amount to increase weight by (default: 0.1)
 */
export const reinforceWeights = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    delta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const delta = args.delta ?? 0.1;
    const now = Date.now();
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    for (const trace of traces) {
      if (trace.success) {
        const features = extractFeatureIds(trace.rawLogs, trace.terminalOutput);

        for (const featureId of features) {
          const existing = await ctx.db
            .query("ternaryAttention")
            .withIndex("by_node_and_key", (q) =>
              q.eq("nodeId", NODE_ID).eq("contextKey", featureId)
            )
            .unique();

          const previousWeight = existing?.weight ?? 0;
          const newWeight = Math.min(1, previousWeight + delta);

          if (existing) {
            await ctx.db.patch(existing._id, { weight: newWeight, updatedAt: now });
          } else {
            await ctx.db.insert("ternaryAttention", {
              nodeId: NODE_ID,
              contextKey: featureId,
              weight: Math.min(1, delta),
              updatedAt: now,
            });
          }

          // Record weight change for learning analysis
          await ctx.db.insert("weightHistory", {
            nodeId: NODE_ID,
            contextKey: featureId,
            previousWeight,
            newWeight,
            delta: newWeight - previousWeight,
            reason: "reinforce",
            candidateId: args.candidateId,
            ts: now,
          });
        }
      }
    }
  },
});

// ── INHIBIT WEIGHTS (internal) ───────────────────────────────────────────
export const inhibitWeights = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    delta: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const delta = args.delta ?? -0.2;
    const now = Date.now();
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    for (const trace of traces) {
      if (!trace.success) {
        const features = extractFeatureIds(trace.rawLogs, trace.terminalOutput);

        for (const featureId of features) {
          const existing = await ctx.db
            .query("ternaryAttention")
            .withIndex("by_node_and_key", (q) =>
              q.eq("nodeId", NODE_ID).eq("contextKey", featureId)
            )
            .unique();

          const previousWeight = existing?.weight ?? 0;
          const newWeight = Math.max(-1, previousWeight + delta);

          if (existing) {
            await ctx.db.patch(existing._id, { weight: newWeight, updatedAt: now });
          } else {
            await ctx.db.insert("ternaryAttention", {
              nodeId: NODE_ID,
              contextKey: featureId,
              weight: Math.max(-1, delta),
              updatedAt: now,
            });
          }

          // Record weight change for learning analysis
          await ctx.db.insert("weightHistory", {
            nodeId: NODE_ID,
            contextKey: featureId,
            previousWeight,
            newWeight,
            delta: newWeight - previousWeight,
            reason: "inhibit",
            candidateId: args.candidateId,
            ts: now,
          });
        }
      }
    }
  },
});

// ── CREATE CANDIDATE ──────────────────────────────────────────────────────
/**
 * Creates a new harness candidate from proposer agent output.
 *
 * @param nodeId - Node ID
 * @param harnessCode - Proposed code (Python/UE5)
 * @param parentCandidateId - Optional parent candidate ID (for lineage tracking)
 * @returns ID of the new candidate
 */
export const createCandidate = internalMutation({
  args: {
    nodeId: v.string(),
    harnessCode: v.string(),
    parentCandidateId: v.optional(v.id("harnessCandidates")),
  },
  handler: async (ctx, args) => {
    // Get latest version for this node
    const latestCandidates = await ctx.db
      .query("harnessCandidates")
      .withIndex("by_node_and_version", (q) => q.eq("nodeId", args.nodeId))
      .collect();

    const latestVersion = latestCandidates.length > 0
      ? Math.max(...latestCandidates.map((c) => c.version))
      : 0;

    return await ctx.db.insert("harnessCandidates", {
      nodeId: args.nodeId,
      harnessCode: args.harnessCode,
      version: latestVersion + 1,
      score: undefined,
      parentCandidateId: args.parentCandidateId,
      isParetoFrontier: false,
      ts: Date.now(),
    });
  },
});

// ── HELPER FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Executes code in a sandboxed environment.
 *
 * Currently uses KVM_EXEC for remote execution.
 * Can be extended to use UE5 Python bridge or containerized environments.
 *
 * @param ctx - Action context
 * @param code - Code to execute
 * @param nodeId - Target node ID
 * @returns Execution result
 */
async function executeInSandbox(
  ctx: ActionCtx,
  code: string,
  nodeId: string
): Promise<ExecutionResult> {
  const startTime = Date.now();

  try {
    // Execute via KVM agent
    const kvmResult = await executeViaKvm(ctx, code, nodeId);

    return {
      success: kvmResult.exitCode === 0,
      logs: parseLogs(kvmResult.stdout, kvmResult.stderr),
      stdout: kvmResult.stdout,
      stderr: kvmResult.stderr,
      exitCode: kvmResult.exitCode,
      durationMs: Date.now() - startTime,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      logs: [{ type: "error", message }],
      stdout: "",
      stderr: message,
      exitCode: -1,
      durationMs: Date.now() - startTime,
    };
  }
}

/**
 * Executes code via KVM agent using a temp file approach for multi-line safety.
 */
async function executeViaKvm(ctx: ActionCtx, code: string, nodeId: string): Promise<{
  stdout: string;
  stderr: string;
  exitCode: number;
}> {
  const kvmAgentUrl = process.env.KVM_AGENT_URL;
  const kvmSecret = process.env.KVM_AGENT_SECRET;

  if (!kvmAgentUrl || !kvmSecret) {
    return simulateExecution(code);
  }

  // NX-04 FIX: Random heredoc delimiter prevents injection via code containing the delimiter
  const randomBuf = new Uint8Array(12);
  crypto.getRandomValues(randomBuf);
  const delimId = Array.from(randomBuf).map((b: number) => b.toString(36)).join("").slice(0, 16);
  const delimiter = `HUGH_CODE_${delimId}`;
  const tempFile = `/tmp/hugh-harness/candidate_${Date.now()}.py`;
  const setupCmd = `mkdir -p /tmp/hugh-harness && cat > ${tempFile} << '${delimiter}'\n${code}\n${delimiter}`;
  const execCmd = `${setupCmd} && python3 ${tempFile} 2>&1; EXIT=$?; rm -f ${tempFile}; exit $EXIT`;

  try {
    const response = await fetch(`${kvmAgentUrl}/exec`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Secret": kvmSecret,
      },
      body: JSON.stringify({
        command: execCmd,
        cwd: "/tmp/hugh-harness",
      }),
      signal: AbortSignal.timeout(60_000),
    });

    if (!response.ok) {
      throw new Error(`KVM execution failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      stdout: "",
      stderr: message,
      exitCode: -1,
    };
  }
}

/**
 * Simulates execution for testing without KVM agent.
 */
function simulateExecution(code: string): {
  stdout: string;
  stderr: string;
  exitCode: number;
} {
  // Static analysis simulation for Python/UE5 code candidates
  const errors: string[] = [];

  // Check for Python syntax issues
  const openParens = (code.match(/\(/g) || []).length;
  const closeParens = (code.match(/\)/g) || []).length;
  if (openParens !== closeParens) {
    errors.push(`SyntaxError: unmatched parentheses (${openParens} open, ${closeParens} close)`);
  }

  const openBrackets = (code.match(/\[/g) || []).length;
  const closeBrackets = (code.match(/\]/g) || []).length;
  if (openBrackets !== closeBrackets) {
    errors.push(`SyntaxError: unmatched brackets (${openBrackets} open, ${closeBrackets} close)`);
  }

  // Check for dangerous patterns
  if (/\bos\.system\b/.test(code)) {
    errors.push("SecurityWarning: os.system() detected — use subprocess.run() instead");
  }
  if (/\beval\b\s*\(/.test(code)) {
    errors.push("SecurityWarning: eval() detected — potential code injection");
  }
  if (/\bexec\b\s*\(/.test(code)) {
    errors.push("SecurityWarning: exec() detected — potential code injection");
  }

  // Check for common Python errors
  if (/\bprint\s+[^(]/.test(code)) {
    errors.push("SyntaxError: missing parentheses in call to 'print' (Python 3)");
  }
  if (code.includes("syntax_error")) {
    errors.push("SyntaxError: invalid syntax");
  }

  // Check for required structures (ARC-AGI candidates must have solve function)
  if (code.includes("def ") && !code.includes("def solve") && !code.includes("def main")) {
    errors.push("StructureWarning: no solve() or main() entry point found");
  }

  // Check indentation consistency
  const lines = code.split("\n");
  let usesSpaces = false;
  let usesTabs = false;
  for (const line of lines) {
    if (line.startsWith("  ")) usesSpaces = true;
    if (line.startsWith("\t")) usesTabs = true;
  }
  if (usesSpaces && usesTabs) {
    errors.push("IndentationError: mixed spaces and tabs");
  }

  if (errors.length > 0) {
    return {
      stdout: "",
      stderr: errors.join("\n"),
      exitCode: errors.some((e) => e.startsWith("SyntaxError") || e.startsWith("IndentationError")) ? 1 : 0,
    };
  }

  return {
    stdout: `Static analysis passed: ${lines.length} lines, ${code.length} chars`,
    stderr: "",
    exitCode: 0,
  };
}

/**
 * Parses stdout/stderr into structured logs.
 */
function parseLogs(stdout: string, stderr?: string): LogEntry[] {
  const logs: LogEntry[] = [];

  if (stdout) {
    logs.push({ type: "stdout", content: stdout });
  }

  if (stderr) {
    logs.push({ type: "stderr", content: stderr });
  }

  return logs;
}

/**
 * Computes speed metric from traces.
 * Normalized 0-1 where higher is better (faster execution).
 */
function computeSpeedMetric(traces: TraceDoc[]): number {
  const durations = traces
    .filter((t) => t.rawLogs)
    .map((t) => {
      try {
        const logs = JSON.parse(t.rawLogs);
        return logs.find((l: LogEntry) => l.durationMs)?.durationMs || 0;
      } catch {
        return 0;
      }
    })
    .filter((d) => d > 0);

  if (durations.length === 0) {
    return 0.5; // Default neutral score
  }

  const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;

  // Normalize: <100ms = 1.0, >5000ms = 0.0
  const normalized = 1 - Math.min(1, Math.max(0, (avgDuration - 100) / 4900));
  return normalized;
}

/**
 * Computes accuracy metric from traces.
 * Success rate: successful traces / total traces.
 */
function computeAccuracyMetric(traces: TraceDoc[]): number {
  if (traces.length === 0) {
    return 0;
  }

  const successful = traces.filter((t) => t.success).length;
  return successful / traces.length;
}

/**
 * Computes resource usage metric from traces.
 * Normalized 0-1 where higher is better (lower resource usage).
 */
function computeResourceMetric(traces: TraceDoc[]): number {
  if (traces.length === 0) return 0.5;

  // Parse resource utilization from trace logs
  // Lower resource usage = higher score (efficiency)
  const resourceScores: number[] = traces.map((trace: TraceDoc) => {
    let logs: LogEntry[] = [];
    try {
      logs = JSON.parse(trace.rawLogs || "[]");
    } catch {
      return 0.5; // Neutral on parse failure
    }

    // Look for resource metrics in logs
    let memoryMb = 0;
    let cpuPercent = 0;
    let hasMetrics = false;

    for (const log of logs) {
      const content = log.content || log.message || "";
      // Parse memory usage patterns (e.g., "memory: 128MB", "RSS: 256m")
      const memMatch = content.match(/(?:memory|rss|heap)[:\s]*(\d+(?:\.\d+)?)\s*(?:mb|m)/i);
      if (memMatch) {
        memoryMb = Math.max(memoryMb, parseFloat(memMatch[1]));
        hasMetrics = true;
      }
      // Parse CPU usage patterns (e.g., "cpu: 45%", "CPU usage: 80%")
      const cpuMatch = content.match(/cpu[:\s]*(\d+(?:\.\d+)?)\s*%/i);
      if (cpuMatch) {
        cpuPercent = Math.max(cpuPercent, parseFloat(cpuMatch[1]));
        hasMetrics = true;
      }
    }

    if (!hasMetrics) {
      // Fall back to code length as proxy for resource complexity
      // Shorter, more efficient code scores higher
      const codeLength = trace.rawLogs.length;
      return Math.max(0.1, 1 - (codeLength / 10000));
    }

    // Normalize: lower resource usage → higher score
    const memScore = Math.max(0, 1 - (memoryMb / 1024)); // 1GB baseline
    const cpuScore = Math.max(0, 1 - (cpuPercent / 100));
    return (memScore + cpuScore) / 2;
  });

  return resourceScores.reduce((sum: number, s: number) => sum + s, 0) / resourceScores.length;
}

/**
 * Computes weighted sum of metrics.
 */
function weightedSum(metrics: ParetoMetrics, weights: ParetoWeights): number {
  return (
    metrics.speed * weights.speed +
    metrics.accuracy * weights.accuracy +
    metrics.resources * weights.resources
  );
}

/**
 * Normalizes objective weights to sum to 1.
 */
function normalizeWeights(objectives: string[]): ParetoWeights {
  // Simple mapping: if objectives are provided, distribute weights equally
  const count = objectives.length;
  const weight = 1 / count;

  return {
    speed: objectives.includes("speed") ? weight : 0,
    accuracy: objectives.includes("accuracy") ? weight : 0,
    resources: objectives.includes("resources") ? weight : 0,
  };
}

/**
 * Extracts feature IDs from execution logs.
 *
 * Parses logs to identify:
 * - Tool calls (MCP tools)
 * - Code paths (function names, modules)
 * - Sensor data (hardware status)
 * - Log files (error patterns)
 *
 * @param rawLogs - Raw log JSON string
 * @param terminalOutput - Optional terminal output
 * @returns Array of feature IDs
 */
function extractFeatureIds(rawLogs: string, terminalOutput?: string): string[] {
  const features: string[] = [];

  try {
    const logs = JSON.parse(rawLogs);

    for (const log of logs) {
      if (log.type === "tool_call" && log.toolName) {
        features.push(`tool:${log.toolName}`);
      }

      if (log.type === "code_path" && log.path) {
        features.push(`code:${log.path}`);
      }

      if (log.type === "sensor" && log.sensorId) {
        features.push(`sensor:${log.sensorId}`);
      }

      if (log.type === "stderr" || log.content?.toLowerCase().includes("error")) {
        features.push("log:error");
      }
    }
  } catch {
    // If JSON parsing fails, try simple pattern matching
    if (rawLogs.toLowerCase().includes("error")) {
      features.push("log:error");
    }
  }

  // Also scan terminal output
  if (terminalOutput) {
    if (terminalOutput.toLowerCase().includes("timeout")) {
      features.push("log:timeout");
    }
    if (terminalOutput.toLowerCase().includes("memory")) {
      features.push("log:memory");
    }
  }

  return features;
}

/**
 * Escapes code for shell execution.
 */
function escapeShell(code: string): string {
  return code
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r");
}

// ── COMPUTE PARETO SCORE FROM RESULT ─────────────────────────────────────
/**
 * Computes Pareto score directly from an execution result.
 * Used internally by executeHarness action.
 */
function computeParetoScoreFromResult(result: ExecutionResult): number {
  const metrics: ParetoMetrics = {
    speed: computeSpeedMetricFromResult(result),
    accuracy: result.success ? 1 : 0,
    resources: computeResourceMetricFromResult(result),
  };

  return weightedSum(metrics, DEFAULT_PARETO_WEIGHTS);
}

/**
 * Computes resource efficiency from a single ExecutionResult.
 */
function computeResourceMetricFromResult(result: ExecutionResult): number {
  // Parse logs for resource metrics
  for (const log of result.logs) {
    const content = (log as LogEntry).content || (log as LogEntry).message || "";
    const memMatch = content.match(/(?:memory|rss|heap)[:\s]*(\d+(?:\.\d+)?)\s*(?:mb|m)/i);
    if (memMatch) {
      const memMb = parseFloat(memMatch[1]);
      return Math.max(0, 1 - (memMb / 1024));
    }
  }
  // Fall back: penalize long output (proxy for resource waste)
  const outputLength = result.stdout.length + result.stderr.length;
  return Math.max(0.1, 1 - (outputLength / 50000));
}

function computeSpeedMetricFromResult(result: ExecutionResult): number {
  const duration = result.durationMs;
  // Normalize: <100ms = 1.0, >5000ms = 0.0
  return 1 - Math.min(1, Math.max(0, (duration - 100) / 4900));
}
