/**
 * deepgram.ts — Deepgram transcript storage for H.U.G.H.
 *
 * The KVM4 audio bridge calls recordTranscript to persist STT results.
 * H.U.G.H. queries these for episodic memory synthesis.
 *
 * Required env var (used by the KVM4 bridge, not Convex directly):
 *   DEEPGRAM_API_KEY
 *
 * Schema: transcripts table (defined in schema.ts)
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

// ── RECORD TRANSCRIPT ──────────────────────────────────────────────────────
// Called by the KVM4 Deepgram bridge via POST /api/deepgram/transcript
// or directly via the Convex client.
export const recordTranscript = mutation({
  args: {
    roomName: v.string(),
    sessionId: v.string(),
    speakerId: v.optional(v.string()),
    speakerLabel: v.optional(v.string()),
    text: v.string(),
    confidence: v.optional(v.number()),
    isFinal: v.boolean(),
    durationMs: v.optional(v.number()),
    ts: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("transcripts", {
      roomName: args.roomName,
      sessionId: args.sessionId,
      speakerId: args.speakerId,
      speakerLabel: args.speakerLabel,
      text: args.text,
      confidence: args.confidence,
      isFinal: args.isFinal,
      durationMs: args.durationMs,
      ts: args.ts ?? Date.now(),
    });
  },
});

// ── GET RECENT TRANSCRIPTS ─────────────────────────────────────────────────
// Returns last N transcripts for a room, newest first.
export const getRecentTranscripts = query({
  args: {
    roomName: v.string(),
    limit: v.optional(v.number()),
    finalOnly: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 50;
    if (args.finalOnly !== false) {
      return await ctx.db
        .query("transcripts")
        .withIndex("by_room_and_final", (q) =>
          q.eq("roomName", args.roomName).eq("isFinal", true)
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("transcripts")
      .withIndex("by_room", (q) => q.eq("roomName", args.roomName))
      .order("desc")
      .take(limit);
  },
});

// ── GET TRANSCRIPTS BY SESSION ─────────────────────────────────────────────
export const getSessionTranscripts = query({
  args: {
    sessionId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("transcripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .take(args.limit ?? 200);
  },
});

// ── GET CONVERSATION TEXT (for H.U.G.H. memory synthesis) ─────────────────
// Returns all final transcripts for a session as a flat timestamped string.
export const getConversationText = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("transcripts")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .order("asc")
      .collect();
    return rows
      .filter((r) => r.isFinal)
      .map((r) => {
        const speaker = r.speakerLabel ?? r.speakerId ?? "unknown";
        return `[${new Date(r.ts).toISOString()}] ${speaker}: ${r.text}`;
      })
      .join("\n");
  },
});

// ── INTERNAL: BULK INSERT (replay / import) ────────────────────────────────
export const bulkInsertTranscripts = internalMutation({
  args: {
    rows: v.array(v.object({
      roomName: v.string(),
      sessionId: v.string(),
      speakerId: v.optional(v.string()),
      speakerLabel: v.optional(v.string()),
      text: v.string(),
      confidence: v.optional(v.number()),
      isFinal: v.boolean(),
      durationMs: v.optional(v.number()),
      ts: v.number(),
    })),
  },
  handler: async (ctx, args) => {
    const ids: string[] = [];
    for (const row of args.rows) {
      ids.push(await ctx.db.insert("transcripts", row));
    }
    return ids;
  },
});
