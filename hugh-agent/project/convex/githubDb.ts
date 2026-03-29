import { internalMutation } from "./_generated/server";
import { v } from "convex/values";

const NODE_ID = "hugh-primary";

export const insertGrowthEntry = internalMutation({
  args: {
    title: v.string(),
    content: v.string(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").take(1);
    if (users.length === 0) throw new Error("No users found — must be logged in first");
    const authorId = users[0]._id;

    const existing = await ctx.db
      .query("growthLog")
      .withIndex("by_node", (q) => q.eq("nodeId", NODE_ID))
      .collect();

    for (const e of existing) {
      if (e.title === args.title) {
        await ctx.db.delete(e._id);
      }
    }

    return await ctx.db.insert("growthLog", {
      nodeId: NODE_ID,
      authorId,
      category: "expansion",
      title: args.title,
      content: args.content,
      priority: 0.95,
      active: true,
      tags: args.tags,
    });
  },
});
