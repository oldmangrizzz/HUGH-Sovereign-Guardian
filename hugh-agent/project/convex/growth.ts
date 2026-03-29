import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

const NODE_ID = "hugh-primary";

// ── ADD GROWTH ENTRY ──────────────────────────────────────────────────────
export const addEntry = mutation({
  args: {
    category: v.union(
      v.literal("directive"),
      v.literal("observation"),
      v.literal("correction"),
      v.literal("expansion"),
      v.literal("anchor_update")
    ),
    title: v.string(),
    content: v.string(),
    priority: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.db.insert("growthLog", {
      nodeId: NODE_ID,
      authorId: userId,
      category: args.category,
      title: args.title,
      content: args.content,
      priority: args.priority,
      active: true,
      tags: args.tags,
    });
  },
});

// ── LIST ENTRIES ──────────────────────────────────────────────────────────
export const listEntries = query({
  args: { includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    if (args.includeArchived) {
      return await ctx.db
        .query("growthLog")
        .withIndex("by_node", (q) => q.eq("nodeId", NODE_ID))
        .order("desc")
        .collect();
    }
    return await ctx.db
      .query("growthLog")
      .withIndex("by_node_and_active", (q) =>
        q.eq("nodeId", NODE_ID).eq("active", true)
      )
      .order("desc")
      .collect();
  },
});

// ── ARCHIVE / RESTORE ─────────────────────────────────────────────────────
export const setActive = mutation({
  args: { entryId: v.id("growthLog"), active: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.patch(args.entryId, { active: args.active });
  },
});

// ── UPDATE ENTRY ──────────────────────────────────────────────────────────
export const updateEntry = mutation({
  args: {
    entryId: v.id("growthLog"),
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    priority: v.optional(v.number()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const { entryId, ...patch } = args;
    await ctx.db.patch(entryId, patch);
  },
});

// ── DELETE ENTRY ──────────────────────────────────────────────────────────
export const deleteEntry = mutation({
  args: { entryId: v.id("growthLog") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    await ctx.db.delete(args.entryId);
  },
});

// ── GET ACTIVE CONTEXT (for H.U.G.H. injection) ───────────────────────────
export const getActiveContext = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("growthLog")
      .withIndex("by_node_and_active", (q) =>
        q.eq("nodeId", NODE_ID).eq("active", true)
      )
      .collect();
  },
});
