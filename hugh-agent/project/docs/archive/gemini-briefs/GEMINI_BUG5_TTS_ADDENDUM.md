# BUG 5 ADDENDUM — LFM TTS IMPLEMENTATION
**For: Gemini**
**Status: UNBLOCKED. Stop asking about KVM2.**

---

## READ THIS BEFORE ANYTHING ELSE

The previous brief said this was "blocked pending KVM2 details." That was wrong. Forget KVM2. Forget which physical node the audio model runs on. **That is not your concern and never was.**

This system is node-agnostic by design. HUGH's intelligence stack runs across whatever nodes are available. The physical location of any model is an env var — you never hardcode it, you never ask about it, you read the env var and move on. This is the same pattern already used for the LLM gateway. You are going to follow that exact same pattern for TTS. Not a new pattern. The same one.

---

## THE EXISTING PATTERN (already deployed — read it)

`convex/openai.ts`:
```typescript
import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: process.env.HUGH_GATEWAY_URL ?? process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.HUGH_GATEWAY_KEY ?? process.env.CONVEX_OPENAI_API_KEY ?? "dummy-key-for-analysis",
});
```

That's it. The gateway URL is an env var. The client is shared across all Convex functions. The LLM inference in `convex/hugh.ts` uses `openai.chat.completions.create()`. TTS uses `openai.audio.speech.create()` on the **same client, same gateway**. Done.

If the gateway serves both LLM and TTS (which it does — llama-server / Ollama-compatible servers expose `/v1/audio/speech` alongside `/v1/chat/completions`), you don't need a separate URL. You don't need a separate client. You need two new optional env vars with sane defaults and about 40 lines of code.

---

## WHAT YOU ARE BUILDING

1. **`convex/tts.ts`** — A new Convex HTTP action that accepts text, calls the TTS model via the existing `openai` client, returns audio bytes.
2. **`convex/router.ts`** — Add `POST /api/tts` route pointing at that action.
3. **`src/HughKioskDisplay.tsx` + `src/HughChat.tsx`** — Replace the `speak()` function to POST to `/api/tts`, receive the audio, play it. Keep browser `speechSynthesis` as fallback.

No new dependencies. No new packages. No new infrastructure. The gateway is already running.

---

## STEP 1 — Create `convex/tts.ts`

```typescript
"use node";
/**
 * tts.ts — H.U.G.H. speech synthesis via the inference gateway
 *
 * Uses the same OpenAI-compatible client as the LLM layer.
 * The gateway at HUGH_GATEWAY_URL exposes /v1/audio/speech.
 *
 * Env vars (set in Convex dashboard, same place as HUGH_GATEWAY_URL):
 *   HUGH_TTS_MODEL   — TTS model name (default: "kokoro")
 *   HUGH_VOICE_ID    — Voice ID / reference name (default: "af_heart")
 *
 * Returns: audio/mpeg bytes as a Response
 */

import { httpAction } from "./_generated/server";
import { openai } from "./openai";

export const synthesize = httpAction(async (_ctx, req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  }

  let text: string;
  try {
    const body = await req.json() as { text?: string };
    text = (body.text ?? "").trim();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!text) {
    return new Response(JSON.stringify({ error: "text required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Strip artifacts before speaking
  const cleanText = text
    .replace(/<KVM_EXEC>[\s\S]*?<\/KVM_EXEC>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .replace(/\[.*?\]/g, "")
    .trim();

  if (!cleanText) {
    return new Response(JSON.stringify({ error: "nothing to speak after cleaning" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const model  = process.env.HUGH_TTS_MODEL  ?? "kokoro";
  const voice  = process.env.HUGH_VOICE_ID   ?? "af_heart";

  try {
    // openai client points at HUGH_GATEWAY_URL — same gateway as LLM
    // The gateway exposes /v1/audio/speech alongside /v1/chat/completions
    const response = await openai.audio.speech.create({
      model,
      voice: voice as Parameters<typeof openai.audio.speech.create>[0]["voice"],
      input: cleanText,
      response_format: "mp3",
    });

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[TTS] synthesis failed:", msg);
    // Return 503 so the frontend knows to fall back to browser TTS
    return new Response(JSON.stringify({ error: msg }), {
      status: 503,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  }
});
```

---

## STEP 2 — Add route to `convex/router.ts`

Add these two entries **before** `export default http` at the bottom of `router.ts`. Do not rewrite the file. Insert them:

```typescript
// ── POST /api/tts ──────────────────────────────────────────────────────────
import { synthesize } from "./tts";

http.route({
  path: "/api/tts",
  method: "POST",
  handler: synthesize,
});

http.route({
  path: "/api/tts",
  method: "OPTIONS",
  handler: synthesize,
});
```

---

## STEP 3 — Replace `speak()` in `HughKioskDisplay.tsx`

The `speak` function is inside the `HughKioskInner` component. Find it and replace it entirely:

```typescript
// ── Constants ─────────────────────────────────────────────────────────────
// Convex HTTP endpoint base — same deployment the app already talks to.
// VITE_CONVEX_URL is set at build time (e.g. https://effervescent-toucan-715.convex.cloud)
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string ?? "";

// ── speak() ───────────────────────────────────────────────────────────────
const speak = useCallback(async (text: string) => {
  const cleanText = text
    .replace(/<KVM_EXEC>[\s\S]*?<\/KVM_EXEC>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  if (!cleanText) return;

  // Attempt LFM TTS via Convex gateway proxy
  if (CONVEX_URL) {
    try {
      const res = await fetch(`${CONVEX_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: cleanText }),
      });

      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended  = () => URL.revokeObjectURL(url);
        audio.onerror  = () => URL.revokeObjectURL(url);
        await audio.play().catch(() => {});
        return; // success — skip browser fallback
      }
      // Non-2xx → fall through to browser TTS
      console.warn("[HUGH TTS] gateway returned", res.status, "— falling back to browser TTS");
    } catch (err) {
      console.warn("[HUGH TTS] fetch failed:", err, "— falling back to browser TTS");
    }
  }

  // ── Fallback: browser speechSynthesis ─────────────────────────────────
  if (!synthRef.current) return;
  synthRef.current.cancel();
  const utt = new SpeechSynthesisUtterance(cleanText);
  const voices = synthRef.current.getVoices();
  const preferred = voices.find(v =>
    v.name.includes("Daniel") ||
    v.name.includes("Google UK English Male") ||
    v.lang.startsWith("en-GB")
  );
  if (preferred) utt.voice = preferred;
  utt.rate = 0.95;
  utt.pitch = 0.9;
  synthRef.current.speak(utt);
}, []);
```

`synthRef` already exists in `HughKioskInner` — do not remove it, the fallback needs it.

---

## STEP 4 — Replace `speak()` in `HughChat.tsx`

Same pattern. Find the `speak` callback and replace:

```typescript
const CONVEX_URL = import.meta.env.VITE_CONVEX_URL as string ?? "";

const speak = useCallback(async (text: string) => {
  if (CONVEX_URL) {
    try {
      const res = await fetch(`${CONVEX_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url  = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        audio.onerror = () => URL.revokeObjectURL(url);
        await audio.play().catch(() => {});
        return;
      }
    } catch {}
  }
  // fallback
  if (!synthRef.current) return;
  synthRef.current.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  const voices = synthRef.current.getVoices();
  const preferred = voices.find(v =>
    v.name.includes("Daniel") ||
    v.name.includes("Google UK English Male") ||
    v.lang === "en-GB"
  );
  if (preferred) utt.voice = preferred;
  utt.rate = 0.88; utt.pitch = 0.85; utt.volume = 1;
  utt.onstart = () => setIsSpeaking(true);
  utt.onend   = () => setIsSpeaking(false);
  utt.onerror = () => setIsSpeaking(false);
  synthRef.current.speak(utt);
}, []);
```

---

## STEP 5 — Env vars to set in Convex dashboard

Go to the Convex dashboard → Settings → Environment Variables. Add:

| Key | Value | Notes |
|-----|-------|-------|
| `HUGH_TTS_MODEL` | `kokoro` | Or whatever TTS model name is loaded at the gateway |
| `HUGH_VOICE_ID` | `af_heart` | Or the voice ID Grizz specifies |

`HUGH_GATEWAY_URL` and `HUGH_GATEWAY_KEY` are already set. **Do not touch them.**

---

## WHAT HAPPENS IF THE GATEWAY DOESN'T SUPPORT `/v1/audio/speech` YET

The TTS action returns 503. The frontend catches it and falls back to browser `speechSynthesis`. HUGH keeps talking, just with the browser voice instead of LFM audio. No silence, no crash, no broken state. When the gateway is updated to serve the audio model, it works automatically on the next request — zero frontend changes needed.

This is why the fallback exists. Do not remove it.

---

## SUMMARY — FILES CHANGED

| File | Change |
|------|--------|
| `convex/tts.ts` | **CREATE** — new TTS httpAction |
| `convex/router.ts` | **EDIT** — add `/api/tts` POST + OPTIONS routes |
| `src/HughKioskDisplay.tsx` | **EDIT** — replace `speak()` callback |
| `src/HughChat.tsx` | **EDIT** — replace `speak()` callback |

No new packages. No new infrastructure. No questions about which node. The gateway is already there. Wire it in and deploy.

---

*Addendum to GEMINI_BRIEF_HUGH_FIXES.md — read both documents.*
