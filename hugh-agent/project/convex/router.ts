/**
 * router.ts — HTTP endpoints
 *
 * POST /api/agent/register   — hugh-agent self-registration
 * POST /api/agent/heartbeat  — keep-alive from running agents
 * GET  /api/world-snapshot   — Unity WebGL polling
 * POST /api/mcp/*            — MCP tool calls (X-Hugh-Secret required)
 * POST /api/deepgram/transcript
 */

import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api, internal } from "./_generated/api";

const http = httpRouter();

// ── HELPERS ────────────────────────────────────────────────────────────────

function checkSecret(req: Request): Response | null {
  const secret = process.env.MCP_SECRET;
  if (!secret) return null;
  if (req.headers.get("x-hugh-secret") !== secret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return null;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function corsOk() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Hugh-Secret, X-Agent-Secret",
    },
  });
}

// ── POST /api/agent/register ───────────────────────────────────────────────
http.route({
  path: "/api/agent/register",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json() as {
      nodeId?: string;
      label?: string;
      agentUrl?: string;
      agentSecret?: string;
      platform?: string;
      arch?: string;
      hostname?: string;
      nodeVersion?: string;
      agentVersion?: string;
    };

    if (!body.nodeId || !body.agentUrl || !body.agentSecret || !body.platform || !body.hostname) {
      return json({ error: "nodeId, agentUrl, agentSecret, platform, hostname required" }, 400);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(body.agentSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const secretHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    await ctx.runMutation(internal.agentRegistry.upsertNode, {
      nodeId: body.nodeId,
      label: body.label ?? body.nodeId,
      agentUrl: body.agentUrl,
      secretHash,
      platform: body.platform,
      arch: body.arch,
      hostname: body.hostname,
      nodeVersion: body.nodeVersion,
      agentVersion: body.agentVersion,
    });

    return json({
      ok: true,
      nodeId: body.nodeId,
      message: `Node "${body.nodeId}" registered. Welcome to the substrate.`,
    });
  }),
});

http.route({ path: "/api/agent/register", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/agent/heartbeat ──────────────────────────────────────────────
http.route({
  path: "/api/agent/heartbeat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const body = await req.json() as {
      nodeId?: string;
      agentSecret?: string;
      agentUrl?: string;
    };

    if (!body.nodeId || !body.agentSecret) {
      return json({ error: "nodeId and agentSecret required" }, 400);
    }

    const node = await ctx.runQuery(internal.agentRegistry.getNode, { nodeId: body.nodeId }) as {
      secretHash: string;
    } | null;

    if (!node) {
      return json({ error: "Node not registered. Call /api/agent/register first." }, 404);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(body.agentSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const incomingHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (incomingHash !== node.secretHash) {
      return json({ error: "Unauthorized" }, 401);
    }

    await ctx.runMutation(internal.agentRegistry.heartbeat, {
      nodeId: body.nodeId,
      agentUrl: body.agentUrl,
    });

    return json({ ok: true, ts: Date.now() });
  }),
});

http.route({ path: "/api/agent/heartbeat", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── GET /api/world-snapshot ────────────────────────────────────────────────
http.route({
  path: "/api/world-snapshot",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const snapshot = await ctx.runQuery(api.appState.getWorldSnapshot);
    return json(snapshot);
  }),
});

http.route({ path: "/api/world-snapshot", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/set-mode ─────────────────────────────────────────────────
http.route({
  path: "/api/mcp/set-mode",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { mode?: string };
    if (!body.mode) return json({ error: "mode required" }, 400);
    return json(await ctx.runMutation(api.appState.setMode, { mode: body.mode }));
  }),
});

http.route({ path: "/api/mcp/set-mode", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/add-alert ────────────────────────────────────────────────
http.route({
  path: "/api/mcp/add-alert",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { severity?: string; message?: string };
    if (!body.severity || !body.message) return json({ error: "severity and message required" }, 400);
    if (!["info", "warning", "critical"].includes(body.severity)) return json({ error: "invalid severity" }, 400);
    return json(await ctx.runMutation(api.appState.addAlert, {
      severity: body.severity as "info" | "warning" | "critical",
      message: body.message,
    }));
  }),
});

http.route({ path: "/api/mcp/add-alert", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/spawn-entity ─────────────────────────────────────────────
http.route({
  path: "/api/mcp/spawn-entity",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as {
      type?: string; label?: string;
      x?: number; y?: number; z?: number; color?: string;
    };
    if (!body.type || !body.label || body.x == null || body.y == null || body.z == null) {
      return json({ error: "type, label, x, y, z required" }, 400);
    }
    return json(await ctx.runMutation(api.appState.spawnEntity, {
      type: body.type, label: body.label,
      x: body.x, y: body.y, z: body.z, color: body.color,
    }));
  }),
});

http.route({ path: "/api/mcp/spawn-entity", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/despawn-entity ───────────────────────────────────────────
http.route({
  path: "/api/mcp/despawn-entity",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { entityId?: string };
    if (!body.entityId) return json({ error: "entityId required" }, 400);
    return json(await ctx.runMutation(api.appState.despawnEntity, { entityId: body.entityId }));
  }),
});

http.route({ path: "/api/mcp/despawn-entity", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/move-camera ──────────────────────────────────────────────
http.route({
  path: "/api/mcp/move-camera",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { x?: number; y?: number; z?: number; target?: string };
    if (body.x == null || body.y == null || body.z == null) {
      return json({ error: "x, y, z required" }, 400);
    }
    return json(await ctx.runMutation(api.appState.moveCamera, {
      x: body.x, y: body.y, z: body.z, target: body.target,
    }));
  }),
});

http.route({ path: "/api/mcp/move-camera", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/mcp/drop-pheromone ───────────────────────────────────────────
http.route({
  path: "/api/mcp/drop-pheromone",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as {
      type?: string; weight?: number;
      x?: number; y?: number; z?: number;
      emitterId?: string; ttlMs?: number;
    };
    if (!body.type || body.weight == null || body.x == null || body.y == null || body.z == null || !body.emitterId) {
      return json({ error: "type, weight, x, y, z, emitterId required" }, 400);
    }
    return json(await ctx.runMutation(api.appState.dropPheromone, {
      type: body.type, weight: body.weight,
      x: body.x, y: body.y, z: body.z,
      emitterId: body.emitterId, ttlMs: body.ttlMs,
    }));
  }),
});

http.route({ path: "/api/mcp/drop-pheromone", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

// ── POST /api/deepgram/transcript ──────────────────────────────────────────
http.route({
  path: "/api/deepgram/transcript",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as {
      roomName?: string; sessionId?: string;
      speakerId?: string; speakerLabel?: string;
      text?: string; confidence?: number;
      isFinal?: boolean; durationMs?: number; ts?: number;
    };
    if (!body.roomName || !body.sessionId || !body.text || body.isFinal == null) {
      return json({ error: "roomName, sessionId, text, isFinal required" }, 400);
    }
    const id = await ctx.runMutation(api.deepgram.recordTranscript, {
      roomName: body.roomName,
      sessionId: body.sessionId,
      speakerId: body.speakerId,
      speakerLabel: body.speakerLabel,
      text: body.text,
      confidence: body.confidence,
      isFinal: body.isFinal,
      durationMs: body.durationMs,
      ts: body.ts,
    });
    return json({ id });
  }),
});

http.route({ path: "/api/deepgram/transcript", method: "OPTIONS", handler: httpAction(async () => corsOk()) });

export default http;
