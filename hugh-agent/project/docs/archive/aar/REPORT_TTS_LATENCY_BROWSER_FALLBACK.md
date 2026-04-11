# TTS Latency Report — Browser Fallback as Primary Voice

**Date:** 2026-04-01  
**Author:** Copilot (Opus 4.6)  
**Status:** Active constraint — needs solution

---

## The Problem

LFM 2.5 Audio running on CT-105 (i5-7500, 4 threads, CPU-only) takes **~60 seconds** to synthesize speech for a single short sentence. This is the full pipeline:

1. Text response from llama-heretic: **6–20 seconds** (acceptable)
2. TTS via llama-liquid-audio: **~60 seconds** (not acceptable for real-time conversation)

A stranger standing at the kiosk says "who are you?" and waits **~75 seconds** for voice. Text appears in 6–20s, but voice lags massively. That's not a conversation — it's a voicemail.

## What's Deployed Right Now

The gateway streams TTS via SSE (`delta.audio_chunk.data`) and forwards chunks over WebSocket to the browser for progressive playback. In theory, this means the first audio plays before the full synthesis completes. In practice, llama-liquid-audio appears to batch-generate the full waveform before emitting chunks — so streaming buys us almost nothing on this hardware.

**Current fallback:** Browser Web Speech API using the `en-IE` (English Ireland) male voice. This fires **instantly** when the text response arrives. It works. It sounds like Siri's Irish voice (which Grizz already uses). But it's not HUGH's voice — it's Apple's.

## Numbers

| Metric | Value |
|--------|-------|
| LFM Audio model | LFM2.5-Audio-1.5B-Q8_0.gguf |
| Vocoder | vocoder-Q8_0.gguf |
| CPU | Intel i5-7500 (4C/4T, 3.4GHz) |
| Threads allocated | 4 |
| Output format | PCM float32 → int16 WAV, 24kHz mono |
| Time for ~15 words | ~60 seconds |
| Browser TTS time | <1 second |
| Streaming benefit | Negligible (model batches internally) |

## Why It's Slow

The i5-7500 is a 4-core/4-thread desktop CPU from 2017. No AVX-512, no GPU. The audio model (1.5B Q8_0) plus vocoder plus speaker tokenizer is doing full neural inference on every token — and audio tokens are dense (24,000 samples/second at 24kHz).

For comparison: the text model (heretic.gguf, also on this CPU) generates ~50 tokens in 7–55 seconds. The audio model has to generate thousands of audio tokens for a few seconds of speech. The math doesn't work on this CPU.

## Options to Consider

### 1. Lighter TTS Model
Replace LFM Audio TTS with a purpose-built, faster TTS engine:
- **Piper TTS** — C++ ONNX runtime, generates speech in real-time on CPU. ~0.5s for a sentence on i5. Scottish voices available via fine-tuned VITS models. Can run as a sidecar service.
- **Kokoro TTS** — Already in the codebase design (af_heart voice). Lightweight, fast on CPU.
- **espeak-ng** — Basically instant but sounds robotic. Not suitable for HUGH.

*Keep LFM Audio for ASR and S2S (where latency is more tolerable), use a fast TTS engine for text-to-speech.*

### 2. GPU Acceleration
The Radeon Pro 570 in the iMac chassis could run TTS. If GPU passthrough to a VM or container with ROCm/Vulkan works:
- LFM Audio TTS would drop from ~60s to ~2-5s
- This also accelerates the text model
- **Blocker:** GPU passthrough to CT-105 (LXC) isn't trivial. VM-103 already has GPU plans for UE5.

### 3. Hybrid Architecture
- Browser TTS (en-IE) for **immediate** feedback (0–1s)
- LFM Audio generates in background
- When native audio is ready, cache it for replay or use it for the *next* interaction's greeting
- Over time, pre-generate common phrases ("Aye, what do you need?", "Give me a moment", etc.)

### 4. Offload to a Faster Node
If there's ever a second machine (even a cheap mini-PC with an iGPU), dedicate it to TTS. The gateway already supports `LFM_AUDIO_URL` as an env var — point it anywhere.

### 5. Accept Browser TTS for Now
The en-IE male voice is actually decent. Grizz already uses it for Siri. For the ARC-AGI 3 competition, the voice isn't scored — the reasoning is. Ship with browser TTS, solve voice quality post-competition.

## My Recommendation

**Short term (ship stranger-ready):** Option 5. Browser TTS works, sounds acceptable, is instant. Don't let TTS latency block the whole system.

**Medium term (pre-competition):** Option 1. Piper TTS is battle-tested, runs on CPU in real-time, and has a fine-tuning pipeline for custom voices. It could live alongside LFM Audio — Piper handles TTS, LFM handles ASR/S2S.

**Long term (post-competition):** Option 2 or 4. GPU acceleration or dedicated hardware solves the fundamental constraint.

## What's Already Wired

The gateway and player.html are architected for this to be swappable:
- `streamTTS()` in the gateway is a single function — swap the backend URL or implementation
- WebSocket protocol sends `{ type: "audio", data: "<base64>" }` — any TTS engine that produces PCM can plug in
- Player.html plays whatever audio chunks arrive — doesn't care about the source
- Browser TTS fallback activates automatically when no native audio arrives within 2 seconds

No code changes needed to swap TTS engines. Just deploy a new service and update `LFM_AUDIO_URL`.

---

*Filed for Grizz's review. The architecture is ready for any of these solutions — the bottleneck is purely hardware/model, not code.*
