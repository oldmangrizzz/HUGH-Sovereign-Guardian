import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";

// ── Document sync ────────────────────────────────────────────────────────────

export const syncDocuments = mutation({
  args: {
    documents: v.array(v.object({
      id: v.string(),
      title: v.string(),
      source: v.string(),
      fileType: v.string(),
      modified: v.string(),
      wordCount: v.optional(v.number()),
      sha256: v.string(),
    })),
  },
  handler: async (ctx, { documents }) => {
    let upserted = 0;
    for (const doc of documents) {
      const existing = await ctx.db
        .query("loom_documents")
        .withIndex("by_sha256", (q) => q.eq("sha256", doc.sha256))
        .first();

      if (!existing) {
        await ctx.db.insert("loom_documents", {
          docId: doc.id,
          title: doc.title,
          source: doc.source,
          fileType: doc.fileType,
          modified: doc.modified,
          wordCount: doc.wordCount,
          sha256: doc.sha256,
        });
        upserted++;
      }
    }
    return { upserted, total: documents.length };
  },
});

// ── Concept sync ─────────────────────────────────────────────────────────────

export const syncConcepts = mutation({
  args: {
    concepts: v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
    })),
  },
  handler: async (ctx, { concepts }) => {
    let upserted = 0;
    for (const concept of concepts) {
      const existing = await ctx.db
        .query("loom_concepts")
        .withIndex("by_name", (q) => q.eq("name", concept.name))
        .first();
      if (!existing) {
        await ctx.db.insert("loom_concepts", {
          conceptId: concept.id,
          name: concept.name,
          description: concept.description,
        });
        upserted++;
      }
    }
    return { upserted, total: concepts.length };
  },
});

// ── Recent docs sync ──────────────────────────────────────────────────────────

export const syncRecent = mutation({
  args: {
    documents: v.array(v.object({
      id: v.string(),
      title: v.string(),
      source: v.string(),
      fileType: v.string(),
      modified: v.string(),
    })),
  },
  handler: async (ctx, { documents }) => {
    const now = Date.now();
    for (const doc of documents) {
      await ctx.db.insert("loom_recent", {
        docId: doc.id,
        title: doc.title,
        source: doc.source,
        fileType: doc.fileType,
        modified: doc.modified,
        addedAt: now,
      });
    }
    // Trim to 500 most recent
    const all = await ctx.db.query("loom_recent").withIndex("by_added").collect();
    if (all.length > 500) {
      const toDelete = all.slice(0, all.length - 500);
      for (const rec of toDelete) {
        await ctx.db.delete(rec._id);
      }
    }
    return { synced: documents.length };
  },
});

// ── Queries ───────────────────────────────────────────────────────────────────

export const getRecentDocuments = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit = 20 }) => {
    return await ctx.db
      .query("loom_recent")
      .withIndex("by_added")
      .order("desc")
      .take(limit);
  },
});

export const searchDocuments = query({
  args: {
    source: v.optional(v.string()),
    fileType: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { source, fileType, limit = 50 }) => {
    let q = ctx.db.query("loom_documents");
    if (source) {
      return await q.withIndex("by_source", (idx) => idx.eq("source", source)).take(limit ?? 50);
    }
    return await q.take(limit ?? 50);
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const [docCount, conceptCount, recentCount, snapCount] = await Promise.all([
      ctx.db.query("loom_documents").collect().then((r) => r.length),
      ctx.db.query("loom_concepts").collect().then((r) => r.length),
      ctx.db.query("loom_recent").collect().then((r) => r.length),
      ctx.db.query("loom_snapshots").collect().then((r) => r.length),
    ]);
    return { documents: docCount, concepts: conceptCount, recent: recentCount, snapshots: snapCount };
  },
});

// ── State helpers ─────────────────────────────────────────────────────────────

export const setState = mutation({
  args: { key: v.string(), value: v.string() },
  handler: async (ctx, { key, value }) => {
    const existing = await ctx.db
      .query("loom_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { value });
    } else {
      await ctx.db.insert("loom_state", { key, value });
    }
  },
});

export const getState = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const rec = await ctx.db
      .query("loom_state")
      .withIndex("by_key", (q) => q.eq("key", key))
      .first();
    return rec?.value ?? null;
  },
});
