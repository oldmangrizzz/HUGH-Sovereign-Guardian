import { Hono, Context } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import OpenAI from "openai";

type Bindings = {
  LFM_API_KEY: string;
  LFM_BASE_URL: string;
  LFM_GATEWAY_SECRET: string;
  LLAMA_CPP_URL: string;
  CONVEX_URL?: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Auth middleware
app.use("*", async (c, next) => {
  const auth = bearerAuth({ token: c.env.LFM_GATEWAY_SECRET });
  return await auth(c, next);
});

app.get("/health", (c) => c.json({
  status: "online",
  models: ["lfm-2.5-thinking", "lfm-2.5-vision", "lfm-2.5-audio"],
  local_reasoning: !!c.env.LLAMA_CPP_URL
}));

// Multi-path handler for chat completions
const chatHandler = async (c: Context<{ Bindings: Bindings }>) => {
  try {
    const body = await c.req.json();
    const baseURL = c.env.LLAMA_CPP_URL || c.env.LFM_BASE_URL;
    const apiKey = c.env.LLAMA_CPP_URL ? "llama-cpp" : c.env.LFM_API_KEY;

    const openai = new OpenAI({ apiKey, baseURL });
    const response = await openai.chat.completions.create({ 
      ...body, 
      model: "lfm-2.5-thinking" 
    });
    return c.json(response);
  } catch (error: unknown) {
    console.error("[Gateway] Chat completion failed:", error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
};

app.post("/v1/chat/completions", chatHandler);
app.post("/chat/completions", chatHandler);

// Vision (Liquid AI)
app.post("/v1/vision", async (c) => {
  try {
    const body = await c.req.json();
    const openai = new OpenAI({ apiKey: c.env.LFM_API_KEY, baseURL: c.env.LFM_BASE_URL });
    const response = await openai.chat.completions.create({ ...body, model: "lfm-2.5-vision" });
    return c.json(response);
  } catch (error: unknown) {
    console.error("[Gateway] Vision completion failed:", error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Audio (Liquid AI) - Speech to Speech (TTS)
app.post("/v1/audio/speech-to-speech", async (c) => {
  const formData = await c.req.formData();
  const liquidResponse = await fetch(`${c.env.LFM_BASE_URL}/audio/speech-to-speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${c.env.LFM_API_KEY}` },
    body: formData,
  });
  if (!liquidResponse.ok) return c.json({ error: "Liquid AI Audio API failed" }, 500);
  return new Response(liquidResponse.body, {
    headers: { "Content-Type": liquidResponse.headers.get("Content-Type") || "audio/wav" },
  });
});

// Audio (Liquid AI) - Speech to Text (STT/Transcription)
// OpenAI-compatible: POST /v1/audio/transcriptions with FormData (file: audio blob)
app.post("/v1/audio/transcriptions", async (c) => {
  try {
    const formData = await c.req.formData();
    const audioFile = formData.get("file") as File | null;
    const model = formData.get("model")?.toString() ?? "lfm-2.5-audio";
    const language = formData.get("language")?.toString() ?? "en";

    if (!audioFile) {
      return c.json({ error: "audio file required" }, 400);
    }

    // Forward to LFM audio model for transcription
    const sttFormData = new FormData();
    sttFormData.append("file", audioFile);
    sttFormData.append("model", model);
    sttFormData.append("language", language);

    const liquidResponse = await fetch(`${c.env.LFM_BASE_URL}/v1/audio/transcriptions`, {
      method: "POST",
      headers: { Authorization: `Bearer ${c.env.LFM_API_KEY}` },
      body: sttFormData,
    });

    if (!liquidResponse.ok) {
      const errText = await liquidResponse.text();
      console.error("[Gateway] STT failed:", errText);
      return c.json({ error: "STT API failed", details: errText }, 500);
    }

    const result = await liquidResponse.json();
    const transcript = result.text || "";

    // ── WAKE WORD DETECTION ──────────────────────────────────────────────────
    // Check for "Hubert" variants in transcript
    const wakeWordPattern = /\b(hubert|hughbert|hewbert|hewbird|hughbird|hyubert|hugh bert|hugh bird)\b/i;
    if (wakeWordPattern.test(transcript)) {
      console.log("[Gateway] Wake word detected:", transcript);
      
      // Trigger Convex wake word mutation
      const convexUrl = c.env.CONVEX_URL || "https://effervescent-toucan-715.convex.cloud";
      await fetch(`${convexUrl}/api/mutation/appState:triggerWakeWord`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }).catch(err => console.error("[Gateway] Convex trigger failed:", err));
    }

    // ── TRANSCRIPT STORAGE ───────────────────────────────────────────────────
    // Store transcript in Convex for memory synthesis
    const convexUrl = c.env.CONVEX_URL || "https://effervescent-toucan-715.convex.cloud";
    const secret = c.env.LFM_GATEWAY_SECRET || "";
    await fetch(`${convexUrl}/api/transcripts/record`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "X-Hugh-Secret": secret,
      },
      body: JSON.stringify({
        roomName: "default",
        sessionId: crypto.randomUUID(),
        text: transcript,
        isFinal: true,
        confidence: result.confidence ?? 1.0,
        ts: Date.now(),
      }),
    }).catch(err => console.error("[Gateway] Transcript storage failed:", err));

    return c.json(result);
  } catch (error: unknown) {
    console.error("[Gateway] STT error:", error);
    return c.json({ error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

// Legacy alias for OpenAI client compatibility
app.post("/audio/transcriptions", async (c) => {
  return await app.fetch(new Request(c.req.url, {
    method: "POST",
    headers: c.req.raw.headers,
    body: c.req.raw.body,
  }));
});

app.post("/v1/audio/hubert-ping", async (c) => {
  // Gateway pings Convex to trigger the ambient flare and attentive state
  const convexUrl = c.env.CONVEX_URL || process.env.CONVEX_URL;
  if (!convexUrl) {
    return c.json({ error: "CONVEX_URL not configured" }, 500);
  }
  
  try {
    const response = await fetch(`${convexUrl}/api/mutation/appState:triggerWakeWord`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error("[Gateway] Convex trigger failed:", err);
      return c.json({ error: "Convex trigger failed" }, 500);
    }
    
    return c.json({ ok: true, message: "Hubert attention triggered" });
  } catch (err: unknown) {
    console.error("[Gateway] Fetch error:", err);
    return c.json({ error: err instanceof Error ? err.message : String(err) }, 500);
  }
});

export default app;
