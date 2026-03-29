import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── DEPOSIT ────────────────────────────────────────────────────────────────
// An agent deposits a pheromone into the shared substrate.
// No agent ever calls another agent directly. This is the only coordination path.
export const deposit = mutation({
  args: {
    emitterId: v.string(),
    nodeId: v.string(),
    signature: v.string(),
    type: v.string(),
    payload: v.string(),
    weight: v.number(),
    zone: v.string(),
    ttlMs: v.number(), // how long this signal lives in ms
  },
  handler: async (ctx, args) => {
    const expiresAt = Date.now() + args.ttlMs;
    const id = await ctx.db.insert("pheromones", {
      emitterId: args.emitterId,
      nodeId: args.nodeId,
      signature: args.signature,
      type: args.type,
      payload: args.payload,
      weight: args.weight,
      zone: args.zone,
      expiresAt,
      evaporated: false,
    });
    return id;
  },
});

// ── OBSERVE ────────────────────────────────────────────────────────────────
// Read all active (non-evaporated, non-expired) pheromones for a node.
// This is how agents sense the environment without calling each other.
export const observe = query({
  args: {
    nodeId: v.string(),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    let q = ctx.db
      .query("pheromones")
      .withIndex("by_node_and_type", (q) =>
        args.type
          ? q.eq("nodeId", args.nodeId).eq("type", args.type)
          : q.eq("nodeId", args.nodeId)
      );

    const results = await q.collect();
    return results.filter((p) => !p.evaporated && p.expiresAt > now);
  },
});

// ── EVAPORATE ─────────────────────────────────────────────────────────────
// Soft-delete a specific pheromone. Called by the emitter or by the autophagy cycle.
export const evaporate = mutation({
  args: { pheromoneId: v.id("pheromones") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.pheromoneId, { evaporated: true });
  },
});

// ── EVAPORATE EXPIRED ─────────────────────────────────────────────────────
// Internal: sweep all expired pheromones. Called by the autophagy cron.
export const evaporateExpired = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("pheromones")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .collect();

    let count = 0;
    for (const p of expired) {
      if (!p.evaporated) {
        await ctx.db.patch(p._id, { evaporated: true });
        count++;
      }
    }
    return count;
  },
});

// ── UPDATE WEIGHT ─────────────────────────────────────────────────────────
// Reinforce or weaken an existing pheromone signal.
export const updateWeight = mutation({
  args: {
    pheromoneId: v.id("pheromones"),
    weight: v.number(),
  },
  handler: async (ctx, args) => {
    const clamped = Math.max(0, Math.min(1, args.weight));
    await ctx.db.patch(args.pheromoneId, { weight: clamped });
  },
});

// ── GET ALL FOR NODE ───────────────────────────────────────────────────────
// Returns all pheromones including evaporated — for autophagy/audit use.
export const getAllForNode = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("pheromones")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", args.nodeId))
      .collect();
  },
});
