# H.U.G.H. COGNITIVE ARCHITECTURE: EXECUTION CHECKLIST
## Phase 1 Critical Path — Week 1

**Mission:** Complete the Meta Harness → BitNet CNS → Limbic System → UE5 Motor Cortex loop

---

## ✅ TASK 1: Mind Metrics Query

**File:** `convex/memory.ts`

**Add:**
```typescript
export const getMindMetrics = query({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const semanticCount = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .collect()
      .then(arr => arr.length);
    
    const episodicCount = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_session", (q) => q.eq("nodeId", args.nodeId))
      .collect()
      .then(arr => arr.length);
    
    return { semanticCount, episodicCount, updatedAt: Date.now() };
  },
});
```

**Test:**
```bash
npx convex run memory.ts:getMindMetrics --args '{"nodeId": "hugh-primary"}'
```

**Update:** `convex/appState.ts` — add `updateMindMetrics` mutation to refresh counts every 5 minutes

---

## ✅ TASK 2: Wake Word Trigger

**File:** `convex/appState.ts`

**Add:**
```typescript
export const triggerWakeWord = mutation({
  handler: async (ctx) => {
    const appState = await ctx.db.query("appState").unique();
    if (!appState) throw new Error("AppState not initialized");
    
    await ctx.db.patch(appState._id, {
      isAttentive: true,
      lastWakeWordTs: Date.now(),
      updatedAt: Date.now(),
    });
    
    // Spike dopamine — reward for being summoned
    await ctx.runMutation(internal.endocrine.spike, {
      nodeId: "hugh-primary",
      hormone: "dopamine",
      delta: 0.3,
    });
    
    // Deposit pheromone for other agents to observe
    await ctx.runMutation(internal.stigmergy.deposit, {
      emitterId: "hugh-primary",
      nodeId: "hugh-primary",
      signature: "wake_word_detected",
      type: "hubert_summons",
      payload: JSON.stringify({ timestamp: Date.now() }),
      weight: 1.0,
      zone: "GREEN",
      ttlMs: 30000,  // 30 seconds
    });
  },
});
```

**Test:**
```bash
npx convex run appState.ts:triggerWakeWord
```

---

## ✅ TASK 3: Gateway Hubert Sentinel

**File:** `hugh-gateway-index.ts`

**Update:** `/v1/audio/transcriptions` endpoint (STT for wake word detection)

**Add:**
```typescript
// LFM STT with wake word detection
app.post("/v1/audio/transcriptions", async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("file") as File;
    const model = formData.get("model")?.toString() ?? "lfm-2.5-audio";

    if (!audioFile) {
      return c.json({ error: "No audio file provided" }, 400);
    }

    // Forward to LFM audio model for transcription
    const sttFormData = new FormData();
    sttFormData.append("file", audioFile);
    sttFormData.append("model", model);

    const sttResponse = await fetch(`${process.env.LFM_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.LFM_API_KEY}` },
      body: sttFormData,
    });

    const result = await sttResponse.json();
    const transcript = result.text || "";

    // Check for wake word "Hubert"
    if (transcript.toLowerCase().includes("hubert")) {
      console.log("[Gateway] Wake word detected:", transcript);
      const convexUrl = process.env.CONVEX_URL;
      if (convexUrl) {
        await fetch(`${convexUrl}/api/mutation/appState:triggerWakeWord`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
      }
    }

    return c.json(result);
  } catch (error: any) {
    console.error("[Gateway] STT failed:", error);
    return c.json({ error: error.message || "STT failed" }, 500);
  }
});
```

**Test:**
```bash
# Send audio file with "Hubert" wake word
curl -X POST http://localhost:8787/v1/audio/speech-to-speech \
  -H "Authorization: Bearer YOUR_SECRET" \
  -F "audio=@test_hubert.wav"
```

---

## ✅ TASK 4: Neural Field Update

**File:** `src/HughNeuralField.tsx`

**Update:** Component to subscribe to mind metrics and handle flare

**Add:**
```typescript
// 1. Subscribe to mind metrics
const mindMetrics = useConvexQuery(api.memory.getMindMetrics, {
  nodeId: "hugh-primary"
});

// 2. Subscribe to app state for wake word trigger
const appState = useConvexQuery(api.appState.getWorldSnapshot);

// 3. Dynamic node density calculation
const NODE_COUNT = useMemo(() => {
  const base = 200;
  const growthFactor = mindMetrics?.semanticCount 
    ? Math.floor(mindMetrics.semanticCount * 1.5) 
    : 0;
  return Math.min(base + growthFactor, 2000);  // Cap at 2000 nodes
}, [mindMetrics?.semanticCount]);

// 4. Global synchronized discharge (The Flare)
useEffect(() => {
  if (appState?.lastWakeWordTs && appState.lastWakeWordTs !== lastFlareTs) {
    triggerGlobalDischarge();
    lastFlareTs = appState.lastWakeWordTs;
  }
}, [appState?.lastWakeWordTs]);

// 5. Processing mode (5x firing rate when attentive)
const firingRate = appState?.isAttentive 
  ? SPONTANEOUS_RATE * 5 
  : SPONTANEOUS_RATE;

// 6. Render function update
const triggerGlobalDischarge = () => {
  setNodes(prev => prev.map(node => ({
    ...node,
    charge: 1.0,  // Full charge
    color: "#FFFFFF",  // White core
    pulseSpeed: 0.1,  // Rapid pulse
  })));
  
  // Decay back to normal over 800ms
  setTimeout(() => {
    setNodes(prev => prev.map(node => ({
      ...node,
      charge: 0.5,
      color: "#00FF00",  // Back to neon green
      pulseSpeed: 1.0,
    })));
  }, 800);
};
```

**Test:**
```bash
npm run dev
# Open browser to http://localhost:5173
# Trigger wake word via gateway
# Observe neural field flare animation
```

---

## ✅ TASK 5: Harness Execution Engine

**File:** `convex/harness.ts` (NEW)

**Create:**
```typescript
/**
 * harness.ts — Meta-Harness Optimization Engine
 * 
 * Executes harness candidates, computes Pareto scores,
 * and updates CNS ternary weights based on outcomes.
 */
import { action, query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { api, internal } from "./_generated/api";

const NODE_ID = "hugh-primary";

// ── EXECUTE HARNESS ───────────────────────────────────────────────────────
export const executeHarness = action({
  args: { candidateId: v.id("harnessCandidates") },
  handler: async (ctx, args) => {
    // 1. Fetch candidate code
    const candidate = await ctx.db.get(args.candidateId);
    if (!candidate) throw new Error("Candidate not found");
    
    // 2. Execute in sandbox (UE5 Python bridge or containerized env)
    const executionResult = await executeInSandbox(candidate.harnessCode);
    
    // 3. Store execution trace
    const traceId = await ctx.runMutation(internal.harness.storeTrace, {
      candidateId: args.candidateId,
      nodeId: NODE_ID,
      traceType: "inference",
      rawLogs: JSON.stringify(executionResult.logs),
      terminalOutput: executionResult.stdout,
      success: executionResult.success,
    });
    
    // 4. Compute Pareto score
    const score = computeParetoScore(executionResult);
    
    // 5. Update candidate score
    await ctx.runMutation(internal.harness.updateCandidateScore, {
      candidateId: args.candidateId,
      score,
    });
    
    // 6. CNS weight learning
    if (executionResult.success) {
      // Reinforce +1 weights
      await ctx.runMutation(internal.harness.reinforceWeights, {
        candidateId: args.candidateId,
        delta: 0.1,
      });
    } else {
      // Inhibit -1 weights
      await ctx.runMutation(internal.harness.inhibitWeights, {
        candidateId: args.candidateId,
        delta: -0.2,
      });
    }
    
    return { traceId, score, success: executionResult.success };
  },
});

// ── COMPUTE PARETO SCORE ──────────────────────────────────────────────────
export const computeParetoScore = query({
  args: { 
    candidateId: v.id("harnessCandidates"),
    objectives: v.optional(v.array(v.string()))  // ["speed", "accuracy", "resources"]
  },
  handler: async (ctx, args) => {
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    
    if (traces.length === 0) return 0;
    
    // Multi-objective optimization
    const metrics = {
      speed: computeAverageDuration(traces),
      accuracy: computeSuccessRate(traces),
      resources: computeResourceUsage(traces),
    };
    
    // Pareto frontier scoring
    const score = weightedSum(metrics, { speed: 0.4, accuracy: 0.4, resources: 0.2 });
    return score;
  },
});

// ── STORE TRACE (internal) ───────────────────────────────────────────────
export const storeTrace = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    nodeId: v.string(),
    traceType: v.string(),
    rawLogs: v.string(),
    terminalOutput: v.optional(v.string()),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("executionTraces", {
      candidateId: args.candidateId,
      nodeId: args.nodeId,
      traceType: args.traceType,
      rawLogs: args.rawLogs,
      terminalOutput: args.terminalOutput,
      success: args.success,
      ts: Date.now(),
    });
  },
});

// ── UPDATE CANDIDATE SCORE (internal) ────────────────────────────────────
export const updateCandidateScore = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    score: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.candidateId, { score: args.score });
  },
});

// ── REINFORCE WEIGHTS (internal) ─────────────────────────────────────────
export const reinforceWeights = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    // Fetch execution trace to extract features
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    
    // Extract features from successful execution
    for (const trace of traces) {
      if (trace.success) {
        // Extract feature IDs from logs
        const features = extractFeatureIds(trace.rawLogs);
        
        for (const featureId of features) {
          // Get current weight
          const existing = await ctx.db
            .query("ternaryAttention")
            .withIndex("by_node_and_key", (q) =>
              q.eq("nodeId", NODE_ID).eq("contextKey", featureId)
            )
            .unique();
          
          if (existing) {
            await ctx.db.patch(existing._id, {
              weight: Math.min(1, existing.weight + args.delta),
              updatedAt: Date.now(),
            });
          }
        }
      }
    }
  },
});

// ── INHIBIT WEIGHTS (internal) ───────────────────────────────────────────
export const inhibitWeights = internalMutation({
  args: {
    candidateId: v.id("harnessCandidates"),
    delta: v.number(),
  },
  handler: async (ctx, args) => {
    // Similar to reinforceWeights, but decrease weights for failed features
    const traces = await ctx.db
      .query("executionTraces")
      .withIndex("by_candidate", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    
    for (const trace of traces) {
      if (!trace.success) {
        const features = extractFeatureIds(trace.rawLogs);
        
        for (const featureId of features) {
          const existing = await ctx.db
            .query("ternaryAttention")
            .withIndex("by_node_and_key", (q) =>
              q.eq("nodeId", NODE_ID).eq("contextKey", featureId)
            )
            .unique();
          
          if (existing) {
            await ctx.db.patch(existing._id, {
              weight: Math.max(-1, existing.weight + args.delta),
              updatedAt: Date.now(),
            });
          }
        }
      }
    }
  },
});

// ── HELPER FUNCTIONS ─────────────────────────────────────────────────────

function executeInSandbox(code: string): Promise<{
  success: boolean;
  logs: any[];
  stdout: string;
}> {
  // Execute in UE5 Python bridge or containerized sandbox
  // Return execution result
  throw new Error("Not implemented — requires UE5 sandbox");
}

function computeParetoScore(result: any): number {
  // Multi-objective scoring
  return 0.5;  // Placeholder
}

function computeAverageDuration(traces: any[]): number {
  return 0;  // Placeholder
}

function computeSuccessRate(traces: any[]): number {
  const successful = traces.filter(t => t.success).length;
  return successful / traces.length;
}

function computeResourceUsage(traces: any[]): number {
  return 0;  // Placeholder
}

function weightedSum(metrics: any, weights: any): number {
  return Object.keys(metrics).reduce((sum, key) => {
    return sum + (metrics[key] * weights[key]);
  }, 0);
}

function extractFeatureIds(logs: string): string[] {
  // Parse logs to extract feature IDs (tools, sensors, code paths)
  return [];  // Placeholder
}
```

**Test:**
```bash
npx convex deploy harness.ts
npx convex run harness.ts:executeHarness --args '{"candidateId": "id_here"}'
```

---

## ✅ TASK 6: Schema Updates

**File:** `convex/schema.ts`

**Add tables:**
```typescript
// Speaker profiles for hugh-ears service
speakerProfiles: defineTable({
  speakerId: v.string(),
  name: v.string(),
  voiceEmbedding: v.array(v.number(), 1536),
  enrolledAt: v.number(),
  lastHeardAt: v.number(),
  isKnown: v.boolean(),
}).index("by_speaker", ["speakerId"]),

// Weight history for CNS learning
weightHistory: defineTable({
  contextKey: v.string(),
  previousWeight: v.number(),
  newWeight: v.number(),
  reason: v.string(),  // "success" | "failure" | "endocrine_shift"
  timestamp: v.number(),
}).index("by_context", ["contextKey"]),
```

**Deploy:**
```bash
npx convex deploy
```

---

## VERIFICATION CHECKLIST

After completing all tasks:

- [ ] Mind metrics query returns semantic + episodic counts
- [ ] Wake word trigger sets `isAttentive = true` and spikes dopamine
- [ ] Gateway detects "Hubert" in audio stream
- [ ] Neural field displays global synchronized discharge (800ms flare)
- [ ] Neural field node density scales with semantic memory count
- [ ] Harness execution engine stores traces and computes scores
- [ ] CNS weights update based on execution success/failure
- [ ] All Convex functions deploy without errors
- [ ] Frontend displays attentive state (5x firing rate)

---

## NEXT PHASE: WEEK 2

Once Phase 1 is complete, proceed to:

1. **Proposer Agent Implementation** — Generate harness code updates via LLM
2. **Counterfactual Analysis** — "What if Feature Y was disabled?"
3. **Pareto Frontier Visualization** — Display optimization progress in UI
4. **hugh-ears Speaker Enrollment** — Voice profiling service

---

**READY FOR EXECUTION.**
