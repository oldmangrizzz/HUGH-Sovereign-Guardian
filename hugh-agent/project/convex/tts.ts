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

  const model  = process.env.HUGH_TTS_MODEL  ?? "lfm-2.5-audio";
  const voice  = process.env.HUGH_VOICE_ID   ?? "uk_male";

  try {
    // Gateway routes /v1/audio/speech to LFM 2.5 Audio server (speech-to-speech)
    const response = await openai.audio.speech.create({
      model,
      voice: voice as Parameters<typeof openai.audio.speech.create>[0]["voice"],
      input: cleanText,
      response_format: "wav",
    });

    const buffer = await response.arrayBuffer();

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
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
