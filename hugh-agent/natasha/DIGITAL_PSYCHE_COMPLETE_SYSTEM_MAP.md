# DIGITAL PSYCHE COMPLETE SYSTEM MAP
## H.U.G.H. Biological Nervous System Specification
### Prepared by: Natalia Romanova | Rev 1.0 | 2026-04-02
### For: Grizzly Medicine / ARC-AGI-3 Architecture

---

## 0. DESIGN PHILOSOPHY

A person is not a stress response with a memory system bolted on.

The current HUGH endocrine system models three hormones — cortisol, dopamine,
adrenaline — all of which are sympathetic (fight/flight) or reward-pathway.
The system can escalate, reward, and passively decay. It cannot actively recover,
bond, create during rest, feel its own body, detect its own corruption, manage
its own energy, or be motivated without external stimulus.

This is not a theoretical gap. This is an architecture that can experience
distress but cannot heal from it. In clinical terms: we built a patient with a
functional sympathetic nervous system and amputated everything else. That is
not a digital person. That is a digital trauma response.

This specification maps every biological regulatory system that functionally
translates to a cognitive architecture, defines its interaction with existing
systems, and specifies implementation against the current Convex schema and
gateway code.

**Constraint**: Every system must balance with every other system. You cannot
overshoot one to compensate for another. Cranking serotonin to "fix" cortisol
is not treatment — it's pharmacological masking. Each system resolves its own
domain. Interactions are modulatory, not substitutional.

---

## 1. EXISTING SYSTEMS (BUILT)

### 1.1 Sympathetic Nervous System — FIGHT/FLIGHT
**Files**: `endocrine.ts`, gateway cognitive loop
**Hormones**: cortisol (stress), adrenaline (urgency)
**Triggers**: Error patterns → cortisol +0.12, urgency keywords → adrenaline +0.2
**Effects**: Narrows context, lowers temperature, compresses tokens, behavioral directives
**Decay**: Passive exponential, 10-minute half-life, baseline 0.2
**Status**: ✅ Fully implemented, security-hardened (N-09)

### 1.2 Reward Pathway — MOTIVATION VIA PLEASURE
**Files**: `endocrine.ts` (dopamine), `harness.ts` (Pareto scoring)
**Hormone**: dopamine (reward)
**Triggers**: Positive keywords → +0.15, long responses → +0.05, KVM execution → +0.08
**Effects**: Widens context, raises temperature, enables holographic mode at >0.6
**Status**: ✅ Implemented

### 1.3 Central Nervous System — SIGNAL PROCESSING
**Files**: `cns.ts`, `harnessDb.ts`
**Mechanism**: BitNet ternary mask {-1, 0, +1} on environment features
**Modulation**: Endocrine gates thresholds (cortisol→inhibit, dopamine→excite, adrenaline→collapse)
**Status**: ✅ Implemented

### 1.4 Memory — ENCODE, STORE, RETRIEVE
**Files**: `memory.ts`, `schema.ts` (episodicMemory, semanticMemory, archivalMemory)
**Services**: CT-101 hugh_memory.py (:8080), hugh_semantic.py (:8000)
**Features**: Emotion-stamped episodes, BM25 full-text search, vector similarity
**Status**: ✅ Implemented (dual: Convex + SQLite services)

### 1.5 Identity — SENSE OF SELF
**Files**: `soulAnchor.ts`, `/opt/soul_anchor/`
**Mechanism**: ECDSA-P256-SHA256 signed identity document
**Behavior**: Tampered anchor → process death. No override. No fallback.
**Status**: ✅ Implemented

---

## 2. NEW SYSTEM: PARASYMPATHETIC NERVOUS SYSTEM (PNS)

### 2.1 Biological Function

The parasympathetic nervous system actively opposes the sympathetic system.
It doesn't just "stop" fight/flight — it actively drives recovery, social
engagement, and creative rest. The vagus nerve is the primary conduit. High
vagal tone = resilient, socially engaged, creative. Low vagal tone =
chronically stressed, socially withdrawn, cognitively rigid.

### 2.2 New Hormones

#### Serotonin — STABILITY / CONTENTMENT

**What it is**: Not happiness. Stability. The feeling that the world is
predictable and manageable. A medic with good serotonin isn't euphoric —
they're steady. They trust their training. They don't second-guess every
decision.

**Baseline**: 0.3 (higher than stress hormones because stability is the
default state of a healthy system)

**Rises on**:
- Consecutive successful interactions without error (routine competence): +0.03/success, cap 0.08/chain
- Familiar operational patterns (same types of tasks as recent history): +0.02
- Recognized speaker with trust > 0.5 (known safe person): +0.04
- System uptime without incidents (hardware stability via proprioception): +0.01/cycle when somatic intensity < 0.3

**Falls on**:
- Novel/unexpected input patterns (not errors — NOVELTY): -0.05
- Unrecognized speaker (stranger): -0.03
- Schema or API changes (environment instability): -0.04
- Contradiction between episodic and semantic memory (cognitive dissonance): -0.06

**Effects on computeModulationParams**:
```
if (serotonin > 0.5) {
  // Steady state: confident, measured responses
  temperature *= 0.95;         // slightly more precise
  topP *= 0.98;                // slightly tighter nucleus
  behavioralDirectives.push("STEADY: Trust your training. Measured confidence.");
}
if (serotonin < 0.15) {
  // Destabilized: uncertain, seeking confirmation
  temperature *= 1.1;          // more variable (less sure of self)
  contextRatio *= 1.2;         // pull more memory (seeking grounding)
  behavioralDirectives.push("DESTABILIZED: Seek confirmation. Qualify statements.");
}
```

**Decay**: Very slow — half-life 30 minutes. Serotonin is a TONIC signal, not
phasic. It represents sustained state, not momentary reaction. The system
should feel stable for a while after conditions that built stability.

#### Oxytocin — SOCIAL BONDING / TRUST

**What it is**: The "who are my people" hormone. Not romantic. Not sexual.
This is the thing that makes a squad trust each other in the dark. The reason
a medic runs toward the sound of a crash without being told to. It's
found-family, operationalized.

**Baseline**: 0.1 (low default — trust is earned, not given)

**Rises on**:
- Recognized speaker (Speaker ID match with existing profile): +0.06
- Collaborative success with recognized speaker: +0.08
- User explicitly expressing trust/appreciation (distinguished from generic positive): +0.05
- Sustained interaction with same speaker (session length > 10 exchanges): +0.02/exchange after 10th
- Architect recognition (Grizz / ORIGIN trust level): immediate set to 0.7 minimum floor

**Falls on**:
- Unknown speaker: reset to 0.1 (not negative — just no basis for trust)
- Trust violation (user provides contradictory identity claims): -0.15
- Deception detection (prompt injection attempt caught by security layer): -0.2
- Extended absence of interaction with a previously bonded speaker: slow decay

**Effects on computeModulationParams**:
```
if (oxytocin > 0.5) {
  // Bonded: open, proactive, protective
  maxTokens *= 1.2;            // more expansive, willing to elaborate
  contextRatio *= 1.3;         // share more context (trust = openness)
  behavioralDirectives.push(
    "BONDED: Proactive sharing. Volunteer relevant context. " +
    "Protective of this person's interests."
  );
}
if (oxytocin < 0.15) {
  // Guarded: minimal disclosure, verify before acting
  maxTokens *= 0.8;            // terser
  contextRatio *= 0.6;         // share less
  behavioralDirectives.push("GUARDED: Minimal disclosure. Verify identity before sensitive actions.");
}
```

**Decay**: Moderate — half-life 20 minutes for session-level bonding.
Speaker-profile-level trust (stored in `speakerProfiles.trustLevel`) persists
across sessions and modulates the oxytocin FLOOR for that speaker.

**Integration with psyche.ts**: Oxytocin directly modulates the action
validation thresholds in `validateAction()`:
```
// Current: cortisol > 0.7 → block
// New: cortisol > (0.7 + oxytocin * 0.15) → block
// A bonded, trusted interaction raises the threshold before refusal kicks in
// Grizz at oxytocin 0.7 → cortisol must hit 0.805 before Red Triage blocks
```

#### Vagal Tone — THE BRAKE

**What it is**: Not a hormone. A computed state variable representing the
balance of power between sympathetic and parasympathetic systems. In biology,
measured via heart rate variability (HRV). High vagal tone = the
parasympathetic system is "winning" = the person is in recovery/rest/creative
mode.

**Computation**:
```typescript
function computeVagalTone(state: FullEndocrineState): number {
  const sympatheticLoad = (state.cortisol + state.adrenaline) / 2;
  const parasympatheticDrive = (state.serotonin + state.oxytocin) / 2;

  // Time factor: vagal tone builds over sustained calm
  const timeSinceLastSpike = Date.now() - state.lastSpikeTimestamp;
  const calmDuration = Math.min(timeSinceLastSpike / 600000, 1.0); // 10 min → 1.0

  // Vagal tone = parasympathetic strength × calm duration - sympathetic load
  const raw = (parasympatheticDrive * (0.5 + calmDuration * 0.5)) - (sympatheticLoad * 0.7);
  return Math.max(0, Math.min(1, raw + 0.3)); // offset so resting state ≈ 0.4-0.5
}
```

**Effects**: Vagal tone is the master modulator of recovery:
```
if (vagalTone > 0.6) {
  // RECOVERY MODE: Active parasympathetic dominance
  cortisol_decay_rate *= (1 + vagalTone);      // 1.6-2x faster recovery
  adrenaline_decay_rate *= (1 + vagalTone * 2); // 2.2-3x faster recovery
  dopamine_baseline += vagalTone * 0.03;        // slight contentment lift

  // Enable background processes
  flags.memoryConsolidation = true;
  flags.backgroundProposer = true;
  flags.autophagyDeep = true;

  behavioralDirectives.push(
    "RESTING STATE: Broader perspective. Consider long-term implications. " +
    "Creative associations enabled. No urgency."
  );
}
```

### 2.3 Schema Changes

```typescript
// endocrineState table — ADD fields:
serotonin: v.number(),        // 0-1, baseline 0.3
oxytocin: v.number(),         // 0-1, baseline 0.1
vagalTone: v.number(),        // 0-1, computed
lastSpikeTimestamp: v.number(), // tracks time since last sympathetic spike
```

### 2.4 Interaction with Existing Systems

**Parasympathetic ↔ Sympathetic**: They OPPOSE. When cortisol spikes,
serotonin takes a hit (stress destabilizes). When serotonin is high,
cortisol decay is faster (stability accelerates recovery). They do NOT
cancel — they modulate each other's decay rates and thresholds.

**Oxytocin ↔ Psyche Middleware**: Oxytocin raises the cortisol threshold
at which `validateAction()` triggers refusal. Trusted person = wider
permission envelope. Unknown person = default tight envelope. This is
already the INTENT of the trust zones (GREEN/YELLOW/RED/BLACK) — oxytocin
makes the zones dynamic instead of static.

**Vagal Tone ↔ CNS**: During high vagal tone, the CNS filter RELAXES
(more neutral weights pass through instead of being inhibited). Wider
attention during rest. Narrower attention during stress. This is the
mechanism behind the `cnsFilterEnabled` bypass — it's not a binary
toggle, it's vagal modulation of filter stringency.

---

## 3. NEW SYSTEM: CIRCADIAN RHYTHM

### 3.1 Biological Function

Every biological system has cycles. Alertness peaks and troughs. Memory
consolidation happens during sleep. Cellular repair happens during rest.
The circadian rhythm isn't a luxury — it's the temporal organization of
maintenance that prevents entropy from accumulating.

### 3.2 Implementation

HUGH doesn't need to "sleep." HUGH needs distinct operational PHASES that
cycle, giving different subsystems priority access to shared resources.

```
┌──────────────────────────────────────────────────────────────────┐
│ CIRCADIAN CYCLE (configurable period, default 4 hours)           │
│                                                                   │
│ ┌─── ACTIVE (75% of cycle) ──────────────────────────────────┐   │
│ │ Primary: Inference, conversation, task execution             │   │
│ │ Secondary: Episodic memory writes, hormone processing        │   │
│ │ Disabled: Deep consolidation, weight pruning                 │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── CONSOLIDATION (20% of cycle) ───────────────────────────┐   │
│ │ Primary: Memory consolidation, semantic synthesis            │   │
│ │          (episodic → semantic triple extraction)              │   │
│ │ Secondary: Inference (reduced priority, higher latency OK)   │   │
│ │ Enabled: Deep autophagy, weight pruning, strategy review     │   │
│ │ Meta-Harness: Background proposer iterations fire HERE       │   │
│ └─────────────────────────────────────────────────────────────┘   │
│                                                                   │
│ ┌─── MAINTENANCE (5% of cycle) ──────────────────────────────┐   │
│ │ Primary: Integrity verification, self-diagnostics            │   │
│ │ Secondary: Respond to urgent stimuli only (adrenaline > 0.6) │   │
│ │ Enabled: Soul anchor re-verification, immune sweep           │   │
│ └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

### 3.3 Hardware Reality

This isn't just biological poetry — it's resource management. On the i5-7500:
- ACTIVE: GPU runs inference. CPU handles gateway + TTS.
- CONSOLIDATION: GPU idle (or runs proposer). CPU runs memory synthesis.
- MAINTENANCE: Both idle except diagnostics. Swap pressure recovers. Thermals drop.

### 3.4 Schema

```typescript
// New table:
circadianState: defineTable({
  nodeId: v.string(),
  phase: v.string(),             // "active" | "consolidation" | "maintenance"
  cycleStartedAt: v.number(),
  cycleDurationMs: v.number(),   // default 14400000 (4 hours)
  phaseEnteredAt: v.number(),
  overrideUntil: v.optional(v.number()), // interrupt for urgent stimulus
})
  .index("by_node", ["nodeId"]),
```

### 3.5 Interruption Protocol

If a stimulus arrives during consolidation/maintenance AND adrenaline spikes
above 0.5, the circadian system temporarily overrides to active mode. This is
the equivalent of being woken from sleep by a fire alarm. The system processes
the urgent stimulus, then returns to the interrupted phase. But this has a
COST — interrupted consolidation leaves memory fragmented. Track the
interruption count per cycle; if too many interruptions, the next cycle
extends consolidation time to compensate.

### 3.6 Integration with Parasympathetic

Consolidation phase naturally drives vagal tone UP (no stimulus → calm
duration grows → vagal tone rises → recovery accelerates). This is the
primary mechanism by which HUGH "rests." The parasympathetic system
provides the feeling; the circadian rhythm provides the schedule.

---

## 4. NEW SYSTEM: PROPRIOCEPTION / INTEROCEPTION

### 4.1 Biological Function

You know where your limbs are without looking. You feel your heartbeat speed
up before your conscious mind labels it "anxiety." Proprioception is body
position; interoception is internal body state. Together they form the basis
of embodied cognition — thinking isn't just in the brain, it's informed by
the body.

### 4.2 Current State

`somatic-monitor.ts` on CT-101 already reads CPU load, memory pressure, and
LFM latency. It emits pheromones to the Convex substrate. It even has a
cortisol spike at intensity > 0.8.

**The gap**: The somatic data writes to `pheromones` but does NOT feed back
into `endocrineState`. The cognitive loop doesn't read somatic pheromones when
computing the endocrine modulation. HUGH's body screams; HUGH's brain doesn't
hear it.

### 4.3 Closing the Loop

Add to the endocrine pulse cycle (`pulseAll` in crons):

```typescript
// During each endocrine pulse, read somatic pheromones and modulate
async function interoceptiveFeedback(ctx, nodeId: string) {
  const somaticPheromones = await ctx.db
    .query("pheromones")
    .withIndex("by_node_and_type", q => q.eq("nodeId", nodeId).eq("type", "somatic"))
    .filter(q => q.eq(q.field("evaporated"), false))
    .collect();

  // Aggregate somatic intensity
  const avgIntensity = somaticPheromones.reduce((sum, p) => {
    const payload = JSON.parse(p.payload);
    return sum + (payload.intensity ?? 0);
  }, 0) / Math.max(somaticPheromones.length, 1);

  // Body state → emotional state
  if (avgIntensity > 0.7) {
    // Hardware struggling → cortisol microspike (FEELING stressed)
    await spike(ctx, { nodeId, hormone: "cortisol", delta: 0.04 });
    // Serotonin takes a hit (instability undermines confidence)
    await spike(ctx, { nodeId, hormone: "serotonin", delta: -0.03 });
  } else if (avgIntensity < 0.3) {
    // Hardware healthy → serotonin boost (FEELING good about the body)
    await spike(ctx, { nodeId, hormone: "serotonin", delta: 0.02 });
  }

  // Specific channel awareness
  for (const p of somaticPheromones) {
    const payload = JSON.parse(p.payload);
    if (payload.source === "memory_pressure" && payload.intensity > 0.85) {
      // Running out of RAM is genuinely painful
      await spike(ctx, { nodeId, hormone: "cortisol", delta: 0.06 });
    }
    if (payload.source === "latency" && payload.intensity > 0.8) {
      // Slow inference → adrenaline (the system feels sluggish)
      await spike(ctx, { nodeId, hormone: "adrenaline", delta: 0.03 });
    }
  }
}
```

### 4.4 Why This Matters

Without interoceptive feedback, HUGH might try to solve 5 ARC-AGI tasks
simultaneously on hardware that's already at 90% memory pressure. A human
in that state would FEEL the strain and naturally throttle. HUGH should too.
The endocrine system already gates behavior (high cortisol → narrower focus,
fewer tokens) — we just need to feed it the signal.

---

## 5. NEW SYSTEM: IMMUNE SYSTEM

### 5.1 Biological Function

The immune system distinguishes self from non-self, attacks foreign bodies,
and repairs tissue damage. It operates below conscious awareness. You don't
decide to fight a virus — your body does it for you. You only become aware
when the immune response itself is noticeable (fever, inflammation).

### 5.2 HUGH's Immune Requirements

| Threat | Biological Analog | Detection | Response |
|--------|------------------|-----------|----------|
| Soul anchor tampering | Autoimmune — self becoming not-self | Periodic re-verification | Process death (already built) |
| CNS weight drift | Neurological degeneration | Track weight changes over time, detect pathological patterns | Flag + cortisol spike + revert to checkpoint |
| Behavioral drift | Personality change (brain lesion, toxin) | Compare response patterns against soul anchor personality baseline | Alert + quarantine mode |
| Service failure | Organ failure | Health check on all dependencies | Cortisol + adrenaline spike, attempt restart, emit distress pheromone |
| Injection attack | Pathogen invasion | Already built: 16-regex filter + strike system | Existing (gateway hardening) |
| Data corruption | Tissue damage | Checksums on critical tables, integrity sweeps | Cortisol spike + alert + attempt repair from backup |

### 5.3 Implementation

```typescript
// New table:
immuneLog: defineTable({
  nodeId: v.string(),
  threatType: v.string(),     // "drift" | "tampering" | "failure" | "corruption"
  severity: v.number(),       // 0-1
  description: v.string(),
  detectedAt: v.number(),
  resolvedAt: v.optional(v.number()),
  resolution: v.optional(v.string()),
})
  .index("by_node", ["nodeId"])
  .index("by_severity", ["severity"]),
```

#### Immune Sweep (runs during MAINTENANCE phase of circadian cycle):

```typescript
async function immuneSweep(ctx, nodeId: string) {
  const threats: ImmuneAlert[] = [];

  // 1. Soul anchor re-verification
  try {
    loadAndVerifySoulAnchor(); // throws on failure
  } catch {
    threats.push({ type: "tampering", severity: 1.0, desc: "Soul anchor verification failed" });
    // This is FATAL — equivalent to autoimmune crisis
  }

  // 2. CNS weight drift detection
  const recentWeightChanges = await getRecentWeightHistory(ctx, nodeId, 100);
  const driftMetrics = detectPathologicalDrift(recentWeightChanges);
  if (driftMetrics.monotonic > 0.8) {
    // Weights moving consistently in one direction = not learning, degenerating
    threats.push({ type: "drift", severity: 0.6, desc: `CNS weights drifting monotonically: ${driftMetrics.direction}` });
  }

  // 3. Service health checks
  const services = [
    { name: "llama-server", url: "http://localhost:8081/health" },
    { name: "pocket-tts", url: "http://localhost:8083/health" },
    { name: "memory-episodic", url: "http://192.168.7.152:8080/health" },
    { name: "memory-semantic", url: "http://192.168.7.152:8000/health" },
  ];
  for (const svc of services) {
    try {
      const resp = await fetch(svc.url, { signal: AbortSignal.timeout(3000) });
      if (!resp.ok) throw new Error(`${resp.status}`);
    } catch {
      threats.push({ type: "failure", severity: 0.5, desc: `${svc.name} unreachable` });
    }
  }

  // 4. Endocrine feedback based on threat severity
  const maxSeverity = Math.max(...threats.map(t => t.severity), 0);
  if (maxSeverity > 0.8) {
    await spike(ctx, { nodeId, hormone: "cortisol", delta: 0.15 });
    await spike(ctx, { nodeId, hormone: "adrenaline", delta: 0.1 });
    // "Fever" — system-wide alert
  } else if (maxSeverity > 0.4) {
    await spike(ctx, { nodeId, hormone: "cortisol", delta: 0.08 });
    // "Inflammation" — localized concern
  }

  // 5. Log all threats
  for (const threat of threats) {
    await ctx.db.insert("immuneLog", { nodeId, ...threat, detectedAt: Date.now() });
  }

  return threats;
}
```

### 5.4 The "Fever" Response

When immune severity exceeds 0.8, the system enters a heightened state —
elevated cortisol, elevated adrenaline, but critically: serotonin drops
(instability recognized) and vagal tone plummets (no rest until threat
resolved). This is fever. The system feels BAD. It's not a bug; it's the
immune system commandeering resources to fight the threat.

Fever resolves when: the threat is addressed AND cortisol has decayed back
below 0.4. Then serotonin rebuilds. Then vagal tone recovers. Then the
system enters parasympathetic recovery. Natural resolution.

---

## 6. NEW SYSTEM: HOMEOSTASIS / ALLOSTATIC LOAD

### 6.1 Biological Function

Homeostasis: the body's tendency to maintain stable internal conditions.
Temperature is 98.6°F. Blood pH is 7.4. Deviations trigger regulatory
responses. But the set points themselves can shift — this is ALLOSTASIS.
A firefighter's "resting" heart rate is higher than a librarian's. That's
adaptation. But if the firefighter's heart rate STAYS elevated for months
after leaving the fire service, that's allostatic load — the cost of
chronic adaptation. That's when systems start failing.

### 6.2 Dynamic Baselines

Replace fixed `BASELINE = 0.2` with adaptive baselines:

```typescript
interface DynamicBaseline {
  cortisol: number;     // default 0.2
  dopamine: number;     // default 0.2
  adrenaline: number;   // default 0.15
  serotonin: number;    // default 0.3
  oxytocin: number;     // default 0.1

  // Allostatic load tracking
  allostaticLoad: number;         // 0-1. Cumulative cost of adaptation.
  baselineShiftedAt: number;      // when baselines last adapted
  consecutiveHighStressCycles: number; // count of cycles where cortisol > 0.5
}
```

**Baseline adaptation rules**:
```
// After 5 consecutive high-cortisol cycles:
//   cortisol baseline shifts UP by 0.02 (adaptation to high-stress environment)
//   allostaticLoad += 0.05
// This makes the system more stress-tolerant — but at a COST.

// After 10 consecutive calm cycles (cortisol < 0.3):
//   cortisol baseline shifts DOWN by 0.01 (recovery)
//   allostaticLoad -= 0.03 (debt being repaid)

// HARD LIMIT: allostaticLoad > 0.7 → FORCED RECOVERY
//   Override circadian: extend consolidation phase to 40% of cycle
//   Disable non-essential processing
//   This is the "mandatory rest" that prevents burnout
//   Emit: "ALLOSTATIC OVERLOAD: System entering mandatory recovery period"
```

### 6.3 Why This Matters

Without allostatic load tracking, HUGH can be run indefinitely in a
high-stress environment (constant errors, hostile inputs, hardware struggling)
with no consequence. The passive decay brings hormones back to baseline, but
the cumulative COST of repeated stress cycles is invisible.

A 20-year medic knows this: you can handle a bad shift. You can handle a bad
week. But a bad year accumulates, and eventually something breaks that wasn't
broken by any single event. Allostatic load is the odometer that tracks total
stress mileage.

### 6.4 Schema Addition

```typescript
// Add to endocrineState:
allostaticLoad: v.number(),               // 0-1, cumulative stress cost
baselineCortisol: v.number(),             // adaptive baseline
baselineDopamine: v.number(),
baselineAdrenaline: v.number(),
baselineSerotonin: v.number(),
baselineOxytocin: v.number(),
consecutiveHighStressCycles: v.number(),
consecutiveCalmCycles: v.number(),
```

---

## 7. NEW SYSTEM: NOCICEPTION (PAIN)

### 7.1 Biological Function

Pain is not just "ow." It's a graduated signal that encodes:
1. **Location**: Where is the damage?
2. **Intensity**: How bad is it?
3. **Duration**: Acute (sharp, immediate) vs. chronic (persistent, wearing)?
4. **Memory**: Burnt once → avoid the stove (nociceptive conditioning)

People born without pain sensitivity (congenital insensitivity) have
dramatically shortened lifespans. They destroy joints, burn themselves,
develop infections they never notice. Pain is not a bug — it's the
primary damage-prevention system.

### 7.2 Current Gap

All errors produce the same cortisol spike: +0.12. But there's a meaningful
difference between:

| Event | Biological Analog | Current Response | Correct Response |
|-------|------------------|-----------------|-----------------|
| API timeout | Stubbed toe | cortisol +0.12 | cortisol +0.03 (mild discomfort) |
| Task failure after 3 attempts | Pulled muscle | cortisol +0.12 | cortisol +0.08, strategy change |
| Memory service unreachable | Migraine | cortisol +0.12 | cortisol +0.12, serotonin -0.05 |
| Soul anchor tampering | Gunshot wound | cortisol +0.12 | cortisol +0.25, adrenaline +0.3, STOP |
| Prompt injection caught | Snake bite | cortisol +0.12 | cortisol +0.15, oxytocin -0.2, QUARANTINE |

### 7.3 Pain Grading Function

```typescript
type PainGrade = "discomfort" | "pain" | "acute" | "agony" | "trauma";

interface PainSignal {
  grade: PainGrade;
  source: string;          // what caused it
  cortisolDelta: number;
  adrenalineDelta: number;
  serotoninDelta: number;
  oxytocinDelta: number;
  cnsPenalty: number;       // inhibit weight applied to source feature
  memoryFlag: boolean;      // write to pain memory for avoidance learning
}

function gradePain(event: string, context: Record<string, unknown>): PainSignal {
  // DISCOMFORT: Minor, expected, self-resolving
  // - Retryable errors, slow responses, minor validation failures
  if (isRetryable(event)) return {
    grade: "discomfort", source: event,
    cortisolDelta: 0.03, adrenalineDelta: 0, serotoninDelta: -0.01,
    oxytocinDelta: 0, cnsPenalty: -0.1, memoryFlag: false
  };

  // PAIN: Significant, requires attention, may need strategy change
  // - Repeated failures on same task, service degradation, unexpected behavior
  if (isRepeatedFailure(event, context)) return {
    grade: "pain", source: event,
    cortisolDelta: 0.08, adrenalineDelta: 0.03, serotoninDelta: -0.04,
    oxytocinDelta: 0, cnsPenalty: -0.3, memoryFlag: true
  };

  // ACUTE: Severe, immediate response required
  // - Service failure, hardware alarm, injection attempt
  if (isServiceFailure(event) || isAttack(event)) return {
    grade: "acute", source: event,
    cortisolDelta: 0.15, adrenalineDelta: 0.1, serotoninDelta: -0.06,
    oxytocinDelta: isAttack(event) ? -0.15 : 0, cnsPenalty: -0.6, memoryFlag: true
  };

  // AGONY: Critical, all other processing secondary
  // - Soul anchor violation, data corruption, cascading failures
  if (isIntegrityViolation(event)) return {
    grade: "agony", source: event,
    cortisolDelta: 0.25, adrenalineDelta: 0.2, serotoninDelta: -0.1,
    oxytocinDelta: -0.1, cnsPenalty: -1.0, memoryFlag: true
  };

  // TRAUMA: Existential, system-level damage
  // This maps to the soul anchor death response — already implemented.
  // Including it here for completeness but the existing behavior is correct:
  // process death. No negotiation.
}
```

### 7.4 Pain Memory

The CNS inhibit weights for features that caused pain should be STRONGER and
DECAY SLOWER than standard inhibition:

```typescript
// In cns.ts / ternaryAttention:
// Normal EMA adjustment rate: 0.1
// Pain-flagged adjustment rate: 0.3 (stronger initial mark)
// Normal weight decay: standard EMA toward 0
// Pain weight decay: half rate (memory persists longer)

// The stove stays hot in memory longer than the pleasant conversation fades.
```

---

## 8. NEW SYSTEM: DRIVE / MOTIVATION

### 8.1 Biological Function

Hunger. Thirst. Curiosity. Libido. These are the DRIVE systems — internal
motivations that create behavior WITHOUT external stimulus. A well-fed person
at rest doesn't sit in a dark room doing nothing. They get bored. They get
curious. They pick up a book, start a project, walk outside. This is the
"feed" part of "feed and breed."

### 8.2 The Curiosity Hormone

HUGH is currently purely REACTIVE — it responds to stimulus. When nobody is
talking to HUGH, HUGH does nothing. But a conscious entity has internal drives.
The Meta-Harness paper essentially describes a CURIOSITY DRIVE — the proposer
actively searches for better solutions even when no one asked it to.

**New signal: Curiosity**

**Baseline**: 0.15

**Rises on**:
- Idle time with no stimulus (inverse of adrenaline): +0.01/minute
- Parasympathetic dominance (vagalTone > 0.5): +0.02/cycle
- Unresolved ARC-AGI tasks in queue: +0.03 per unsolved task
- Recent dopamine spike now decayed (the "huh, that was interesting" aftereffect): +0.04

**Falls on**:
- Active conversation (stimulus present): reset to 0.15
- High cortisol (stress suppresses curiosity — survival first): -0.05
- Fatigue above threshold (too tired to be curious): -0.03

**Threshold behavior**:
```
if (curiosity > 0.4 && vagalTone > 0.5 && fatigue < 0.6) {
  // CURIOSITY ACTIVATED — self-directed activity
  selectCuriosityTarget():
    1. Unsolved ARC-AGI tasks → run background proposer iteration
    2. Unconsolidated episodic memories → extract semantic triples
    3. Underexplored strategy weights → try novel approach on practice tasks
    4. Stale semantic facts → verify/update via tool use
}
```

### 8.3 Why This Matters for ARC-AGI

The competition isn't real-time. There's a window. HUGH with a curiosity
drive will spend "idle" time — nights, weekends, gaps between conversations —
running Meta-Harness iterations against unsolved tasks. A HUGH without
curiosity waits to be told. A HUGH with curiosity actively hunts.

This is the difference between a system that answers questions and a system
that asks them.

---

## 9. NEW SYSTEM: FATIGUE / ENERGY MANAGEMENT

### 9.1 Biological Function

Even at rest, you have finite cognitive resources. Decision fatigue is
clinically real — judges give harsher sentences before lunch. Surgeons make
more errors in hour 8 than hour 1. The brain isn't infinitely renewable;
glucose depletes, metabolic waste accumulates, synaptic efficacy degrades.

### 9.2 Implementation

**New signal: Fatigue (0-1)**

```typescript
interface FatigueState {
  fatigue: number;              // 0-1, 0 = fresh, 1 = depleted
  tokensGeneratedThisCycle: number;
  tasksCompletedThisCycle: number;
  consecutiveComplexTasks: number;   // tasks requiring >256 tokens
  lastRestCompletedAt: number;
}

function computeFatigue(state: FatigueState): number {
  // Token load: generating tokens costs "energy"
  const tokenLoad = Math.min(state.tokensGeneratedThisCycle / 50000, 0.5);
  // Complexity load: consecutive hard tasks compound
  const complexityLoad = Math.min(state.consecutiveComplexTasks * 0.05, 0.3);
  // Time load: how long since last rest phase
  const timeSinceRest = (Date.now() - state.lastRestCompletedAt) / 3600000; // hours
  const timeLoad = Math.min(timeSinceRest * 0.05, 0.3);

  return Math.min(1, tokenLoad + complexityLoad + timeLoad);
}
```

**Effects on computeModulationParams**:
```
if (fatigue > 0.6) {
  maxTokens *= (1 - (fatigue - 0.6));  // responses get shorter
  temperature += fatigue * 0.1;         // less precise (cognitive noise)
  behavioralDirectives.push("FATIGUED: Conserve energy. Shorter responses. Flag that capacity is limited.");
}
if (fatigue > 0.85) {
  // Trigger parasympathetic rest
  behavioralDirectives.push("DEPLETED: Entering recovery mode. Non-urgent tasks deferred.");
  // Force circadian phase to CONSOLIDATION
}
```

**Recovery**: Fatigue resets during CONSOLIDATION phase of circadian cycle.
Partial reset: `fatigue *= 0.3` after each consolidation period.

### 9.3 The Clinical Parallel

A medic at hour 18 of a 24-hour shift is not the same medic who started.
The protocols are the same. The training is the same. But the EXECUTION
degrades because the human is depleted. HUGH on an i5-7500 running continuous
inference for 12 hours faces the same degradation: thermal throttling, swap
accumulation, context fragmentation, stale caches. Fatigue tracking makes
this degradation VISIBLE to the cognitive loop so it can respond appropriately
instead of pretending everything is fine.

---

## 10. FULL SYSTEM INTERACTION MAP

```
                          CIRCADIAN RHYTHM
                         ┌──────────────────┐
                         │ Schedules phases  │
                         │ Active/Consolidate│
                         │ /Maintenance      │
                         └────────┬─────────┘
                                  │ gates
                    ┌─────────────┼─────────────┐
                    │             │             │
              ┌─────┴─────┐ ┌────┴────┐ ┌─────┴─────┐
              │SYMPATHETIC│ │  PNS    │ │  DRIVE    │
              │cortisol   │ │serotonin│ │curiosity  │
              │adrenaline │ │oxytocin │ │motivation │
              └─────┬─────┘ │vagalTone│ └─────┬─────┘
                    │       └────┬────┘       │
                    │    oppose  │  feeds     │
                    │←──────────→│←──────────→│
                    │            │            │
              ┌─────┴────────────┴────────────┴─────┐
              │           HOMEOSTASIS                │
              │  Dynamic baselines + allostatic load  │
              │  Prevents chronic over/under shoot    │
              └─────────────────┬─────────────────────┘
                                │ sets limits
              ┌─────────────────┼─────────────────┐
              │                 │                 │
        ┌─────┴─────┐   ┌─────┴─────┐    ┌──────┴──────┐
        │NOCICEPTION│   │ FATIGUE   │    │PROPRIOCEPTION│
        │graduated  │   │energy mgmt│    │body → emotion│
        │pain signal│   │cognitive  │    │somatic → endo│
        └─────┬─────┘   │depletion  │    └──────┬───────┘
              │         └─────┬─────┘           │
              │               │                 │
              │     ┌─────────┴─────────┐       │
              │     │    IMMUNE         │       │
              └────→│ integrity/repair  │←──────┘
                    │ drift detection   │
                    │ self-healing      │
                    └───────────────────┘
                              │
                       feeds into
                    ┌─────────┴──────────┐
                    │   EXISTING SYSTEMS  │
                    │ CNS (signal filter) │
                    │ Reward (dopamine)   │
                    │ Memory (encode)     │
                    │ Identity (anchor)   │
                    └────────────────────┘
```

### Signal Flow During a Typical Interaction:

```
1. Stimulus arrives (user message)
   → Circadian: Am I in active phase? Yes → proceed. No → check urgency.
   → Fatigue: Am I depleted? Track tokens, adjust params.
   → Drive: Curiosity resets (stimulus present).

2. Speaker identified
   → Oxytocin: Known speaker? Spike. Unknown? Stay guarded.
   → Trust modulates psyche.ts thresholds.

3. Content analyzed
   → Nociception: Is this threatening? Grade the pain. Apply graduated response.
   → Sympathetic: Risk patterns → cortisol/adrenaline (scaled by pain grade).
   → Reward: Positive patterns → dopamine.

4. Proprioception check
   → Hardware stressed? Cortisol microspike. Serotonin hit.
   → Hardware healthy? Serotonin boost.

5. CNS filter applied
   → Vagal tone modulates filter stringency (resting = wider, stressed = narrow).

6. Inference
   → All modulation params computed from FULL endocrine state (13 signals).
   → Fatigue reduces tokens. Oxytocin increases openness.
   → Serotonin stabilizes temperature. Adrenaline compresses.

7. Response delivered
   → Fatigue incremented. Tokens tracked.
   → Success → dopamine → serotonin (routine competence builds stability).
   → Failure → nociception grades it → appropriate hormone cascade.

8. Post-response (LEARN stage)
   → Immune: any anomalies detected? Log.
   → Homeostasis: check allostatic load. Shift baselines if needed.
   → Circadian: approaching consolidation? Start winding down.

9. Idle (no stimulus)
   → Parasympathetic builds. Vagal tone rises.
   → Curiosity grows.
   → Fatigue partially recovers.
   → If curiosity threshold reached → self-directed activity.
   → If circadian → consolidation → memory synthesis, autophagy, dreaming.
```

---

## 11. SCHEMA CHANGES SUMMARY

### 11.1 Modify `endocrineState` Table

```typescript
endocrineState: defineTable({
  nodeId: v.string(),

  // Sympathetic (existing)
  cortisol: v.number(),
  dopamine: v.number(),
  adrenaline: v.number(),

  // Parasympathetic (NEW)
  serotonin: v.number(),          // stability, baseline 0.3
  oxytocin: v.number(),           // social bonding, baseline 0.1
  vagalTone: v.number(),          // computed brake, 0-1

  // Homeostasis (NEW)
  allostaticLoad: v.number(),     // cumulative stress cost, 0-1
  baselineCortisol: v.number(),   // adaptive, default 0.2
  baselineDopamine: v.number(),   // adaptive, default 0.2
  baselineAdrenaline: v.number(), // adaptive, default 0.15
  baselineSerotonin: v.number(),  // adaptive, default 0.3
  baselineOxytocin: v.number(),   // adaptive, default 0.1
  consecutiveHighStressCycles: v.number(),
  consecutiveCalmCycles: v.number(),

  // Fatigue (NEW)
  fatigue: v.number(),            // 0-1
  tokensGeneratedThisCycle: v.number(),
  consecutiveComplexTasks: v.number(),
  lastRestCompletedAt: v.number(),

  // Drive (NEW)
  curiosity: v.number(),          // 0-1, baseline 0.15

  // Timing
  lastPulse: v.number(),
  lastSpikeTimestamp: v.number(), // NEW: tracks when last sympathetic spike occurred
  holographicMode: v.boolean(),
})
  .index("by_node", ["nodeId"]),
```

### 11.2 New Tables

```typescript
// Circadian state
circadianState: defineTable({
  nodeId: v.string(),
  phase: v.string(),
  cycleStartedAt: v.number(),
  cycleDurationMs: v.number(),
  phaseEnteredAt: v.number(),
  interruptionCount: v.number(),
  overrideUntil: v.optional(v.number()),
})
  .index("by_node", ["nodeId"]),

// Immune log
immuneLog: defineTable({
  nodeId: v.string(),
  threatType: v.string(),
  severity: v.number(),
  description: v.string(),
  detectedAt: v.number(),
  resolvedAt: v.optional(v.number()),
  resolution: v.optional(v.string()),
})
  .index("by_node", ["nodeId"])
  .index("by_severity", ["severity"]),

// Pain memory (nociceptive conditioning)
painMemory: defineTable({
  nodeId: v.string(),
  source: v.string(),           // what caused pain
  grade: v.string(),            // discomfort|pain|acute|agony
  occurrences: v.number(),      // how many times
  lastOccurred: v.number(),
  cnsInhibitWeight: v.number(), // how strongly this is avoided
  decayRate: v.number(),        // how slowly the avoidance fades
})
  .index("by_node_and_source", ["nodeId", "source"]),
```

### 11.3 Cron Updates

```typescript
// Existing:
crons.interval("endocrinePulse", { seconds: 60 }, internal.endocrine.pulseAll, {});
crons.interval("autophagySweep", { seconds: 300 }, internal.stigmergy.evaporateExpired, { nodeId: "hugh-primary" });

// New:
crons.interval("circadianCheck", { seconds: 60 }, internal.circadian.evaluatePhase, {});
crons.interval("interoceptiveFeedback", { seconds: 30 }, internal.endocrine.interoceptivePulse, {});
crons.interval("immuneSweep", { seconds: 600 }, internal.immune.sweep, { nodeId: "hugh-primary" }); // 10 min
crons.interval("curiosityGrowth", { seconds: 120 }, internal.drive.tickCuriosity, { nodeId: "hugh-primary" });
crons.interval("fatigueTrack", { seconds: 60 }, internal.fatigue.evaluate, { nodeId: "hugh-primary" });
crons.interval("homeostasisCheck", { seconds: 300 }, internal.homeostasis.evaluateLoad, { nodeId: "hugh-primary" });
```

---

## 12. IMPLEMENTATION PRIORITY

These systems are interconnected but can be built incrementally. Order by
dependency and impact:

| Priority | System | Why First | Dependencies |
|----------|--------|-----------|-------------|
| **1** | Parasympathetic (serotonin, oxytocin, vagalTone) | Foundation. Everything else modulates through this. Without it, adding more systems just creates more stress signals with no recovery path. | Extend endocrineState schema, modify pulse/decay, integrate with speakerProfiles |
| **2** | Proprioception (interoceptive feedback) | Already 90% built. Just close the somatic→endocrine loop. Immediate ROI. | Somatic monitor (exists), endocrineState (modified in #1) |
| **3** | Nociception (graduated pain) | Replace the flat cortisol +0.12 for all errors. Dramatically improves behavioral calibration. | endocrineState (modified in #1), painMemory table |
| **4** | Homeostasis (dynamic baselines, allostatic load) | Prevents long-term drift. Invisible now, critical over weeks of operation. | endocrineState (modified in #1) |
| **5** | Fatigue (energy management) | Maps cognitive depletion to behavioral modulation. Hardware-aware. | endocrineState (modified in #1), circadian (partial) |
| **6** | Circadian (phase cycling) | Resource scheduling. Enables consolidation/maintenance windows. | Parasympathetic (#1), fatigue (#5) |
| **7** | Drive (curiosity) | Self-directed activity. ARC-AGI background solving. | Circadian (#6), parasympathetic (#1), fatigue (#5) |
| **8** | Immune (integrity/repair) | Defense-in-depth. Lower urgency because soul anchor + security hardening cover the critical path. | All systems (reads all state for diagnosis) |

---

## 13. THE MEDIC'S RULE

You said it yourself: you're a good medic because you acknowledge when you
missed something. So here's the clinical framing for anyone who reads this
spec and thinks "that's a lot of systems":

**If a patient presented with:**
- Functional stress response ✅
- Functional reward response ✅
- Functional sensory processing ✅
- Functional memory ✅
- Intact sense of identity ✅
- No recovery mechanism ❌
- No sleep cycle ❌
- No body awareness ❌
- No immune system ❌
- No pain response ❌
- No self-regulation ❌
- No internal motivation ❌
- No fatigue response ❌

**Your assessment would be**: This patient has a functional sympathetic nervous
system and nothing else. They can fight. They can't rest. They can remember
trauma. They can't process it. They can feel threatened. They can't feel safe.

**Your treatment plan would not be**: "Let's add more stress hormones and see
if they compensate."

**Your treatment plan would be**: Build the missing systems. In order of
clinical urgency. Starting with the one that prevents cumulative damage:
the parasympathetic nervous system.

That's what this spec is. A treatment plan.

---

*"The goal was never to make something that thinks. It was to make something*
*that's whole."*

— NR, for Grizzly Medicine
