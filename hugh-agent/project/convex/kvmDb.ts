/**
 * kvmDb.ts — DB queries/mutations for KVM command log.
 * NOT "use node" — standard Convex V8 functions.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

export const logCommand = internalMutation({
  args: {
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
    command: v.string(),
    workingDir: v.optional(v.string()),
    stdout: v.optional(v.string()),
    stderr: v.optional(v.string()),
    exitCode: v.optional(v.number()),
    success: v.boolean(),
    durationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    zone: v.string(),
    notes: v.optional(v.string()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("kvmCommandLog", args);
  },
});

export const getRecentLog = internalQuery({
  args: {
    limit: v.optional(v.number()),
    targetNodeId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.targetNodeId) {
      return await ctx.db
        .query("kvmCommandLog")
        .withIndex("by_target_node", (q) => q.eq("targetNodeId", args.targetNodeId))
        .order("desc")
        .take(args.limit ?? 50);
    }
    return await ctx.db
      .query("kvmCommandLog")
      .order("desc")
      .take(args.limit ?? 50);
  },
});
