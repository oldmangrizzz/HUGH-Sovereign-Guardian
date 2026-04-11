import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const recordTrauma = internalMutation({
  args: {
    nodeId: v.string(),
    eventHash: v.string(),
    intensity: v.number(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("traumaRegistry", {
      nodeId: args.nodeId,
      originatingEventHash: args.eventHash,
      injuryTimestamp: Date.now(),
      phase: "hemostasis",
      phaseEnteredAt: Date.now(),
      currentIntensity: args.intensity,
      processingCycleCount: 0,
      healingProgress: 0,
    });
  },
});

export const healStep = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const activeWounds = await ctx.db
      .query("traumaRegistry")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .filter((q) => q.neq(q.field("phase"), "integrated"))
      .collect();

    const endocrine = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();

    if (!endocrine || activeWounds.length === 0) return;

    const healingPotency = (endocrine.serotonin * 0.5 + endocrine.oxytocin * 0.5) - (endocrine.cortisol * 0.2);
    const progressDelta = Math.max(0.001, healingPotency * 0.01);

    for (const wound of activeWounds) {
      const newProgress = Math.min(1.0, wound.healingProgress + progressDelta);
      const newIntensity = Math.max(0, wound.currentIntensity - (progressDelta * 0.5));
      
      let nextPhase = wound.phase;
      if (newProgress >= 1.0) {
        const phases = ["hemostasis", "inflammation", "proliferation", "remodeling", "integrated"];
        const idx = phases.indexOf(wound.phase);
        nextPhase = (idx !== -1 && idx < phases.length - 1) ? phases[idx + 1] : wound.phase;
      }

      await ctx.db.patch(wound._id, {
        healingProgress: newProgress >= 1.0 ? 0 : newProgress,
        currentIntensity: newIntensity,
        phase: nextPhase,
        phaseEnteredAt: nextPhase !== wound.phase ? Date.now() : wound.phaseEnteredAt,
        processingCycleCount: wound.processingCycleCount + 1,
      });
    }
  },
});
