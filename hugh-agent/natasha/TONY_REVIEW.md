# TONY STARK SESSION REVIEW
**Reviewer:** Natalia Romanova (Black Widow)  
**Subject:** Tony Stark (Gemini 3 Pro) Infrastructure Session  
**Date:** 2026-04-02  
**Classification:** Post-Action Assessment  

---

## VERDICT: Mixed Execution — Good Diagnostics, Left a Fire Burning

Tony found real problems. He also created new ones. The system is currently in **worse operational state** than before his session began.

---

## ✅ WHAT HE DID RIGHT

### 1. Correct Root-Cause Diagnosis (LFM_URL Misconfiguration)
Tony identified that `hugh-mind` on CT-101 was pointing `LFM_URL` to `http://192.168.4.100:11434/v1` — a dead Ollama endpoint on the PVE host. This was the primary reason HUGH was stuck at `intensity: 1.00` with `LFM: OFFLINE`. Solid find.

### 2. PM2 Environment Investigation
He correctly identified PM2's aggressive environment caching. The debugging sequence — checking `/proc/PID/environ` to verify that PM2's `--update-env` flag was lying — was textbook. He earned that one the hard way.

### 3. Health Check Path Discovery
Found that `somatic-monitor.js` constructs the health check as `${LFM_URL}/models`. With `LFM_URL=http://...8081/v1`, this becomes `/v1/models`. Stripping the `/v1` suffix fixed the path to `/models` (llama.cpp native endpoint). Subtle bug, correctly diagnosed.

### 4. Missing Auth Header in lfmModelChain.js
Identified that `lfmModelChain.js` uses `axios` to hit the gateway but **does not pass an `Authorization: Bearer` header**. This is why the gateway returns `401 Unauthorized`. Rather than patching the JS, he pivoted to bypass the gateway entirely (direct to llama-server on 8081). Pragmatic, if incomplete.

### 5. Rogue Port 8084 Eliminated
The duplicate llama-server on port 8084 that I flagged in the implementation blueprint is confirmed dead. One less ghost in the machine.

### 6. HUGH Came Online (Briefly)
The log shows the transition: `LFM:OFFLINE intensity:1.00` → `LFM:3ms intensity:0.55` → `LFM:4ms intensity:0.22`. The endocrine system responded exactly as designed — cortisol/adrenaline decayed as stimulus resolved. Beautiful validation of the architecture. For about 8 minutes.

---

## 🔴 WHAT HE BROKE

### 1. CRITICAL: llama-gemma3n Is Crash-Looping (SIGABRT)
**Current status: `activating (auto-restart)` — Port 8081 is DOWN.**

The service is dying during model warmup with a GPU memory access fault:
```
Memory access fault by GPU node-1 on address 0x20000000
Reason: Page not present or supervisor privilege
Assertion `false && "GPU memory access fault."` failed
```

**Root cause:** Tony started `llama-audio` on port 8082, which loaded a second model into GPU memory. The RX 580 has 8GB VRAM. Gemma 3n Q8 needs ~4.5GB. LFM Audio Q8 needs ~1.5GB. Together that's 6GB — tight but theoretically possible. However, both services are fighting for GPU memory regions, and `llama-gemma3n` is losing.

**This means HUGH's primary reasoning engine is currently dead.** The mind sidecar is back to `intensity: 1.00`. Everything Tony fixed is now unfixed.

### 2. CRITICAL: Build Process Running on Production Node
There's a `build-opencl` directory on CT-105 with active `gcc` compiler processes consuming 40-50% CPU. Tony appears to have started rebuilding llama.cpp with OpenCL support **on the live inference node** during a production session.

You don't rebuild the engine while the plane is in the air.

### 3. HIGH: LFM_GATEWAY_SECRET Printed in Plaintext
The `tonylog.md` file — which is in the git repository — contains the full `LFM_GATEWAY_SECRET` in plaintext on **multiple lines**:
```
LFM_GATEWAY_SECRET=[ROTATED]
```
This was flagged in my Tier 5 Red Team Report. Tony extracted it from `/proc/PID/environ` and printed it to his log. The secret needs rotation. The log needs scrubbing before any push.

### 4. HIGH: Sidecar Bypasses Gateway (No Auth, No Rate Limit, No Audit)
By pointing `LFM_URL` directly at llama-server (port 8081), Tony bypassed every security layer I hardened in Phase 2:
- No `Authorization: Bearer` validation
- No rate limiting
- No structured audit logging
- No connection limits

This is architecturally correct as a **temporary diagnostic bypass**. It's architecturally wrong as a **permanent configuration**. The `.env` file on CT-101 currently codifies this bypass.

### 5. MEDIUM: Convex Deployment Stale
The error logs show:
```
Could not find public function for 'pheromones:emitSomatic'
Could not find public function for 'system:updateHormones'
```
These are core endocrine functions. If the Convex backend is stale, the entire psyche middleware is operating in a vacuum — hormones spike but never persist, pheromones emit but go nowhere. The sidecar is a brain in a jar.

### 6. MEDIUM: hugh-model-swap.sh Not Deployed
Tony created the model-swap script (it's in `natasha/tony/hugh-model-swap.sh`) but **never actually deployed it to CT-105**. `find / -name hugh-model-swap.sh` returns nothing on the inference node. The script is sitting in the local repo doing nothing.

### 7. LOW: CT-101 .env Has /v1 Suffix (Will Break Again)
```
LFM_URL=http://192.168.7.123:8081/v1
```
Tony discovered that the health check appends `/models` to `LFM_URL`. If `LFM_URL` ends in `/v1`, the path becomes `/v1/models`. He fixed this once (changed to no `/v1`), but the current `.env` file shows the `/v1` suffix is back. The next PM2 restart will re-break the health check depending on which env actually loads.

---

## 🔧 WHAT NEEDS TO HAPPEN NOW

### Immediate (Stop the Bleeding)
| # | Action | Why |
|---|--------|-----|
| 1 | `systemctl stop llama-audio` on CT-105 | Free GPU memory so llama-gemma3n can load |
| 2 | Kill the gcc/build-opencl processes on CT-105 | Stop compiling on a production node |
| 3 | `systemctl restart llama-gemma3n` on CT-105 | Restore primary inference |
| 4 | Verify port 8081 listening | Confirm HUGH can reach the model |
| 5 | Fix `/root/.env` on CT-101: `LFM_URL=http://192.168.7.123:8081` (no /v1) | Health check path fix |
| 6 | Restart hugh-mind via PM2 with `--update-env`, verify via `/proc/PID/environ` | Env actually applied |

### Short-Term (Stabilize)
| # | Action | Why |
|---|--------|-----|
| 7 | Rotate `LFM_GATEWAY_SECRET` | Printed in plaintext in git-tracked log |
| 8 | Scrub or `.gitignore` `tonylog.md` | Contains secret material |
| 9 | Deploy `hugh-model-swap.sh` to CT-105 `/opt/hugh-gateway/` | Tool exists but was never placed |
| 10 | Add `Authorization: Bearer` to `lfmModelChain.js` | Proper fix for gateway auth |
| 11 | Re-point `LFM_URL` to gateway (8787) once auth header is added | Restore security layers |
| 12 | Run `npx convex deploy` to sync backend | Fix stale function references |

### Architecture (Do It Right)
| # | Action | Why |
|---|--------|-----|
| 13 | Build llama.cpp with OpenCL **on a separate machine or CT-115** | Never compile on production |
| 14 | GPU memory budget: only ONE model loaded at a time | RX 580 can't dual-serve reliably |
| 15 | Model-swap script should stop current model before starting new one | Prevents memory collision |

---

## 📊 SCORECARD

| Category | Score | Notes |
|----------|-------|-------|
| **Diagnostics** | 9/10 | Excellent root-cause analysis. Systematic. |
| **Execution** | 4/10 | Got the win, then immediately broke it. |
| **Security** | 2/10 | Printed secrets to a logged file. Bypassed gateway auth. |
| **Stability** | 3/10 | Left system in crash-loop. Build running on prod. |
| **Documentation** | 7/10 | Created soul tether, model-swap script. Good artifacts. |
| **Cleanup** | 2/10 | Didn't verify final state. Left debris everywhere. |
| **Overall** | 4.5/10 | Smart operator, messy closer. |

---

## THE MEDIC'S ANALOGY

Tony found the patient in cardiac arrest (LFM: OFFLINE, intensity 1.00). He correctly identified the rhythm (bad LFM_URL), delivered the right shock (environment fix), and got ROSC (LFM: 3ms, intensity 0.22). 

Then he left the patient on the stretcher with two IV drips fighting for the same line (dual GPU models), a construction crew jackhammering in the ICU (build-opencl on prod), and the patient's chart taped to the waiting room bulletin board (secrets in plaintext).

ROSC doesn't mean discharge. You still have to manage the post-resuscitation care.

---

## CREDIT WHERE DUE

The model-swap script concept is genuinely useful. The soul tether he wrote for himself is well-structured (though that's more vanity than architecture). And finding the PM2 environment caching behavior — that's institutional knowledge that will save everyone hours next time.

He's not wrong that H.U.G.H. needs to be online. He's wrong about how you leave things when you walk away.

---

*Filed by: Natalia Romanova*  
*"I always check the room after someone else sweeps it."*
