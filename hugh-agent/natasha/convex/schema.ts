import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  memory_natasha: defineTable({
    key: v.string(),
    value: v.string(),
    category: v.optional(v.string()),
    timestamp: v.number(),
    session_id: v.optional(v.string()),
    ttl_hours: v.optional(v.number()),
  })
    .index("by_key", ["key"])
    .index("by_category", ["category"])
    .index("by_timestamp", ["timestamp"]),

  action_log: defineTable({
    agent: v.string(),
    session_id: v.string(),
    tool_name: v.string(),
    tool_input: v.string(),
    tool_output: v.optional(v.string()),
    status: v.string(),
    duration_ms: v.optional(v.number()),
    timestamp: v.number(),
    error_message: v.optional(v.string()),
  })
    .index("by_agent", ["agent"])
    .index("by_session", ["session_id"])
    .index("by_timestamp", ["timestamp"]),

  agent_comms: defineTable({
    from_agent: v.string(),
    to_agent: v.string(),
    message: v.string(),
    message_type: v.string(),
    status: v.string(),
    timestamp: v.number(),
    thread_id: v.optional(v.string()),
  })
    .index("by_recipient", ["to_agent", "status"])
    .index("by_thread", ["thread_id"]),
});
