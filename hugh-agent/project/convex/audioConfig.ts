/**
 * audioConfig.ts — LiveKit room lifecycle records
 *
 * Tracks open/closed audio rooms in Convex.
 * Token generation lives in livekit.ts (already deployed).
 *
 * Schema: audioConfig table (defined in schema.ts)
 */
import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// ── OPEN ROOM ──────────────────────────────────────────────────────────────
export const openRoom = mutation({
  args: {
    roomName: v.string(),
    maxParticipants: v.optional(v.number()),
    metaJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("audioConfig")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .first();
    if (existing && existing.status === "open") return existing._id;
    return await ctx.db.insert("audioConfig", {
      roomName: args.roomName,
      status: "open",
      maxParticipants: args.maxParticipants,
      metaJson: args.metaJson,
      createdAt: Date.now(),
    });
  },
});

// ── CLOSE ROOM ─────────────────────────────────────────────────────────────
export const closeRoom = mutation({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    const room = await ctx.db
      .query("audioConfig")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .first();
    if (!room) throw new Error(`Room not found: ${args.roomName}`);
    await ctx.db.patch(room._id, { status: "closed", closedAt: Date.now() });
    return { closed: true };
  },
});

// ── GET ACTIVE ROOMS ───────────────────────────────────────────────────────
export const getActiveRooms = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("audioConfig")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .order("desc")
      .collect();
  },
});

// ── GET ROOM ───────────────────────────────────────────────────────────────
export const getRoom = query({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("audioConfig")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .first();
  },
});
