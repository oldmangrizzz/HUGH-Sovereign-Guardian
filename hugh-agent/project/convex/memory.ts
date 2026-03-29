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

// ── RETRIEVE LONG-TERM CONTEXT (PUBLIC ACTION) ─────────────────────────────
export const retrieveLongTermContext = action({
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
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit ?? 30;
    const episodes = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .order("desc")
      .take(limit * 2); // take more, filter to user/hugh only

    const relevant = episodes
      .filter((e) => e.eventType === "user_message" || e.eventType === "hugh_response")
      .slice(0, limit)
      .reverse(); // chronological order

    return relevant.map((e) => ({
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
export const getRecentEpisodes = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

// ── GET SEMANTIC MEMORY (public, for UI) ──────────────────────────────────
export const getSemanticMemory = query({
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

// ── CLEAR MEMORY (admin) ───────────────────────────────────────────────────
export const clearEpisodicMemory = mutation({
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

export const clearSemanticMemory = mutation({
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
