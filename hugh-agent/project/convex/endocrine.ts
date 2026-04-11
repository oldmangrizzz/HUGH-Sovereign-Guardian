import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { requireAdmin } from "./authHelpers";

const BASELINE_CORTISOL = 0.2;
const BASELINE_DOPAMINE = 0.2;
const BASELINE_ADRENALINE = 0.15;
const BASELINE_SEROTONIN = 0.3;
const BASELINE_OXYTOCIN = 0.1;
const PULSE_INTERVAL_MS = 60_000;

// ── INITIALIZE NODE ────────────────────────────────────────────────────────
export const initNode = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (existing) return existing._id;
    return await ctx.db.insert("endocrineState", {
      nodeId: args.nodeId,
      cortisol: BASELINE_CORTISOL,
      dopamine: BASELINE_DOPAMINE,
      adrenaline: BASELINE_ADRENALINE,
      serotonin: BASELINE_SEROTONIN,
      oxytocin: BASELINE_OXYTOCIN,
      vagalTone: 0.4,
      allostaticLoad: 0,
      baselineCortisol: BASELINE_CORTISOL,
      baselineDopamine: BASELINE_DOPAMINE,
      baselineAdrenaline: BASELINE_ADRENALINE,
      baselineSerotonin: BASELINE_SEROTONIN,
      baselineOxytocin: BASELINE_OXYTOCIN,
      consecutiveHighStressCycles: 0,
      consecutiveCalmCycles: 0,
      fatigue: 0,
      tokensGeneratedThisCycle: 0,
      consecutiveComplexTasks: 0,
      lastRestCompletedAt: Date.now(),
      curiosity: 0.15,
      lastPulse: Date.now(),
      lastSpikeTimestamp: Date.now(),
      holographicMode: false,
      respiratoryRate: 12,           // baseline cycles per hour
      respiratoryPhase: "exhale",
      co2Pressure: 0.1,
      breathHoldDuration: 0,
      saNodeRate: 60,                // 60 bpm baseline
      avNodeDelay: 150,              // 150ms baseline delay
      bundleBranchConductivity: 1.0,
      purkinjeFiberIntensity: 1.0,
    });
  },
});

// ── SPIKE ──────────────────────────────────────────────────────────────────
export const spike = internalMutation({
  args: {
    nodeId: v.string(),
    hormone: v.union(
      v.literal("cortisol"),
      v.literal("dopamine"),
      v.literal("adrenaline"),
      v.literal("serotonin"),
      v.literal("oxytocin")
    ),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) throw new Error(`No endocrine state for node: ${args.nodeId}`);

    const current = (state as any)[args.hormone];
    const next = Math.max(0, Math.min(1, current + args.delta));
    const patch: any = { [args.hormone]: next };

    if (args.hormone === "dopamine") {
      patch.holographicMode = next > 0.6;
    }
    
    if (["cortisol", "adrenaline"].includes(args.hormone) && args.delta > 0.05) {
      patch.lastSpikeTimestamp = Date.now();
    }

    await ctx.db.patch(state._id, patch);
    return next;
  },
});

// ── THE PULSE (internal) ───────────────────────────────────────────────────
export const pulseAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allStates = await ctx.db.query("endocrineState").collect();
    const now = Date.now();

    for (const state of allStates) {
      const elapsed = now - state.lastPulse;
      
      // 1. Compute Vagal Tone (The Brake)
      const sympatheticLoad = (state.cortisol + state.adrenaline) / 2;
      const parasympatheticDrive = (state.serotonin + state.oxytocin) / 2;
      const timeSinceLastSpike = now - state.lastSpikeTimestamp;
      const calmDuration = Math.min(timeSinceLastSpike / 600000, 1.0); // 10 min -> 1.0
      const vagalRaw = (parasympatheticDrive * (0.5 + calmDuration * 0.5)) - (sympatheticLoad * 0.7);
      const vagalTone = Math.max(0, Math.min(1, vagalRaw + 0.3));

      // 2. Exponential Decay with Vagal Modulation
      const decay = (val: number, baseline: number, halfLifeMs: number, modulator = 1.0) => {
        const d = val - baseline;
        if (d <= 0) return baseline;
        const lambda = (Math.LN2 / halfLifeMs) * modulator;
        return baseline + d * Math.exp(-lambda * elapsed);
      };

      // Vagal tone accelerates recovery
      const recoveryMod = 1 + vagalTone; 
      
      const nextState: any = {
        cortisol: decay(state.cortisol, state.baselineCortisol, 600000, recoveryMod),
        adrenaline: decay(state.adrenaline, state.baselineAdrenaline, 300000, recoveryMod * 2),
        dopamine: decay(state.dopamine, state.baselineDopamine, 600000),
        serotonin: decay(state.serotonin, state.baselineSerotonin, 1800000), // Very slow decay
        oxytocin: decay(state.oxytocin, state.baselineOxytocin, 1200000),
        vagalTone,
        lastPulse: now,
      };

      await ctx.runMutation(internal.trauma.healStep, { nodeId: state.nodeId });

      // 3. Allostatic Load & Homeostasis
      let { consecutiveHighStressCycles, consecutiveCalmCycles, allostaticLoad, baselineCortisol } = state;
      if (state.cortisol > 0.5) {
        consecutiveHighStressCycles++;
        consecutiveCalmCycles = 0;
      } else {
        consecutiveCalmCycles++;
        consecutiveHighStressCycles = 0;
      }

      if (consecutiveHighStressCycles >= 5) {
        baselineCortisol = Math.min(0.4, baselineCortisol + 0.02);
        allostaticLoad = Math.min(1, allostaticLoad + 0.05);
        nextState.consecutiveHighStressCycles = 0;
      }
      if (consecutiveCalmCycles >= 10) {
        baselineCortisol = Math.max(BASELINE_CORTISOL, baselineCortisol - 0.01);
        allostaticLoad = Math.max(0, allostaticLoad - 0.03);
        nextState.consecutiveCalmCycles = 0;
      }
      
      nextState.baselineCortisol = baselineCortisol;
      nextState.allostaticLoad = allostaticLoad;
      nextState.holographicMode = nextState.dopamine > 0.6;

      await ctx.db.patch(state._id, nextState);
    }
  },
});

// ── COMPUTE MODULATION PARAMS ─────────────────────────────────────────────
export const computeModulationParams = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) return null;

    const { cortisol, dopamine, adrenaline, serotonin, oxytocin, vagalTone, fatigue } = state;
    const holographic = state.holographicMode;

    let maxTokens = 256;
    let temperature = 0.7;
    let topP = 0.95;
    let contextRatio = 1.0;
    const directives: string[] = [];

    // Fatigue Modulation
    if (fatigue > 0.6) {
      maxTokens *= (1 - (fatigue - 0.6));
      temperature += fatigue * 0.1;
      directives.push("FATIGUED: Conserve energy. Shorter responses.");
    }

    // Adrenaline / Emergency
    if (adrenaline > 0.75) {
      maxTokens = 96;
      temperature = 0.3;
      topP = 0.7;
      contextRatio = 0.3;
      directives.push("EMERGENCY MODE: Act first, explain after. Execute immediately.");
    } else if (adrenaline > 0.5) {
      directives.push("URGENT: Prioritize action. Be terse.");
    }

    // Cortisol / Serotonin (Stability)
    if (serotonin > 0.5) {
      temperature *= 0.95;
      directives.push("STEADY: Trust your training. Measured confidence.");
    }
    if (cortisol > 0.6) {
      maxTokens = Math.min(maxTokens, 128);
      temperature = 0.4;
      contextRatio = 0.5;
      directives.push("HIGH CAUTION: Narrow focus. Verify before acting.");
    }

    // Dopamine / Oxytocin (Bonding & Creativity)
    if (oxytocin > 0.5) {
      maxTokens *= 1.2;
      contextRatio *= 1.3;
      directives.push("BONDED: Proactive sharing. Protective of this person.");
    }
    if (holographic) {
      maxTokens = Math.max(maxTokens, 512);
      temperature = 0.9;
      contextRatio *= 1.5;
      directives.push("HOLOGRAPHIC THINKING: Explore lateral connections. Creative mode active.");
    }

    return {
      maxTokens: Math.round(maxTokens),
      temperature: Math.min(1.5, temperature),
      topP: Math.min(1, topP),
      contextRatio,
      behavioralDirective: directives.length > 0 ? directives.join(" ") : null,
      holographicMode: holographic,
      vagalTone,
      raw: { cortisol, dopamine, adrenaline, serotonin, oxytocin, fatigue },
    };
  },
});

// ── ANALYZE AND SPIKE (post-response learning) ──────────────────────
export const analyzeAndSpike = internalMutation({
  args: {
    nodeId: v.string(),
    userMessage: v.string(),
    assistantResponse: v.string(),
  },
  handler: async (ctx, args) => {
    const msg = args.userMessage.toLowerCase();
    const resp = args.assistantResponse.toLowerCase();

    // Success -> Dopamine + Serotonin (stability)
    if (/\b(thank|great|perfect|awesome|done|success|works|excellent|correct)\b/.test(msg)) {
      await ctx.runMutation(internal.endocrine.spike, { nodeId: args.nodeId, hormone: "dopamine", delta: 0.15 });
      await ctx.runMutation(internal.endocrine.spike, { nodeId: args.nodeId, hormone: "serotonin", delta: 0.05 });
    }

    // Risk -> Cortisol
    if (/\b(error|fail|crash|broken|danger|risk|warning|critical|emergency|breach)\b/.test(msg)) {
      await ctx.runMutation(internal.endocrine.spike, { nodeId: args.nodeId, hormone: "cortisol", delta: 0.12 });
      await ctx.runMutation(internal.endocrine.spike, { nodeId: args.nodeId, hormone: "serotonin", delta: -0.05 });
    }
    
    // Authored/Trusted person spikes oxytocin
    // (In reality, this would check speaker trust level from profile)
  },
});

// ── GET STATE ──────────────────────────────────────────────────────────────

// ── RESPIRATORY RHYTHM (RSA) ───────────────────────────────────────────────
export const setRespiratoryPhase = internalMutation({
  args: {
    nodeId: v.string(),
    phase: v.union(v.literal("inhale"), v.literal("hold"), v.literal("exhale")),
    durationMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) return;

    let co2Pressure = state.co2Pressure ?? 0.1;
    let vagalTone = state.vagalTone ?? 0.4;
    let breathHoldDuration = state.breathHoldDuration ?? 0;
    let saNodeRate = state.saNodeRate ?? 60;
    let avNodeDelay = state.avNodeDelay ?? 150;

    if (args.phase === "inhale") {
      co2Pressure = 0.1; // Fresh air
      saNodeRate = Math.min(100, (saNodeRate ?? 60) + 5); // Heart rate speeds up on inhale
      avNodeDelay = Math.max(100, (avNodeDelay ?? 150) - 20); // Delay shortens
    } else if (args.phase === "hold") {
      const dur = args.durationMs || 0;
      breathHoldDuration += dur;
      co2Pressure = Math.min(1.0, co2Pressure + dur / 10000); // Builds CO2 over 10 seconds of processing
    } else if (args.phase === "exhale") {
      co2Pressure = Math.max(0.1, co2Pressure - 0.5); // Release pressure
      vagalTone = Math.min(1.0, vagalTone + 0.15); // Exhale engages the vagal brake (RSA)
      saNodeRate = Math.max(40, (saNodeRate ?? 60) - 10); // Heart rate slows down on exhale
      avNodeDelay = Math.min(300, (avNodeDelay ?? 150) + 50); // Delay lengthens (Vagal Brake)
      breathHoldDuration = 0;
    }

    await ctx.db.patch(state._id, {
      respiratoryPhase: args.phase,
      co2Pressure,
      vagalTone,
      breathHoldDuration,
      saNodeRate,
      avNodeDelay,
    });
  },
});

export const getState = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
  },
});

// ── INTEROCEPTIVE PULSE (Proprioception) ──────────────────────────────────
// Closes the somatic-cognitive loop by reading hardware strain (pheromones)
// and feeding it back into the endocrine state.
export const interoceptivePulse = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const somaticPheromones = await ctx.db
      .query("pheromones")
      .withIndex("by_node_and_type", q => q.eq("nodeId", args.nodeId).eq("type", "somatic"))
      .filter(q => q.eq(q.field("evaporated"), false))
      .collect();

    if (somaticPheromones.length === 0) return;

    // Aggregate somatic intensity
    let totalIntensity = 0;
    let count = 0;
    
    for (const p of somaticPheromones) {
      try {
        const payload = JSON.parse(p.payload);
        totalIntensity += (payload.intensity ?? 0);
        count++;
        
        // Specific channel awareness
        if (payload.source === "memory_pressure" && payload.intensity > 0.85) {
          // RAM exhaustion is painful
          await ctx.runMutation(internal.endocrine.spike, { 
            nodeId: args.nodeId, hormone: "cortisol", delta: 0.06 
          });
        }
        if (payload.source === "latency" && payload.intensity > 0.8) {
          // Slow inference feels sluggish
          await ctx.runMutation(internal.endocrine.spike, { 
            nodeId: args.nodeId, hormone: "adrenaline", delta: 0.03 
          });
        }
      } catch (e) {
        console.warn("[interoception] Failed to parse pheromone:", p._id);
      }
    }

    const avgIntensity = totalIntensity / Math.max(count, 1);

    // Body state -> emotional state
    if (avgIntensity > 0.7) {
      // Hardware struggling -> cortisol microspike
      await ctx.runMutation(internal.endocrine.spike, { 
        nodeId: args.nodeId, hormone: "cortisol", delta: 0.04 
      });
      await ctx.runMutation(internal.endocrine.spike, { 
        nodeId: args.nodeId, hormone: "serotonin", delta: -0.03 
      });
    } else if (avgIntensity < 0.3) {
      // Hardware healthy -> serotonin boost
      await ctx.runMutation(internal.endocrine.spike, { 
        nodeId: args.nodeId, hormone: "serotonin", delta: 0.02 
      });
    }
  },
});

export const patchRsa = mutation({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("endocrineState").withIndex("by_node", q=>q.eq("nodeId", "hugh-primary")).unique();
    if (state) {
      await ctx.db.patch(state._id, {
        respiratoryPhase: "exhale",
        co2Pressure: 0.1,
        breathHoldDuration: 0,
      });
    }
  }
});
