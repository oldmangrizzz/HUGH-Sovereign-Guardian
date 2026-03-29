import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";

const applicationTables = {

  // ── STIGMERGIC SUBSTRATE ──────────────────────────────────────────────
  pheromones: defineTable({
    emitterId: v.string(),
    nodeId: v.string(),
    signature: v.string(),
    type: v.string(),
    payload: v.string(),
    weight: v.number(),
    zone: v.string(),
    expiresAt: v.number(),
    evaporated: v.boolean(),
  })
    .index("by_node_and_type", ["nodeId", "type"])
    .index("by_expiry", ["expiresAt"])
    .index("by_emitter", ["emitterId"]),

  // ── ENDOCRINE STATE ────────────────────────────────────────────────────────
  endocrineState: defineTable({
    nodeId: v.string(),
    cortisol: v.number(),
    dopamine: v.number(),
    adrenaline: v.number(),
    lastPulse: v.number(),
    holographicMode: v.boolean(),
  })
    .index("by_node", ["nodeId"]),

  // ── EPISODIC MEMORY ────────────────────────────────────────────────────────
  episodicMemory: defineTable({
    nodeId: v.string(),
    sessionId: v.string(),
    speakerId: v.optional(v.string()),
    eventType: v.string(),
    content: v.string(),
    emotionalContext: v.optional(v.string()),
    cortisolAtTime: v.number(),
    dopamineAtTime: v.number(),
    adrenalineAtTime: v.number(),
    importance: v.number(),
  })
    .index("by_node_and_session", ["nodeId", "sessionId"])
    .index("by_node_and_type", ["nodeId", "eventType"])
    .index("by_importance", ["importance"]),

  // ── SEMANTIC MEMORY (MYCELIUM / COGNEE) ──────────────────────────────────
  semanticMemory: defineTable({
    nodeId: v.string(),
    subject: v.string(),
    subjectType: v.optional(v.string()),
    predicate: v.string(),
    object: v.string(),
    objectType: v.optional(v.string()),
    confidence: v.number(),
    sourceEpisodeId: v.optional(v.id("episodicMemory")),
    lastReinforced: v.number(),
    metaJson: v.optional(v.string()),
  })
    .index("by_node_and_subject", ["nodeId", "subject"])
    .index("by_node_and_predicate", ["nodeId", "predicate"]),

  // ── ARCHIVAL MEMORY (LONG-TERM / MEMGPT) ──────────────────────────────────
  archivalMemory: defineTable({
    nodeId: v.string(),
    content: v.string(),
    embedding: v.array(v.number()),
    metadataJson: v.optional(v.string()),
    ts: v.number(),
  })
    .index("by_node", ["nodeId"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1536,
      filterFields: ["nodeId"],
    }),

  // ── NODE REGISTRY ──────────────────────────────────────────────────────────
  nodeRegistry: defineTable({
    nodeId: v.string(),
    label: v.string(),
    anchorHash: v.string(),
    status: v.string(),
    lastHeartbeat: v.number(),
    infraAddress: v.optional(v.string()),
  })
    .index("by_node", ["nodeId"])
    .index("by_status", ["status"]),

  // ── AUTOPHAGY LOG ─────────────────────────────────────────────────────────
  autophagyLog: defineTable({
    nodeId: v.string(),
    phase: v.string(),
    startedAt: v.number(),
    completedAt: v.optional(v.number()),
    evaporatedCount: v.number(),
    synthesizedCount: v.number(),
    notes: v.optional(v.string()),
  })
    .index("by_node", ["nodeId"]),

  // ── VAULT (FILE STORAGE) ───────────────────────────────────────────────────
  vaultFiles: defineTable({
    storageId: v.id("_storage"),
    uploadedBy: v.id("users"),
    filename: v.string(),
    contentType: v.string(),
    sizeBytes: v.number(),
    label: v.optional(v.string()),
    hughContext: v.optional(v.string()),
    isPublic: v.boolean(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_uploader", ["uploadedBy"])
    .index("by_public", ["isPublic"]),

  // ── GROWTH LOG ────────────────────────────────────────────────────────────
  growthLog: defineTable({
    nodeId: v.string(),
    authorId: v.id("users"),
    category: v.string(),
    title: v.string(),
    content: v.string(),
    priority: v.number(),
    active: v.boolean(),
    tags: v.optional(v.array(v.string())),
  })
    .index("by_node", ["nodeId"])
    .index("by_node_and_active", ["nodeId", "active"]),

  // ── MCP TOOL REGISTRY ─────────────────────────────────────────────────────
  mcpTools: defineTable({
    name: v.string(),
    description: v.string(),
    inputSchema: v.string(),
    endpoint: v.string(),
    zone: v.string(),
    enabled: v.boolean(),
    requiresAuth: v.boolean(),
    callCount: v.number(),
    lastCalledAt: v.optional(v.number()),
  })
    .index("by_name", ["name"])
    .index("by_enabled", ["enabled"]),

  // ── MCP CALL LOG ──────────────────────────────────────────────────────────
  mcpCallLog: defineTable({
    nodeId: v.string(),
    toolName: v.string(),
    input: v.string(),
    output: v.optional(v.string()),
    zone: v.string(),
    success: v.boolean(),
    errorMessage: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    sessionId: v.optional(v.string()),
  })
    .index("by_node", ["nodeId"])
    .index("by_tool", ["toolName"]),

  // ── STANDBY LOG ───────────────────────────────────────────────────────────
  standbyLog: defineTable({
    nodeId: v.string(),
    invokedBy: v.optional(v.string()),
    reason: v.optional(v.string()),
    standbyMode: v.string(),
    resolvedAt: v.optional(v.number()),
    notes: v.optional(v.string()),
  })
    .index("by_node", ["nodeId"]),

  // ── TACTICAL MAP — WAYPOINTS ───────────────────────────────────────────────
  mapWaypoints: defineTable({
    createdBy: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    label: v.string(),
    description: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    altitude: v.optional(v.number()),
    waypointType: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    visible: v.boolean(),
    tags: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  })
    .index("by_type", ["waypointType"])
    .index("by_visible", ["visible"]),

  // ── TACTICAL MAP — TRACKS ──────────────────────────────────────────────────
  mapTracks: defineTable({
    createdBy: v.optional(v.id("users")),
    sessionId: v.optional(v.string()),
    label: v.string(),
    color: v.string(),
    trackType: v.string(),
    active: v.boolean(),
    pointsJson: v.string(),
    distanceMeters: v.optional(v.number()),
    durationMs: v.optional(v.number()),
  })
    .index("by_active", ["active"]),

  // ── TACTICAL MAP — OSINT FEEDS ─────────────────────────────────────────────
  osintFeeds: defineTable({
    name: v.string(),
    feedType: v.string(),
    sourceUrl: v.string(),
    enabled: v.boolean(),
    lastFetchedAt: v.optional(v.number()),
    lastStatus: v.optional(v.string()),
    refreshIntervalMs: v.number(),
    cachedDataJson: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    displayColor: v.string(),
    iconEmoji: v.string(),
  })
    .index("by_type", ["feedType"])
    .index("by_enabled", ["enabled"]),

  // ── TACTICAL MAP — MAP LAYERS ──────────────────────────────────────────────
  mapLayerState: defineTable({
    sessionId: v.string(),
    layerId: v.string(),
    visible: v.boolean(),
    opacity: v.number(),
  })
    .index("by_session", ["sessionId"])
    .index("by_session_and_layer", ["sessionId", "layerId"]),

  // ── APP STATE (MCP SINGLETON) ──────────────────────────────────────────────
  appState: defineTable({
    key: v.string(),
    mode: v.string(),
    alertsJson: v.string(),
    entitiesJson: v.string(),
    cameraJson: v.string(),
    updatedAt: v.number(),
  })
    .index("by_key", ["key"]),

  // ── AUDIO CONFIG (LIVEKIT) ─────────────────────────────────────────────────
  audioConfig: defineTable({
    roomName: v.string(),
    status: v.string(),
    maxParticipants: v.optional(v.number()),
    metaJson: v.optional(v.string()),
    createdAt: v.number(),
    closedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomName"])
    .index("by_status", ["status"]),

  // ── TRANSCRIPTS (DEEPGRAM) ────────────────────────────────────────────────
  transcripts: defineTable({
    roomName: v.string(),
    sessionId: v.string(),
    speakerId: v.optional(v.string()),
    speakerLabel: v.optional(v.string()),
    text: v.string(),
    confidence: v.optional(v.number()),
    isFinal: v.boolean(),
    durationMs: v.optional(v.number()),
    ts: v.number(),
  })
    .index("by_room", ["roomName"])
    .index("by_session", ["sessionId"])
    .index("by_room_and_final", ["roomName", "isFinal"]),

  // ── KVM COMMAND LOG ───────────────────────────────────────────────────────
  // Every command H.U.G.H. issues to the Hostinger VPS is logged here.
  // Human-on-the-loop: you can see everything, veto nothing (by design).
  kvmCommandLog: defineTable({
    // Who/what issued the command
    issuedBy: v.string(),        // "hugh-primary" | "admin:<userId>"
    sessionId: v.optional(v.string()),
    // The command itself
    command: v.string(),
    workingDir: v.optional(v.string()),
    // Execution result
    stdout: v.optional(v.string()),
    stderr: v.optional(v.string()),
    exitCode: v.optional(v.number()),
    success: v.boolean(),
    durationMs: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
    // Classification
    zone: v.string(),
    notes: v.optional(v.string()),
    targetNodeId: v.optional(v.string()),
  })
    .index("by_issued_by", ["issuedBy"])
    .index("by_success", ["success"])
    .index("by_target_node", ["targetNodeId"]),

  // ── AGENT REGISTRY ────────────────────────────────────────────────────────
  agentRegistry: defineTable({
    nodeId: v.string(),
    label: v.string(),
    agentUrl: v.string(),
    secretHash: v.string(),
    platform: v.string(),
    arch: v.optional(v.string()),
    hostname: v.string(),
    nodeVersion: v.optional(v.string()),
    agentVersion: v.optional(v.string()),
    status: v.string(),
    lastHeartbeat: v.number(),
    registeredAt: v.number(),
    lastTunnelUrl: v.optional(v.string()),
  })
    .index("by_node_id", ["nodeId"])
    .index("by_status", ["status"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
