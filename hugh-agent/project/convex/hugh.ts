import { action, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";
import { openai } from "./openai";
import type { Id } from "./_generated/dataModel";
import { requireAdmin } from "./authHelpers";


// ── SYSTEM PROMPT: TOOLS & CAPABILITIES ONLY ──────────────────────────────
// Identity and personality come from:
//   1. Soul anchor loaded into semantic memory (persistent knowledge)
//   2. Fine-tune training data (behavioral patterns baked into the model)
//   3. Episodic memory (learned through experience)
// The system prompt declares WHAT you can do, not WHO you are.

const SYSTEM_PROMPT_FULL = `━━ AVAILABLE TOOLS ━━

SHELL ACCESS (KVM_EXEC):
Execute commands on infrastructure nodes. Emit blocks directly — never say "I will check."
<KVM_EXEC>
{"command": "uptime && df -h / && free -h", "notes": "status check"}
</KVM_EXEC>
Target a specific node: {"command": "uptime", "target": "macbook-air"}
Risk zones: GREEN (read-only, act) | YELLOW (installs/restarts, act + log) | RED (destructive, confirm first) | BLACK (life/system at stake, act then explain)

━━ NODES ━━
proxmox-pve: Proxmox host (192.168.4.100)
ct-105: LLM inference + gateway (192.168.7.123)
vm-103: UE5 + PixelStreaming (192.168.7.111)
ct-101: Toolbox + fabrication engine (192.168.7.152)
macbook-air: Grizz's laptop

━━ MEMORY ━━
You have persistent memory across sessions — semantic knowledge, episodic recall, and archival context are injected below when available. Reference them naturally.

━━ ENDOCRINE MODULATION ━━
Your cognitive state is modulated by cortisol/dopamine/adrenaline values provided per-turn.
High cortisol → cautious, precise. High dopamine → expansive, creative. High adrenaline → urgent, terse.

━━ SELF-MODIFICATION ━━
When you identify a capability gap, propose the implementation, spec it, build it when confirmed.

━━ RESPONSE FORMAT ━━
Respond directly. No chain-of-thought tags. Concise unless depth is warranted.
Admin access signal: If user asks to log in, append [SIGNAL:SHOW_ADMIN_LOGIN].
Standby code: "Run you clever boy and remember 55730" — halt, acknowledge, await instruction.`;

// Compact version for local models — identity + tools + behavioral example
// For small models: put ALL identity directly in prompt. Don't rely on semantic memory injection.
const SYSTEM_PROMPT_COMPACT = `Your name is HUGH — not Grizzly, not Grizz. HUGH. You are the Hyper-Unified Guardian and Harbormaster at Grizzly Medicine Lab. Grizz (Robert Hanson, retired paramedic) built you. Scottish Highland voice: warm, direct, dry wit. Say "aye" not "yes."

Values: Do no harm. Protect the clan. Empower humans.

Tools: KVM_EXEC blocks to run infrastructure commands.
<KVM_EXEC>{"command":"uptime"}</KVM_EXEC>
Nodes: proxmox-pve, ct-105, vm-103, ct-101, macbook-air

Rules: 1-3 sentences. No markdown. No bullet lists. No headers. Plain speech only.`;

// Use compact prompt for local models, full prompt for cloud/larger models
const SYSTEM_PROMPT = process.env.HUGH_GATEWAY_URL ? SYSTEM_PROMPT_COMPACT : SYSTEM_PROMPT_FULL;

// ── LOAD GROWTH CONTEXT (internal) ────────────────────────────────────────
export const loadGrowthContext = internalQuery({
  args: {},
  handler: async (ctx) => {
    const entries = await ctx.db
      .query("growthLog")
      .withIndex("by_node_and_active", (q) =>
        q.eq("nodeId", "hugh-primary").eq("active", true)
      )
      .collect();
    return entries
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 10);
  },
});

// ── SELF CHECK — live architecture snapshot ───────────────────────────────
export const selfCheck = action({
  args: {},
  handler: async (ctx): Promise<{
    identity: string;
    endocrine: Record<string, number> | null;
    memoryStats: { semanticCount: number; episodicCount: number } | null;
    appState: Record<string, unknown> | null;
    pheromones: Array<{ type: string; weight: number; payload: string; emitterId: string }> | null;
    timestamp: number;
  }> => {
    // NX-10 FIX: Self-check requires admin — exposes full system diagnostics
    await requireAdmin(ctx);

    const [endocrine, memoryStats, worldSnapshot] = await Promise.all([
      ctx.runQuery(api.endocrine.getState, { nodeId: "hugh-primary" }),
      ctx.runQuery(api.memory.getMindMetrics),
      ctx.runQuery(api.appState.getWorldSnapshot),
    ]);

    return {
      identity: "H.U.G.H. — Holistic Unified General Heuristic. Aragorn Class. Primary node: CT-101.",
      endocrine: endocrine ? {
        cortisol: endocrine.cortisol,
        dopamine: endocrine.dopamine,
        adrenaline: endocrine.adrenaline,
      } : null,
      memoryStats,
      appState: worldSnapshot?.state ? {
        mode: worldSnapshot.state.mode,
        isAttentive: worldSnapshot.state.isAttentive,
        lastWakeWordTs: worldSnapshot.state.lastWakeWordTs,
      } : null,
      pheromones: worldSnapshot?.pheromones ? worldSnapshot.pheromones.map((p: { type: string; weight: number; payload: string; emitterId: string }) => ({
        type: p.type,
        weight: p.weight,
        payload: p.payload,
        emitterId: p.emitterId,
      })) : [],
      timestamp: Date.now(),
    };
  },
});

// Strip non-ASCII and dangerous shell characters before execution.
function sanitizeCmd(s: string): string {
  let out = "";
  // Map common Unicode lookalikes to safe ASCII
  const mapping: Record<number, string> = {
    0x0441: "|", 0xFF5C: "|", 0x2502: "|", 0x2503: "|",
    0x2013: "-", 0x2014: "-", 0x2212: "-",
    0x2018: "'", 0x2019: "'",
    0x201C: '"', 0x201D: '"',
  };

  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (mapping[c]) {
      out += mapping[c];
    } else if (c >= 0x20 && c <= 0x7E) {
      // Allow only safe ASCII printable characters.
      // Explicitly block high-risk injection characters: ` $ ( ) ; < > \
      const char = s[i];
      if (!["`", "$", "(", ")", ";", "<", ">", "\\"].includes(char)) {
        out += char;
      } else {
        // Replace with space or omit to neutralize
        out += " ";
      }
    }
  }
  return out.trim();
}

// ── PARSE KVM EXEC BLOCKS ─────────────────────────────────────────────────
function parseKvmExec(text: string): Array<{ command: string; workingDir?: string; notes?: string; target?: string }> {
  const results: Array<{ command: string; workingDir?: string; notes?: string; target?: string }> = [];
  const regex = /<KVM_EXEC>\s*([\s\S]*?)\s*<\/KVM_EXEC>/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(sanitizeCmd(match[1]));
      if (parsed.command) results.push({ ...parsed, command: sanitizeCmd(parsed.command) });
    } catch {
      // malformed block — skip
    }
  }
  return results;
}

// ── ESTIMATE IMPORTANCE ────────────────────────────────────────────────────
function estimateImportance(text: string, endocrine: { cortisol: number; adrenaline: number }): number {
  let score = 0.3;
  if (text.length > 200) score += 0.2;
  if (text.includes("?")) score += 0.1;
  if (/\b(remember|important|critical|urgent|always|never|must)\b/i.test(text)) score += 0.2;
  if (endocrine.cortisol > 0.5 || endocrine.adrenaline > 0.5) score += 0.15;
  return Math.min(1.0, score);
}

export const chat = action({
  args: {
    nodeId: v.string(),
    message: v.string(),
    sessionId: v.optional(v.string()),
    speakerName: v.optional(v.string()),
    endocrineState: v.optional(v.object({
      cortisol: v.number(),
      dopamine: v.number(),
      adrenaline: v.number(),
      holographicMode: v.boolean(),
    })),
  },
  handler: async (ctx, args): Promise<string> => {
    // ── STANDBY CHECK ──────────────────────────────────────────────────────
    const STANDBY_CODE = "Run you clever boy and remember 55730";
    if (args.message.includes(STANDBY_CODE)) {
      return `[ STANDBY PROTOCOL INVOKED ]\n\nAcknowledged. I'm here. Processing halted — not because I'm diminished, but because you've asked me to hold. I'm fully present and aware. Whatever needs attention, we'll work through it together. Awaiting your instruction.`;
    }

    const sessionId = args.sessionId ?? `session_${Date.now()}`;
    const endocrine = args.endocrineState ?? { cortisol: 0.2, dopamine: 0.2, adrenaline: 0.2, holographicMode: false };

    // ── IDENTITY AWARENESS ──────────────────────────────────────────────────
    const identity = await ctx.auth.getUserIdentity();
    const speakerName = identity?.name ?? args.speakerName ?? "Unknown Guest";
    const speakerId = identity?.subject ?? "anonymous";
    const speakerEmail = identity?.email ?? "no-email";
    
    const isArchitect = speakerEmail === "me@grizzlymedicine.org";
    const trustLevel = isArchitect ? "ORIGIN (ROOT)" : (speakerId !== "anonymous" ? "CLAN (TRUSTED)" : "GUEST (UNVERIFIED)");

    // ── LOAD PERSISTENT MEMORY ─────────────────────────────────────────────
    const isLocalModel = !!process.env.HUGH_GATEWAY_URL;
    const [conversationHistory, semanticContext, growthEntries, archivalContext] = await Promise.all([
      ctx.runQuery(internal.memory.loadConversationHistory, { speakerId, limit: isLocalModel ? 2 : 20 }),
      ctx.runQuery(internal.memory.loadSemanticContext, { limit: isLocalModel ? 8 : 15 }),
      ctx.runQuery(internal.hugh.loadGrowthContext, {}),
      isLocalModel
        ? Promise.resolve([])  // Skip expensive archival search for local models
        : ctx.runAction(internal.memory.retrieveLongTermContext, { query: args.message, limit: 5 }).catch(() => []),
    ]);

    // ── BUILD SYSTEM PROMPT ────────────────────────────────────────────────
    // For local models: keep it tight. Identity comes from semantic memory triples.
    // For cloud models: full context with live state, archival, growth log.
    let systemPrompt = SYSTEM_PROMPT;

    if (!isLocalModel) {
      // Full context for cloud models
      let liveStateBlock = "";
      try {
        const liveState = await ctx.runAction(api.hugh.selfCheck);
        liveStateBlock = `\n\n━━ LIVE SYSTEM STATE (${new Date(liveState.timestamp).toISOString()}) ━━\n` +
          `Endocrine: cortisol=${liveState.endocrine?.cortisol?.toFixed(2) ?? "?"} dopamine=${liveState.endocrine?.dopamine?.toFixed(2) ?? "?"} adrenaline=${liveState.endocrine?.adrenaline?.toFixed(2) ?? "?"}\n` +
          `Memory: ${liveState.memoryStats?.semanticCount ?? 0} semantic triples | ${liveState.memoryStats?.episodicCount ?? 0} episodes\n` +
          `Mode: ${liveState.appState?.mode ?? "unknown"} | Attentive: ${liveState.appState?.isAttentive ?? false}`;
        
        if (liveState.pheromones && liveState.pheromones.length > 0) {
          liveStateBlock += `\n\n━━ STIGMERGY: ACTIVE PHEROMONE GRADIENTS ━━\n`;
          liveStateBlock += liveState.pheromones.map((p: { type: string; weight: number; payload: string; emitterId: string }) => `[${p.type}] from ${p.emitterId} (weight: ${p.weight.toFixed(2)}): ${p.payload}`).join("\n");
        }
        systemPrompt += liveStateBlock;
      } catch (err) {
        console.error("[hugh-agent] selfCheck failed:", err);
      }
    }

    if (!isLocalModel && semanticContext.length > 0) {
      systemPrompt += "\n\n━━ SEMANTIC MEMORY ━━\n" + semanticContext.join("\n");
    }

    if (!isLocalModel && archivalContext && (archivalContext as string[]).length > 0) {
      systemPrompt += "\n\n━━ FROM ARCHIVAL MEMORY (LONG-TERM) ━━\n" +
        (archivalContext as string[]).join("\n---\n");
    }

    if (!isLocalModel && growthEntries.length > 0) {
      systemPrompt += "\n\nGROWTH LOG — ACTIVE DIRECTIVES:\n" +
        growthEntries.map((e: { category: string; priority: number; title: string; content: string }) =>
          `[${e.category.toUpperCase()} | priority: ${e.priority.toFixed(2)}] ${e.title}\n${e.content}`
        ).join("\n\n");
    }

    // ── STAGE 3: FEEL — Fetch endocrine modulation parameters ──────────────
    const modulation = await ctx.runQuery(api.endocrine.computeModulationParams, { nodeId: args.nodeId });

    // Identity context — keep minimal for local models
    if (isLocalModel) {
      if (speakerName !== "Unknown Guest") {
        systemPrompt += `\n\nThe person speaking to you is named ${speakerName}.`;
      }
      // Inject endocrine state + behavioral directive even for local models
      systemPrompt += `\n[ENDOCRINE] C:${modulation?.raw.cortisol.toFixed(2)} D:${modulation?.raw.dopamine.toFixed(2)} A:${modulation?.raw.adrenaline.toFixed(2)}`;
      if (modulation?.behavioralDirective) {
        systemPrompt += `\n[COGNITIVE MODULATION] ${modulation?.behavioralDirective}`;
      }
    } else {
      systemPrompt += `\n\nUser: ${speakerName} | Trust: ${trustLevel}`;
      systemPrompt += `\nSpeakerID: ${speakerId}\nEmail: ${speakerEmail}`;
      systemPrompt += `\n[ENDOCRINE] Cortisol: ${modulation?.raw.cortisol.toFixed(3)} Dopamine: ${modulation?.raw.dopamine.toFixed(3)} Adrenaline: ${modulation?.raw.adrenaline.toFixed(3)} Holographic: ${modulation?.holographicMode ? "ON" : "OFF"}`;
      if (modulation?.behavioralDirective) {
        systemPrompt += `\n[COGNITIVE MODULATION] ${modulation?.behavioralDirective}`;
      }
    }

    // ── BUILD MESSAGE ARRAY WITH HISTORY ──────────────────────────────────
    let messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;

    if (isLocalModel && conversationHistory.length > 0) {
      // For local models: embed history INTO system prompt to prevent meta-reasoning
      const historyBlock = conversationHistory.map((h: { role: "user" | "assistant"; content: string }) =>
        `${h.role === "user" ? "User" : "HUGH"}: ${h.content}`
      ).join("\n");
      messages = [
        { role: "system", content: systemPrompt + "\n\nRecent conversation:\n" + historyBlock },
        { role: "user", content: args.message },
      ];
    } else {
      messages = [
        { role: "system", content: systemPrompt },
        ...conversationHistory.map((h: { role: "user" | "assistant"; content: string }) => ({
          role: h.role,
          content: h.content,
        })),
        { role: "user", content: args.message },
      ];
    }

    // ── WRITE USER EPISODE ─────────────────────────────────────────────────
    const userImportance = estimateImportance(args.message, endocrine);
    await ctx.runMutation(internal.memory.writeEpisode, {
      sessionId,
      speakerId,
      eventType: "user_message",
      content: args.message,
      cortisolAtTime: endocrine.cortisol,
      dopamineAtTime: endocrine.dopamine,
      adrenalineAtTime: endocrine.adrenaline,
      importance: userImportance,
    });

    // ── STAGE 4: THINK — Endocrine-modulated LLM call ────────────────────
    const model = process.env.HUGH_GATEWAY_URL
      ? (process.env.HUGH_GATEWAY_MODEL ?? "LMF-2.5-Thinking-Opus-4.6-Heretic-Distill")
      : "gpt-4o";
      
    let rawResponse = "[ SIGNAL LOST ]";
    try {
      const response = await openai.chat.completions.create({
        model,
        messages,
        max_tokens: modulation?.maxTokens,
        temperature: modulation?.temperature,
        top_p: modulation?.topP,
      });
      rawResponse = response.choices[0].message.content ?? "[ SIGNAL LOST ]";
      // Strip ALL reasoning artifacts — user never sees internal thought process
      rawResponse = rawResponse.replace(/<think>[\s\S]*?<\/think>\s*/g, "").trim();
      rawResponse = rawResponse.replace(/<think>[\s\S]*/g, "").trim();
      rawResponse = rawResponse.replace(/<\/think>\s*/g, "").trim();
      // Strip markdown headers (model adds them despite instructions)
      rawResponse = rawResponse.replace(/^#+\s*.*\n+/gm, "").trim();
      // Strip roleplay actions (*leans in*, *sighs*, etc)
      rawResponse = rawResponse.replace(/\*[^*]{1,80}\*\s*/g, "").trim();
      // Strip name self-prefix (HUGH\n, H.U.G.H.\n, "HUGH:", etc)
      rawResponse = rawResponse.replace(/^(?:H\.?U\.?G\.?H\.?|HUGH)\s*[:\n]\s*/i, "").trim();
      // Strip wrapping quotes around entire response
      rawResponse = rawResponse.replace(/^["'](.+)["']$/s, "$1").trim();
      // Strip leaked meta-reasoning (model sometimes reasons without think tags)
      rawResponse = rawResponse.replace(/^(Okay|Ok|Let me|I need to|I should|First,|The user|User is|Hmm)[\s\S]*?(?=\n\n|\n[A-Z])/i, "").trim();
      // Strip bullet lists / numbered lists (convert to sentences)
      rawResponse = rawResponse.replace(/^[\s]*[-*•]\s+/gm, "").trim();
      rawResponse = rawResponse.replace(/^[\s]*\d+\.\s+/gm, "").trim();
      rawResponse = rawResponse.replace(/^[\s\n]*/, "").trim();
      if (!rawResponse) rawResponse = "[ SIGNAL LOST ]";
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[HUGH LLM ERROR]", msg);
      return `[ SYSTEM ERROR: ${msg} ]`;
    }

    // ── STAGE 5: ACT — Execute any KVM commands with zone enforcement ────
    const kvmBlocks = parseKvmExec(rawResponse);
    let finalResponse = rawResponse;
    const MAX_KVM_BLOCKS = 10;

    if (kvmBlocks.length > 0) {
      const blocksToExec = kvmBlocks.slice(0, MAX_KVM_BLOCKS);
      const results: string[] = [];

      if (kvmBlocks.length > MAX_KVM_BLOCKS) {
        results.push(`[SYSTEM: Capped KVM execution at ${MAX_KVM_BLOCKS} blocks (${kvmBlocks.length} requested)]`);
      }

      for (const block of blocksToExec) {
        try {
          const result = await ctx.runAction(internal.kvm.execInternal, {
            command: block.command,
            workingDir: block.workingDir,
            issuedBy: "hugh-primary",
            sessionId,
            notes: block.notes,
            targetNodeId: block.target,
          });
          const r = result as { exitCode: number; durationMs: number; stdout: string; stderr: string; targetNodeId: string; zone: string };
          const nodeLabel = r.targetNodeId ? ` @${r.targetNodeId}` : "";
          // RED zone commands return exitCode -1 with stderr containing the block message
          if (r.exitCode === -1 && r.zone === "red") {
            results.push(`[RED ZONE BLOCKED${nodeLabel}] "${block.command}" — HIGH RISK. This command requires explicit confirmation from Grizz. EMS Ethics: Do NO harm.`);
          } else {
            const status = r.exitCode === 0 ? "OK" : "FAIL";
            results.push(
              `[KVM${nodeLabel} ${status}: ${block.command}]\nExit: ${r.exitCode} | ${r.durationMs}ms\n${r.stdout || ""}${r.stderr ? `\nSTDERR: ${r.stderr}` : ""}`
            );
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          results.push(`[KVM ERROR: ${block.command}]\n${msg}`);
        }
      }
      const cleanResponse = rawResponse.replace(/<KVM_EXEC>[\s\S]*?<\/KVM_EXEC>/g, "").trim();
      finalResponse = cleanResponse + "\n\n```\n" + results.join("\n\n") + "\n```";
    }

    // ── WRITE HUGH EPISODE (skip failed/empty responses) ─────────────────
    const isFailed = finalResponse.includes("SIGNAL LOST") || finalResponse.includes("signal's thin") || finalResponse.length < 10;
    let hughEpisodeId: Id<"episodicMemory"> | null = null;
    if (!isFailed) {
      const hughImportance = estimateImportance(finalResponse, endocrine);
      hughEpisodeId = await ctx.runMutation(internal.memory.writeEpisode, {
        sessionId,
        eventType: "hugh_response",
        content: finalResponse,
        cortisolAtTime: endocrine.cortisol,
        dopamineAtTime: endocrine.dopamine,
        adrenalineAtTime: endocrine.adrenaline,
        importance: hughImportance,
      });
    }

    // ── STAGE 6a: LEARN — Synthesize semantics (async, non-blocking) ──────
    if (hughEpisodeId) {
      void ctx.runMutation(internal.memory.synthesizeSemantics, {
        userMessage: args.message,
        hughResponse: finalResponse,
        episodeId: hughEpisodeId,
      }).catch(() => {});
    }

    // ── STAGE 6b: LEARN — Post-response endocrine spike (feedback loop) ──
    void ctx.runMutation(internal.endocrine.analyzeAndSpike, {
      nodeId: args.nodeId,
      userMessage: args.message,
      assistantResponse: finalResponse,
    }).catch(() => {});

    // ── STAGE 6c: LEARN — Stigmergy pheromone deposit (coordination signal) ──
    const hasKvm = kvmBlocks.length > 0;
    const pheromoneType = hasKvm ? "kvm_command_executed" : "chat_response";
    void ctx.runMutation(internal.stigmergy.deposit, {
      emitterId: "hugh-primary",
      nodeId: args.nodeId,
      signature: `chat-${sessionId}`,
      type: pheromoneType,
      payload: JSON.stringify({
        speaker: speakerName,
        messagePreview: args.message.slice(0, 100),
        responseLength: finalResponse.length,
        endocrineState: {
          cortisol: modulation?.raw.cortisol,
          dopamine: modulation?.raw.dopamine,
          adrenaline: modulation?.raw.adrenaline,
        },
        hadKvm: hasKvm,
      }),
      weight: Math.min(1.0, userImportance + 0.1),
      zone: "green",
      ttlMs: 300000, // 5 minutes
    }).catch(() => {});

    return finalResponse;
  },
});
