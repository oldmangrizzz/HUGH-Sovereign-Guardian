import { Hono } from "hono";
import { bearerAuth } from "hono/bearer-auth";
import OpenAI from "openai";

type Bindings = {
  LFM_API_KEY: string;
  LFM_BASE_URL: string;
  LFM_GATEWAY_SECRET: string;
  LLAMA_CPP_URL: string;
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
const chatHandler = async (c: any) => {
  const body = await c.req.json();
  const baseURL = c.env.LLAMA_CPP_URL || c.env.LFM_BASE_URL;
  const apiKey = c.env.LLAMA_CPP_URL ? "llama-cpp" : c.env.LFM_API_KEY;

  const openai = new OpenAI({ apiKey, baseURL });
  const response = await openai.chat.completions.create({ 
    ...body, 
    model: "lfm-2.5-thinking" 
  });
  return c.json(response);
};

app.post("/v1/chat/completions", chatHandler);
app.post("/chat/completions", chatHandler);

// Vision (Liquid AI)
app.post("/v1/vision", async (c) => {
  const body = await c.req.json();
  const openai = new OpenAI({ apiKey: c.env.LFM_API_KEY, baseURL: c.env.LFM_BASE_URL });
  const response = await openai.chat.completions.create({ ...body, model: "lfm-2.5-vision" });
  return c.json(response);
});

// Audio (Liquid AI)
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

export default app;
