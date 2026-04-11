import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    agent: v.string(),
    session_id: v.string(),
    tool_name: v.string(),
    tool_input: v.string(),
    tool_output: v.optional(v.string()),
    status: v.string(),
    duration_ms: v.optional(v.number()),
    error_message: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("action_log", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const getSession = query({
  args: { session_id: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("action_log")
      .withIndex("by_session", (q) => q.eq("session_id", args.session_id))
      .order("desc")
      .take(args.limit ?? 100);
  },
});

export const getByAgent = query({
  args: { agent: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("action_log")
      .withIndex("by_agent", (q) => q.eq("agent", args.agent))
      .order("desc")
      .take(args.limit ?? 500);
  },
});
