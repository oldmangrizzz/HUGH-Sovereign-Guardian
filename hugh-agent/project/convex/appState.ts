/**
 * appState.ts — MCP Server Integration
 *
 * Singleton app state document. The MCP server on KVM4 calls these mutations
 * to drive the Unity WebGL viewer and H.U.G.H.'s situational awareness.
 *
 * All mutations are PUBLIC so the MCP server can call them via the Convex
 * HTTP API. Secure them with the X-Hugh-Secret header check in router.ts.
 */
import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const STATE_KEY = "main";

// ── TYPES (mirrored in Unity) ──────────────────────────────────────────────

export type Alert = {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  ts: number;
};

export type Entity = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  z: number;
  color?: string;
  spawnedAt: number;
};

export type Camera = {
  x: number;
  y: number;
  z: number;
  target?: string;
  updatedAt: number;
};

// ── HELPERS ────────────────────────────────────────────────────────────────

async function getOrCreateState(ctx: any) {
  const existing = await ctx.db
    .query("appState")
    .withIndex("by_key", (q: any) => q.eq("key", STATE_KEY))
    .unique();
  if (existing) return existing;
  const id = await ctx.db.insert("appState", {
    key: STATE_KEY,
    mode: "nominal",
    alertsJson: "[]",
    entitiesJson: "[]",
    cameraJson: "{}",
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
}

// ── GET FULL STATE ─────────────────────────────────────────────────────────
// Simple singleton read. Unity can also call getWorldSnapshot for pheromones.
export const getFullState = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("appState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();
  },
});

// ── GET WORLD SNAPSHOT ─────────────────────────────────────────────────────
// Returns appState singleton + last 100 active pheromones in one call.
// Unity WebGL polls this endpoint every ~500ms via GET /api/world-snapshot.
export const getWorldSnapshot = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db
      .query("appState")
      .withIndex("by_key", (q) => q.eq("key", STATE_KEY))
      .unique();

    const now = Date.now();
    const candidates = await ctx.db
      .query("pheromones")
      .withIndex("by_expiry", (q) => q.gt("expiresAt", now))
      .order("desc")
      .take(100);

    return {
      state,
      pheromones: candidates.filter((p) => !p.evaporated),
      snapshotAt: now,
    };
  },
});

// ── SET MODE ───────────────────────────────────────────────────────────────
// MCP: setMode("combat") | setMode("nominal") | setMode("standby")
export const setMode = mutation({
  args: { mode: v.string() },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    await ctx.db.patch(doc._id, { mode: args.mode, updatedAt: Date.now() });
    return { ok: true, mode: args.mode };
  },
});

// ── ADD ALERT ──────────────────────────────────────────────────────────────
// MCP: addAlert("critical", "Perimeter breach at sector 7")
// Stored as JSON array in alertsJson. Max 50 kept, newest first.
export const addAlert = mutation({
  args: {
    severity: v.union(v.literal("info"), v.literal("warning"), v.literal("critical")),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    const alerts: Alert[] = JSON.parse(doc.alertsJson ?? "[]");
    const newAlert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      severity: args.severity,
      message: args.message,
      ts: Date.now(),
    };
    const updated = [newAlert, ...alerts].slice(0, 50);
    await ctx.db.patch(doc._id, {
      alertsJson: JSON.stringify(updated),
      updatedAt: Date.now(),
    });
    return newAlert;
  },
});

// ── SPAWN ENTITY ───────────────────────────────────────────────────────────
// MCP: spawnEntity("drone", "Scout-1", 12.5, 0, -8.3, "#00ff88")
// Stored as JSON array in entitiesJson. Max 200 kept.
export const spawnEntity = mutation({
  args: {
    type: v.string(),
    label: v.string(),
    x: v.number(),
    y: v.number(),
    z: v.number(),
    color: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    const entities: Entity[] = JSON.parse(doc.entitiesJson ?? "[]");
    const newEntity: Entity = {
      id: `entity_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: args.type,
      label: args.label,
      x: args.x,
      y: args.y,
      z: args.z,
      color: args.color,
      spawnedAt: Date.now(),
    };
    const updated = [newEntity, ...entities].slice(0, 200);
    await ctx.db.patch(doc._id, {
      entitiesJson: JSON.stringify(updated),
      updatedAt: Date.now(),
    });
    return newEntity;
  },
});

// ── DESPAWN ENTITY ─────────────────────────────────────────────────────────
export const despawnEntity = mutation({
  args: { entityId: v.string() },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    const entities: Entity[] = JSON.parse(doc.entitiesJson ?? "[]");
    const updated = entities.filter((e) => e.id !== args.entityId);
    await ctx.db.patch(doc._id, {
      entitiesJson: JSON.stringify(updated),
      updatedAt: Date.now(),
    });
    return { removed: entities.length - updated.length };
  },
});

// ── MOVE CAMERA ────────────────────────────────────────────────────────────
// MCP: moveCamera(0, 50, -20, "entity_abc123")
export const moveCamera = mutation({
  args: {
    x: v.number(),
    y: v.number(),
    z: v.number(),
    target: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    const camera: Camera = {
      x: args.x,
      y: args.y,
      z: args.z,
      target: args.target,
      updatedAt: Date.now(),
    };
    await ctx.db.patch(doc._id, {
      cameraJson: JSON.stringify(camera),
      updatedAt: Date.now(),
    });
    return camera;
  },
});

// ── DROP PHEROMONE ─────────────────────────────────────────────────────────
// MCP: dropPheromone("threat", 0.85, 12.5, 0, -8.3, "hugh-primary")
// TTL defaults to 60s. 3D position encoded in payload JSON.
export const dropPheromone = mutation({
  args: {
    type: v.string(),
    weight: v.number(),
    x: v.number(),
    y: v.number(),
    z: v.number(),
    emitterId: v.string(),
    ttlMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const ttl = args.ttlMs ?? 60_000;
    const now = Date.now();
    const id = await ctx.db.insert("pheromones", {
      emitterId: args.emitterId,
      nodeId: "world",
      signature: `${args.type}:${args.emitterId}:${now}`,
      type: args.type,
      payload: JSON.stringify({ x: args.x, y: args.y, z: args.z }),
      weight: Math.max(0, Math.min(1, args.weight)),
      zone: "green",
      expiresAt: now + ttl,
      evaporated: false,
    });
    return { id, expiresAt: now + ttl };
  },
});

// ── UPSERT STATE (legacy / generic patch) ─────────────────────────────────
export const upsertState = mutation({
  args: {
    mode: v.optional(v.string()),
    alertsJson: v.optional(v.string()),
    entitiesJson: v.optional(v.string()),
    cameraJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    await ctx.db.patch(doc._id, {
      ...(args.mode !== undefined ? { mode: args.mode } : {}),
      ...(args.alertsJson !== undefined ? { alertsJson: args.alertsJson } : {}),
      ...(args.entitiesJson !== undefined ? { entitiesJson: args.entitiesJson } : {}),
      ...(args.cameraJson !== undefined ? { cameraJson: args.cameraJson } : {}),
      updatedAt: Date.now(),
    });
    return doc._id;
  },
});

// ── INTERNAL: CLEAN EXPIRED PHEROMONES ────────────────────────────────────
// Called by crons.ts every 60 seconds. Soft-deletes expired pheromones.
export const cleanExpiredPheromones = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const expired = await ctx.db
      .query("pheromones")
      .withIndex("by_expiry", (q) => q.lt("expiresAt", now))
      .collect();
    let cleaned = 0;
    for (const p of expired) {
      if (!p.evaporated) {
        await ctx.db.patch(p._id, { evaporated: true });
        cleaned++;
      }
    }
    return { cleaned, at: now };
  },
});
