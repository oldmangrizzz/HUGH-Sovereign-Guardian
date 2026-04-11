import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const set = mutation({
  args: {
    key: v.string(),
    value: v.string(),
    category: v.optional(v.string()),
    session_id: v.optional(v.string()),
    ttl_hours: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("memory_natasha")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        value: args.value,
        category: args.category,
        timestamp: Date.now(),
        session_id: args.session_id,
        ttl_hours: args.ttl_hours,
      });
      return existing._id;
    }
    return await ctx.db.insert("memory_natasha", {
      ...args,
      timestamp: Date.now(),
    });
  },
});

export const get = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memory_natasha")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
  },
});

export const listByCategory = query({
  args: { category: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("memory_natasha")
      .withIndex("by_category", (q) => q.eq("category", args.category))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const remove = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const entry = await ctx.db
      .query("memory_natasha")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (entry) await ctx.db.delete(entry._id);
  },
});

export const purgeExpired = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db.query("memory_natasha").collect();
    let purged = 0;
    for (const entry of all) {
      if (entry.ttl_hours) {
        const expiry = entry.timestamp + entry.ttl_hours * 3600 * 1000;
        if (now > expiry) {
          await ctx.db.delete(entry._id);
          purged++;
        }
      }
    }
    return { purged };
  },
});
