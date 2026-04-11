/**
 * pheromones.ts — Public Somatic Pheromone API
 *
 * Bridge between the CT-101 sidecar (somatic-monitor) and the
 * internal stigmergy system. The sidecar emits hardware telemetry
 * (CPU load, memory pressure, LFM latency) as pheromones that
 * drive the Clifford attractor visualization and influence the
 * endocrine system.
 *
 * Auth: Validates SIDECAR_SECRET to prevent external pheromone poisoning.
 * See: NX-10 (stigmergy.deposit is internalMutation by design)
 */
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function requireSidecarSecret(secret: string) {
  const expected = process.env.SIDECAR_SECRET;
  if (!expected) throw new Error("SIDECAR_SECRET not configured");
  if (secret !== expected) throw new Error("Forbidden — invalid sidecar secret");
}

export const heartbeatAgent = mutation({
  args: {
    agentId: v.string(),
    agentType: v.string(),
    hostname: v.string(),
    publicKey: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSidecarSecret(args.secret);
    const existing = await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.agentId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastHeartbeat: now,
        hostname: args.hostname,
        status: "online",
      });
    } else {
      await ctx.db.insert("agentRegistry", {
        nodeId: args.agentId,
        label: args.agentType,
        agentUrl: "",
        secretHash: args.publicKey,
        platform: "linux",
        hostname: args.hostname,
        status: "online",
        lastHeartbeat: now,
        registeredAt: now,
      });
    }
  },
});

export const emitSomatic = mutation({
  args: {
    source: v.string(),
    intensity: v.number(),
    hueShift: v.number(),
    turbulence: v.number(),
    driftSpeed: v.number(),
    position: v.object({ x: v.number(), y: v.number(), z: v.number() }),
    weight: v.number(),
    ttlMs: v.number(),
    emitterId: v.string(),
    emitterSignature: v.string(),
    secret: v.string(),
  },
  handler: async (ctx, args): Promise<string> => {
    requireSidecarSecret(args.secret);

    const clamped = {
      intensity: Math.max(0, Math.min(1, args.intensity)),
      weight: Math.max(0, Math.min(1, args.weight)),
      ttlMs: Math.min(args.ttlMs, 120000),
    };

    return await ctx.runMutation(internal.stigmergy.deposit, {
      emitterId: args.emitterId,
      nodeId: args.emitterId.split(":")[0] || "unknown",
      signature: args.emitterSignature,
      type: args.source,
      payload: JSON.stringify({
        intensity: clamped.intensity,
        hueShift: args.hueShift,
        turbulence: args.turbulence,
        driftSpeed: args.driftSpeed,
        position: args.position,
      }),
      weight: clamped.weight,
      zone: "somatic",
      ttlMs: clamped.ttlMs,
    });
  },
});
