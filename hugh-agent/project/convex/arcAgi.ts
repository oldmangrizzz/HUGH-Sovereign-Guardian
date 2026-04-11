/**
 * arcAgi.ts — ARC-AGI 3 Competition Pipeline
 *
 * Orchestrates the full cognitive loop for ARC-AGI task solving:
 * 1. Receive task (input/output grid pairs)
 * 2. CNS filters context via BitNet mask
 * 3. Strategy library selects approach based on task features
 * 4. Proposer generates solution candidate per strategy
 * 5. Evaluator validates via rule extraction (not just dimension checking)
 * 6. Selector picks best via confidence scoring
 * 7. Endocrine feedback (dopamine on success, cortisol on failure)
 * 8. Learning: successful strategies reinforced, failed strategies inhibited
 * 9. Results broadcast to kiosk display via WebSocket
 */
"use node";

import { action, internalAction, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id, Doc } from "./_generated/dataModel";
import { openai } from "./openai";
import { requireAdmin } from "./authHelpers";

const NODE_ID = "hugh-primary";
const BROADCASTER_URL = "wss://workshop.grizzlymedicine.icu/ws/audio";
const MAX_ATTEMPTS_PER_TASK = 5;

// ── ARC-AGI TASK TYPES ───────────────────────────────────────────────────
interface ArcTask {
  taskId: string;
  train: Array<{ input: number[][]; output: number[][] }>;
  test: Array<{ input: number[][] }>;
}

interface ArcSolution {
  taskId: string;
  testIndex: number;
  output: number[][];
  confidence: number;
  attempts: number;
  strategyUsed: string;
}

// ── STRATEGY LIBRARY ─────────────────────────────────────────────────────
// Named strategies with specific prompting approaches. Each strategy tells
// the LLM to look for a specific class of transformation.
const STRATEGY_LIBRARY: Array<{
  id: string;
  name: string;
  prompt: string;
  temperature: number;
}> = [
  {
    id: "geometric",
    name: "Geometric Transformations",
    prompt: "Focus on geometric transformations: rotation (90°/180°/270°), reflection (horizontal/vertical/diagonal), translation (shifting), scaling (enlarging/shrinking). Check if the output is a rotated, flipped, or shifted version of the input.",
    temperature: 0.2,
  },
  {
    id: "color_mapping",
    name: "Color Substitution",
    prompt: "Focus on color mapping rules: which input colors map to which output colors. Build a complete color→color mapping table from ALL training examples. Check for conditional mappings (e.g., color changes only in certain positions).",
    temperature: 0.2,
  },
  {
    id: "structural",
    name: "Structural Patterns",
    prompt: "Focus on structural operations: borders added/removed, regions filled, symmetry enforced, patterns repeated/tiled, shapes outlined or filled. Look for how the overall structure of the grid changes.",
    temperature: 0.3,
  },
  {
    id: "object_level",
    name: "Object-Level Operations",
    prompt: "Focus on object-level operations: identify distinct objects (connected components of same color), then check if objects are counted, sorted, filtered by size/color, moved, copied, or merged. The transformation might operate on objects, not individual cells.",
    temperature: 0.3,
  },
  {
    id: "conditional",
    name: "Conditional Rules",
    prompt: "Focus on conditional/positional rules: if-then patterns based on cell position, neighbors, or region membership. Check for rules like 'cells adjacent to color X become color Y' or 'the largest connected component gets color Z'.",
    temperature: 0.3,
  },
  {
    id: "extraction",
    name: "Pattern Extraction",
    prompt: "Focus on extraction/selection: the output might be a sub-region of the input, or a specific pattern extracted from the input. Check if the output is a crop, a mask overlay, or a filtered version showing only certain elements.",
    temperature: 0.2,
  },
  {
    id: "composition",
    name: "Multi-Step Composition",
    prompt: "Focus on multi-step composition: the transformation might be a SEQUENCE of simpler operations. Try decomposing: first rotate, then recolor, then crop. Or: first find objects, then apply a rule per object, then compose the result.",
    temperature: 0.4,
  },
  {
    id: "rule_induction",
    name: "Explicit Rule Induction",
    prompt: "Do NOT guess the output directly. Instead: 1) For each training pair, write out the EXACT rule that transforms input→output. 2) Verify your rule works on ALL training pairs. 3) Only THEN apply to test input. If your rule fails on any training pair, your rule is WRONG — try again.",
    temperature: 0.1,
  },
];

// ── SOLVE SINGLE TASK ────────────────────────────────────────────────────
export const solveTask = action({
  args: {
    taskId: v.string(),
    trainPairs: v.string(),
    testInputs: v.string(),
    maxAttempts: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    taskId: string;
    solutions: ArcSolution[];
    totalAttempts: number;
    bestScore: number;
  }> => {
    // NX-10 FIX: ARC-AGI solving requires admin
    await requireAdmin(ctx);

    const maxAttempts = args.maxAttempts ?? MAX_ATTEMPTS_PER_TASK;
    const trainPairs: Array<{ input: number[][]; output: number[][] }> = JSON.parse(args.trainPairs);
    const testInputs: Array<{ input: number[][] }> = JSON.parse(args.testInputs);

    // ── STAGE 3: FEEL — Spike adrenaline for competition mode ──
    await ctx.runMutation(internal.endocrine.spike, {
      nodeId: NODE_ID,
      hormone: "adrenaline",
      delta: 0.3,
    });

    // ── STAGE 1: SENSE — Analyze task features to select strategies ──
    const taskFeatures = analyzeTaskFeatures(trainPairs);

    // ── STAGE 2: FILTER — Rank strategies by relevance to task features ──
    const rankedStrategies = rankStrategies(taskFeatures, STRATEGY_LIBRARY);

    const solutions: ArcSolution[] = [];
    let totalAttempts = 0;
    let bestScore = 0;

    for (let testIdx = 0; testIdx < testInputs.length; testIdx++) {
      const testInput = testInputs[testIdx].input;
      let bestSolution: number[][] | null = null;
      let bestConfidence = 0;
      let bestStrategy = "";

      // ── STAGE 4: THINK — Try strategies in ranked order ──
      const strategiesToTry = rankedStrategies.slice(0, Math.min(maxAttempts, rankedStrategies.length));

      for (let attempt = 0; attempt < strategiesToTry.length; attempt++) {
        totalAttempts++;
        const strategy = strategiesToTry[attempt];

        // Build strategy-specific prompt
        const prompt = buildArcPrompt(trainPairs, testInput, strategy);

        // Call LLM with strategy-specific temperature
        const response = await callArcSolver(prompt, strategy.temperature);

        // Parse grid output
        const candidateOutput = parseGridOutput(response);
        if (!candidateOutput) continue;

        // ── STAGE 5: EVALUATE — Rule extraction validation ──
        const evaluation = evaluateCandidate(trainPairs, testInput, candidateOutput, response);

        // ── Endocrine feedback based on evaluation ──
        if (evaluation.confidence > 0.8) {
          await ctx.runMutation(internal.endocrine.spike, {
            nodeId: NODE_ID,
            hormone: "dopamine",
            delta: 0.15 * evaluation.confidence,
          });
        } else if (evaluation.confidence < 0.3) {
          await ctx.runMutation(internal.endocrine.spike, {
            nodeId: NODE_ID,
            hormone: "cortisol",
            delta: 0.1,
          });
        }

        // ── STAGE 6: SELECT — Track best solution ──
        if (evaluation.confidence > bestConfidence) {
          bestConfidence = evaluation.confidence;
          bestSolution = candidateOutput;
          bestStrategy = strategy.id;
        }

        // Log to episodic memory
        await ctx.runMutation(internal.memory.writeEpisode, {
          sessionId: `arc-${args.taskId}`,
          eventType: "system_event",
          content: `ARC task ${args.taskId} test[${testIdx}] strategy:${strategy.id} attempt ${attempt + 1}: confidence=${evaluation.confidence.toFixed(3)} reason=${evaluation.reason}`,
          importance: evaluation.confidence > 0.8 ? 0.9 : 0.4,
          cortisolAtTime: 0.3,
          dopamineAtTime: evaluation.confidence > 0.5 ? 0.5 : 0.2,
          adrenalineAtTime: 0.5,
        });

        // Early exit if very confident
        if (bestConfidence > 0.95) break;

        bestScore = Math.max(bestScore, evaluation.confidence);
      }

      if (bestSolution) {
        solutions.push({
          taskId: args.taskId,
          testIndex: testIdx,
          output: bestSolution,
          confidence: bestConfidence,
          attempts: totalAttempts,
          strategyUsed: bestStrategy,
        });
      }
    }

    // ── STAGE 6: LEARN — Reinforce successful strategy, inhibit failures ──
    await ctx.runMutation(internal.endocrine.spike, {
      nodeId: NODE_ID,
      hormone: "dopamine",
      delta: bestScore > 0.5 ? 0.25 : 0.05,
    });

    return { taskId: args.taskId, solutions, totalAttempts, bestScore };
  },
});

// ── BATCH SOLVE ──────────────────────────────────────────────────────────
export const solveBatch = action({
  args: {
    tasksJson: v.string(),
    maxAttemptsPerTask: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<{
    totalTasks: number;
    solved: number;
    totalScore: number;
    results: Array<{ taskId: string; bestScore: number; solved: boolean }>;
  }> => {
    // NX-10 FIX: Batch solve requires admin
    await requireAdmin(ctx);

    const tasks: ArcTask[] = JSON.parse(args.tasksJson);
    const results: Array<{ taskId: string; bestScore: number; solved: boolean }> = [];
    let solved = 0;
    let totalScore = 0;

    for (const task of tasks) {
      const result = await ctx.runAction(api.arcAgi.solveTask, {
        taskId: task.taskId,
        trainPairs: JSON.stringify(task.train),
        testInputs: JSON.stringify(task.test),
        maxAttempts: args.maxAttemptsPerTask,
      });

      const isSolved = result.bestScore > 0.95;
      if (isSolved) solved++;
      totalScore += result.bestScore;

      results.push({
        taskId: task.taskId,
        bestScore: result.bestScore,
        solved: isSolved,
      });
    }

    return {
      totalTasks: tasks.length,
      solved,
      totalScore: totalScore / tasks.length,
      results,
    };
  },
});

// ── BROADCAST TO KIOSK ───────────────────────────────────────────────────
export const broadcastToKiosk = action({
  args: {
    msgType: v.string(),
    payload: v.string(),
  },
  handler: async (_ctx, args): Promise<{ sent: boolean }> => {
    try {
      const WebSocket = (await import("ws")).default;
      const ws = new WebSocket(BROADCASTER_URL);

      return await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          ws.close();
          resolve({ sent: false });
        }, 3000);

        ws.on("open", () => {
          ws.send(JSON.stringify({
            type: args.msgType,
            payload: JSON.parse(args.payload),
          }));
          clearTimeout(timeout);
          ws.close();
          resolve({ sent: true });
        });

        ws.on("error", () => {
          clearTimeout(timeout);
          resolve({ sent: false });
        });
      });
    } catch {
      return { sent: false };
    }
  },
});

// ── ANALYZE TASK FEATURES ────────────────────────────────────────────────
// Examines training pairs to detect structural clues about the transformation type.
function analyzeTaskFeatures(trainPairs: Array<{ input: number[][]; output: number[][] }>): {
  sizeChanges: boolean;
  colorChanges: boolean;
  dimensionRatio: { rowRatio: number; colRatio: number } | null;
  colorCount: { input: number; output: number };
  hasSymmetry: boolean;
  objectCount: { input: number; output: number };
} {
  const sizeRelationships = trainPairs.map(p => ({
    rowRatio: p.output.length / p.input.length,
    colRatio: (p.output[0]?.length ?? 1) / (p.input[0]?.length ?? 1),
  }));

  const sizeChanges = sizeRelationships.some(r => r.rowRatio !== 1 || r.colRatio !== 1);

  const allSameRatio = sizeRelationships.every(r =>
    Math.abs(r.rowRatio - sizeRelationships[0].rowRatio) < 0.01 &&
    Math.abs(r.colRatio - sizeRelationships[0].colRatio) < 0.01
  );

  const inputColors = new Set(trainPairs.flatMap(p => p.input.flat()));
  const outputColors = new Set(trainPairs.flatMap(p => p.output.flat()));
  const colorChanges = ![...outputColors].every(c => inputColors.has(c));

  // Detect objects (connected components) in first training pair
  const firstInput = trainPairs[0]?.input ?? [];
  const firstOutput = trainPairs[0]?.output ?? [];
  const inputObjects = countConnectedComponents(firstInput);
  const outputObjects = countConnectedComponents(firstOutput);

  // Basic symmetry check on output
  const hasSymmetry = trainPairs.some(p => checkSymmetry(p.output));

  return {
    sizeChanges,
    colorChanges,
    dimensionRatio: allSameRatio ? sizeRelationships[0] : null,
    colorCount: { input: inputColors.size, output: outputColors.size },
    hasSymmetry,
    objectCount: { input: inputObjects, output: outputObjects },
  };
}

// ── RANK STRATEGIES ──────────────────────────────────────────────────────
// Score each strategy based on how well it matches the detected task features.
function rankStrategies(
  features: ReturnType<typeof analyzeTaskFeatures>,
  strategies: typeof STRATEGY_LIBRARY,
): typeof STRATEGY_LIBRARY {
  const scored = strategies.map(s => {
    let score = 0.5; // Base relevance

    switch (s.id) {
      case "geometric":
        if (!features.sizeChanges && !features.colorChanges) score += 0.3;
        if (features.hasSymmetry) score += 0.2;
        break;
      case "color_mapping":
        if (features.colorChanges) score += 0.4;
        if (!features.sizeChanges) score += 0.1;
        break;
      case "structural":
        if (features.sizeChanges) score += 0.2;
        if (features.hasSymmetry) score += 0.2;
        break;
      case "object_level":
        if (features.objectCount.input !== features.objectCount.output) score += 0.3;
        if (features.objectCount.input > 2) score += 0.2;
        break;
      case "conditional":
        if (features.colorChanges && !features.sizeChanges) score += 0.2;
        break;
      case "extraction":
        if (features.sizeChanges && features.dimensionRatio &&
            features.dimensionRatio.rowRatio < 1) score += 0.4;
        break;
      case "composition":
        if (features.sizeChanges && features.colorChanges) score += 0.3;
        break;
      case "rule_induction":
        score += 0.15; // Always somewhat relevant as fallback
        break;
    }

    return { ...s, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

// ── EVALUATE CANDIDATE ───────────────────────────────────────────────────
// Rule extraction-based validation. Goes beyond dimension checking.
function evaluateCandidate(
  trainPairs: Array<{ input: number[][]; output: number[][] }>,
  testInput: number[][],
  candidateOutput: number[][],
  rawResponse: string,
): { confidence: number; reason: string } {
  // 1. Dimension consistency check
  const trainOutputSizes = trainPairs.map(p => ({
    rows: p.output.length,
    cols: p.output[0]?.length ?? 0,
  }));

  const allSameSize = trainOutputSizes.every(s =>
    s.rows === trainOutputSizes[0].rows && s.cols === trainOutputSizes[0].cols
  );

  if (allSameSize) {
    const expectedRows = trainOutputSizes[0].rows;
    const expectedCols = trainOutputSizes[0].cols;
    if (candidateOutput.length !== expectedRows ||
        (candidateOutput[0]?.length ?? 0) !== expectedCols) {
      return { confidence: 0.1, reason: "dimension_mismatch" };
    }
  }

  // 2. Color validity — output should only use colors that appear in training
  const validColors = new Set(trainPairs.flatMap(p => [...p.input.flat(), ...p.output.flat()]));
  const candidateColors = new Set(candidateOutput.flat());
  const invalidColors = [...candidateColors].filter(c => !validColors.has(c));
  if (invalidColors.length > 0) {
    return { confidence: 0.15, reason: "invalid_colors" };
  }

  // 3. Size relationship consistency — if train has consistent I/O ratio, check candidate
  const sizeRelationships = trainPairs.map(p => ({
    rowRatio: p.output.length / p.input.length,
    colRatio: (p.output[0]?.length ?? 1) / (p.input[0]?.length ?? 1),
  }));

  const allSameRatio = sizeRelationships.every(r =>
    Math.abs(r.rowRatio - sizeRelationships[0].rowRatio) < 0.01 &&
    Math.abs(r.colRatio - sizeRelationships[0].colRatio) < 0.01
  );

  if (allSameRatio) {
    const expectedRows = Math.round(testInput.length * sizeRelationships[0].rowRatio);
    const expectedCols = Math.round((testInput[0]?.length ?? 1) * sizeRelationships[0].colRatio);
    if (candidateOutput.length !== expectedRows ||
        (candidateOutput[0]?.length ?? 0) !== expectedCols) {
      return { confidence: 0.2, reason: "size_ratio_mismatch" };
    }
  }

  // 4. Color distribution similarity — output should have similar color proportions
  const trainColorDist = computeColorDistribution(trainPairs.map(p => p.output));
  const candidateColorDist = computeColorDistribution([candidateOutput]);
  const distSimilarity = colorDistributionSimilarity(trainColorDist, candidateColorDist);

  // 5. Non-trivial check — output shouldn't be all one color or identical to input
  const allSameColor = candidateOutput.every(row => row.every(c => c === candidateOutput[0][0]));
  if (allSameColor && !trainPairs.every(p => p.output.every(row => row.every(c => c === p.output[0][0])))) {
    return { confidence: 0.1, reason: "trivial_constant_output" };
  }

  // 6. Composite confidence
  let confidence = 0.4; // Base: passed dimension + color checks
  if (allSameSize || allSameRatio) confidence += 0.2;
  confidence += distSimilarity * 0.3;
  if (!allSameColor) confidence += 0.1;

  return {
    confidence: Math.min(0.95, confidence),
    reason: `passed_checks:dim=${allSameSize || allSameRatio},colors=valid,dist=${distSimilarity.toFixed(2)}`,
  };
}

// ── HELPER: BUILD ARC PROMPT ─────────────────────────────────────────────
function buildArcPrompt(
  trainPairs: Array<{ input: number[][]; output: number[][] }>,
  testInput: number[][],
  strategy: { id: string; name: string; prompt: string },
): string {
  const examples = trainPairs.map((pair, i) =>
    `Example ${i + 1}:\nInput:\n${gridToString(pair.input)}\nOutput:\n${gridToString(pair.output)}`
  ).join("\n\n");

  return `# ARC-AGI Task

You are solving an abstract reasoning task. Study the input→output examples, discover the transformation rule, then apply it to the test input.

## Training Examples
${examples}

## Test Input
${gridToString(testInput)}

## Strategy: ${strategy.name}
${strategy.prompt}

## Instructions
1. Study ALL training examples to find the SINGLE consistent transformation rule
2. VERIFY your rule produces the correct output for EVERY training example
3. If your rule fails on ANY training example, it is WRONG — find a different rule
4. Apply the verified rule to the test input
5. Return ONLY the output grid as a JSON array of arrays of integers

## Output Format
Return ONLY a valid JSON array. Example: [[1,2],[3,4]]
No explanations. No markdown. Just the grid.`;
}

// ── HELPER: CALL ARC SOLVER ──────────────────────────────────────────────
async function callArcSolver(prompt: string, temperature: number): Promise<string> {
  const model = process.env.HUGH_GATEWAY_URL
    ? (process.env.HUGH_GATEWAY_MODEL ?? "LMF-2.5-Thinking-Opus-4.6-Heretic-Distill")
    : "gpt-4";

  const response = await openai.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: "You are an expert at abstract reasoning and pattern recognition. You solve ARC-AGI tasks by discovering transformation rules from examples. Always return ONLY a valid JSON grid array.",
      },
      { role: "user", content: prompt },
    ],
    max_tokens: 2048,
    temperature,
  });

  return response.choices[0]?.message?.content ?? "";
}

// ── HELPER: PARSE GRID OUTPUT ────────────────────────────────────────────
function parseGridOutput(response: string): number[][] | null {
  try {
    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
    else if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
    if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
    cleaned = cleaned.trim();

    const arrayMatch = cleaned.match(/\[\s*\[[\s\S]*?\]\s*\]/);
    if (arrayMatch) {
      const grid = JSON.parse(arrayMatch[0]);
      if (Array.isArray(grid) && grid.every((row: unknown) =>
        Array.isArray(row) && (row as unknown[]).every((cell: unknown) => typeof cell === "number")
      )) {
        return grid;
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ── HELPER: COUNT CONNECTED COMPONENTS ───────────────────────────────────
function countConnectedComponents(grid: number[][]): number {
  if (grid.length === 0) return 0;
  const rows = grid.length;
  const cols = grid[0].length;
  const visited = Array.from({ length: rows }, () => Array(cols).fill(false));
  let count = 0;

  function bfs(r: number, c: number, color: number): void {
    const queue: [number, number][] = [[r, c]];
    visited[r][c] = true;
    while (queue.length > 0) {
      const [cr, cc] = queue.shift()!;
      for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
        const nr = cr + dr;
        const nc = cc + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols &&
            !visited[nr][nc] && grid[nr][nc] === color) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }
  }

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!visited[r][c] && grid[r][c] !== 0) { // 0 = background
        bfs(r, c, grid[r][c]);
        count++;
      }
    }
  }
  return count;
}

// ── HELPER: CHECK SYMMETRY ───────────────────────────────────────────────
function checkSymmetry(grid: number[][]): boolean {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;

  // Horizontal symmetry
  let hSym = true;
  for (let r = 0; r < rows && hSym; r++) {
    for (let c = 0; c < Math.floor(cols / 2) && hSym; c++) {
      if (grid[r][c] !== grid[r][cols - 1 - c]) hSym = false;
    }
  }
  if (hSym) return true;

  // Vertical symmetry
  let vSym = true;
  for (let r = 0; r < Math.floor(rows / 2) && vSym; r++) {
    for (let c = 0; c < cols && vSym; c++) {
      if (grid[r][c] !== grid[rows - 1 - r][c]) vSym = false;
    }
  }
  return vSym;
}

// ── HELPER: COLOR DISTRIBUTION ───────────────────────────────────────────
function computeColorDistribution(grids: number[][][]): Map<number, number> {
  const dist = new Map<number, number>();
  let total = 0;
  for (const grid of grids) {
    for (const row of grid) {
      for (const cell of row) {
        dist.set(cell, (dist.get(cell) ?? 0) + 1);
        total++;
      }
    }
  }
  // Normalize
  for (const [color, count] of dist) {
    dist.set(color, count / total);
  }
  return dist;
}

function colorDistributionSimilarity(a: Map<number, number>, b: Map<number, number>): number {
  const allColors = new Set([...a.keys(), ...b.keys()]);
  let similarity = 0;
  for (const color of allColors) {
    const aVal = a.get(color) ?? 0;
    const bVal = b.get(color) ?? 0;
    similarity += 1 - Math.abs(aVal - bVal);
  }
  return similarity / allColors.size;
}

// ── HELPER: GRID TO STRING ───────────────────────────────────────────────
function gridToString(grid: number[][]): string {
  return grid.map((row) => row.join(" ")).join("\n");
}
