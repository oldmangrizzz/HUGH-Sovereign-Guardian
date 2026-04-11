import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Document metadata index — mirrors Kuzu Document nodes
  loom_documents: defineTable({
    docId: v.string(),           // Kuzu node ID (UUID)
    title: v.string(),
    source: v.string(),          // "github" | "gdrive-personal" | "gdrive-business" | "icloud" | "openai-export"
    fileType: v.string(),
    modified: v.string(),        // ISO timestamp
    wordCount: v.optional(v.number()),
    sha256: v.string(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_source", ["source"])
    .index("by_modified", ["modified"])
    .index("by_sha256", ["sha256"]),

  // Concept nodes
  loom_concepts: defineTable({
    conceptId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
  })
    .index("by_name", ["name"]),

  // Recent additions ring buffer — latest 500 docs
  loom_recent: defineTable({
    docId: v.string(),
    title: v.string(),
    source: v.string(),
    fileType: v.string(),
    modified: v.string(),
    addedAt: v.number(),         // Unix timestamp for sorting
  })
    .index("by_added", ["addedAt"]),

  // Parquet snapshot manifests — metadata only, blobs stored in Convex file storage
  loom_snapshots: defineTable({
    storageId: v.string(),       // Convex file storage ID
    filename: v.string(),
    createdAt: v.number(),
    documentCount: v.number(),
    sizeBytes: v.number(),
  })
    .index("by_created", ["createdAt"]),

  // System state — single-row config
  loom_state: defineTable({
    key: v.string(),
    value: v.string(),
  })
    .index("by_key", ["key"]),
});
