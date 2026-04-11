/**
 * cns.ts — Central Nervous System (BitNet 1.58b + Meta-Harness)
 *
 * This is the cognitive gatekeeper. It maps the Limbic System (pheromones)
 * to a ternary attention mask {-1, 0, 1} that filters the environmental
 * context for the Meta-Harness Proposer.
 */
import { action, internalMutation, query, mutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const NODE_ID = "hugh-primary";

// ── COMPUTE BITNET MASK ───────────────────────────────────────────────────
// Maps limbic pheromones to ternary weights for environmental features.
export const computeBitNetMask = internalAction({
  args: { 
    features: v.array(v.object({
      id: v.string(),
      type: v.union(v.literal("log"), v.literal("tool"), v.literal("code"), v.literal("sensor")),
      metadata: v.optional(v.string())
    }))
  },
  handler: async (ctx, args) => {
    // 1. Get current Endocrine State (Limbic Substrate)
    const endocrine = await ctx.runQuery(api.endocrine.getState, { nodeId: NODE_ID });
    if (!endocrine) throw new Error("Endocrine state not initialized");

    const { cortisol, dopamine, adrenaline } = endocrine;
    const mask: Record<string, number> = {};

    // 2. BitNet Ternary Logic Mapping:
    // Cortisol (Stress) -> Narrowed focus. Increases INHIBITION (-1) of noise/logs.
    // Dopamine (Reward) -> Exploration. Increases EXCITEMENT (+1) of tools/discovery.
    // Adrenaline (Urgency) -> Rapid action. Collapses Neutral (0) into binary choice.

    for (const feature of args.features) {
      let weight = 0;

      // Feature-specific heuristics
      if (feature.type === "log" || feature.type === "sensor") {
        // High cortisol inhibits background logs to focus on errors
        weight = cortisol > 0.6 ? -1 : 0;
        // If the log contains 'error', force excitement regardless of cortisol
        if (feature.metadata?.toLowerCase().includes("error")) weight = 1;
      } 
      else if (feature.type === "tool" || feature.type === "code") {
        // High dopamine excites exploration of new tools/code paths
        weight = dopamine > 0.5 ? 1 : 0;
      }

      // Adrenaline Force-Multiplier:
      // If adrenaline is high, we don't have time for neutral states.
      // Force a decision: either it's important (1) or it's out (-1).
      if (adrenaline > 0.75 && weight === 0) {
        weight = Math.random() > 0.5 ? 1 : -1; 
      }

      mask[feature.id] = weight;

      // 3. Persist for UE5 Rendering (Motor Cortex)
      await ctx.runMutation(internal.cns.updateTernaryAttention, {
        nodeId: NODE_ID,
        contextKey: feature.id,
        weight,
      });
    }

    return mask;
  },
});

// ── GET ACTIVE MASK ───────────────────────────────────────────────────────
export const getActiveMask = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ternaryAttention")
      .withIndex("by_node_and_key", (q) => q.eq("nodeId", args.nodeId))
      .collect();
  },
});

// ── INTERNAL: UPDATE ATTENTION ───────────────────────────────────────────
export const updateTernaryAttention = internalMutation({
  args: {
    nodeId: v.string(),
    contextKey: v.string(),
    weight: v.number(),
    reason: v.optional(v.string()),
    candidateId: v.optional(v.id("harnessCandidates")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ternaryAttention")
      .withIndex("by_node_and_key", (q) =>
        q.eq("nodeId", args.nodeId).eq("contextKey", args.contextKey)
      )
      .unique();

    const previousWeight = existing?.weight ?? 0;
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { weight: args.weight, updatedAt: now });
    } else {
      await ctx.db.insert("ternaryAttention", {
        nodeId: args.nodeId,
        contextKey: args.contextKey,
        weight: args.weight,
        updatedAt: now,
      });
    }

    // Record weight change in history for learning analysis
    if (previousWeight !== args.weight) {
      await ctx.db.insert("weightHistory", {
        nodeId: args.nodeId,
        contextKey: args.contextKey,
        previousWeight,
        newWeight: args.weight,
        delta: args.weight - previousWeight,
        reason: args.reason ?? "cns_update",
        candidateId: args.candidateId,
        ts: now,
      });
    }
  },
});

// ── LEARNING RATE EMA ────────────────────────────────────────────────────
const LEARNING_RATE = 0.1;

export const adjustWeightEma = internalMutation({
  args: {
    nodeId: v.string(),
    contextKey: v.string(),
    targetWeight: v.number(),
    reason: v.optional(v.string()),
    candidateId: v.optional(v.id("harnessCandidates")),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ternaryAttention")
      .withIndex("by_node_and_key", (q) =>
        q.eq("nodeId", args.nodeId).eq("contextKey", args.contextKey)
      )
      .unique();

    const currentWeight = existing?.weight ?? 0;
    // EMA: new = current + lr * (target - current)
    const newWeight = currentWeight + LEARNING_RATE * (args.targetWeight - currentWeight);
    const clampedWeight = Math.max(-1, Math.min(1, newWeight));
    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, { weight: clampedWeight, updatedAt: now });
    } else {
      await ctx.db.insert("ternaryAttention", {
        nodeId: args.nodeId,
        contextKey: args.contextKey,
        weight: clampedWeight,
        updatedAt: now,
      });
    }

    await ctx.db.insert("weightHistory", {
      nodeId: args.nodeId,
      contextKey: args.contextKey,
      previousWeight: currentWeight,
      newWeight: clampedWeight,
      delta: clampedWeight - currentWeight,
      reason: args.reason ?? "ema_adjustment",
      candidateId: args.candidateId,
      ts: now,
    });

    return clampedWeight;
  },
});

// ── GET WEIGHT HISTORY ───────────────────────────────────────────────────
export const getWeightHistory = query({
  args: {
    nodeId: v.string(),
    contextKey: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.contextKey) {
      return await ctx.db
        .query("weightHistory")
        .withIndex("by_context_key", (q) =>
          q.eq("nodeId", args.nodeId).eq("contextKey", args.contextKey!)
        )
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db
      .query("weightHistory")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
