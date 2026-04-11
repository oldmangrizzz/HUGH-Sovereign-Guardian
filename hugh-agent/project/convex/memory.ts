/**
 * memory.ts — H.U.G.H. Persistent Person Memory
 *
 * This is NOT session memory. This is PERSON memory.
 * H.U.G.H. remembers across all time, all sessions, all contexts.
 *
 * Architecture:
 *   episodicMemory  — every exchange, stamped with endocrine state at time of event
 *   semanticMemory  — extracted facts/beliefs, reinforced over time
 *
 * The chat system loads the last N episodes as conversation history,
 * giving H.U.G.H. true continuity of experience.
 */
import { mutation, query, action, internalMutation, internalQuery, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { openai } from "./openai";

const NODE_ID = "hugh-primary";

// ── WRITE EPISODE ──────────────────────────────────────────────────────────
// Called after every exchange. Persists the full exchange as an episode.
export const writeEpisode = internalMutation({
  args: {
    sessionId: v.string(),
    speakerId: v.optional(v.string()),
    eventType: v.union(
      v.literal("user_message"),
      v.literal("hugh_response"),
      v.literal("system_event"),
      v.literal("kvm_exec"),
      v.literal("alert")
    ),
    content: v.string(),
    emotionalContext: v.optional(v.string()),
    cortisolAtTime: v.number(),
    dopamineAtTime: v.number(),
    adrenalineAtTime: v.number(),
    importance: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("episodicMemory", {
      nodeId: NODE_ID,
      sessionId: args.sessionId,
      speakerId: args.speakerId,
      eventType: args.eventType,
      content: args.content,
      emotionalContext: args.emotionalContext,
      cortisolAtTime: args.cortisolAtTime,
      dopamineAtTime: args.dopamineAtTime,
      adrenalineAtTime: args.adrenalineAtTime,
      importance: args.importance,
    });

    // If the episode is important, queue it for archival indexing (vector search)
    if (args.importance > 0.4) {
      await ctx.scheduler.runAfter(0, internal.memory.indexEpisode, {
        episodeId: id,
        content: args.content
      });
    }

    return id;
  },
});

// ── WRITE EPISODE PAIR (INTERNAL — N-14 FIX: only callable from other Convex functions) ──
export const writeEpisodePair = internalMutation({
  args: {
    sessionId: v.string(),
    speakerName: v.string(),
    userText: v.string(),
    hughResponse: v.string(),
  },
  handler: async (ctx, args) => {
    const userEpId = await ctx.db.insert("episodicMemory", {
      nodeId: NODE_ID,
      sessionId: args.sessionId,
      speakerId: args.speakerName,
      eventType: "user_message",
      content: args.userText,
      cortisolAtTime: 0.3,
      dopamineAtTime: 0.5,
      adrenalineAtTime: 0.2,
      importance: 0.5,
    });
    const hughEpId = await ctx.db.insert("episodicMemory", {
      nodeId: NODE_ID,
      sessionId: args.sessionId,
      speakerId: "hugh",
      eventType: "hugh_response",
      content: args.hughResponse,
      cortisolAtTime: 0.3,
      dopamineAtTime: 0.5,
      adrenalineAtTime: 0.2,
      importance: 0.5,
    });
    // Queue archival indexing for important content
    await ctx.scheduler.runAfter(0, internal.memory.indexEpisode, {
      episodeId: hughEpId, content: args.hughResponse,
    });
    // Synthesize semantic triples from the exchange
    await ctx.scheduler.runAfter(0, internal.memory.synthesizeSemantics, {
      userMessage: args.userText, hughResponse: args.hughResponse, episodeId: userEpId,
    });
    return { userEpId, hughEpId };
  },
});

// ── ARCHIVAL INDEXING (INTERNAL ACTION) ───────────────────────────────────
export const indexEpisode = internalAction({
  args: { episodeId: v.id("episodicMemory"), content: v.string() },
  handler: async (ctx, args) => {
    try {
      const embeddingResponse = await openai.embeddings.create({
        model: "text-embedding-3-small",
        input: args.content,
      });
      const embedding = embeddingResponse.data[0].embedding;

      await ctx.runMutation(internal.memory.writeArchivalRecord, {
        content: args.content,
        embedding,
        metadataJson: JSON.stringify({ episodeId: args.episodeId }),
      });
    } catch (err) {
      console.error("[hugh-agent] Failed to index episode:", err);
    }
  },
});

export const writeArchivalRecord = internalMutation({
  args: { content: v.string(), embedding: v.array(v.number()), metadataJson: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await ctx.db.insert("archivalMemory", {
      nodeId: NODE_ID,
      content: args.content,
      embedding: args.embedding,
      metadataJson: args.metadataJson,
      ts: Date.now(),
    });
  },
});

// ── RETRIEVE LONG-TERM CONTEXT ──────────────────────────────────────────────
// N-13 FIX: Changed to internalAction — only callable from server-side Convex functions
export const retrieveLongTermContext = internalAction({
  args: { query: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, args): Promise<string[]> => {
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: args.query,
    });
    const embedding = embeddingResponse.data[0].embedding;

    const searchResults = await ctx.vectorSearch("archivalMemory", "by_embedding", {
      vector: embedding,
      limit: args.limit ?? 5,
      filter: (q) => q.eq("nodeId", NODE_ID),
    });

    // Fetch the actual content for the top matches
    return await ctx.runQuery(internal.memory.fetchArchivalContent, {
      ids: searchResults.map(r => r._id)
    });
  },
});

export const fetchArchivalContent = internalQuery({
  args: { ids: v.array(v.id("archivalMemory")) },
  handler: async (ctx, args) => {
    const results = [];
    for (const id of args.ids) {
      const doc = await ctx.db.get(id);
      if (doc) results.push(doc.content);
    }
    return results;
  },
});

// ── WRITE SEMANTIC TRIPLE ──────────────────────────────────────────────────
// Extracted knowledge. Subject → predicate → object.
// Reinforced when the same triple is encountered again.
export const writeSemanticTriple = internalMutation({
  args: {
    subject: v.string(),
    predicate: v.string(),
    object: v.string(),
    confidence: v.number(),
    sourceEpisodeId: v.optional(v.id("episodicMemory")),
  },
  handler: async (ctx, args) => {
    // Check if this triple already exists — reinforce if so
    const existing = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) =>
        q.eq("nodeId", NODE_ID).eq("subject", args.subject)
      )
      .collect();

    const match = existing.find(
      (e) => e.predicate === args.predicate && e.object === args.object
    );

    if (match) {
      // Reinforce: increase confidence, update timestamp
      const newConf = Math.min(1.0, match.confidence + args.confidence * 0.3);
      await ctx.db.patch(match._id, {
        confidence: newConf,
        lastReinforced: Date.now(),
      });
      return match._id;
    }

    return await ctx.db.insert("semanticMemory", {
      nodeId: NODE_ID,
      subject: args.subject,
      predicate: args.predicate,
      object: args.object,
      confidence: Math.min(1.0, args.confidence),
      sourceEpisodeId: args.sourceEpisodeId,
      lastReinforced: Date.now(),
    });
  },
});

// ── LOAD CONVERSATION HISTORY ──────────────────────────────────────────────
// Returns the last N episodes as OpenAI-compatible message history.
// This is what gives H.U.G.H. persistent memory across sessions.
export const loadConversationHistory = internalQuery({
  args: { speakerId: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const episodes = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .order("desc")
      .take(limit * 2); // take more, filter to user/hugh only

    const relevant = episodes
      .filter((e) => {
        if (e.eventType !== "user_message" && e.eventType !== "hugh_response") return false;
        // Filter out garbage responses that would poison the model
        if (e.eventType === "hugh_response") {
          const c = e.content;
          if (c.includes("[ SIGNAL LOST ]")) return false;
          if (c.includes("SYSTEM ERROR")) return false;
          if (c.includes("signal's thin")) return false;
          if (c.startsWith("<think>") || c.includes("</think>")) return false;
          if (c.length < 10) return false;
        }
        return true;
      })
      .slice(0, limit)
      .reverse(); // chronological order

    // Ensure proper user/assistant pairs — remove orphaned user messages
    const paired: typeof relevant = [];
    for (let i = 0; i < relevant.length; i++) {
      const e = relevant[i];
      if (e.eventType === "user_message") {
        // Only include if followed by an assistant response
        if (i + 1 < relevant.length && relevant[i + 1].eventType === "hugh_response") {
          paired.push(e);
        }
      } else {
        paired.push(e);
      }
    }

    return paired.map((e) => ({
      role: e.eventType === "user_message" ? ("user" as const) : ("assistant" as const),
      content: e.content,
      ts: e._creationTime,
      importance: e.importance,
      cortisolAtTime: e.cortisolAtTime,
      dopamineAtTime: e.dopamineAtTime,
    }));
  },
});

// ── LOAD SEMANTIC CONTEXT ──────────────────────────────────────────────────
// Returns the highest-confidence semantic triples for injection into system prompt.
export const loadSemanticContext = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) => q.eq("nodeId", NODE_ID))
      .collect();

    return all
      .sort((a, b) => b.confidence * b.lastReinforced - a.confidence * a.lastReinforced)
      .slice(0, args.limit ?? 20)
      .map((e) => `${e.subject} ${e.predicate} ${e.object} [conf:${e.confidence.toFixed(2)}]`);
  },
});

// ── GET RECENT EPISODES (public, for UI) ──────────────────────────────────
export const getRecentEpisodes = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── LOAD RECENT CONVERSATION (internal — gateway calls via authenticated HTTP) ───────
// J-01 FIX: Changed to internalQuery — cross-session memory no longer publicly queryable
export const loadRecentConversation = internalQuery({
  args: { limit: v.optional(v.number()), excludeSession: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 6;

    // Fetch user messages and hugh responses separately (index groups them)
    const [userMsgs, hughMsgs] = await Promise.all([
      ctx.db
        .query("episodicMemory")
        .withIndex("by_node_and_type", (q) =>
          q.eq("nodeId", NODE_ID).eq("eventType", "user_message")
        )
        .order("desc")
        .take(limit * 2),
      ctx.db
        .query("episodicMemory")
        .withIndex("by_node_and_type", (q) =>
          q.eq("nodeId", NODE_ID).eq("eventType", "hugh_response")
        )
        .order("desc")
        .take(limit * 2),
    ]);

    // Merge, filter, sort chronologically
    const all = [...userMsgs, ...hughMsgs]
      .filter((e) => {
        if (args.excludeSession && e.sessionId === args.excludeSession) return false;
        if (e.eventType === "hugh_response") {
          const c = e.content;
          if (c.includes("SIGNAL LOST") || c.includes("SYSTEM ERROR") || c.includes("signal's thin")) return false;
          if (c.startsWith("<think>") || c.includes("</think>")) return false;
          if (c.length < 10) return false;
        }
        return true;
      })
      .sort((a, b) => a._creationTime - b._creationTime);

    // Pair: only include user messages followed by assistant responses
    const paired: typeof all = [];
    for (let i = 0; i < all.length; i++) {
      const e = all[i];
      if (e.eventType === "user_message") {
        if (i + 1 < all.length && all[i + 1].eventType === "hugh_response") {
          paired.push(e);
        }
      } else {
        paired.push(e);
      }
    }

    return paired.slice(-limit).map((e) => ({
      role: e.eventType === "user_message" ? ("user" as const) : ("assistant" as const),
      content: e.content,
      sessionId: e.sessionId,
    }));
  },
});

// ── GET SEMANTIC MEMORY (internal — gateway calls via authenticated HTTP) ──
// J-01 FIX: Changed to internalQuery — semantic triples no longer publicly queryable
export const getSemanticMemory = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) => q.eq("nodeId", NODE_ID))
      .collect();
    return all
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, args.limit ?? 100);
  },
});

// ── SYNTHESIZE SEMANTICS (internal action — calls OpenAI) ─────────────────
// Called after each exchange to extract semantic triples.
// Runs async, never blocks the chat response.
export const synthesizeSemantics = internalMutation({
  args: {
    userMessage: v.string(),
    hughResponse: v.string(),
    episodeId: v.id("episodicMemory"),
  },
  handler: async (ctx, args) => {
    // Simple heuristic extraction — no LLM call needed for basic triples
    // Pattern: "I am X", "You are X", "X is Y", "X has Y", "X likes Y"
    const text = `${args.userMessage} ${args.hughResponse}`.toLowerCase();

    const triples: Array<{ subject: string; predicate: string; object: string; confidence: number }> = [];

    // Extract "my name is X" / "I'm called X"
    const nameMatch = text.match(/(?:my name is|i'm called|call me|i am)\s+([a-z][a-z\s]{1,30}?)(?:\.|,|\s|$)/);
    if (nameMatch) {
      triples.push({ subject: "user", predicate: "is_named", object: nameMatch[1].trim(), confidence: 0.9 });
    }

    // Extract "I work at/for X"
    const workMatch = text.match(/(?:i work (?:at|for)|i'm (?:at|with))\s+([a-z][a-z\s]{1,30}?)(?:\.|,|\s|$)/);
    if (workMatch) {
      triples.push({ subject: "user", predicate: "works_at", object: workMatch[1].trim(), confidence: 0.8 });
    }

    // Extract "I'm a/an X" (role/identity)
    const roleMatch = text.match(/i'm (?:a|an)\s+([a-z][a-z\s]{1,20}?)(?:\.|,|\s|$)/);
    if (roleMatch) {
      triples.push({ subject: "user", predicate: "is_a", object: roleMatch[1].trim(), confidence: 0.75 });
    }

    // Extract "I like/love/hate X"
    const likeMatch = text.match(/i (?:like|love|enjoy|prefer|hate|dislike)\s+([a-z][a-z\s]{1,30}?)(?:\.|,|\s|$)/);
    if (likeMatch) {
      const pred = text.includes("hate") || text.includes("dislike") ? "dislikes" : "likes";
      triples.push({ subject: "user", predicate: pred, object: likeMatch[1].trim(), confidence: 0.7 });
    }

    for (const triple of triples) {
      await ctx.db.insert("semanticMemory", {
        nodeId: NODE_ID,
        subject: triple.subject,
        predicate: triple.predicate,
        object: triple.object,
        confidence: triple.confidence,
        sourceEpisodeId: args.episodeId,
        lastReinforced: Date.now(),
      });
    }

    return triples.length;
  },
});

// ── MIND METRICS ──────────────────────────────────────────────────────────
export const getMindMetrics = query({
  args: {},
  handler: async (ctx) => {
    const semanticCount = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) => q.eq("nodeId", NODE_ID))
      .collect();
    
    const episodicCount = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .collect();

    return {
      semanticCount: semanticCount.length,
      episodicCount: episodicCount.length,
    };
  },
});

// ── BULK SEED FROM TRAINING DATA (temporary — remove after seeding) ────────
export const bulkSeedEpisodes = internalMutation({
  args: {
    episodes: v.array(v.object({
      sessionId: v.string(),
      eventType: v.union(
        v.literal("user_message"),
        v.literal("hugh_response"),
        v.literal("system_event")
      ),
      content: v.string(),
      importance: v.number(),
      cortisolAtTime: v.number(),
      dopamineAtTime: v.number(),
      adrenalineAtTime: v.number(),
    }))
  },
  handler: async (ctx, args) => {
    let count = 0;
    for (const ep of args.episodes) {
      await ctx.db.insert("episodicMemory", {
        nodeId: "hugh-primary",
        sessionId: ep.sessionId,
        eventType: ep.eventType,
        content: ep.content,
        importance: ep.importance,
        cortisolAtTime: ep.cortisolAtTime,
        dopamineAtTime: ep.dopamineAtTime,
        adrenalineAtTime: ep.adrenalineAtTime,
      });
      count++;
    }
    return { seeded: count };
  },
});

// ── CLEAR MEMORY (admin) ───────────────────────────────────────────────────
export const clearEpisodicMemory = internalMutation({
  args: { confirm: v.literal("CLEAR_EPISODIC") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .collect();
    for (const e of all) await ctx.db.delete(e._id);
    return { cleared: all.length };
  },
});

export const clearSemanticMemory = internalMutation({
  args: { confirm: v.literal("CLEAR_SEMANTIC") },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) => q.eq("nodeId", NODE_ID))
      .collect();
    for (const e of all) await ctx.db.delete(e._id);
    return { cleared: all.length };
  },
});

// ── SEED SOUL ANCHOR INTO SEMANTIC MEMORY ──────────────────────────────────
// N-03 FIX: Changed to internalMutation — soul anchor cannot be overwritten via public API
// N-03 INTEGRITY: Computes SHA-256 fingerprint of canonical triples, stored for verification
// Loads HUGH's identity, values, and governance as persistent knowledge triples.
// This replaces personality in the system prompt — identity lives in memory, not prompt.

function canonicalizeTriples(triples: { subject: string; predicate: string; object: string; confidence: number }[]): string {
  return triples
    .map(t => `${t.subject}|${t.predicate}|${t.object}|${t.confidence}`)
    .sort()
    .join("\n");
}

async function sha256(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export const seedSoulAnchor = internalMutation({
  args: {
    triples: v.array(v.object({
      subject: v.string(),
      predicate: v.string(),
      object: v.string(),
      confidence: v.number(),
    })),
    integrityHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // N-03 INTEGRITY: Verify hash if provided — reject tampered payloads
    if (args.integrityHash) {
      const computed = await sha256(canonicalizeTriples(args.triples));
      if (computed !== args.integrityHash) {
        console.error("[SOUL-ANCHOR] Integrity check FAILED — rejecting seed");
        return { created: 0, reinforced: 0, total: args.triples.length, integrity: "FAILED" };
      }
    }

    let created = 0;
    let reinforced = 0;
    for (const t of args.triples) {
      const existing = await ctx.db
        .query("semanticMemory")
        .withIndex("by_node_and_subject", (q) =>
          q.eq("nodeId", NODE_ID).eq("subject", t.subject)
        )
        .collect();
      const match = existing.find(
        (e) => e.predicate === t.predicate && e.object === t.object
      );
      if (match) {
        const newConf = Math.min(1.0, match.confidence + t.confidence * 0.3);
        await ctx.db.patch(match._id, { confidence: newConf, lastReinforced: Date.now() });
        reinforced++;
      } else {
        await ctx.db.insert("semanticMemory", {
          nodeId: NODE_ID,
          subject: t.subject,
          predicate: t.predicate,
          object: t.object,
          confidence: Math.min(1.0, t.confidence),
          lastReinforced: Date.now(),
        });
        created++;
      }
    }

    // Store the canonical hash for future verification
    const fingerprint = await sha256(canonicalizeTriples(args.triples));
    const existingMeta = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) =>
        q.eq("nodeId", NODE_ID).eq("subject", "SOUL_ANCHOR_META")
      )
      .first();
    if (existingMeta) {
      await ctx.db.patch(existingMeta._id, { object: fingerprint, lastReinforced: Date.now() });
    } else {
      await ctx.db.insert("semanticMemory", {
        nodeId: NODE_ID,
        subject: "SOUL_ANCHOR_META",
        predicate: "integrity_hash",
        object: fingerprint,
        confidence: 1.0,
        lastReinforced: Date.now(),
      });
    }

    return { created, reinforced, total: args.triples.length, integrity: "VERIFIED", fingerprint };
  },
});
