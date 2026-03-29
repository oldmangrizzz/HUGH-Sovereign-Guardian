import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── MCP TOOL REGISTRY ─────────────────────────────────────────────────────
// All tools must resolve within Grizzly Medicine infrastructure.
// No external API calls. Ever. This is a safety constraint, not a limitation.

export const registerTool = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    inputSchema: v.string(),
    endpoint: v.string(),
    zone: v.union(v.literal("green"), v.literal("yellow"), v.literal("red")),
    requiresAuth: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const existing = await ctx.db
      .query("mcpTools")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, {
        description: args.description,
        inputSchema: args.inputSchema,
        endpoint: args.endpoint,
        zone: args.zone,
        requiresAuth: args.requiresAuth,
      });
      return existing._id;
    }
    return await ctx.db.insert("mcpTools", {
      ...args,
      enabled: true,
      callCount: 0,
    });
  },
});

export const listTools = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("mcpTools")
      .withIndex("by_enabled", (q) => q.eq("enabled", true))
      .collect();
  },
});

export const listAllTools = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.db.query("mcpTools").collect();
  },
});

export const setToolEnabled = mutation({
  args: { toolId: v.id("mcpTools"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.toolId, { enabled: args.enabled });
  },
});

// ── MCP CALL LOG ──────────────────────────────────────────────────────────
export const logCall = internalMutation({
  args: {
    nodeId: v.string(),
    toolName: v.string(),
    input: v.string(),
    output: v.optional(v.string()),
    zone: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("mcpCallLog", args);
    // Update call count on tool
    const tool = await ctx.db
      .query("mcpTools")
      .withIndex("by_name", (q) => q.eq("name", args.toolName))
      .unique();
    if (tool) {
      await ctx.db.patch(tool._id, {
        callCount: tool.callCount + 1,
        lastCalledAt: Date.now(),
      });
    }
  },
});

export const getCallLog = query({
  args: { nodeId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.db
      .query("mcpCallLog")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});
