/**
 * proposer.ts — Proposer Agent Implementation
 *
 * The Proposer Agent is the cognitive engine of the Meta-Harness optimization loop.
 * It generates new harness candidates by:
 * 1. Collecting execution traces from failed/successful candidates
 * 2. Applying CNS BitNet mask to filter context (Excite/Inhibit/Neutral)
 * 3. Prompting LLM with focused context to propose code fixes
 * 4. Creating new candidate in harnessCandidates table
 *
 * Integration:
 * - Reads from: executionTraces, harnessCandidates, ternaryAttention
 * - Writes to: harnessCandidates (new versions)
 * - Uses: CNS computeBitNetMask for context filtering
 *
 * @module proposer
 */

import { action, query, mutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import type { EnvironmentFeature, FeatureType } from "./harnessDb";
import { openai } from "./openai";

const NODE_ID = "hugh-primary";

type CandidateDoc = Doc<"harnessCandidates">;
type TraceDoc = Doc<"executionTraces">;

interface CandidateWithTraces {
  candidate: CandidateDoc;
  traces: TraceDoc[];
}

// ── INTERNAL QUERY: GET CANDIDATE BY ID ───────────────────────────────────
export const getCandidate = internalQuery({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args): Promise<CandidateDoc | null> => {
    return await ctx.db.get(args.candidateId);
  },
});

// ── PROPOSE NEXT CANDIDATE ────────────────────────────────────────────────
/**
 * Generates the next harness candidate using the Proposer Agent.
 *
 * Flow:
 * 1. Fetch latest candidates and their execution traces
 * 2. Extract environmental features from traces
 * 3. Apply CNS BitNet mask to filter features (Excite/Inhibit/Neutral)
 * 4. Build focused prompt with filtered context
 * 5. Call LLM to generate new harness code
 * 6. Create new candidate in database
 *
 * @param nodeId - Node to propose candidate for
 * @param taskDescription - Optional task description for the proposer
 * @returns ID of the new candidate
 */
export const proposeNextCandidate = internalAction({
  args: {
    nodeId: v.optional(v.string()),
    taskDescription: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{
    candidateId: Id<"harnessCandidates">;
    version: number;
    featuresAnalyzed: number;
    maskApplied: number;
  }> => {
    const nodeId = args.nodeId ?? NODE_ID;

    // 1. Fetch latest candidates
    const latestCandidates = await ctx.runQuery(api.harness.getLatestCandidates, {
      nodeId,
      limit: 5,
    });

    if (latestCandidates.length === 0) {
      throw new Error("No existing candidates to base proposal on");
    }

    // 2. Fetch execution traces for latest candidates
    const traces: CandidateWithTraces[] = await Promise.all(
      latestCandidates.map(async (c: CandidateDoc) => ({
        candidate: c,
        traces: await ctx.runQuery(api.harness.getCandidateTraces, {
          candidateId: c._id,
        }),
      }))
    );

    // 3. Extract environmental features from traces
    const features = extractFeaturesFromTraces(traces);

    // 4. Apply CNS BitNet mask to filter features (Limbic Filtering)
    const mask = await ctx.runAction(internal.cns.computeBitNetMask, {
      features,
    });

    // 5. Build focused prompt with filtered context (BitNet Implementation)
    const prompt = buildProposerPrompt(traces, mask, args.taskDescription);

    // 6. Call LLM to generate new harness code
    const harnessCode = await callLlmProposer(prompt);

    // 7. Create new candidate
    const parentCandidateId = latestCandidates[0]._id;
    const newCandidateId = await ctx.runMutation(internal.harness.createCandidate, {
      nodeId,
      harnessCode,
      parentCandidateId,
    });

    return {
      candidateId: newCandidateId,
      version: latestCandidates[0].version + 1,
      featuresAnalyzed: features.length,
      maskApplied: Object.keys(mask).length,
    };
  },
});

// ── ANALYZE FAILURE ───────────────────────────────────────────────────────
/**
 * Analyzes a failed candidate and proposes a fix.
 *
 * Focuses on error patterns in execution traces and uses CNS
 * to highlight relevant tools/code paths for debugging.
 *
 * @param candidateId - ID of the failed candidate
 * @returns Analysis result with proposed fix candidate ID
 */
export const analyzeFailure = internalAction({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args): Promise<{
    candidateId: Id<"harnessCandidates">;
    version: number;
    failedTraceCount: number;
    errorPatterns: string[];
  }> => {
    // 1. Fetch candidate (actions can't access ctx.db — use internal query)
    const candidate: CandidateDoc | null = await ctx.runQuery(internal.proposer.getCandidate, {
      candidateId: args.candidateId,
    });
    if (!candidate) {
      throw new Error(`Candidate ${args.candidateId} not found`);
    }

    // 2. Fetch execution traces
    const candidateTraces: TraceDoc[] = await ctx.runQuery(api.harness.getCandidateTraces, {
      candidateId: args.candidateId,
    });

    // 3. Filter to failed traces only
    const failedTraces: TraceDoc[] = candidateTraces.filter((t: TraceDoc) => !t.success);

    if (failedTraces.length === 0) {
      throw new Error("No failed traces found for this candidate");
    }

    // 4. Extract features from failed traces
    const features = extractFeaturesFromTraces([{ candidate, traces: failedTraces }]);

    // 5. Apply CNS BitNet mask
    const mask = await ctx.runAction(internal.cns.computeBitNetMask, {
      features,
    });

    // 6. Build failure analysis prompt
    const prompt = buildFailurePrompt(candidate, failedTraces, mask);

    // 7. Call LLM to generate fix
    const harnessCode = await callLlmProposer(prompt);

    // 8. Create new candidate with fix
    const newCandidateId: Id<"harnessCandidates"> = await ctx.runMutation(internal.harness.createCandidate, {
      nodeId: candidate.nodeId,
      harnessCode,
      parentCandidateId: args.candidateId,
    });

    return {
      candidateId: newCandidateId,
      version: candidate.version + 1,
      failedTraceCount: failedTraces.length,
      errorPatterns: extractErrorPatterns(failedTraces),
    };
  },
});

// ── GET PROPOSER CONTEXT ──────────────────────────────────────────────────
/**
 * Returns the filtered context that the Proposer Agent would receive.
 *
 * Useful for debugging and understanding what the CNS is filtering.
 *
 * @param nodeId - Node to get context for
 * @returns Filtered context with excite/observe/inhibit sections
 */
export const getProposerContext = query({
  args: { nodeId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const nodeId = args.nodeId ?? NODE_ID;

    // 1. Fetch latest candidates
    const latestCandidates = await ctx.runQuery(api.harness.getLatestCandidates, {
      nodeId,
      limit: 3,
    });

    if (latestCandidates.length === 0) {
      return { excite: [], observe: [], inhibit: [] };
    }

    // 2. Fetch traces
    const traces: CandidateWithTraces[] = await Promise.all(
      latestCandidates.map(async (c: CandidateDoc) => ({
        candidate: c,
        traces: await ctx.runQuery(api.harness.getCandidateTraces, {
          candidateId: c._id,
        }),
      }))
    );

    // 3. Extract features
    const features = extractFeaturesFromTraces(traces);

    // 4. Get CNS attention weights
    const attentionWeights = await ctx.db
      .query("ternaryAttention")
      .withIndex("by_node_and_key", (q) => q.eq("nodeId", nodeId))
      .collect();

    const weightMap = Object.fromEntries(
      attentionWeights.map((a) => [a.contextKey, a.weight])
    );

    // 5. Categorize features by weight
    const excite: EnvironmentFeature[] = [];
    const observe: EnvironmentFeature[] = [];
    const inhibit: EnvironmentFeature[] = [];

    for (const feature of features) {
      const weight = weightMap[feature.id] ?? 0;

      if (weight > 0.5) {
        excite.push(feature);
      } else if (weight < -0.5) {
        inhibit.push(feature);
      } else {
        observe.push(feature);
      }
    }

    return {
      excite: excite.map((f) => ({
        ...f,
        weight: weightMap[f.id] ?? 0,
        reason: "Critical context - forced inclusion",
      })),
      observe: observe.map((f) => ({
        ...f,
        weight: weightMap[f.id] ?? 0,
        reason: "Background context - included if space permits",
      })),
      inhibit: inhibit.map((f) => ({
        ...f,
        weight: weightMap[f.id] ?? 0,
        reason: "Noise - explicitly filtered out",
      })),
    };
  },
});

// ── COUNTERFACTUAL ANALYSIS ───────────────────────────────────────────────
/**
 * Performs counterfactual analysis: "What if Feature X was disabled?"
 *
 * Analyzes execution traces to determine the impact of specific features
 * on success/failure outcomes.
 *
 * @param featureId - Feature to analyze (e.g., "tool:mcp_search")
 * @param nodeId - Node to analyze
 * @returns Counterfactual analysis result
 */
export const counterfactualAnalysis = query({
  args: {
    featureId: v.string(),
    nodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const nodeId = args.nodeId ?? NODE_ID;

    // 1. Get all candidates
    const candidates = await ctx.runQuery(api.harness.getLatestCandidates, {
      nodeId,
      limit: 20,
    });

    // 2. Get traces for all candidates
    const allTraces: CandidateWithTraces[] = await Promise.all(
      candidates.map(async (c: CandidateDoc) => ({
        candidate: c,
        traces: await ctx.runQuery(api.harness.getCandidateTraces, {
          candidateId: c._id,
        }),
      }))
    );

    // 3. Separate traces with and without the feature
    const tracesWithFeature: TraceDoc[] = [];
    const tracesWithoutFeature: TraceDoc[] = [];

    for (const { candidate, traces: candidateTraces } of allTraces) {
      for (const trace of candidateTraces) {
        const hasFeature = trace.rawLogs.includes(args.featureId) ||
          trace.terminalOutput?.includes(args.featureId);

        if (hasFeature) {
          tracesWithFeature.push(trace);
        } else {
          tracesWithoutFeature.push(trace);
        }
      }
    }

    // 4. Compute success rates
    const successRateWith = tracesWithFeature.length > 0
      ? tracesWithFeature.filter((t: TraceDoc) => t.success).length / tracesWithFeature.length
      : 0;

    const successRateWithout = tracesWithoutFeature.length > 0
      ? tracesWithoutFeature.filter((t: TraceDoc) => t.success).length / tracesWithoutFeature.length
      : 0;

    // 5. Determine impact
    const impact = successRateWith - successRateWithout;

    return {
      featureId: args.featureId,
      tracesWithFeature: tracesWithFeature.length,
      tracesWithoutFeature: tracesWithoutFeature.length,
      successRateWith,
      successRateWithout,
      impact,
      interpretation: interpretImpact(impact),
    };
  },
});

// ── GET CANDIDATE LINEAGE ─────────────────────────────────────────────────
/**
 * Returns the lineage (ancestry tree) of a candidate.
 *
 * Useful for understanding the evolution of harness code
 * and tracking which changes led to improvements.
 *
 * @param candidateId - ID of the candidate
 * @returns Array of ancestors from oldest to newest
 */
export const getCandidateLineage = query({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args) => {
    const lineage: CandidateDoc[] = [];
    let currentId: Id<"harnessCandidates"> | undefined = args.candidateId;

    while (currentId) {
      const candidate: CandidateDoc | null = await ctx.db.get(currentId);
      if (!candidate) {
        break;
      }

      lineage.unshift(candidate);
      currentId = candidate.parentCandidateId ?? undefined;
    }

    return lineage;
  },
});

// ── HELPER FUNCTIONS ─────────────────────────────────────────────────────

/**
 * Extracts environmental features from execution traces.
 */
function extractFeaturesFromTraces(
  candidateData: CandidateWithTraces[]
): EnvironmentFeature[] {
  const features: EnvironmentFeature[] = [];
  const seen = new Set<string>();

  for (const { candidate, traces: candidateTraces } of candidateData) {
    for (const trace of candidateTraces) {
      // Extract from raw logs
      try {
        const logs = JSON.parse(trace.rawLogs);
        for (const log of logs) {
          if (log.type === "tool_call" && log.toolName) {
            const id = `tool:${log.toolName}`;
            if (!seen.has(id)) {
              features.push({ id, type: "tool", metadata: log.toolName });
              seen.add(id);
            }
          }

          if (log.type === "code_path" && log.path) {
            const id = `code:${log.path}`;
            if (!seen.has(id)) {
              features.push({ id, type: "code", metadata: log.path });
              seen.add(id);
            }
          }

          if (log.type === "sensor" && log.sensorId) {
            const id = `sensor:${log.sensorId}`;
            if (!seen.has(id)) {
              features.push({ id, type: "sensor", metadata: log.sensorId });
              seen.add(id);
            }
          }

          if (log.type === "stderr" || log.content?.toLowerCase().includes("error")) {
            const id = "log:error";
            if (!seen.has(id)) {
              features.push({ id, type: "log", metadata: "Error in execution" });
              seen.add(id);
            }
          }
        }
      } catch {
        // If JSON parsing fails, check raw strings
        if (trace.rawLogs.toLowerCase().includes("error")) {
          const id = "log:error";
          if (!seen.has(id)) {
            features.push({ id, type: "log", metadata: "Error in logs" });
            seen.add(id);
          }
        }
      }

      // Extract from terminal output
      if (trace.terminalOutput) {
        if (trace.terminalOutput.toLowerCase().includes("timeout")) {
          const id = "log:timeout";
          if (!seen.has(id)) {
            features.push({ id, type: "log", metadata: "Timeout occurred" });
            seen.add(id);
          }
        }

        if (trace.terminalOutput.toLowerCase().includes("memory")) {
          const id = "log:memory";
          if (!seen.has(id)) {
            features.push({ id, type: "log", metadata: "Memory-related output" });
            seen.add(id);
          }
        }
      }

      // Add candidate harness code as a feature
      const codeId = `code:harness_v${candidate.version}`;
      if (!seen.has(codeId)) {
        features.push({
          id: codeId,
          type: "code",
          metadata: `Harness version ${candidate.version}`,
        });
        seen.add(codeId);
      }
    }
  }

  return features;
}

/**
 * Builds the prompt for the Proposer Agent.
 */
function buildProposerPrompt(
  candidateData: CandidateWithTraces[],
  mask: Record<string, number>,
  taskDescription?: string
): string {
  const excite: string[] = [];
  const observe: string[] = [];

  // Categorize by mask weight
  for (const { candidate, traces: candidateTraces } of candidateData) {
    for (const trace of candidateTraces) {
      const featureId = `trace:${trace._id}`;
      const weight = mask[featureId] ?? 0;

      const traceSummary = `Candidate v${candidate.version} (${trace.success ? "SUCCESS" : "FAILED"}):
  Type: ${trace.traceType}
  Output: ${trace.terminalOutput?.substring(0, 200) || "N/A"}`;

      if (weight > 0.5) {
        excite.push(traceSummary);
      } else {
        observe.push(traceSummary);
      }
    }
  }

  return `
# H.U.G.H. Meta-Harness Proposer Agent

## TASK
${taskDescription || "Analyze the execution traces below and propose an improved harness code implementation."}

## FOCUS (High Priority - Excite +1)
These traces are critical for understanding the current state:

${excite.join("\n\n") || "No critical traces identified."}

## CONTEXT (Observational - Neutral 0)
Background traces for additional context:

${observe.join("\n\n") || "No background traces."}

## INSTRUCTIONS
1. Analyze the failures in the FOCUS section
2. Identify root causes (tool failures, resource constraints, logic errors)
3. Propose a new harness code implementation that addresses these issues
4. Optimize for:
   - Speed (reduce execution time)
   - Accuracy (improve success rate)
   - Resource efficiency (minimize memory/CPU usage)

## OUTPUT FORMAT
Return ONLY the Python/UE5 code for the new harness implementation.
Do not include explanations or markdown formatting.

## CURRENT BEST CANDIDATE
${candidateData[0]?.candidate.harnessCode.substring(0, 500) || "N/A"}
...
`;
}

/**
 * Builds the prompt for failure analysis.
 */
function buildFailurePrompt(
  candidate: CandidateDoc,
  failedTraces: TraceDoc[],
  mask: Record<string, number>
): string {
  const errors = failedTraces
    .map((t: TraceDoc) => ({
      type: t.traceType,
      output: t.terminalOutput || "No output",
      logs: t.rawLogs,
    }))
    .map((e, i) => `Error ${i + 1} (${e.type}):\n${e.output.substring(0, 300)}`)
    .join("\n\n");

  return `
# H.U.G.H. Meta-Harness Failure Analysis

## TASK
Analyze the following execution failures and propose a fix.

## FAILED CANDIDATE
Version: ${candidate.version}
Code:
${candidate.harnessCode.substring(0, 1000)}
...

## ERRORS
${errors}

## INSTRUCTIONS
1. Identify the root cause of each error
2. Determine which code paths or tools are failing
3. Propose a minimal fix that addresses the failures
4. Maintain compatibility with existing successful patterns

## OUTPUT FORMAT
Return ONLY the corrected Python/UE5 code.
Do not include explanations or markdown formatting.
`;
}

/**
 * Calls the LLM via the HUGH Gateway (OpenAI-compatible API) to generate
 * new harness candidate code. Uses the same OpenAI client as hugh.ts and memory.ts.
 *
 * Gateway routes to: LFM 2.5 Thinking + Opus 4.6 Heretic Distill
 */
async function callLlmProposer(
  prompt: string
): Promise<string> {
  const model = process.env.HUGH_GATEWAY_URL
    ? (process.env.HUGH_GATEWAY_MODEL ?? "LMF-2.5-Thinking-Opus-4.6-Heretic-Distill")
    : "gpt-4";

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `You are the H.U.G.H. Meta-Harness Proposer Agent. Your sole purpose is to generate optimized Python harness code for the ARC-AGI challenge.

Rules:
- Return ONLY valid Python code. No markdown, no explanations, no code fences.
- Every candidate MUST have a \`def solve(input_grid: list[list[int]]) -> list[list[int]]\` entry point.
- Optimize for: speed (execution time), accuracy (correct ARC transforms), resource efficiency (memory/CPU).
- Use numpy for grid operations when beneficial.
- Handle edge cases: empty grids, single-cell grids, large grids (30x30 max).
- Never use os.system(), eval(), exec(), or subprocess for security.`,
      },
      {
        role: "user",
        content: prompt,
      },
    ],
    max_tokens: 4096,
    temperature: 0.7, // Allow creative exploration of solution space
  });

  const content = response.choices[0]?.message?.content;
  if (!content || content.trim().length === 0) {
    throw new Error("LLM returned empty response for proposer prompt");
  }

  // Strip any markdown code fences the model might have included
  let code = content.trim();
  if (code.startsWith("```python")) {
    code = code.slice(9);
  } else if (code.startsWith("```")) {
    code = code.slice(3);
  }
  if (code.endsWith("```")) {
    code = code.slice(0, -3);
  }

  return code.trim();
}

/**
 * Extracts error patterns from failed traces.
 */
function extractErrorPatterns(failedTraces: TraceDoc[]): string[] {
  const patterns: string[] = [];
  const patternSet = new Set<string>();

  for (const trace of failedTraces) {
    const output = trace.terminalOutput || trace.rawLogs;

    // Common error patterns
    const errorRegexes = [
      /Error:\s*(.+)/gi,
      /Exception:\s*(.+)/gi,
      /Failed to\s*(.+)/gi,
      /Timeout.*(?:after|in)\s*(.+)/gi,
      /Memory.*(?:error|full|limit)/gi,
    ];

    for (const regex of errorRegexes) {
      const matches = output.match(regex);
      if (matches) {
        for (const match of matches) {
          const normalized = match.toLowerCase().trim();
          if (!patternSet.has(normalized)) {
            patterns.push(match);
            patternSet.add(normalized);
          }
        }
      }
    }
  }

  return patterns.slice(0, 10); // Limit to top 10 patterns
}

/**
 * Interprets the impact score from counterfactual analysis.
 */
function interpretImpact(impact: number): string {
  if (impact > 0.3) {
    return "CRITICAL: This feature significantly improves success rate. Do not disable.";
  } else if (impact > 0.1) {
    return "POSITIVE: This feature provides moderate benefit. Consider keeping.";
  } else if (impact > -0.1) {
    return "NEUTRAL: This feature has minimal impact. Safe to disable for testing.";
  } else if (impact > -0.3) {
    return "NEGATIVE: This feature may be harmful. Consider disabling or refactoring.";
  } else {
    return "CRITICAL: This feature significantly reduces success rate. Disable immediately.";
  }
}
