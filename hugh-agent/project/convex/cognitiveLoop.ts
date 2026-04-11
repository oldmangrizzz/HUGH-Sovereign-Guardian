/**
 * cognitiveLoop.ts — 6-Stage Cognitive Loop Orchestrator
 *
 * This is the master conductor that ties the full H.U.G.H. cognitive
 * architecture together in one coherent cycle:
 *
 * Stage 1: SENSE     — Receive stimulus (chat, wake word, ARC task, flare)
 * Stage 2: FILTER    — CNS BitNet mask filters context {-1, 0, +1}
 * Stage 3: FEEL      — Endocrine system modulates emotional state
 * Stage 4: THINK     — Proposer generates candidate response/solution
 * Stage 5: ACT       — Harness executes candidate, KVM dispatches commands
 * Stage 6: LEARN     — Pareto scoring → weight reinforcement/inhibition → memory consolidation
 *
 * Each stage feeds into the next. The loop is self-improving:
 * successful actions reinforce CNS weights, failed actions inhibit them.
 */
"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import type { EnvironmentFeature } from "./harnessDb";
import { requireAdmin } from "./authHelpers";

const NODE_ID = "hugh-primary";

// ── STIMULUS TYPES ───────────────────────────────────────────────────────
type StimulusType = "chat" | "wake_word" | "arc_task" | "flare" | "cron" | "kvm_result";

interface CognitiveResult {
  stimulusType: StimulusType;
  stages: {
    sense: { received: boolean; featureCount: number };
    filter: { excited: number; inhibited: number; neutral: number };
    feel: { cortisol: number; dopamine: number; adrenaline: number };
    think: { candidateId?: string; proposalGenerated: boolean };
    act: { executed: boolean; success?: boolean; score?: number };
    learn: { weightsUpdated: number; memoryConsolidated: boolean };
  };
  totalDurationMs: number;
}

// ── FULL COGNITIVE CYCLE ─────────────────────────────────────────────────
/**
 * Executes a complete cognitive cycle triggered by an external stimulus.
 *
 * This is the main entry point for autonomous cognitive processing.
 * For chat interactions, use hugh.ts directly (it has its own loop).
 * This is for meta-harness optimization and ARC-AGI solving.
 */
export const runCycle = action({
  args: {
    stimulusType: v.string(),
    stimulusData: v.string(), // JSON payload — shape depends on stimulusType
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<CognitiveResult> => {
    // NX-10 FIX: Cognitive loop requires admin
    await requireAdmin(ctx);

    const startTime = Date.now();
    const sessionId = args.sessionId ?? `cycle-${Date.now()}`;
    const stimulusType = args.stimulusType as StimulusType;

    const result: CognitiveResult = {
      stimulusType,
      stages: {
        sense: { received: false, featureCount: 0 },
        filter: { excited: 0, inhibited: 0, neutral: 0 },
        feel: { cortisol: 0, dopamine: 0, adrenaline: 0 },
        think: { proposalGenerated: false },
        act: { executed: false },
        learn: { weightsUpdated: 0, memoryConsolidated: false },
      },
      totalDurationMs: 0,
    };

    // ── STAGE 1: SENSE ─────────────────────────────────────────────────
    await ctx.runMutation(internal.endocrine.setRespiratoryPhase, { nodeId: NODE_ID, phase: "inhale" });
    // Parse stimulus into environmental features
    const features: EnvironmentFeature[] = extractFeatures(stimulusType, args.stimulusData);
    result.stages.sense = { received: true, featureCount: features.length };

    if (features.length === 0) {
      result.totalDurationMs = Date.now() - startTime;
      return result;
    }

    // ── STAGE 2: FILTER (CNS BitNet) ───────────────────────────────────
    // Apply ternary attention mask to determine what's important
    const mask = await ctx.runAction(internal.cns.computeBitNetMask, { features });

    let excited = 0, inhibited = 0, neutral = 0;
    for (const weight of Object.values(mask)) {
      if (weight > 0) excited++;
      else if (weight < 0) inhibited++;
      else neutral++;
    }
    result.stages.filter = { excited, inhibited, neutral };

    // ── STAGE 3: FEEL (Endocrine) ──────────────────────────────────────
    // Read current emotional state — it influences decision-making
    const endocrine = await ctx.runQuery(api.endocrine.getState, { nodeId: NODE_ID });
    if (endocrine) {
      result.stages.feel = {
        cortisol: endocrine.cortisol,
        dopamine: endocrine.dopamine,
        adrenaline: endocrine.adrenaline,
      };
    }

    // Modulate based on stimulus type
    if (stimulusType === "flare") {
      await ctx.runMutation(internal.endocrine.spike, {
        nodeId: NODE_ID,
        hormone: "adrenaline",
        delta: 0.3,
      });
    } else if (stimulusType === "arc_task") {
      await ctx.runMutation(internal.endocrine.spike, {
        nodeId: NODE_ID,
        hormone: "adrenaline",
        delta: 0.15,
      });
    }

    // ── STAGE 4: THINK (Proposer) ──────────────────────────────────────
    const thinkStart = Date.now();
    await ctx.runMutation(internal.endocrine.setRespiratoryPhase, { nodeId: NODE_ID, phase: "hold" });
    // Generate a candidate solution/action
    try {
      if (stimulusType === "arc_task") {
        // For ARC tasks, use the dedicated solver
        const taskData = JSON.parse(args.stimulusData);
        const arcResult = await ctx.runAction(api.arcAgi.solveTask, {
          taskId: taskData.taskId ?? "unknown",
          trainPairs: JSON.stringify(taskData.train ?? []),
          testInputs: JSON.stringify(taskData.test ?? []),
          maxAttempts: 3,
        });
        result.stages.think = {
          proposalGenerated: true,
          candidateId: `arc-${arcResult.taskId}`,
        };
        result.stages.act = {
          executed: true,
          success: arcResult.bestScore > 0.5,
          score: arcResult.bestScore,
        };
      } else {
        // For meta-harness optimization, use the proposer
        const proposalResult = await ctx.runAction(internal.proposer.proposeNextCandidate, {
          nodeId: NODE_ID,
          taskDescription: args.stimulusData,
        });
        result.stages.think = {
          proposalGenerated: true,
          candidateId: proposalResult.candidateId,
        };

        const thinkDurationMs = Date.now() - thinkStart;
        await ctx.runMutation(internal.endocrine.setRespiratoryPhase, { nodeId: NODE_ID, phase: "hold", durationMs: thinkDurationMs });
        // ── STAGE 5: ACT (Harness) ──────────────────────────────────────
        const executionResult = await ctx.runAction(internal.harness.executeHarness, {
          candidateId: proposalResult.candidateId as Id<"harnessCandidates">,
        });
        result.stages.act = {
          executed: true,
          success: executionResult.success,
          score: executionResult.score,
        };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[cogLoop] Think/Act failed: ${msg}`);
      // Cortisol spike on failure
      await ctx.runMutation(internal.endocrine.spike, {
        nodeId: NODE_ID,
        hormone: "cortisol",
        delta: 0.15,
      });
    }

    // ── STAGE 6: LEARN ─────────────────────────────────────────────────
    await ctx.runMutation(internal.endocrine.setRespiratoryPhase, { nodeId: NODE_ID, phase: "exhale" });
    // Weight reinforcement/inhibition happens inside harness.executeHarness
    // Here we do memory consolidation
    try {
      await ctx.runMutation(internal.memory.writeEpisode, {
        sessionId,
        eventType: "system_event",
        content: `Cognitive cycle completed: ${stimulusType} → ${result.stages.act.success ? "SUCCESS" : "INCOMPLETE"} (score: ${result.stages.act.score?.toFixed(3) ?? "N/A"})`,
        importance: result.stages.act.success ? 0.8 : 0.4,
        cortisolAtTime: result.stages.feel.cortisol,
        dopamineAtTime: result.stages.feel.dopamine,
        adrenalineAtTime: result.stages.feel.adrenaline,
      });
      result.stages.learn = {
        weightsUpdated: excited + inhibited, // Features that had non-zero weights
        memoryConsolidated: true,
      };
    } catch {
      result.stages.learn = { weightsUpdated: 0, memoryConsolidated: false };
    }

    // Dopamine reward for completing the full cycle
    if (result.stages.act.success) {
      await ctx.runMutation(internal.endocrine.spike, {
        nodeId: NODE_ID,
        hormone: "dopamine",
        delta: 0.1,
      });
    }

    result.totalDurationMs = Date.now() - startTime;
    return result;
  },
});

// ── HELPER: EXTRACT FEATURES FROM STIMULUS ───────────────────────────────
function extractFeatures(stimulusType: StimulusType, data: string): EnvironmentFeature[] {
  const features: EnvironmentFeature[] = [];

  switch (stimulusType) {
    case "chat":
      features.push({ id: "chat:message", type: "log", metadata: data.substring(0, 200) });
      break;

    case "wake_word":
      features.push({ id: "sensor:wake_word", type: "sensor", metadata: "Wake word detected" });
      features.push({ id: "sensor:audio", type: "sensor", metadata: "Audio input active" });
      break;

    case "arc_task": {
      features.push({ id: "tool:arc_solver", type: "tool", metadata: "ARC-AGI task processing" });
      try {
        const taskData = JSON.parse(data);
        if (taskData.train) {
          features.push({
            id: `code:arc_train_${taskData.train.length}`,
            type: "code",
            metadata: `${taskData.train.length} training examples`,
          });
        }
      } catch {
        // Parse failure — still include base feature
      }
      break;
    }

    case "flare":
      features.push({ id: "sensor:flare", type: "sensor", metadata: "Emergency flare received" });
      features.push({ id: "log:alert", type: "log", metadata: data.substring(0, 200) });
      break;

    case "cron":
      features.push({ id: "tool:cron", type: "tool", metadata: "Scheduled maintenance" });
      break;

    case "kvm_result":
      features.push({ id: "tool:kvm", type: "tool", metadata: "KVM execution result" });
      if (data.toLowerCase().includes("error")) {
        features.push({ id: "log:error", type: "log", metadata: "Error in KVM result" });
      }
      break;
  }

  return features;
}
