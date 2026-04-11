/**
 * agentRegistry.ts — Holographic Satellite Node registry
 *
 * Nodes self-register on startup via POST /api/agent/register.
 * H.U.G.H. resolves target → agentUrl dynamically from this table.
 * Secrets are stored as SHA-256 hashes — never plaintext.
 */
import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";

// ── INTERNAL: UPSERT NODE ─────────────────────────────────────────────────
export const upsertNode = internalMutation({
  args: {
    nodeId: v.string(),
    label: v.string(),
    agentUrl: v.string(),
    secretHash: v.string(),
    platform: v.string(),
    arch: v.optional(v.string()),
    hostname: v.string(),
    nodeVersion: v.optional(v.string()),
    agentVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.nodeId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        label: args.label,
        lastTunnelUrl: existing.agentUrl !== args.agentUrl ? existing.agentUrl : existing.lastTunnelUrl,
        agentUrl: args.agentUrl,
        secretHash: args.secretHash,
        platform: args.platform,
        arch: args.arch,
        hostname: args.hostname,
        nodeVersion: args.nodeVersion,
        agentVersion: args.agentVersion,
        status: "online",
        lastHeartbeat: now,
      });
      return existing._id;
    } else {
      return await ctx.db.insert("agentRegistry", {
        ...args,
        status: "online",
        lastHeartbeat: now,
        registeredAt: now,
      });
    }
  },
});

// ── INTERNAL: HEARTBEAT ───────────────────────────────────────────────────
export const heartbeat = internalMutation({
  args: { nodeId: v.string(), agentUrl: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!node) return null;
    await ctx.db.patch(node._id, {
      status: "online",
      lastHeartbeat: Date.now(),
      ...(args.agentUrl && args.agentUrl !== node.agentUrl ? {
        lastTunnelUrl: node.agentUrl,
        agentUrl: args.agentUrl,
      } : {}),
    });
    return node._id;
  },
});

// ── INTERNAL: MARK OFFLINE ────────────────────────────────────────────────
export const markOffline = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!node) return null;
    await ctx.db.patch(node._id, { status: "offline" });
    return node._id;
  },
});

// ── INTERNAL: GET NODE BY ID ──────────────────────────────────────────────
export const getNode = internalQuery({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.nodeId))
      .unique();
  },
});

// ── INTERNAL: GET ALL NODES ───────────────────────────────────────────────
export const getAllNodes = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("agentRegistry").collect();
  },
});

// ── PUBLIC: LIST NODES (admin UI) ─────────────────────────────────────────
export const listNodes = internalQuery({
  args: {},
  handler: async (ctx) => {
    const nodes = await ctx.db.query("agentRegistry").collect();
    // Strip secretHash from public response
    return nodes.map(({ secretHash: _s, ...rest }) => rest);
  },
});

// ── PUBLIC: MARK NODE OFFLINE (admin) ────────────────────────────────────
export const deregisterNode = internalMutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const node = await ctx.db
      .query("agentRegistry")
      .withIndex("by_node_id", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!node) throw new Error("Node not found");
    await ctx.db.patch(node._id, { status: "offline" });
    return { ok: true };
  },
});
