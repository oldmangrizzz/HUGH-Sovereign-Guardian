# DESIGN: Hubert Wake Word & Knowledge-Driven Neural Growth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the "Hubert" wake word gate and transform the ambient neural field into a knowledge-driven readout of H.U.G.H.'s mental growth and attention.

**Architecture:** A hybrid approach using a Gateway-level "Ear" for fast audio slicing and a Convex-level "Pulse" for ambient state synchronization. The frontend neural field dynamically scales its density based on backend memory metrics and reacts to attention states.

**Tech Stack:** Convex, React (TypeScript), Hono, Canvas API.

---

### Task 1: Convex Schema & App State Expansion

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/appState.ts`

- [ ] **Step 1: Update schema.ts to include attention and metrics**

```typescript
// convex/schema.ts
// Add these fields to appState definition:
appState: defineTable({
  key: v.string(),
  mode: v.string(),
  alertsJson: v.string(),
  entitiesJson: v.string(),
  cameraJson: v.string(),
  updatedAt: v.number(),
  // New fields:
  isAttentive: v.optional(v.boolean()),
  lastWakeWordTs: v.optional(v.number()),
  semanticCount: v.optional(v.number()),
  episodicCount: v.optional(v.number()),
})
```

- [ ] **Step 2: Add triggerWakeWord mutation to appState.ts**

```typescript
// convex/appState.ts
export const triggerWakeWord = mutation({
  args: {},
  handler: async (ctx) => {
    const doc = await getOrCreateState(ctx);
    await ctx.db.patch(doc._id, {
      isAttentive: true,
      lastWakeWordTs: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const setAttentive = mutation({
  args: { attentive: v.boolean() },
  handler: async (ctx, args) => {
    const doc = await getOrCreateState(ctx);
    await ctx.db.patch(doc._id, {
      isAttentive: args.attentive,
      updatedAt: Date.now(),
    });
  },
});
```

- [ ] **Step 3: Commit**

```bash
git add convex/schema.ts convex/appState.ts
git commit -m "feat(convex): expand appState for attention and mind metrics"
```

---

### Task 2: Mind Metrics Query

**Files:**
- Modify: `convex/memory.ts`

- [ ] **Step 1: Implement getMindMetrics query**

```typescript
// convex/memory.ts
export const getMindMetrics = query({
  args: {},
  handler: async (ctx) => {
    const semanticCount = await ctx.db
      .query("semanticMemory")
      .withIndex("by_node_and_subject", (q) => q.eq("nodeId", NODE_ID))
      .collect();
    
    const episodicCount = await ctx.db
      .query("episodicMemory")
      .withIndex("by_node_and_type", (q) => q.eq("nodeId", NODE_ID))
      .collect();

    return {
      semanticCount: semanticCount.length,
      episodicCount: episodicCount.length,
    };
  },
});
```

- [ ] **Step 2: Commit**

```bash
git add convex/memory.ts
git commit -m "feat(convex): add getMindMetrics query"
```

---

### Task 3: Knowledge-Driven Neural Field

**Files:**
- Modify: `src/HughNeuralField.tsx`

- [ ] **Step 1: Connect Neural Field to Mind Metrics and App State**

```typescript
// src/HughNeuralField.tsx
import { useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

// ... inside component ...
const metrics = useQuery(api.memory.getMindMetrics);
const appState = useQuery(api.appState.getFullState);

const semanticCount = metrics?.semanticCount ?? 0;
const isAttentive = appState?.isAttentive ?? false;
const lastWakeWordTs = appState?.lastWakeWordTs ?? 0;

// Dynamic node count logic
// Base 200 + 1.5 per semantic triple
const dynamicNodeCount = Math.min(2000, 200 + Math.floor(semanticCount * 1.5));
```

- [ ] **Step 2: Implement Flare and Active Mode logic in tick()**

```typescript
// Update the tick loop to handle high-energy state and global flare
const tick = () => {
  const isFlaring = Date.now() - lastWakeWordTs < 800; // 800ms flare window
  
  // High spontaneous firing if attentive
  const currentSpontaneous = isAttentive ? SPONTANEOUS * 5 : SPONTANEOUS;

  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    if (isFlaring) {
      n.charge = 1.0; // Forced discharge
    } else {
      if (n.refract === 0 && Math.random() < currentSpontaneous) n.charge = 1.0;
    }
    // ... existing physics ...
  }
  // ...
};
```

- [ ] **Step 3: Commit**

```bash
git add src/HughNeuralField.tsx
git commit -m "feat(ui): make neural field growth-driven and reactive to attention"
```

---

### Task 4: Gateway "Hubert" Sentinel

**Files:**
- Modify: `hugh-gateway-index.ts`

- [ ] **Step 1: Implement basic keyword detection in speech-to-speech bridge**

```typescript
// hugh-gateway-index.ts
// Note: This is a placeholder for the stream analysis logic.
// In a production STS system, this would involve VAD + lightweight keyword spotter.
// For this POC, we'll simulate the ping to Convex.

app.post("/v1/audio/hubert-ping", async (c) => {
  // Gateway pings this when audio bridge detects 'Hubert'
  const convexUrl = c.env.CONVEX_URL; // assumed from env
  await fetch(`${convexUrl}/api/mutation/appState:triggerWakeWord`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return c.json({ ok: true });
});
```

- [ ] **Step 2: Commit**

```bash
git add hugh-gateway-index.ts
git commit -m "feat(gateway): add Hubert wake word trigger endpoint"
```
