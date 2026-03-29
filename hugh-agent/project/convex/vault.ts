import { mutation, query, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ── GENERATE UPLOAD URL (admin only) ──────────────────────────────────────
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.storage.generateUploadUrl();
  },
});

// ── SAVE FILE RECORD ──────────────────────────────────────────────────────
export const saveFile = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    label: v.optional(v.string()),
    hughContext: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    return await ctx.db.insert("vaultFiles", {
      storageId: args.storageId,
      uploadedBy: userId,
      filename: args.filename,
      contentType: args.contentType,
      sizeBytes: args.sizeBytes,
      label: args.label,
      hughContext: args.hughContext,
      isPublic: false,
      tags: args.tags,
    });
  },
});

// ── LIST FILES (admin) ────────────────────────────────────────────────────
export const listFiles = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const files = await ctx.db.query("vaultFiles").order("desc").collect();
    return Promise.all(
      files.map(async (f) => ({
        ...f,
        url: await ctx.storage.getUrl(f.storageId),
      }))
    );
  },
});

// ── GET FILE URL ──────────────────────────────────────────────────────────
export const getFileUrl = query({
  args: { fileId: v.id("vaultFiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const file = await ctx.db.get(args.fileId);
    if (!file) return null;
    return {
      ...file,
      url: await ctx.storage.getUrl(file.storageId),
    };
  },
});

// ── UPDATE FILE METADATA ──────────────────────────────────────────────────
export const updateFile = mutation({
  args: {
    fileId: v.id("vaultFiles"),
    label: v.optional(v.string()),
    hughContext: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const { fileId, ...patch } = args;
    await ctx.db.patch(fileId, patch);
  },
});

// ── DELETE FILE ───────────────────────────────────────────────────────────
export const deleteFile = mutation({
  args: { fileId: v.id("vaultFiles") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Unauthorized");
    const file = await ctx.db.get(args.fileId);
    if (!file) throw new Error("File not found");
    await ctx.storage.delete(file.storageId);
    await ctx.db.delete(args.fileId);
  },
});

// ── GET VAULT CONTEXT FOR HUGH ────────────────────────────────────────────
// Returns a summary of vault files with their hughContext fields
// so H.U.G.H. can reference them in conversation.
export const getVaultContextForHugh = internalQuery({
  args: {},
  handler: async (ctx) => {
    const files = await ctx.db.query("vaultFiles").collect();
    return files
      .filter((f) => f.hughContext)
      .map((f) => ({
        filename: f.filename,
        label: f.label,
        context: f.hughContext,
        tags: f.tags,
      }));
  },
});
