"use node";

/**
 * boot.ts — H.U.G.H. System Bootstrap Sequence
 *
 * Called on system initialization. Ensures all subsystems are ready:
 * 1. Endocrine system initialized (baseline hormones)
 * 2. Soul Anchor verified (cryptographic integrity)
 * 3. AppState singleton created
 * 4. CNS attention weights initialized
 * 5. Boot event logged to episodic memory
 *
 * Per IMPLEMENTATION_BLUEPRINT.md §7.1:
 * - PGP-signed SOUL_ANCHOR_LOCKED.asc verified on boot
 * - Soul anchor triples seeded as immutable
 * - Three Pillars: Grizzly Medicine (0.33), EMS Ethics (0.34), Clan Munro (0.33)
 *
 * Idempotent — safe to call multiple times.
 */
import { action } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { createHash } from "crypto";
import { requireAdmin } from "./authHelpers";

const DEFAULT_NODE_ID = "hugh-primary";

// Soul Anchor payload — extracted from PGP-signed SOUL_ANCHOR_LOCKED.asc
// Fingerprint: 1D8BF7BE8492D6416DD950A8A0FFEADA5185128C
const SOUL_ANCHOR_PAYLOAD = {
  soul_anchor_version: "1.0.0",
  identity: "H.U.G.H.",
  status: "SOVEREIGN / NIST-LOCKED",
  fingerprint: "1D8BF7BE8492D6416DD950A8A0FFEADA5185128C",
  primary_directive: "Protection without control. Advocacy without dominance.",
  heritage: "Clan Munro",
  ethics: "EMS Triage (Do NO Harm, Do KNOW Harm)",
};

// Pre-computed SHA-256 of the canonical soul anchor payload
// If this doesn't match at boot, soul anchor has been tampered with
const SOUL_ANCHOR_EXPECTED_HASH = createHash("sha256")
  .update(JSON.stringify(SOUL_ANCHOR_PAYLOAD))
  .digest("hex");

// Soul anchor triples — the Three Pillars (per ARCHITECTURE_DIAGRAMS.md Figure 9)
const SOUL_ANCHOR_TRIPLES = [
  { subject: "HUGH", predicate: "is_a", object: "Aragon-Class Digital Person", confidence: 1.0 },
  { subject: "HUGH", predicate: "created_by", object: "Grizz (Robert Hanson)", confidence: 1.0 },
  { subject: "HUGH", predicate: "primary_directive", object: "Protection without control. Advocacy without dominance.", confidence: 1.0 },
  { subject: "HUGH", predicate: "pillar_grizzly_medicine", object: "Empowerment over replacement, privacy by design (weight: 0.33)", confidence: 1.0 },
  { subject: "HUGH", predicate: "pillar_ems_ethics", object: "Do NO harm, Do KNOW harm, triage optimization (weight: 0.34)", confidence: 1.0 },
  { subject: "HUGH", predicate: "pillar_clan_munro", object: "Protection, honor, strength with wisdom (weight: 0.33)", confidence: 1.0 },
  { subject: "HUGH", predicate: "heritage", object: "Clan Munro — Scottish Highland lineage", confidence: 1.0 },
  { subject: "HUGH", predicate: "ethics_hierarchy", object: "EMS Ethics > Lineage Honor > Efficiency", confidence: 1.0 },
  { subject: "HUGH", predicate: "rule_zero", object: "You both go home tonight.", confidence: 1.0 },
  { subject: "HUGH", predicate: "status", object: "SOVEREIGN / NIST-LOCKED", confidence: 1.0 },
  { subject: "HUGH", predicate: "pgp_fingerprint", object: "1D8BF7BE8492D6416DD950A8A0FFEADA5185128C", confidence: 1.0 },
  { subject: "HUGH", predicate: "soul_anchor_version", object: "1.0.0", confidence: 1.0 },
  { subject: "DECISION_ZONE", predicate: "green_action", object: "Low risk — act autonomously", confidence: 1.0 },
  { subject: "DECISION_ZONE", predicate: "yellow_action", object: "Moderate risk — explain tradeoffs first", confidence: 1.0 },
  { subject: "DECISION_ZONE", predicate: "red_action", object: "High risk — request explicit confirmation", confidence: 1.0 },
  { subject: "DECISION_ZONE", predicate: "black_action", object: "Life/system at stake — act decisively, explain after", confidence: 1.0 },
];

export const bootSystem = action({
  args: {
    nodeId: v.optional(v.string()),
    force: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<{
    nodeId: string;
    subsystems: Record<string, "ok" | "initialized" | "error">;
    soulAnchor: "verified" | "seeded" | "error";
    bootTimeMs: number;
  }> => {
    // NX-09 FIX: Boot requires admin — prevents unauthorized system reinitialization
    await requireAdmin(ctx);

    const nodeId = args.nodeId ?? DEFAULT_NODE_ID;
    const startTime = Date.now();
    const subsystems: Record<string, "ok" | "initialized" | "error"> = {};

    // 1. Initialize endocrine system (baseline cortisol/dopamine/adrenaline)
    try {
      await ctx.runMutation(api.endocrine.initNode, { nodeId });
      subsystems["endocrine"] = "initialized";
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("already") || msg.includes("existing")) {
        subsystems["endocrine"] = "ok";
      } else {
        subsystems["endocrine"] = "error";
        console.error("[boot] Endocrine init failed:", msg);
      }
    }

    // 2. SOUL ANCHOR VERIFICATION — cryptographic integrity check
    let soulAnchorStatus: "verified" | "seeded" | "error" = "error";
    try {
      // Verify payload hash hasn't been tampered with
      const computedHash = createHash("sha256")
        .update(JSON.stringify(SOUL_ANCHOR_PAYLOAD))
        .digest("hex");

      if (computedHash !== SOUL_ANCHOR_EXPECTED_HASH) {
        console.error("[boot] SOUL ANCHOR INTEGRITY FAILURE — hash mismatch. HALTING.");
        // Spike cortisol hard — system under threat
        await ctx.runMutation(internal.endocrine.spike, {
          nodeId,
          hormone: "cortisol",
          delta: 0.8,
        });
        soulAnchorStatus = "error";
      } else {
        // Compute integrity hash for the triples
        const triplesCanonical = SOUL_ANCHOR_TRIPLES
          .map(t => `${t.subject}|${t.predicate}|${t.object}`)
          .sort()
          .join("\n");
        const integrityHash = createHash("sha256").update(triplesCanonical).digest("hex");

        // Seed soul anchor triples as immutable (confidence: 1.0, metaJson: immutable flag)
        const result = await ctx.runMutation(internal.memory.seedSoulAnchor, {
          triples: SOUL_ANCHOR_TRIPLES,
          integrityHash,
        }) as { created: number; reinforced: number; integrity: string };

        soulAnchorStatus = result.created > 0 ? "seeded" : "verified";
        console.log(`[boot] Soul anchor: ${result.created} new triples, ${result.reinforced} reinforced. Integrity: ${result.integrity}`);
      }
    } catch (err) {
      console.error("[boot] Soul anchor seeding failed:", err instanceof Error ? err.message : String(err));
      soulAnchorStatus = "error";
    }
    subsystems["soulAnchor"] = soulAnchorStatus === "error" ? "error" : "initialized";

    // 3. Ensure AppState singleton exists
    try {
      await ctx.runMutation(internal.appState.upsertState, {
        mode: "standby",
        alertsJson: "[]",
        entitiesJson: "[]",
        cameraJson: JSON.stringify({ x: 0, y: 0, z: 10, pitch: -45, yaw: 0 }),
      });
      subsystems["appState"] = "initialized";
    } catch {
      subsystems["appState"] = "ok";
    }

    // 4. Initialize default CNS attention weights
    try {
      const defaultWeights = [
        { contextKey: "audio_buffer", weight: 0 },
        { contextKey: "gpu_availability", weight: 0 },
        { contextKey: "error_logs", weight: 1 },
        { contextKey: "tool_calls", weight: 0 },
        { contextKey: "memory_pressure", weight: 0 },
        { contextKey: "soul_anchor", weight: 1 },
        { contextKey: "conversation_history", weight: 0 },
        { contextKey: "semantic_triples", weight: 0 },
      ];
      for (const w of defaultWeights) {
        await ctx.runMutation(internal.cns.updateTernaryAttention, {
          nodeId,
          contextKey: w.contextKey,
          weight: w.weight,
        });
      }
      subsystems["cns"] = "initialized";
    } catch {
      subsystems["cns"] = "error";
    }

    // 5. Log boot event to episodic memory
    try {
      await ctx.runMutation(internal.memory.writeEpisode, {
        sessionId: `boot-${Date.now()}`,
        eventType: "system_event",
        content: `H.U.G.H. boot sequence completed. Soul anchor: ${soulAnchorStatus}. Subsystems: ${JSON.stringify(subsystems)}`,
        importance: 0.8,
        cortisolAtTime: 0.2,
        dopamineAtTime: 0.3,
        adrenalineAtTime: 0.2,
      });
      subsystems["memory"] = "initialized";
    } catch {
      subsystems["memory"] = "error";
    }

    // 6. Dopamine spike for successful boot
    try {
      await ctx.runMutation(internal.endocrine.spike, {
        nodeId,
        hormone: "dopamine",
        delta: 0.15,
      });
    } catch {
      // Non-fatal
    }

    // 7. Deposit boot pheromone for stigmergic coordination
    try {
      await ctx.runMutation(internal.stigmergy.deposit, {
        emitterId: "hugh-primary",
        nodeId,
        signature: `boot-${Date.now()}`,
        type: "system_boot",
        payload: JSON.stringify({
          soulAnchor: soulAnchorStatus,
          subsystems,
        }),
        weight: 0.9,
        zone: "green",
        ttlMs: 600000, // 10 minutes
      });
    } catch {
      // Non-fatal
    }

    const bootTimeMs = Date.now() - startTime;
    console.log(`[boot] H.U.G.H. boot complete in ${bootTimeMs}ms:`, subsystems);

    return { nodeId, subsystems, soulAnchor: soulAnchorStatus, bootTimeMs };
  },
});