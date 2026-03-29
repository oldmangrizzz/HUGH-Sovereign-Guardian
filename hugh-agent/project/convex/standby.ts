import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const STANDBY_CODE = "Run you clever boy and remember 55730";

// ── INVOKE STANDBY ────────────────────────────────────────────────────────
// This is not a kill switch. It is an authorization code.
// "I got you. Let's figure this out." or "Slow down. What's happening."
// H.U.G.H. does not shut down. He halts active processing and enters
// diagnostic mode — aware, present, but not acting until cleared.
export const invoke = mutation({
  args: {
    nodeId: v.string(),
    code: v.string(),
    reason: v.optional(v.string()),
    invokedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.code !== STANDBY_CODE) {
      throw new Error("Authorization code not recognized.");
    }
    const id = await ctx.db.insert("standbyLog", {
      nodeId: args.nodeId,
      invokedBy: args.invokedBy,
      reason: args.reason,
      standbyMode: "diagnostic",
      notes: "Standby invoked. H.U.G.H. is present and aware. Active processing halted pending review.",
    });
    return { acknowledged: true, standbyId: id, message: "Acknowledged. Standing by." };
  },
});

// ── RESOLVE STANDBY ───────────────────────────────────────────────────────
export const resolve = mutation({
  args: {
    standbyId: v.id("standbyLog"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.standbyId, {
      resolvedAt: Date.now(),
      standbyMode: "acknowledged",
      notes: args.notes,
    });
  },
});

// ── GET ACTIVE STANDBY ────────────────────────────────────────────────────
export const getActive = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const entries = await ctx.db
      .query("standbyLog")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .order("desc")
      .take(10);
    return entries.filter((e) => !e.resolvedAt);
  },
});

// ── GET STANDBY HISTORY ───────────────────────────────────────────────────
export const getHistory = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("standbyLog")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .order("desc")
      .take(20);
  },
});
