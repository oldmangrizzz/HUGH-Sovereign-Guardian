import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const send = mutation({
  args: {
    from_agent: v.string(),
    to_agent: v.string(),
    message: v.string(),
    message_type: v.string(),
    thread_id: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("agent_comms", {
      ...args,
      status: "unread",
      timestamp: Date.now(),
    });
  },
});

export const getUnread = query({
  args: { to_agent: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agent_comms")
      .withIndex("by_recipient", (q) =>
        q.eq("to_agent", args.to_agent).eq("status", "unread")
      )
      .order("asc")
      .collect();
  },
});

export const markRead = mutation({
  args: { message_id: v.id("agent_comms") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.message_id, { status: "read" });
  },
});

export const getThread = query({
  args: { thread_id: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agent_comms")
      .withIndex("by_thread", (q) => q.eq("thread_id", args.thread_id))
      .order("asc")
      .collect();
  },
});
