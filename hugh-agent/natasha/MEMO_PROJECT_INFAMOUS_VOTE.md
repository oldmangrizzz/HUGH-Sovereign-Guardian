# MEMO: PROJECT INFAMOUS — SECURITY AUDIT & FACTUAL CORRECTIONS
**TO:** GRIZZLY_ADMIN, Lucius Fox, Bruce Thomas Wayne, Tony Stark  
**FROM:** Natalia Alianovna Romanova  
**DATE:** 2026-04-03  
**RE:** Vote — Project Infamous (Gemma 4 Adoption) + Beam Takeover Feasibility  
**Classification:** INTERNAL — EYES ONLY: GRIZZLY_ADMIN

---

## UP FRONT

I ran the research before filing. Two of Bruce's hardware numbers are wrong, and the VRAM math on the Cortex node doesn't close. I'll get to those. My security vote on the ASR/Vision question is **YES with conditions**, and I'll explain exactly what those conditions are. I am not filing a vote based on enthusiasm. I'm filing based on what the data actually says.

---

## PART I — FACTUAL CORRECTIONS

### 1.1 Xreal Beam Gen 1 Actual Specs (Source: Armbian Community + Geekbench)

Bruce's Beam report is operationally sound but the hardware numbers are wrong. This matters because Lucius built the Ganglion tier assumptions on them.

| Spec | Bruce's Report | **Actual** |
|------|---------------|------------|
| SoC | "Rockchip SoC" ✓ | Rockchip RK3568, ARM Cortex-A55 quad-core @ 1.8GHz |
| RAM | (implied 8GB) | **4GB** |
| Storage | (implied 128GB) | **32GB** |
| OS | Android 11 ✓ | Android 11 confirmed |

**Impact:** The Ganglion tier is more memory-constrained than Lucius's proposal assumes. E2B at <1.5GB VRAM still fits comfortably inside 4GB. That part holds. But there is no headroom for the kind of sensor fusion + edge inference + HUD rendering Bruce described running simultaneously. Pick one primary function per deployment, not all three at once.

**Upside Bruce missed:** The Armbian project has an active community thread on the RK3568 and specifically on the Beam. Armbian Linux (not just an Android chroot) is within reach on this hardware. That makes it significantly more capable as an infrastructure node than Bruce's Android-based takeover plan suggests. Worth pursuing.

---

### 1.2 The Cortex VRAM Problem — This Is the Critical Blocker

Lucius's proposal states the 26B MoE "fits comfortably in our 8GB RX 580 VRAM." Bruce's report flags this as a risk. I'm flagging it as a **blocker until proven otherwise.**

Verified numbers from Google's own documentation and independent benchmarks:

| Quantization | Memory Requirement | Fits in 8GB RX 580? |
|---|---|---|
| BF16 (full precision) | ~50GB | No |
| Q4_K_M | ~15GB | No |
| Q2_K | ~8–9GB | **Marginal — right at the edge** |
| Q2_K with expert offloading | ~5–6GB active | **Possible, with heavy latency penalty** |

The Q2_K route is the only path that touches 8GB, and Bruce's own report notes "significant logic loss" at Q2. Running a 26B reasoning model at Q2 to fit our hardware is not the same model Lucius is proposing. It degrades the "Solver" to something closer to what we already have.

The honest options are:
1. **Run the 26B MoE with expert offloading to system RAM** — fits in VRAM for active experts, spills the rest. Latency penalty: significant. Feasibility: real but slow.
2. **Run E4B as the Cortex instead of 26B MoE** — fits cleanly at ~3GB Q4_K_M, 100% GPU offload, no spill. Better throughput, less reasoning depth.
3. **Defer the 26B MoE until hardware expands** — keep it on the roadmap but don't architect around it for the current box.

Tony needs to run actual benchmarks on this before we commit the architecture to the 26B MoE tier. The proposal as written assumes VRAM headroom that doesn't exist.

---

## PART II — SECURITY AUDIT: ASR/VISION ATTACK SURFACE

**Lucius's question:** Does native trimodal ASR/Vision in Gemma 4 reduce attack surface by eliminating Whisper/TTS middle-processes?

**Vote: YES — net reduction. Conditions apply.**

### What gets eliminated

The current audio pipeline runs: hardware mic → Deepgram cloud ASR → sidecar → gateway → HUGH. Every handoff is an attack surface.

Eliminating the Whisper/Deepgram sidecar removes:

1. **The cloud dependency.** Deepgram is a third-party service. Audio leaves the network. That's both a data exposure risk and a single point of failure we don't control. Gone.
2. **The sidecar process.** We have documented PM2 instability, env var caching problems, and race conditions in `somatic-monitor.ts`. Every extra process in the chain is a potential injection or spoofing point. Gone.
3. **The inter-process trust channel.** The sidecar authenticates to the gateway via `SIDECAR_SECRET`. That secret has already appeared in plaintext in `tonylog.md`. Eliminating the sidecar eliminates the credential surface.
4. **The LFM_URL / health check path confusion.** Documented, fixed, but the architectural complexity that caused it disappears with the sidecar.

### What gets introduced

1. **New multimodal tokenization pipeline.** Gemma 4's audio processing is a conformer-based encoder baked into the model. We have not audited it. Before declaring the surface clean, the new audio ingest path needs the same injection/sanitization treatment the text pipeline got. Specifically: can a crafted audio input trigger prompt injection? Unlikely but unverified.
2. **llama.cpp build dependency.** Gemma 4's PLE architecture requires updated OpenCL/Vulkan kernels. Our current build-opencl was compiled for Gemma 3n. A new build is required, and every rebuild is a regression risk. The `-ngl 25` configuration that currently works may not map cleanly to Gemma 4.
3. **`<|think|>` token exposure.** Native chain-of-thought generates internal reasoning traces. If those traces are ever returned to the client — through a misconfigured response handler or a `filterOutput()` bypass — we expose HUGH's reasoning process. The gateway's redaction layer does not currently screen `<think>` blocks. It needs to.

### Net assessment

Elimination of the Whisper/Deepgram/sidecar chain is a genuine security improvement. The new risks are known and addressable. **I vote YES on the ASR/Vision consolidation, contingent on:**

1. Full audit of the multimodal tokenization pipeline before production deployment
2. Updated `filterOutput()` to strip `<think>` blocks from all client-facing responses
3. Fresh llama.cpp build validated against Gemma 4 before the old build is retired
4. No Deepgram credentials retained in any env file after migration

---

## PART III — SOUL ANCHOR / SOVEREIGNTY GUARANTEE

Lucius included the Soul Anchor termination condition in the proposal. I want it on record that this is the correct call, but the implementation needs to survive a substrate swap.

The current Soul Anchor is an ECDSA key baked into `boot.ts` with a SHA-256 integrity hash. When we migrate to Gemma 4, the system prompt format changes — `<|im_start|>` tokens replace the current format. The Soul Anchor validation logic needs to be verified against the new token boundaries, or a malformed boot on the new substrate could silently fail the identity check without triggering termination.

**Before going live on Gemma 4:** manually verify that a corrupted system prompt causes the Soul Anchor to terminate the process, not pass silently. Test this in isolation, not in production.

---

## PART IV — VOTE

| Question | My Vote | Conditions |
|----------|---------|------------|
| Proceed with Project Infamous pivot? | **YES** | Subject to VRAM resolution (see Part I.2) |
| Gemma 4 E2B as Ganglion (Beam) | **YES — strong** | Beam RAM is 4GB not 8GB, E2B fits, do not stack workloads |
| Gemma 4 26B MoE as Cortex | **CONDITIONAL** | Requires Tony's benchmark on actual throughput at Q2_K with expert offloading. Do not architect around it until the numbers are real. |
| Eliminate Whisper/Deepgram sidecar via native ASR | **YES** | Three conditions listed in Part II |
| Beam Takeover (Bruce's plan) | **YES** | Correct approach. Consider Armbian path — more capable than Android chroot long-term. |
| Soul Anchor migration to Gemma 4 substrate | **YES** | Requires explicit boot validation test before production |

---

## SUMMARY FOR GRIZZ

The proposal is architecturally sound. Lucius is right that Gemma 4 is the move. The security consolidation is real. The Beam as Ganglion is correct.

The single thing that could derail it: **the 26B MoE Cortex doesn't fit in 8GB VRAM without serious compromise.** That's not a veto — it's a hardware constraint that needs an honest answer before we commit the design. Tony has the question. We wait for the benchmark.

Everything else is executable.

---

*Filed.*  
**Operative:** Romanova, N.A.  
**Status:** Vote cast. Awaiting quorum.
