import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const BASELINE = 0.2;
const PULSE_INTERVAL_MS = 60_000;

// ── INITIALIZE NODE ────────────────────────────────────────────────────────
// Called when a node first comes online. Creates its endocrine record.
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
      cortisol: BASELINE,
      dopamine: BASELINE,
      adrenaline: BASELINE,
      lastPulse: Date.now(),
      holographicMode: false,
    });
  },
});

// ── GET STATE ──────────────────────────────────────────────────────────────
export const getState = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
  },
});

// ── GET ALL NODES ──────────────────────────────────────────────────────────
export const getAllStates = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("endocrineState").collect();
  },
});

// ── SPIKE ──────────────────────────────────────────────────────────────────
// Raise a hormone scalar. Clamped 0.0–1.0.
// cortisol  → high-risk/irreversible ops: narrows focus, increases caution
// dopamine  → task completion/synthesis: enables lateral creative connection
// adrenaline → time-sensitive queries: increases processing speed
export const spike = mutation({
  args: {
    nodeId: v.string(),
    hormone: v.union(
      v.literal("cortisol"),
      v.literal("dopamine"),
      v.literal("adrenaline")
    ),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) throw new Error(`No endocrine state for node: ${args.nodeId}`);

    const current = state[args.hormone];
    const next = Math.max(0, Math.min(1, current + args.delta));
    const patch: Record<string, number | boolean> = { [args.hormone]: next };

    // Holographic Thinking Mode activates when dopamine > 0.6
    if (args.hormone === "dopamine") {
      patch.holographicMode = next > 0.6;
    }

    await ctx.db.patch(state._id, patch);
    return next;
  },
});

// ── THE PULSE (internal) ───────────────────────────────────────────────────
// Unconditional linear decay toward baseline every 60s.
// Elevated states are temporary by design. This runs regardless.
export const pulse = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) return;

    const now = Date.now();
    const elapsed = now - state.lastPulse;
    const ticks = elapsed / PULSE_INTERVAL_MS;

    const decay = (val: number) => {
      const d = val - BASELINE;
      if (d <= 0) return BASELINE;
      // Exponential decay: N(t) = N0 * e^(-λt)
      // For a ~10 minute half-life: λ = ln(2) / 600000 ms
      const lambda = Math.LN2 / 600000;
      return BASELINE + d * Math.exp(-lambda * elapsed);
    };

    const newCortisol = decay(state.cortisol);
    const newDopamine = decay(state.dopamine);
    const newAdrenaline = decay(state.adrenaline);

    await ctx.db.patch(state._id, {
      cortisol: newCortisol,
      dopamine: newDopamine,
      adrenaline: newAdrenaline,
      lastPulse: now,
      holographicMode: newDopamine > 0.6,
    });
  },
});

// ── PULSE ALL NODES (internal) ─────────────────────────────────────────────
// Called by the cron. Decays every registered node.
export const pulseAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const allStates = await ctx.db.query("endocrineState").collect();
    const now = Date.now();

    for (const state of allStates) {
      const elapsed = now - state.lastPulse;
      const ticks = elapsed / PULSE_INTERVAL_MS;
      const decay = (val: number) => {
        const d = val - BASELINE;
        if (d <= 0) return BASELINE;
        const lambda = Math.LN2 / 600000;
        return BASELINE + d * Math.exp(-lambda * elapsed);
      };
      const newCortisol = decay(state.cortisol);
      const newDopamine = decay(state.dopamine);
      const newAdrenaline = decay(state.adrenaline);
      await ctx.db.patch(state._id, {
        cortisol: newCortisol,
        dopamine: newDopamine,
        adrenaline: newAdrenaline,
        lastPulse: now,
        holographicMode: newDopamine > 0.6,
      });
    }
  },
});

// ── TRIGGER PULSE (public) ─────────────────────────────────────────────────
// External services can call this to force a decay tick on a specific node.
export const triggerPulse = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.endocrine.pulse, { nodeId: args.nodeId });
  },
});
