/**
 * router.ts — HTTP endpoints
 *
 * POST /api/agent/register   — hugh-agent self-registration
 * POST /api/agent/heartbeat  — keep-alive from running agents
 * GET  /api/world-snapshot   — Unity WebGL polling
 * POST /api/mcp/*            — MCP tool calls (X-Hugh-Secret required)
 * POST /api/transcripts/record — STT transcript storage
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

// N-01 FIX: Replace wildcard CORS with exact origin allowlist
const ALLOWED_ORIGINS = [
  /^https?:\/\/([a-z0-9-]+\.)*grizzlymedicine\.icu$/,
  /^https?:\/\/localhost(:\d+)?$/,
  /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
];

function getAllowedOrigin(req: Request): string {
  const origin = req.headers.get("Origin") || "";
  if (ALLOWED_ORIGINS.some(re => re.test(origin))) return origin;
  return "";
}

function json(data: unknown, status = 200, req?: Request) {
  const origin = req ? getAllowedOrigin(req) : "";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(JSON.stringify(data), { status, headers });
}

function corsOk(req?: Request) {
  const origin = req ? getAllowedOrigin(req) : "";
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Hugh-Secret, X-Agent-Secret, Authorization",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return new Response(null, { status: 204, headers });
}

// ── POST /api/agent/register ───────────────────────────────────────────────
// N-08 FIX: Require X-Hugh-Secret to prevent rogue agent registration
http.route({
  path: "/api/agent/register",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;

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
      return json({ error: "nodeId, agentUrl, agentSecret, platform, hostname required" }, 400, req);
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
    }, 200, req);
  }),
});

http.route({ path: "/api/agent/register", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

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
      return json({ error: "nodeId and agentSecret required" }, 400, req);
    }

    const node = await ctx.runQuery(internal.agentRegistry.getNode, { nodeId: body.nodeId }) as {
      secretHash: string;
    } | null;

    if (!node) {
      return json({ error: "Node not registered. Call /api/agent/register first." }, 404, req);
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(body.agentSecret);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const incomingHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");

    if (incomingHash !== node.secretHash) {
      return json({ error: "Unauthorized" }, 401, req);
    }

    await ctx.runMutation(internal.agentRegistry.heartbeat, {
      nodeId: body.nodeId,
      agentUrl: body.agentUrl,
    });

    return json({ ok: true, ts: Date.now() }, 200, req);
  }),
});

http.route({ path: "/api/agent/heartbeat", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── GET /api/world-snapshot ────────────────────────────────────────────────
http.route({
  path: "/api/world-snapshot",
  method: "GET",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    const snapshot = await ctx.runQuery(api.appState.getWorldSnapshot);
    return json(snapshot, 200, req);
  }),
});

http.route({ path: "/api/world-snapshot", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/memory/context ─────────────────────────────────────────────
// J-01 FIX: Authenticated facade for cross-session memory — replaces 3 public queries
http.route({
  path: "/api/memory/context",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = await req.json() as {
        sessionId?: string;
        conversationLimit?: number;
        semanticLimit?: number;
        nodeId?: string;
      };
      const nodeId = body.nodeId ?? "hugh-primary";
      const [conversation, semantics, endocrine, modulation, cnsMask] = await Promise.all([
        ctx.runQuery(internal.memory.loadRecentConversation, {
          limit: body.conversationLimit ?? 6,
          excludeSession: body.sessionId,
        }),
        ctx.runQuery(internal.memory.getSemanticMemory, {
          limit: body.semanticLimit ?? 8,
        }),
        ctx.runQuery(api.endocrine.getState, { nodeId }),
        ctx.runQuery(api.endocrine.computeModulationParams, { nodeId }),
        ctx.runQuery(api.cns.getActiveMask, { nodeId }),
      ]);
      return json({ conversation, semantics, endocrine, modulation, cnsMask }, 200, req);
    } catch {
      return json({ error: "Memory retrieval failed" }, 500, req);
    }
  }),
});

http.route({ path: "/api/memory/context", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/endocrine/learn — Post-response endocrine spike ────────────
// Gateway calls this after each response to trigger the endocrine feedback loop.
http.route({
  path: "/api/endocrine/learn",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = await req.json() as {
        nodeId?: string;
        userMessage: string;
        assistantResponse: string;
      };
      await ctx.runMutation(internal.endocrine.analyzeAndSpike, {
        nodeId: body.nodeId ?? "hugh-primary",
        
        userMessage: body.userMessage,
        assistantResponse: body.assistantResponse,
      });
      return json({ ok: true }, 200, req);
    } catch {
      return json({ error: "Endocrine spike failed" }, 500, req);
    }
  }),
});

http.route({ path: "/api/endocrine/learn", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/mcp/set-mode ─────────────────────────────────────────────────
http.route({
  path: "/api/mcp/set-mode",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { mode?: string };
    if (!body.mode) return json({ error: "mode required" }, 400, req);
    return json(await ctx.runMutation(internal.appState.setMode, { mode: body.mode }), 200, req);
  }),
});

http.route({ path: "/api/mcp/set-mode", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/mcp/add-alert ────────────────────────────────────────────────
http.route({
  path: "/api/mcp/add-alert",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { severity?: string; message?: string };
    if (!body.severity || !body.message) return json({ error: "severity and message required" }, 400, req);
    if (!["info", "warning", "critical"].includes(body.severity)) return json({ error: "invalid severity" }, 400, req);
    return json(await ctx.runMutation(internal.appState.addAlert, {
      severity: body.severity as "info" | "warning" | "critical",
      message: body.message,
    }), 200, req);
  }),
});

http.route({ path: "/api/mcp/add-alert", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

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
      return json({ error: "type, label, x, y, z required" }, 400, req);
    }
    return json(await ctx.runMutation(internal.appState.spawnEntity, {
      type: body.type, label: body.label,
      x: body.x, y: body.y, z: body.z, color: body.color,
    }), 200, req);
  }),
});

http.route({ path: "/api/mcp/spawn-entity", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/mcp/despawn-entity ───────────────────────────────────────────
http.route({
  path: "/api/mcp/despawn-entity",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { entityId?: string };
    if (!body.entityId) return json({ error: "entityId required" }, 400, req);
    return json(await ctx.runMutation(internal.appState.despawnEntity, { entityId: body.entityId }), 200, req);
  }),
});

http.route({ path: "/api/mcp/despawn-entity", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/mcp/move-camera ──────────────────────────────────────────────
http.route({
  path: "/api/mcp/move-camera",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const err = checkSecret(req);
    if (err) return err;
    const body = await req.json() as { x?: number; y?: number; z?: number; target?: string };
    if (body.x == null || body.y == null || body.z == null) {
      return json({ error: "x, y, z required" }, 400, req);
    }
    return json(await ctx.runMutation(internal.appState.moveCamera, {
      x: body.x, y: body.y, z: body.z, target: body.target,
    }), 200, req);
  }),
});

http.route({ path: "/api/mcp/move-camera", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

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
      return json({ error: "type, weight, x, y, z, emitterId required" }, 400, req);
    }
    return json(await ctx.runMutation(internal.appState.dropPheromone, {
      type: body.type, weight: body.weight,
      x: body.x, y: body.y, z: body.z,
      emitterId: body.emitterId, ttlMs: body.ttlMs,
    }), 200, req);
  }),
});

http.route({ path: "/api/mcp/drop-pheromone", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/transcripts/record ───────────────────────────────────────────
http.route({
  path: "/api/transcripts/record",
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
      return json({ error: "roomName, sessionId, text, isFinal required" }, 400, req);
    }
    const id = await ctx.runMutation(api.transcripts.recordTranscript, {
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
    return json({ id }, 200, req);
  }),
});

http.route({ path: "/api/transcripts/record", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/chat ─────────────────────────────────────────────────────────
// Public HTTP endpoint for the web player (Pixel Streaming kiosk).
// Calls the full cognitive loop: memory retrieval → system prompt → LLM → memory storage.

http.route({
  path: "/api/chat",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = (await req.json()) as {
        message?: string;
        sessionId?: string;
        nodeId?: string;
        endocrineState?: {
          cortisol: number;
          dopamine: number;
          adrenaline: number;
          holographicMode: boolean;
        };
      };

      if (!body.message || typeof body.message !== "string") {
        return json({ error: "message is required" }, 400, req);
      }

      const response = await ctx.runAction(api.hugh.chat, {
        nodeId: "hugh-primary",
        
        message: body.message,
        sessionId: body.sessionId,
        endocrineState: body.endocrineState ?? {
          cortisol: 0.2,
          dopamine: 0.5,
          adrenaline: 0.1,
          holographicMode: false,
        },
      });

      return json({ response, status: "ok" }, 200, req);
    } catch (error) {
      console.error("[router] /api/chat error:", error);
      return json({ error: "Processing error" }, 500, req);
    }
  }),
});

http.route({ path: "/api/chat", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/auth/login ──────────────────────────────────────────────────
http.route({
  path: "/api/auth/login",
  method: "POST",
  handler: httpAction(async (_ctx, req) => {
    try {
      const { email, password } = await req.json();
      if (!email || !password) return json({ success: false, error: "Missing credentials" }, 400, req);

      // Validate credentials
      const encoder = new TextEncoder();
      const hashBuf = await crypto.subtle.digest("SHA-256", encoder.encode(password));
      const hash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");

      // N-07 FIX: Accounts loaded from environment, not hardcoded in source
      const accountsJson = process.env.HUGH_ACCOUNTS;
      if (!accountsJson) return json({ success: false, error: "Authentication unavailable" }, 503, req);
      let accounts: [string, string, string][];
      try { accounts = JSON.parse(accountsJson); } catch { return json({ success: false, error: "Authentication unavailable" }, 503, req); }

      const match = accounts.find(([e, h]) => email.toLowerCase() === e && hash === h);
      if (match) {
        const tokenBytes = new Uint8Array(32);
        crypto.getRandomValues(tokenBytes);
        const token = Array.from(tokenBytes).map(b => b.toString(16).padStart(2, "0")).join("");
        return json({ success: true, displayName: match[2], token }, 200, req);
      }

      return json({ success: false, error: "Invalid credentials" }, 401, req);
    } catch {
      return json({ success: false, error: "Authentication failed" }, 500, req);
    }
  }),
});

http.route({ path: "/api/auth/login", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/tts ──────────────────────────────────────────────────────────
import { synthesize } from "./tts";

http.route({
  path: "/api/tts",
  method: "POST",
  handler: synthesize,
});

http.route({
  path: "/api/tts",
  method: "OPTIONS",
  handler: synthesize,
});

// ── POST /api/ws/episode — Gateway stores WS conversation in episodic memory ──
http.route({
  path: "/api/ws/episode",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = await req.json() as {
        sessionId?: string;
        speakerName?: string;
        userText?: string;
        hughResponse?: string;
      };
      if (!body.userText || !body.hughResponse) {
        return json({ error: "userText and hughResponse required" }, 400, req);
      }
      await ctx.runMutation(internal.memory.writeEpisodePair, {
        sessionId: body.sessionId ?? "ws_" + Date.now(),
        speakerName: body.speakerName ?? "Guest",
        userText: body.userText,
        hughResponse: body.hughResponse,
      });
      return json({ ok: true }, 200, req);
    } catch {
      return json({ error: "Processing error" }, 500, req);
    }
  }),
});

http.route({ path: "/api/ws/episode", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/ws/pheromone — Gateway deposits stigmergy coordination signal ──
http.route({
  path: "/api/ws/pheromone",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = await req.json() as {
        emitterId?: string;
        nodeId?: string;
        type?: string;
        payload?: string;
        weight?: number;
        zone?: string;
        ttlMs?: number;
      };
      if (!body.type || !body.emitterId) {
        return json({ error: "type and emitterId required" }, 400, req);
      }
      const id = await ctx.runMutation(internal.stigmergy.deposit, {
        nodeId: body.nodeId ?? "hugh-primary",
        emitterId: body.emitterId,
        
        signature: `gw-${Date.now()}`,
        type: body.type,
        payload: body.payload ?? "{}",
        weight: Math.max(0, Math.min(1, body.weight ?? 0.7)),
        zone: body.zone ?? "green",
        ttlMs: Math.min(body.ttlMs ?? 300000, 600000), // Cap at 10 minutes
      });
      return json({ ok: true, id }, 200, req);
    } catch {
      return json({ error: "Processing error" }, 500, req);
    }
  }),
});

http.route({ path: "/api/ws/pheromone", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

// ── POST /api/cognitive/cycle ───────────────────────────────────────────
http.route({
  path: "/api/cognitive/cycle",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const authErr = checkSecret(req);
    if (authErr) return authErr;
    try {
      const body = await req.json() as {
        nodeId?: string;
        stimulusType: string;
        stimulusData: string;
      };
      const result = await ctx.runAction(api.cognitiveLoop.runCycle, {
        
        stimulusType: body.stimulusType,
        stimulusData: body.stimulusData,
      });
      return json(result, 200, req);
    } catch (err) {
      console.error("[router] /api/cognitive/cycle error:", err);
      return json({ error: "Cognitive cycle failed" }, 500, req);
    }
  }),
});

http.route({ path: "/api/cognitive/cycle", method: "OPTIONS", handler: httpAction(async (_ctx, req) => corsOk(req)) });

export default http;
