/**
 * system.ts — Public System Mutation API
 *
 * Bridge between the CT-101 sidecar and internal endocrine system.
 * The somatic monitor calls updateHormones when hardware intensity
 * exceeds 0.8 — this is the interoceptive feedback loop that
 * connects physical infrastructure stress to HUGH's emotional state.
 *
 * Auth: Validates SIDECAR_SECRET to prevent external hormone manipulation.
 * See: NX-09 (endocrine.spike is internalMutation by design)
 */
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

function requireSidecarSecret(secret: string) {
  const expected = process.env.SIDECAR_SECRET;
  if (!expected) throw new Error("SIDECAR_SECRET not configured");
  if (secret !== expected) throw new Error("Forbidden — invalid sidecar secret");
}

export const updateHormones = mutation({
  args: {
    cortisolDelta: v.optional(v.number()),
    dopamineDelta: v.optional(v.number()),
    adrenalineDelta: v.optional(v.number()),
    nodeId: v.optional(v.string()),
    secret: v.string(),
  },
  handler: async (ctx, args) => {
    requireSidecarSecret(args.secret);

    const node = args.nodeId || "hugh-primary";
    const MAX_DELTA = 0.15;

    const deltas = [
      { hormone: "cortisol" as const, delta: args.cortisolDelta },
      { hormone: "dopamine" as const, delta: args.dopamineDelta },
      { hormone: "adrenaline" as const, delta: args.adrenalineDelta },
    ];

    const results: Record<string, number> = {};

    for (const { hormone, delta } of deltas) {
      if (delta !== undefined && delta !== 0) {
        const clamped = Math.max(-MAX_DELTA, Math.min(MAX_DELTA, delta));
        results[hormone] = await ctx.runMutation(internal.endocrine.spike, {
          nodeId: node,
          hormone,
          delta: clamped,
        });
      }
    }

    return results;
  },
});
