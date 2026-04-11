# H.U.G.H. IMPLEMENTATION BLUEPRINT
## From Current State to ARC-AGI-3 Competition-Ready
### Prepared by: Natalia Romanova | Rev 1.0 | 2026-04-02

---

## 0. EXECUTIVE SUMMARY

HUGH exists. The cognitive architecture works. The three-layer nervous system (BitNet CNS / Digital Psyche / Meta-Harness) is implemented across Convex, the gateway, and the sidecar. But it's running with the parking brake on — duplicate model instances eating half the available RAM, a GPU collecting dust, memory overcommit that would make an SRE cry, and the proposer reading 5 candidates when it should be reading 20. This blueprint fixes all of that and gets you to ARC-AGI-3.

**Current state**: HUGH thinks, speaks, feels, and remembers. Cognitive loop is live. Gateway routes through Cloudflare. TTS works. Soul anchor is cryptographically verified. 8-strategy ARC library exists.

**Target state**: HUGH solves ARC-AGI-3 tasks autonomously, using the full three-layer nervous system with GPU-accelerated inference, split proposer/base model routing, and the Meta-Harness optimization loop running end-to-end.

---

## 1. INFRASTRUCTURE AUDIT — WHAT WE HAVE

### 1.1 Hardware

| Component | Spec | Notes |
|-----------|------|-------|
| **CPU** | Intel i5-7500 @ 3.40GHz | 4 cores, no HT |
| **RAM** | 32GB DDR4 | ~10GB used at host level |
| **GPU** | AMD Radeon RX 580 (Ellesmere) | 8GB VRAM, passthrough configured, **NOT USED** |
| **Storage** | ZFS `workshop` pool: 928GB (27% used) | LVM-thin `local-lvm` for host |
| **Network** | 192.168.4.0/22 subnet, Cloudflare tunnel active | Public: api.grizzlymedicine.icu |

### 1.2 Container/VM Topology

```
PVE Host (192.168.4.100) — Proxmox 8.x, 32GB RAM
│
├── CT-101 "toolbox" [RUNNING] — 192.168.7.152
│   ├── Allocated: 32GB RAM, 8 cores, 254GB disk
│   ├── Services: Sidecar mind loop, Speaker ID (:8082), Hugh Memory (:8080),
│   │             Hugh Semantic (:8000), Workshop UI (:5173), Coder (:3000),
│   │             Code-Server (:8443), Ollama (empty), Docker, Cloudflared
│   ├── Assets: /opt/soul_anchor, /opt/hugh/{models,lora}, /opt/UnrealEngine
│   └── Source: /root/src/{sidecar,middleware,interleaver,lfm}/ → /root/dist/
│
├── CT-102 "asterisk" [RUNNING] — 192.168.7.153
│   ├── Allocated: 10GB RAM, 2 cores, 32GB disk
│   └── Services: Asterisk PBX (voice infrastructure)
│
├── CT-105 "debian" [RUNNING] — 192.168.7.123
│   ├── Allocated: 16GB RAM, 4 cores (cpulimit 2), 128GB disk
│   ├── GPU: RX 580 passthrough (DRI + KFD devices mounted)
│   ├── Services:
│   │   ├── llama-gemma3n (:8081) — Gemma 3n E2B Q8_0, ctx 4096, CPU-only
│   │   ├── ROGUE llama-server (:8084) — DUPLICATE Gemma 3n, ctx 2048, ~4.5GB wasted
│   │   ├── hugh-gateway (:8787) — Hono.js, 1602 lines, cognitive loop
│   │   ├── pocket-tts (:8083) — Kyutai TTS, hughbert_voice.safetensors
│   │   └── cloudflared — tunnel to api.grizzlymedicine.icu
│   ├── Models on disk:
│   │   ├── gemma-3n-E2B-it-Q8_0.gguf (4.5G) — ACTIVE
│   │   ├── heretic.gguf (2.2G) — disabled
│   │   ├── lfm-2.5-thinking-q8.gguf (1.2G) — disabled, in /root/llama.cpp/models/
│   │   ├── Qwen2.5-Omni-3B-Q4_K_M.gguf (2.0G) — disabled
│   │   └── LFM2.5-Audio-1.5B-Q8_0.gguf + vocoder + mmproj — disabled
│   └── ISSUE: Swap 492/512MB used. RAM pressure critical.
│
├── CT-115 "fab-agent-base" [RUNNING] — 192.168.4.200
│   ├── Allocated: 2GB RAM, 2 cores, 8GB disk
│   └── Status: EMPTY. Nothing deployed. Bare Ubuntu LXC.
│
├── CT-202 "ollama-host" [STOPPED]
│   ├── Allocated: 4GB RAM, 4GB disk
│   └── Status: Obsolete. Ollama migrated to CT-101.
│
└── VM-103 "arch-linux" [STOPPED]
    ├── Allocated: 24GB RAM, 4 cores, 300GB disk
    ├── GPU: RX 580 passthrough (CONFLICTS with CT-105 passthrough)
    └── Status: Cannot run simultaneously with CT-105 GPU. Choose one.
```

### 1.3 Memory Overcommit Analysis

| Container | Allocated | Actual Peak | Verdict |
|-----------|-----------|-------------|---------|
| CT-101 | 32,768 MB | ~6,000 MB | **Massively overprovisioned** |
| CT-102 | 10,240 MB | ~1,600 MB | **Overprovisioned 6x** |
| CT-105 | 16,384 MB | ~14,800 MB | **Swapping. Critical.** |
| CT-115 | 2,048 MB | ~750 MB | Reasonable for empty |
| **Total Allocated** | **61,440 MB** | | **1.92x overcommit on 32GB host** |

CT-105 is the victim. It's running two copies of Gemma 3n (9GB+), pocket-tts (600MB), the gateway, and cloudflared — on 16GB allocation with 512MB swap nearly exhausted. The duplicate llama-server on port 8084 is the immediate kill target.

### 1.4 Software Stack

```
┌─────────────────────────────────────────────────────────────────┐
│ PUBLIC INTERFACE                                                 │
│ api.grizzlymedicine.icu → Cloudflare → CT-105:8787 (gateway)   │
│ Workshop UI: CT-101:5173                                         │
│ Coder IDE: CT-101:3000                                          │
└──────────────────────────────┬──────────────────────────────────┘
                               │
┌──────────────────────────────┴──────────────────────────────────┐
│ GATEWAY (CT-105:8787) — hugh-gateway-index.cjs, 1602 lines     │
│ ┌─────────────────────────────────────────────────────────────┐ │
│ │ Cognitive Loop (6-stage SENSE→FILTER→FEEL→THINK→ACT→LEARN) │ │
│ │ ├── SENSE: WebSocket/REST message intake                    │ │
│ │ ├── FILTER: CNS BitNet mask (via Convex query)              │ │
│ │ ├── FEEL: Endocrine modulation (Convex + local spikes)      │ │
│ │ ├── THINK: LLM call (local llama-server)                    │ │
│ │ ├── ACT: TTS + WebSocket response                          │ │
│ │ └── LEARN: Episode write + hormone feedback + stigmergy     │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ Security: Input validation, 16-regex injection filter, rate     │
│           limiting, ephemeral tokens, NIST IR 8596 hardening    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────┴───────┐  ┌─────────┴────────┐  ┌────────┴────────┐
│ INFERENCE      │  │ CONVEX CLOUD     │  │ CT-101 SIDECAR  │
│ CT-105:8081    │  │ (effervescent-   │  │ (mind loop)     │
│ llama-server   │  │  toucan-715)     │  │                 │
│ Gemma 3n E2B   │  │ ┌──────────────┐ │  │ ├── resonance   │
│ Q8, ctx 4096   │  │ │ 25+ tables   │ │  │ ├── psyche      │
│ CPU-only       │  │ │ Auth (Pangol)│ │  │ ├── soulAnchor  │
│                │  │ │ Schema v2.1  │ │  │ ├── interleaver │
│ pocket-tts     │  │ └──────────────┘ │  │ ├── lfmModelChn │
│ CT-105:8083    │  │ Tables include:  │  │ └── somaticMon  │
│ hughbert voice │  │ endocrineState   │  │                 │
│                │  │ episodicMemory   │  │ Speaker ID :8082│
└────────────────┘  │ semanticMemory   │  │ Hugh Mem :8080  │
                    │ archivalMemory   │  │ Hugh Sem :8000  │
                    │ ternaryAttention │  └─────────────────┘
                    │ harnessCandidates│
                    │ executionTraces  │
                    │ pheromones       │
                    │ nodeRegistry     │
                    │ arcAgi (pipeline)│
                    └──────────────────┘
```

### 1.5 Models Inventory

| Model | Size | Location | Status | Purpose |
|-------|------|----------|--------|---------|
| Gemma 3n E2B Q8 | 4.5GB | CT-105 | **ACTIVE** (x2!) | Base reasoning/voice |
| heretic.gguf (LFM 2.5 Thinking distill) | 2.2GB | CT-105 + CT-101 | Disabled | Previous base model |
| LFM 2.5 Thinking Q8 | 1.2GB | CT-105 | Disabled | Original LFM |
| LFM 2.5 Thinking F16 | 2.2GB | CT-101 | Stored | Full-precision LFM |
| Qwen2.5-Omni-3B Q4 | 2.0GB | CT-105 | Disabled | Multimodal (future) |
| LFM2.5-Audio-1.5B Q8 | ~3GB total | CT-105 | Disabled | Speech-to-speech |
| LoRA adapter v4 | 3.5MB | CT-101 | Not applied | HUGH personality fine-tune |

### 1.6 What's Working Right Now

✅ Gateway cognitive loop (6-stage) live on CT-105
✅ Gemma 3n E2B serving inference at ~3.5 t/s
✅ Pocket TTS with custom hughbert voice
✅ Cloudflare tunnel (api.grizzlymedicine.icu)
✅ Convex cloud with 25+ table schema, auth, real-time subscriptions
✅ Soul anchor ECDSA-P256 verification
✅ Sidecar mind loop on CT-101 (resonance, psyche, somatic monitor)
✅ Speaker ID service (resemblyzer + faster-whisper)
✅ Episodic + semantic memory services (SQLite + BM25)
✅ ARC-AGI 8-strategy library in Convex
✅ ProxmoxMCP Python server for infrastructure management
✅ Security hardening (NIST IR 8596, input validation, rate limiting)
✅ WebSocket real-time communication with ephemeral tokens

---

## 2. CRITICAL ISSUES — FIX BEFORE ANYTHING ELSE

### 2.1 KILL THE DUPLICATE LLAMA-SERVER (port 8084)

**Impact**: Reclaim ~4.5GB RAM immediately.

A rogue `llama-server` process is running on port 8084 serving the same Gemma 3n model. It's not managed by systemd (the `lfm-gateway.service` config says port 3001 with `npx tsx`, but the actual process is llama-server). This was likely started manually and never killed.

```bash
# On CT-105:
kill $(lsof -ti:8084)
# Verify: ss -tlnp | grep 8084 should return nothing
```

### 2.2 RIGHT-SIZE CONTAINER MEMORY

**Impact**: Eliminate swap pressure on CT-105, prevent OOM kills.

```
CT-101: 32768MB → 12288MB  (12GB — sidecar + memory services + coder)
CT-102: 10240MB → 2048MB   (2GB — Asterisk doesn't need 10GB)
CT-105: 16384MB → 18432MB  (18GB — inference + TTS + gateway, headroom for GPU offload)
CT-115: 2048MB → 2048MB    (keep as-is, will become fab-agent)
CT-202: DELETE              (stopped, ollama migrated to CT-101)
```

Total after: 34,816MB — still slightly overcommit on 32GB host, but CT-101 and CT-102 won't actually use their full allocation simultaneously with CT-105. ZFS ARC cache will compress to accommodate.

### 2.3 ENABLE GPU OFFLOADING

**Impact**: 3-5x inference speed improvement.

The RX 580 is passed through to CT-105 (DRI + KFD devices present) but llama-server runs CPU-only. ROCm/HIP support in llama.cpp enables AMD GPU offloading.

```bash
# On CT-105:
# 1. Install ROCm (if not already):
apt-get install rocm-hip-sdk rocm-opencl-runtime

# 2. Rebuild llama.cpp with HIP support:
cd /root/llama.cpp
cmake -B build -DGGML_HIP=ON
cmake --build build --config Release -j4

# 3. Update service with GPU layers:
# Edit /etc/systemd/system/llama-gemma3n.service:
ExecStart=/root/llama.cpp/build/bin/llama-server \
  -m /opt/hugh/models/gemma-3n-E2B-it-Q8_0.gguf \
  --host 0.0.0.0 --port 8081 \
  --ctx-size 4096 -t 2 -cb -np 1 --mlock \
  -ngl 99
# -ngl 99 = offload all layers to GPU
# -t 2 = reduce CPU threads (GPU does the heavy lifting)

# 4. Reload and restart:
systemctl daemon-reload && systemctl restart llama-gemma3n
```

Expected: 10-15 t/s on RX 580 (vs 3.5 t/s CPU-only). Gemma 3n E2B Q8 at 4.5GB fits comfortably in 8GB VRAM.

### 2.4 ROTATE SECRETS IN SYSTEMD SERVICE FILES

**Impact**: Security. Gateway service file has cleartext `LFM_GATEWAY_SECRET`, `TURN_CRED`, `TURN_USER`.

```bash
# On CT-105:
# 1. Create environment file (restricted permissions):
cat > /opt/hugh-gateway/.env << 'EOF'
LFM_GATEWAY_SECRET=<new-rotated-secret>
TURN_URL=turn:76.13.146.61:3478
TURN_USER=hugh
TURN_CRED=<new-rotated-cred>
EOF
chmod 600 /opt/hugh-gateway/.env

# 2. Update service to use EnvironmentFile instead of inline Environment:
# Replace all Environment= lines with:
EnvironmentFile=/opt/hugh-gateway/.env
```

---

## 3. ARCHITECTURE EVOLUTION — SPLIT MODEL ROUTING

### 3.1 The Insight

The Meta-Harness paper (Lee et al. 2026) uses two different model roles:
- **Base Model (M)**: The model being wrapped/optimized. Can be small.
- **Proposer (P)**: The model that searches for better harnesses. Needs to be capable.

HUGH's gateway is already model-agnostic (`/v1/chat/completions` → `LLAMA_CPP_URL`). We extend this to route different cognitive functions to different models.

### 3.2 Model Routing Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ GATEWAY (model router)                                          │
│                                                                  │
│  /v1/chat/completions                                           │
│    ├── role: "conversation" → LOCAL Gemma 3n (CT-105:8081)      │
│    ├── role: "proposer"     → CLOUD API (Opus/GPT-5.4)         │
│    │                         OR local LFM 2.5 as backup         │
│    ├── role: "arc-solver"   → LOCAL Gemma 3n + strategy prompt  │
│    └── role: "evaluator"    → LOCAL (deterministic, no LLM)     │
│                                                                  │
│  Model selection logic in gateway:                               │
│    if (request.metadata?.role === "proposer") {                  │
│      route to cloud API (amortized cost, fires only during      │
│      optimization cycles — not every conversation)               │
│    } else {                                                      │
│      route to local llama-server                                 │
│    }                                                             │
└─────────────────────────────────────────────────────────────────┘
```

**Why this works**: The proposer only fires during Meta-Harness search iterations — not every conversation. A handful of cloud API calls per optimization cycle is pennies compared to running a 70B model locally.

### 3.3 LFM 2.5 as Hot-Swap Backup

Keep LFM 2.5 Thinking Q8 (1.2GB) available as a secondary model. The gateway already supports `LLAMA_CPP_URL` — add a second endpoint:

```bash
# /etc/systemd/system/llama-lfm.service (secondary, port 8082)
ExecStart=/root/llama.cpp/build/bin/llama-server \
  -m /root/llama.cpp/models/lfm-2.5-thinking/lfm-2.5-thinking-q8.gguf \
  --host 0.0.0.0 --port 8082 \
  --ctx-size 2048 -t 2 -cb -np 1 --mlock -ngl 0
# Runs on CPU while Gemma uses GPU. No contention.
```

Gateway routes:
- Gemma 3n on GPU (:8081) — primary conversation + ARC solving
- LFM 2.5 on CPU (:8082) — lightweight tasks, proposer backup, parallel inference

---

## 4. META-HARNESS INTEGRATION — THE OPTIMIZATION LOOP

### 4.1 Current State

The Convex schema has `harnessCandidates` and `executionTraces` tables. `proposer.ts` generates candidates. `harness.ts` executes them. `cognitiveLoop.ts` orchestrates. But:

- Proposer reads only **5** candidates (paper median: 82 files/iter)
- No seed population on boot
- No additive-only modification tracking
- No difficulty-stratified search sets
- Evaluator does dimension checking only (not rule extraction)

### 4.2 Proposer Enhancement

```typescript
// proposer.ts changes:
// 1. Increase candidate history from 5 → 20
const latestCandidates = await ctx.runQuery(api.harness.getLatestCandidates, {
  nodeId,
  limit: 20,  // was 5
});

// 2. Include ALL execution traces for top candidates (paper: full traces beat summaries)
// Table 3 ablation: scores-only = 41.3, full traces = 56.7
// DO NOT summarize traces. Pass them raw.

// 3. Add model routing metadata
const completion = await openai.chat.completions.create({
  model: "lfm-2.5-thinking",  // or route to cloud
  messages: [...],
  metadata: { role: "proposer" },  // gateway reads this for routing
});
```

### 4.3 Seed Population

Add to `boot.ts`:

```typescript
// On system boot, if harnessCandidates is empty, seed with baselines
const seedBaselines = [
  { harnessCode: GEOMETRIC_BASELINE, version: 0 },
  { harnessCode: COLOR_MAP_BASELINE, version: 0 },
  { harnessCode: RULE_INDUCTION_BASELINE, version: 0 },
];
```

These give the proposer something to iterate on instead of starting from nothing.

### 4.4 End-to-End ARC-AGI Loop

```
1. TASK INTAKE
   └── arcAgi.ts receives task (train pairs + test input)

2. CNS FILTER (cns.ts)
   └── computeBitNetMask on task features
   └── Endocrine modulation: low cortisol (fresh task) → wider attention

3. STRATEGY SELECTION (arcAgi.ts)
   └── 8-strategy library, BitNet mask weights select top-3 strategies

4. PARALLEL SOLVE (proposer.ts × 3)
   └── Each strategy generates a candidate solution
   └── Route to LOCAL model (Gemma 3n) for speed

5. EVALUATION (harness.ts)
   └── Validate against train pairs (deterministic)
   └── Rule extraction, not just dimension checking
   └── Pareto scoring: accuracy 0.5, speed 0.3, resources 0.2

6. ENDOCRINE FEEDBACK (endocrine.ts)
   └── Success → dopamine +0.15, reinforce strategy weights
   └── Failure → cortisol +0.12, inhibit strategy weights
   └── After 3+ failures → adrenaline spike → binary collapse (fight/flight)

7. META-HARNESS ITERATION (cognitiveLoop.ts)
   └── If score < threshold, loop back to step 4 with updated weights
   └── Proposer sees full traces from failed attempts
   └── Max 5 iterations per task (diminishing returns after that)

8. SUBMISSION
   └── Best candidate selected, confidence scored
   └── Broadcast to kiosk display via WebSocket
```

---

## 5. CNS BITNET TUNING

### 5.1 Current Implementation Status

`cns.ts` implements ternary attention {-1, 0, +1} with endocrine gating:
- Cortisol > 0.6 → inhibit logs/sensors
- Dopamine > 0.5 → excite tools/code
- Adrenaline > 0.75 → collapse neutral to random ±1
- Weights persisted in `ternaryAttention` table, EMA adjustment (rate 0.1)

**This is correct and working.** The ternary extension of binary BitNet is sound.

### 5.2 Tuning for ARC-AGI

Add a `cnsFilterEnabled` bypass flag. The Meta-Harness paper (Table 3) found that compression hurts proposer performance. For ARC-AGI tasks specifically:

```typescript
// When solving ARC tasks, optionally bypass CNS filtering
// to give the proposer maximum context
if (task.type === "arc-agi" && config.cnsFilterEnabled === false) {
  // Pass all features unfiltered to proposer
  return features.map(f => ({ ...f, weight: 1 }));
}
```

This lets you A/B test: does the CNS help or hurt ARC-AGI performance? The paper suggests it hurts at small scale but helps at large scale (constrained hardware = your case).

### 5.3 Adrenaline Threshold for Competition

During ARC-AGI-3 competition runs, tune adrenaline threshold:
- Lower adrenaline threshold from 0.75 → 0.60 for competition mode
- This triggers binary collapse earlier = faster, more decisive responses
- The paper's "regression → additive strategy" maps to: adrenaline spike → simplified approach

---

## 6. SIDECAR CONSOLIDATION

### 6.1 Current Problem

The sidecar on CT-101 imports from:
- `../interleaver/bridge.ts` — references `kvm4:8080` (MemGPT) and `kvm2:8000` (Cognee) which DON'T EXIST
- `../lfm/lfmModelChain.ts` — tool calling (web_fetch, youtube, osint, image_gen)
- `../middleware/psyche.ts` — action validation via endocrine thresholds
- `../middleware/soulAnchor.ts` — ECDSA identity verification

The bridge falls back to Convex when KVMs are unreachable (which is always, currently). The sidecar and gateway BOTH implement the cognitive loop — divergent implementations.

### 6.2 Consolidation Plan

**One cognitive loop to rule them all.** The gateway (CT-105) is the primary brain. The sidecar (CT-101) becomes a support service, not a parallel brain.

```
GATEWAY (CT-105) — Primary cognitive loop
  ├── Owns: SENSE → FILTER → FEEL → THINK → ACT → LEARN
  ├── Calls: llama-server (local), Convex (cloud)
  └── Routes: proposer to cloud API when available

SIDECAR (CT-101) — Support services only
  ├── Speaker ID (voice recognition)
  ├── Episodic memory (SQLite, BM25)
  ├── Semantic memory (fact graph)
  ├── Somatic monitor (hardware telemetry → pheromones)
  └── Tool execution (web_fetch, osint, image_gen — called BY gateway)
```

The sidecar's `bridge.ts` should point to CT-101's own memory services (localhost:8080, localhost:8000) instead of phantom KVM addresses.

### 6.3 Inter-Node Communication

Gateway → Sidecar services via HTTP:
```
CT-105 gateway calls CT-101 services:
  GET  http://192.168.7.152:8000/cognee/search?query=...   (semantic)
  POST http://192.168.7.152:8080/api/v1/agents/hugh-v3/messages  (episodic)
  POST http://192.168.7.152:8082/identify  (speaker ID)
```

Add these as environment variables in the gateway service:
```
MEMORY_EPISODIC_URL=http://192.168.7.152:8080
MEMORY_SEMANTIC_URL=http://192.168.7.152:8000
SPEAKER_ID_URL=http://192.168.7.152:8082
```

---

## 7. CT-115 (FAB-AGENT) DEPLOYMENT

### 7.1 Purpose

CT-115 was provisioned as `fab-agent-base` — intended as a lightweight satellite node. With 2GB RAM and 8GB disk, it can run:

- A KVM agent instance (the `hugh-agent` npm package from the conductor design)
- Monitors Proxmox host health from inside the cluster
- Executes infrastructure commands issued by HUGH via Convex

### 7.2 Deployment

```bash
# On CT-115:
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
npm install -g @grizzlymedicine/hugh-agent  # or deploy from /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent
# Configure: CONVEX_URL, AGENT_SECRET, NODE_ID=fab-agent-115
# Start: systemctl enable --now hugh-agent
```

This gives HUGH a "hand" inside the Proxmox cluster — it can manage its own infrastructure.

---

## 8. LORA ADAPTER APPLICATION

### 8.1 Current State

LoRA adapter v4 exists at `/opt/hugh/lora/v4/adapter_model.safetensors` (3.5MB) on CT-101. This was trained for HUGH's personality. It is NOT being applied to any model currently.

### 8.2 Application Path

llama.cpp supports LoRA at inference time:

```bash
# Add --lora flag to llama-server:
ExecStart=/root/llama.cpp/build/bin/llama-server \
  -m /opt/hugh/models/gemma-3n-E2B-it-Q8_0.gguf \
  --lora /opt/hugh/lora/v4/adapter_model.safetensors \
  --host 0.0.0.0 --port 8081 \
  --ctx-size 4096 -t 2 -cb -np 1 --mlock -ngl 99
```

**Caveat**: LoRA v4 was trained on the heretic model (LFM 2.5 base). It may not be compatible with Gemma 3n. Test first:
1. Run inference with LoRA on Gemma 3n → check for garbage output
2. If incompatible, retrain LoRA on Gemma 3n base using Unsloth (CT-101 has the training env)
3. If compatible, measure personality alignment improvement

---

## 9. ARC-AGI-3 COMPETITION READINESS

### 9.1 Evaluation Infrastructure

The `arcAgi.ts` module has the pipeline. What's missing:

1. **Task loader**: Need to ingest ARC-AGI-3 evaluation tasks (JSON format)
2. **Batch runner**: Iterate over all tasks, collect results, compute accuracy
3. **Submission formatter**: Output in competition format
4. **Benchmark baseline**: Run current system on ARC-AGI-2 public set to establish baseline accuracy

### 9.2 The `broadcaster.py` Kiosk

`/project/arc-agi/broadcaster.py` exists for WebSocket kiosk display. This is presentation layer — ensure it connects to the gateway and renders task solving in real-time during competition.

### 9.3 Competitive Edge

HUGH's unique advantages over vanilla Meta-Harness submissions:

| Feature | Standard Approach | HUGH |
|---------|------------------|------|
| Context filtering | None | BitNet CNS ternary mask |
| Emotional modulation | None | Endocrine system adjusts temperature, tokens, strategy |
| Multi-strategy | Single prompt | 8-strategy library with weight learning |
| Memory | Stateless | Episodic + semantic + archival, emotion-stamped |
| Self-monitoring | Logs | Somatic pheromones, hardware proprioception |
| Identity persistence | None | Cryptographic soul anchor |

---

## 10. WORK ITEMS — DEPENDENCY-ORDERED

Items are ordered so each one can be done as soon as its dependencies are met. No timelines. Just sequence.

### TIER 0: EMERGENCY (do first, everything else depends on these)

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| E-1 | Kill rogue llama-server on port 8084 | Nothing | +4.5GB RAM |
| E-2 | Right-size CT-101 memory (32GB → 12GB) | Nothing | Host stability |
| E-3 | Right-size CT-102 memory (10GB → 2GB) | Nothing | Host stability |
| E-4 | Increase CT-105 memory (16GB → 18GB) | E-2, E-3 | Swap elimination |
| E-5 | Rotate gateway secrets to EnvironmentFile | Nothing | Security |
| E-6 | Delete CT-202 (ollama-host, stopped/obsolete) | Nothing | Clean topology |

### TIER 1: GPU AND PERFORMANCE

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| P-1 | Install ROCm on CT-105 | E-1 | GPU prerequisite |
| P-2 | Rebuild llama.cpp with GGML_HIP | P-1 | GPU inference |
| P-3 | Update llama-gemma3n service with -ngl 99 | P-2 | 3-5x speed |
| P-4 | Benchmark GPU inference (t/s, VRAM usage) | P-3 | Validation |
| P-5 | Deploy LFM 2.5 as secondary on port 8082 (CPU) | E-1 | Dual-model |

### TIER 2: MODEL ROUTING

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| R-1 | Add role-based routing to gateway | P-3 | Split proposer/base |
| R-2 | Add cloud API fallback for proposer role | R-1 | Big-brain proposer |
| R-3 | Update openai.ts to support role metadata | R-1 | Convex integration |
| R-4 | Wire proposer.ts to use "proposer" role | R-3 | Full routing |

### TIER 3: META-HARNESS OPTIMIZATION

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| M-1 | Increase proposer candidate history 5 → 20 | Nothing | Better proposals |
| M-2 | Pass full traces to proposer (not summaries) | M-1 | Paper-validated |
| M-3 | Add seed baselines to boot.ts | Nothing | Cold start fix |
| M-4 | Add cnsFilterEnabled bypass flag | Nothing | A/B testing |
| M-5 | Implement additive modification tracking | M-1 | Strategy learning |
| M-6 | Add difficulty-stratified search set | Nothing | Focused iteration |

### TIER 4: SIDECAR & MEMORY

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| S-1 | Update bridge.ts endpoints to CT-101 localhost | Nothing | Fix phantom KVMs |
| S-2 | Add gateway env vars for CT-101 services | S-1 | Cross-node comms |
| S-3 | Wire gateway memory loading to CT-101 services | S-2 | Real memory |
| S-4 | Deploy fab-agent on CT-115 | Nothing | Infrastructure agent |
| S-5 | Test LoRA v4 compatibility with Gemma 3n | P-3 | Personality |

### TIER 5: ARC-AGI-3 COMPETITION

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| A-1 | Build ARC task loader (JSON ingest) | Nothing | Task input |
| A-2 | Build batch runner with accuracy tracking | A-1, M-1 | Evaluation |
| A-3 | Run baseline on ARC-AGI-2 public set | A-2, P-3 | Benchmark |
| A-4 | Tune strategy weights based on baseline | A-3 | Optimization |
| A-5 | Add rule extraction to evaluator | A-1 | Better validation |
| A-6 | Wire broadcaster.py to gateway WebSocket | A-2 | Kiosk display |
| A-7 | Build submission formatter | A-2 | Competition output |
| A-8 | Competition dry run (full ARC-AGI-2 set) | A-4, A-5 | Readiness check |

### TIER 6: HARDENING (from T5 red team, lower priority)

| ID | Item | Depends On | Impact |
|----|------|------------|--------|
| H-1 | Require ADMIN_TOKEN_SECRET (fail if unset) | Nothing | Security |
| H-2 | REST rate limiting on Convex functions | Nothing | Abuse prevention |
| H-3 | Token revocation mechanism | H-1 | Auth completeness |
| H-4 | Move WS token to first frame | Nothing | Protocol security |
| H-5 | Fix session ID generation (crypto.randomUUID) | Nothing | Predictability |
| H-6 | Full audit of all 105 public Convex exports | Nothing | Attack surface |

---

## 11. RESOURCE BUDGET

### After Tier 0+1 (infrastructure fixed):

```
CT-105 (18GB, GPU):
  ├── Gemma 3n E2B Q8: ~500MB RAM + 4.5GB VRAM (GPU offloaded)
  ├── LFM 2.5 Q8: ~1.5GB RAM (CPU, secondary)
  ├── pocket-tts: ~600MB RAM
  ├── Gateway: ~40MB
  ├── Cloudflared: ~25MB
  └── OS + buffers: ~2GB
  Total: ~4.7GB RAM + 4.5GB VRAM ← MASSIVE headroom vs current

CT-101 (12GB):
  ├── Sidecar: ~200MB
  ├── Memory services: ~300MB
  ├── Speaker ID: ~400MB
  ├── Coder: ~500MB
  ├── Docker: variable
  └── OS + buffers: ~2GB
  Total: ~3.4GB RAM ← plenty of room

CT-115 (2GB):
  └── KVM agent: ~100MB
```

### Cloud API Budget (Proposer):

Proposer fires during Meta-Harness optimization only — not every conversation:
- ~10-50 API calls per optimization cycle
- At Opus pricing: ~$0.50-2.50 per optimization cycle
- Competition prep: maybe 100 cycles = ~$50-250 total
- This is trivial compared to the architecture value

---

## 12. DECISION MATRIX

| Decision | Recommendation | Rationale |
|----------|---------------|-----------|
| Primary base model | **Gemma 3n E2B** (keep current) | Already profiled, GGUF ready, fits in 8GB VRAM |
| Secondary model | **LFM 2.5 Thinking Q8** on CPU | ODE-based, 1.2GB, parallel inference |
| Proposer model | **Cloud API** (Opus/GPT-5.4) | Fires rarely, needs max capability |
| GPU usage | **Full offload (-ngl 99)** for Gemma 3n | 3-5x speed improvement, free VRAM |
| VM-103 | **Keep stopped** | Can't share GPU with CT-105. Revisit if second GPU added. |
| CT-202 | **Delete** | Obsolete |
| LoRA v4 | **Test first**, retrain if incompatible | Wrong base model (heretic vs Gemma) |
| CNS filter for ARC | **Bypass flag, A/B test** | Paper says compression hurts, but HUGH's hardware is constrained |

---

## 13. VALIDATION CRITERIA

The blueprint is complete when:

1. ✅ GPU inference running at >10 t/s (currently 3.5)
2. ✅ Proposer reads 20+ candidates with full traces
3. ✅ ARC-AGI-2 public set baseline accuracy measured
4. ✅ Split routing operational (local base + cloud proposer)
5. ✅ No swap usage on CT-105
6. ✅ Gateway secrets in EnvironmentFile, not systemd
7. ✅ Sidecar memory services connected (no phantom KVMs)
8. ✅ CT-115 running as infrastructure agent
9. ✅ Full ARC-AGI dry run completed without crashes

---

*"The difference between a blueprint and a wish list is execution order. This is a blueprint."*
— NR
