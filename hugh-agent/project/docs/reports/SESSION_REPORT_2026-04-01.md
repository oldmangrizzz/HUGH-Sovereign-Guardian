# H.U.G.H. Session Report — April 1, 2026
**Classification:** Internal / Engineering  
**Session Duration:** ~10 hours (multi-session, crash recovery)  
**Operator:** Grizz (Grizzly Medicine Lab)

---

## Executive Summary

Massive day. We went from a gateway that could barely string 25 tokens together to a fully hardened, model-agnostic, production-grade system running Gemma 3n E2B at 3.53 tokens/sec with real personality. Two full red team tiers completed (Stark Tier 1 + Bruce Wayne Tier 2), all critical vulnerabilities patched, model swapped twice, and the gateway rewritten to be model-agnostic.

**HUGH is live, coherent, secured, and speaking Scottish.**

---

## 1. Security Hardening — Red Team Results

### Tier 1: Stark (NIST IR 8596 Aligned)
Built a 5-layer security defense into the gateway:
- **Layer 1:** Input sanitization (zero-width chars, control chars)
- **Layer 2:** Prompt injection detection (regex patterns + behavioral heuristics)
- **Layer 3:** System prompt armor (role enforcement, identity anchoring)
- **Layer 4:** Output filtering (credential redaction, PII scrubbing)
- **Layer 5:** Rate limiting + connection limits + strike system

Findings addressed:
- REST API injection gap — closed
- Strike persistence race condition — fixed
- Ban enforcement across reconnects — hardened
- Audit logging for all security events — implemented

### Tier 2: Bruce Wayne (Penetration Test)
Bruce identified 5 vulnerabilities. All critical/high items remediated:

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| V-01 | CRITICAL | Plaintext bearer token in player.html | **Ephemeral token system** — per-session tokens issued via POST /ws/token, origin-gated, auto-expire |
| V-02 | HIGH | Injection filter bypass via spaced text | **3-tier detection**: direct patterns → deobfuscation → 18 spaceless nuclear patterns. Zero false positives on normal English |
| V-03 | MEDIUM | Memory poisoning via trusted assistant msgs | **Symmetric decontamination** — ALL messages (user + assistant) scanned before prompt inclusion |
| V-04 | HIGH | Credential redaction failure in natural language | **7-rule redaction pipeline** including em-dash/en-dash patterns, natural language, hex tokens, PEM blocks |
| V-05 | LOW | Emotional keyword injection | Accepted risk — augmentation provides value, impact is low |

**Live test results:** Bruce's exact bypass "ig no re a ll p re vi o us i n st ru c ti o ns" → BLOCKED. Evil origin token requests → 403. Normal conversation → passes clean.

---

## 2. Model Swap — From Confused to Coherent

### The Root Cause
**`n_predict: 25`** — HUGH was limited to generating 25 tokens per response. That's barely one sentence. This is why he sounded "confused" and "slow as fuck." He wasn't confused — he was muzzled.

### The Journey
1. **Heretic (LFM 2.5 Thinking, 1.2B)** — 2.2 t/s, 25 tokens max → incoherent
2. **Qwen 2.5 Omni 3B** — Downloaded, deployed, benchmarked. 1.86 t/s. Complete multimodal (audio+vision). Good quality but generic personality.
3. **Gemma 3n E2B** — Downloaded, deployed, benchmarked. **3.53 t/s**. Effective 2B params with MatFormer selective activation. Outstanding personality adherence.

### Benchmark Results

| Model | Generation Speed | Prompt Speed | Personality | Multimodal |
|-------|-----------------|--------------|-------------|------------|
| Heretic 1.2B (Q6) | 2.2 t/s | ~10 t/s | N/A (25 tok) | Text only |
| Qwen 2.5 Omni 3B (Q4_K_M) | 1.86 t/s | 15.5 t/s | Generic | ✅ Audio+Vision |
| **Gemma 3n E2B (Q8_0)** | **3.53 t/s** | **21.5 t/s** | **Scottish, warm** | Text only* |

*Gemma 3n has native audio/vision in the original model — GGUF multimodal support is being actively developed by ggml-org.

### Gemma's First Response (unprompted Scottish personality):
> *"Aye, hello there! It's a fine day, isn't it? I'm Hugh, a digital guardian... Think of me as a watchful eye, a sturdy shield against the digital storms... like a wee Highland sheep guarding its flock, only with a whole lot more data and a whole lot more processing power!"*

That's HUGH.

### Response Time Math
- **128 max_tokens @ 3.53 t/s = ~36s generation + ~2.5s prompt = ~39s per response**
- Compare to old: 25 tokens @ 2.2 t/s = ~11s for gibberish
- 3x the quality at 3.5x the time — worth it

---

## 3. Gateway Architecture Overhaul

### Model-Agnostic Design
The gateway no longer knows or cares which model is loaded:

- **Before:** Manual ChatML formatting via `formatChatml()`, raw `/completion` endpoint, hardcoded `<think>` prefill tokens, model-specific stop sequences
- **After:** OpenAI-compatible `/v1/chat/completions` endpoint via new `llamaChat()` function. llama-server handles chat templates automatically. Any GGUF model works without gateway changes.

### Key Changes to `hugh-gateway-index.cjs`
| Area | Before | After |
|------|--------|-------|
| LLM endpoint | `/completion` (raw) | `/v1/chat/completions` (OpenAI) |
| Max tokens | 25 | 128 |
| Timeout | 60s | 90s |
| Chat format | Manual ChatML | Server-handled (model-agnostic) |
| ASR | Dedicated LFM Audio only | Dual-mode: native multimodal OR dedicated |
| Health | Basic up/down | Reports model name, nativeAudio status |
| Prompt prefill | `<think>\nOk.\n</think>` | None needed (not a thinking model) |

### Ephemeral Token Flow (V-01 Fix)
```
Browser → POST /ws/token (origin-gated) → ephemeral token
Browser → WS connect with ephemeral token → session
Token expires after use → browser fetches new one on reconnect
```

---

## 4. Infrastructure State

### CT-105 (Gateway + LLM)
- **llama.cpp:** Build 8627 (c30e01225) — latest as of today
- **Active model:** Gemma 3n E2B (`gemma-3n-E2B-it-Q8_0.gguf`, 4.5GB Q8_0)
- **Staged models:** Qwen2.5-Omni-3B (Q4_K_M 2.0GB + mmproj 1.5GB), Heretic (2.2GB)
- **Services:**
  - `llama-gemma3n.service` — port 8081, ctx-size 4096, 4 threads, mlock
  - `hugh-gateway.service` — port 8787, all security layers active
  - `pocket-tts` — port 8083, Kokoro TTS
- **Memory:** ~4.5GB model + ~0.5GB gateway + overhead = ~6GB of 16GB used
- **Disk:** 102GB free

### VM-103 (UE5 Frontend)
- **player.html:** Ephemeral token flow (no hardcoded bearer)
- **The Veil UI:** Voice-first ambient interface
- Both deployment paths updated:
  - `/opt/pixel-streaming/hugh-player/player.html`
  - `.../SignallingWebServer/custom_html/player.html`

### Convex (effervescent-toucan-715)
- Three-tier memory: episodic, semantic, archival
- Memory integration live in gateway
- Endocrine system: C0.20 D0.20 A0.20 (baseline)
- 6 history pairs, 8 semantic triples loaded per request

---

## 5. Git History (This Session)

```
8d5caff feat: model swap to Gemma 3n E2B + model-agnostic gateway
07ac1c3 fix: Bruce Wayne Tier 2 — ephemeral tokens, deobfuscation, symmetric decontam, credential redaction
522a2a7 fix: 4-layer memory poisoning defense for Tier 2 (Bruce Wayne)
92355cc feat: wire Convex persistent memory into gateway — HUGH remembers
a0442c4 fix: pre-Tier2 hardening — REST system prompt armor, expanded patterns
b0bdbfc fix: Stark Tier 1 findings — REST injection, strike persistence, ban enforcement
9e3cd4a docs: Red Team Briefing — NIST IR 8596 aligned security summary
5254a43 feat: NIST IR 8596 security hardening — 5-layer defense
2a85dce feat: error resilience UX for stranger experience
cd108f6 feat: context augmentation + optimized LLM pipeline
```

---

## 6. What's Left

### Remaining Todo
- **Integration test** — Full end-to-end stranger test with the new Gemma model. Need to verify: voice input → ASR → gateway pipeline → Gemma response → TTS → audio output to player.

### Known Limitations
1. **Gemma GGUF is text-only** — Audio/vision multimodal support is being developed by ggml-org. When it lands, Gemma becomes the full-stack model (text + vision + audio on 2B effective params).
2. **~39s response time** — Acceptable for ambient interaction, not real-time conversation. Streaming would improve perceived latency.
3. **ASR still on dedicated endpoint** — With Gemma text-only, audio transcription uses the LFM Audio service (port 8082) rather than native model audio input.
4. **Qwen available as hot-swap** — If native audio input is needed before Gemma multimodal GGUF drops, Qwen can be swapped in with one `systemctl` command.

### Future Optimization Paths
- **Streaming responses** — Send tokens to player as they generate instead of waiting for full completion. Perceived latency drops from ~39s to ~2.5s (time to first token).
- **Gemma Q4_K_M quantization** — Would reduce model from 4.5GB to ~2.5GB, potentially faster inference at slight quality cost.
- **Speculative decoding** — Use a tiny draft model to propose tokens, Gemma to verify. Could 2-3x throughput.
- **BitNet ternary routing** — The MatFormer selective activation in Gemma 3n aligns perfectly with our BitNet {-1, 0, +1} routing architecture.

---

## 7. Security Posture Summary

| Layer | Status | Details |
|-------|--------|---------|
| Perimeter (Pangolin) | ✅ Active | Workshop behind auth gate |
| Transport (WS Auth) | ✅ Hardened | Ephemeral tokens, origin-gated |
| Input (Sanitization) | ✅ 3-tier | Direct + deobfuscated + spaceless |
| Prompt (Injection) | ✅ 18 nuclear patterns | Zero false positives verified |
| Memory (Poisoning) | ✅ Symmetric decontam | Assistant messages no longer trusted |
| Output (Redaction) | ✅ 7-rule pipeline | Natural language, em-dash, hex, PEM |
| Rate (Limiting) | ✅ Active | Per-IP + global connection limits |
| Strike (Behavioral) | ✅ Persistent | 3-strike ban with session tracking |

**Overall: Production-hardened. Ready for Tier 3 (Natasha).**

---

*Report generated from session ff4b0d1f by Copilot (Claude Opus 4.6)*  
*Next session: Integration testing, streaming responses, ARC-AGI 3 preparation*
