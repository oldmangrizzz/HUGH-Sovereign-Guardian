# IPAD PRO M5 AS HUGH INFERENCE SERVER
## Technical Intelligence Brief
**Classification:** GRIZZLY_ADMIN  
**Prepared by:** Natalia Romanova  
**Subject:** Feasibility assessment — iPad Pro M5 11" as primary LLM inference backend, replacing CT-105

---

## EXECUTIVE SUMMARY

**Short answer: Yes. Do it. But not out of the box — it requires one deliberate decision and ~4 hours of setup work.**

The iPad Pro M5 is roughly **10–17x faster** than your current CT-105 inference stack (i5-7500 + RX 580, ~3.53 t/s) and consumes a fraction of the power. The hardware case is overwhelming. The only friction is iOS sandboxing — Apple doesn't want your tablet acting as a server. There are clean, documented workarounds. None require jailbreak.

The pivot Grizz described — iPad handles inference, Proxmox only runs the sidecar environment — is architecturally sound and reduces your Proxmox compute requirement to nearly zero. CT-101 stays. CT-105 becomes optional standby or gets decommissioned.

---

## SECTION 1: THE HARDWARE CASE

### iPad Pro M5 11-inch (Released October 22, 2025)

| Spec | Value |
|------|-------|
| Chip | Apple M5 |
| CPU | 9-core (256GB/512GB models) / 10-core (1TB/2TB models) |
| GPU | 10-core with Neural Accelerator per core |
| Neural Engine | 16-core, ~45+ TOPS |
| RAM | **12GB** (256GB/512GB) / **16GB** (1TB/2TB) |
| Memory Bandwidth | **150+ GB/s** (≈30% faster than M4) |
| AI Performance vs M4 | **3.5x faster** |
| AI Performance vs M1 | **5.6x faster** |
| Storage Read/Write | 2x faster than M4 |
| Connectivity | Wi-Fi 7 (N1), Bluetooth 6, optional 5G (C1X) |
| Thickness | 5.3mm |

### Why Memory Bandwidth Is the Number That Matters for LLMs

LLM inference is not compute-bound — it's memory-bandwidth-bound. The model weights live in RAM and have to be streamed to the GPU/NPU for every token. That's why a $40 GPU inside an M5 crushes a dedicated RX 580:

| Device | Memory Bandwidth | LLM Inference Speed (7B Q4) | Power Draw |
|--------|-----------------|------------------------------|------------|
| CT-105: i5-7500 + RX 580 | ~256 GB/s (GPU only) | **~3.53 t/s** (actual) | ~150W |
| iPad Pro M5 (12GB) | **150+ GB/s unified** | **~45–60 t/s** (projected) | **~10–15W** |

> **Note:** RX 580 bandwidth looks higher on paper, but the VRAM is only 8GB and the CPU-to-GPU transfer overhead kills throughput for quantized GGUF models. Unified memory architecture eliminates that bottleneck entirely. The actual measured M4 speed (25–40 t/s for 7B Q4) scales to M5 at ~1.5x generation improvement = roughly 37–60 t/s. Compared to 3.53 t/s on CT-105, that's **10–17x faster real-world inference.**

### Real-World LLM Benchmarks (M5, Qwen3-8B-4bit)

- **Prompt prefill, 10k tokens:** 18 seconds (M4 took 81 seconds — 4.4x improvement)
- **Prompt prefill, 16k tokens:** 38 seconds (M4 took 118 seconds)
- **Token generation:** ~1.5x faster than M4

For HUGH's use case (conversational inference, ~128 token responses, 3.5 second budget): the M5 generates 128 tokens in **~2–3 seconds** vs CT-105's current **~36 seconds**. That's not an incremental upgrade. That's a different class of system.

### RAM Configuration and Model Limits

Your storage tier determines your RAM. This matters for model selection:

**If you have 256GB or 512GB storage → 12GB RAM:**
- Safe: anything up to ~7B Q8 or ~13B Q4
- Models that fit: Gemma 3n E2B Q8 (4.5GB), Llama 3.1 8B Q4 (4.5GB), Qwen 2.5 7B Q5 (5.1GB), Phi-3.5 Mini (2.2GB)
- HUGH's current model (Gemma 3n E2B Q8) fits with 7.5GB headroom for OS

**If you have 1TB or 2TB storage → 16GB RAM:**
- Safe: anything up to ~13B Q4 or ~7B full precision
- Opens the door to Llama 3.1 13B Q4 (7.5GB), Mistral 7B variants, Qwen2.5 14B Q4 (8.2GB)

> **Question for Grizz:** Which storage tier is your iPad? Storage model = RAM model. Check Settings → General → About → Capacity.

---

## SECTION 2: THE iOS OBSTACLE AND THE WORKAROUNDS

### What iOS Blocks

Apple's App Store policies explicitly prohibit apps that:
- Bind long-running network listeners to LAN interfaces
- Act as servers to other applications
- Run as background daemons

This means no App Store app exposes a proper OpenAI-compatible `/v1/chat/completions` endpoint on your LAN. The LLM apps that exist (LLMFarm, LLM Farm, PocketPal) are chat UIs — they do inference locally but don't serve it.

This is a policy constraint, not a hardware constraint. The M5 is fully capable. We just need to get around the distribution rules.

### Option A: PocketPal AI v1.13.0 — Try First, Costs Nothing

**PocketPal AI** (GitHub: `a-ghorbani/pocketpal-ai`) merged an experimental feature titled "OpenAI-compatible remote server support" in version 1.13.0 (March 2026).

- Available on the App Store (free)
- Uses llama.cpp backend with Metal acceleration
- Supports GGUF models (same format as CT-105)
- The remote server feature is explicitly documented in their GitHub issues and changelog

**The catch:** This feature was primarily developed with Android in mind. iOS's background restrictions may limit it to foreground-only operation, or it may work when the screen is on. The exact iOS behavior of v1.13.0's server mode is undocumented as of this report.

**Recommended test procedure:**
1. Install PocketPal AI from the App Store
2. Load Gemma 3n E2B Q8 (or any GGUF model via HuggingFace Hub download in-app)
3. Look for a "Server" or "API Mode" toggle in settings
4. If present, enable it and note the port it binds to (likely 8080 or 5000)
5. From CT-101: `curl http://[iPad-IP]:[port]/v1/models`
6. If that responds, update `LFM_URL` on CT-101 and run a live inference test

**Cost:** Free. Time: 30 minutes. Risk: May not work on iOS. Worth trying first.

---

### Option B: Sideloaded Custom App — The Proper Solution

If PocketPal's server mode doesn't work on iOS, the next option is a sideloaded app. Sideloading means installing an IPA directly from Xcode or AltStore, bypassing the App Store sandbox rules.

**What sideloaded apps can do that App Store apps cannot:**
- Bind to LAN interfaces and serve HTTP traffic
- Run in background with Background App Refresh entitlements
- Use com.apple.developer.networking.multicast for mDNS service discovery

**The two sideloading paths:**

#### Path B1: AltStore (Free Apple ID)
- Install AltStore on your Mac and iPad (~20 min setup)
- Sign and install a custom IPA using your free Apple ID
- **Limitation:** Certificate expires every 7 days. AltStore auto-renews if your Mac is on the same network at expiry time
- For a 24/7 server, this is fragile — if your Mac is off when the cert expires, the iPad stops serving

#### Path B2: Apple Developer Account ($99/year) — Recommended
- Paid developer certificate lasts 1 year
- No dependency on your Mac being nearby
- Deploy the app to the iPad once, runs for a year without re-signing
- Also enables background fetch entitlements for proper persistent background operation

**What you'd build/deploy (SwiftLM approach):**

SwiftLM (GitHub: `SharpAI/SwiftLM`, March 2026) is a native Swift MLX inference server with a full OpenAI-compatible HTTP API. It's currently built for macOS arm64, but can be adapted for iPadOS. The API it exposes:

```
GET  /health                   → server status
GET  /v1/models                → list loaded models  
POST /v1/chat/completions      → inference (streaming + non-streaming)
GET  /metrics                  → Prometheus metrics
```

This is exactly what CT-101's sidecar needs — the same interface as CT-105's llama-server.

**Alternative approach:** Fork LLMFarm's Swift library (`llmfarm_core.swift`) and add a Vapor or Hummingbird HTTP server layer. LLMFarm already has Metal-accelerated llama.cpp inference working on iOS — it's just missing the network serving layer. Estimated dev effort: 2–4 hours for someone who knows Swift.

---

### Option C: The Nuclear Option — Don't Serve from iOS, Mirror from Mac

If iOS proves intractable, there's a bridge approach:
- Run Ollama on your MacBook (it's already installed)
- Ollama binds to `0.0.0.0:11434` with `OLLAMA_HOST=0.0.0.0`
- CT-101's `LFM_URL` points to your Mac's LAN IP instead of CT-105
- iPad Pro M5 stays available as a GPU-accelerated workstation for other tasks

This doesn't use the iPad as server, but it does use a much better inference machine (your Mac with its own Apple Silicon) while keeping iPad in reserve. Not the original vision, but a valid intermediate state.

---

## SECTION 3: INTEGRATION ARCHITECTURE

### Current Stack

```
[User/Discord] 
      ↓
[CT-101 sidecar (Node.js)]
  - somatic-monitor.ts
  - psyche.ts
  - bridge.ts (Convex memory)
      ↓ LFM_URL=http://192.168.7.123:8081/v1
[CT-105 llama-server]
  - Gemma 3n E2B Q8
  - OpenCL/RX 580
  - 3.53 t/s
```

### Proposed Stack (iPad as Inference Server)

```
[User/Discord]
      ↓
[CT-101 sidecar (Node.js)]  ← unchanged
      ↓ LFM_URL=http://[iPad-IP]:[port]/v1
[iPad Pro M5 — PocketPal API or SwiftLM sideload]
  - Gemma 3n E2B Q8 (or better model)
  - M5 Neural Engine + GPU
  - ~45–60 t/s
  
[CT-105] → standby/decommission
[Proxmox] → only needs to run CT-101 (very low compute)
```

### What Changes on CT-101

One environment variable:

```bash
# Current
LFM_URL=http://192.168.7.123:8081/v1

# New (replace with iPad's static IP and whatever port the app uses)
LFM_URL=http://192.168.7.XXX:[port]/v1
```

Everything else in the sidecar — somatic-monitor, psyche, bridge, lfmModelChain — stays identical. The sidecar doesn't care what hardware is doing inference, only that the endpoint speaks OpenAI protocol.

**Assign the iPad a static DHCP lease on your router** (use iPad's MAC address). Otherwise its IP drifts and the sidecar breaks. This is a 2-minute router config task.

---

## SECTION 4: RISKS AND TRADE-OFFS

### The Real Risks (Not the Theoretical Ones)

**1. iOS Background Behavior — The Single Biggest Risk**  
iPadOS aggressively kills background processes to preserve battery. Even with Background App Refresh enabled, an inference server running without a foreground UI is fighting the OS scheduler. If the iPad goes to sleep, the server goes with it.

*Mitigation:* Use Guided Access to lock the screen to the app, or configure Display Never Sleep in accessibility settings. The iPad needs to either stay awake or the server needs true background execution entitlements (requires dev cert sideload). This is solvable but needs active management.

**2. 24/7 Plugged-In Operation — Thermal and Longevity**  
An iPad plugged in constantly while serving inference requests will thermal-throttle. Apple's power management reduces charge to 80% when the device is always plugged in (Optimized Battery Charging), but heat is still a factor.

*Mitigation:* The M5's efficiency architecture means inference loads are 10–15W vs CT-105's 150W. Heat is far less than you'd expect. Continuous plugged-in use is a known use case (retail deployments, kiosk mode). iPad hardware is rated for it. The battery longevity concern is real over 2–3 years, but manageable.

**3. Single Point of Failure**  
If the iPad fails or needs a reboot, HUGH goes dark. CT-105 currently has this problem too. 

*Mitigation:* Keep CT-105 provisioned as warm standby. `LFM_URL` can be hot-swapped in CT-101's environment in under 2 minutes.

**4. iOS Updates**  
iPadOS updates can break sideloaded apps or change background execution behavior.

*Mitigation:* Disable automatic updates on the iPad. Update deliberately, test the server after each update. With a paid dev cert, you control the deployment timeline.

**5. PocketPal v1.13.0 iOS Server Mode May Be Android-Only**  
The experimental feature might not work on iOS at all. Confirmed iOS behavior is not documented.

*Mitigation:* Test it first. If it doesn't work, move directly to Option B.

---

## SECTION 5: MODEL RECOMMENDATIONS FOR M5

Given the M5's capabilities and HUGH's personality architecture, here's a model upgrade path sorted by priority:

| Model | Size | Est. t/s (M5) | Notes |
|-------|------|---------------|-------|
| **Gemma 3n E2B Q8** | 4.5GB | ~55 t/s | Current model — immediate drop-in, huge speed gain |
| **Gemma 3 4B Q8** | 4.0GB | ~60 t/s | Better reasoning than 3n E2B, similar size |
| **Llama 3.1 8B Q4_K_M** | 4.7GB | ~45 t/s | Strong all-rounder, very capable |
| **Qwen 2.5 7B Q5_K_M** | 5.1GB | ~42 t/s | Excellent instruction following |
| **Phi-3.5 Mini Q8** | 2.2GB | ~80 t/s | Fastest possible, surprisingly capable |
| **Gemma 3 12B Q4** | 6.8GB | ~25 t/s | If 16GB RAM — significant quality jump |
| **Llama 3.1 13B Q4** | 7.5GB | ~22 t/s | If 16GB RAM — strong long-context performance |

All of these are in GGUF format and loadable by PocketPal, LLMFarm, and any llama.cpp-based server.

---

## SECTION 6: DECISION MATRIX

### What Grizz Needs to Decide Before We Proceed

**Decision 1: iPad storage tier?**  
Check Settings → General → About → Capacity. 256GB or 512GB = 12GB RAM. 1TB or 2TB = 16GB RAM. Changes which models are viable.

**Decision 2: Are you willing to spend $99/year on an Apple Developer account?**  
- Yes: Full sideload capability, 1-year certs, background execution entitlements. Clean solution.
- No: Try PocketPal v1.13.0 first (free), fall back to AltStore (free but 7-day cert renewal headache), or use Option C (Mac as inference server).

**Decision 3: Decommission CT-105 or keep as standby?**  
- Decommission: Frees the GPU, reduces noise/power, simplifies stack
- Standby: Safe fallback if iPad has issues. CT-105 costs about 150W sitting idle on Proxmox.

### Recommendation

1. **Tonight:** Install PocketPal v1.13.0 on the iPad. Load Gemma 3n E2B Q8. Test the server mode. This costs zero dollars and 30 minutes.
2. **If server mode works:** Assign iPad a static DHCP lease, update `LFM_URL` on CT-101, run HUGH against it. Done.
3. **If server mode is iOS-blocked:** Get the Apple Developer account ($99). I'll walk you through building the sideloaded server app. SwiftLM + GCDWebServer is a clean path and I can draft the implementation guide.
4. **CT-105:** Keep it provisioned but powered off until the iPad stack is stable for 48 hours. Then decide.

---

## APPENDIX: QUICK REFERENCE

### PocketPal AI Test Commands (from CT-101)
```bash
# Test connectivity (replace with iPad's actual IP and port)
curl http://192.168.7.XXX:8080/v1/models

# Test inference
curl http://192.168.7.XXX:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"current","messages":[{"role":"user","content":"ping"}],"max_tokens":5}'
```

### CT-101 Environment Update (when ready)
```bash
# SSH to CT-101
pct exec 101 -- bash

# Edit .env
nano /root/.env
# Change: LFM_URL=http://[iPad-IP]:[port]/v1
# Note: NO trailing /v1 is needed if the app includes it in endpoint paths
# Confirm with: curl $LFM_URL/models

# Restart sidecar
export LFM_URL=http://[iPad-IP]:[port]/v1
/usr/local/lib/node_modules/pm2/bin/pm2 delete somatic-monitor
/usr/local/lib/node_modules/pm2/bin/pm2 start /root/dist/sidecar/somatic-monitor.js \
  --name somatic-monitor
```

### Key Links
- PocketPal AI: https://github.com/a-ghorbani/pocketpal-ai
- SwiftLM: https://github.com/SharpAI/SwiftLM
- LLMFarm Core: https://github.com/guinmoon/llmfarm_core.swift
- AltStore: https://altstore.io
- Apple Developer Program: https://developer.apple.com/programs/

---

*Report compiled from: iPad Pro M5 hardware specs (Apple newsroom, Oct 2025), MacStories MLX benchmarks, PocketPal AI GitHub issues #203/#259/#407 + v1.13.0 release notes, SwiftLM GitHub (March 2026), LLMFarm GitHub, AltStore documentation, session memory (CT-101 PM2 paths, LFM_URL format, sidecar architecture).*
