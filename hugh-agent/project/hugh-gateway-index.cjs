const { Hono } = require("hono");
const { bearerAuth } = require("hono/bearer-auth");
const OpenAI = require("openai");
const { serve } = require("@hono/node-server");

const app = new Hono();

// Auth middleware
app.use("*", async (c, next) => {
  const auth = bearerAuth({ token: process.env.LFM_GATEWAY_SECRET });
  return await auth(c, next);
});

app.get("/health", (c) => c.json({
  status: "online",
  models: ["lfm-2.5-thinking", "lfm-2.5-vision", "lfm-2.5-audio"],
  local_reasoning: !!process.env.LLAMA_CPP_URL
}));

// Multi-path handler for chat completions
const chatHandler = async (c) => {
  const body = await c.req.json();
  const baseURL = process.env.LLAMA_CPP_URL || process.env.LFM_BASE_URL;
  const apiKey = process.env.LLAMA_CPP_URL ? "llama-cpp" : process.env.LFM_API_KEY;

  // Model mapping for Ollama/local backends
  const modelName = process.env.LLAMA_CPP_URL ? "llama3.2:3b" : "lfm-2.5-thinking";

  const openai = new OpenAI({ apiKey, baseURL });
  const response = await openai.chat.completions.create({ 
    ...body, 
    model: modelName 
  });
  return c.json(response);
};

app.post("/v1/chat/completions", chatHandler);
app.post("/chat/completions", chatHandler);

// Vision (Liquid AI)
app.post("/v1/vision", async (c) => {
  const body = await c.req.json();
  const openai = new OpenAI({ apiKey: process.env.LFM_API_KEY, baseURL: process.env.LFM_BASE_URL });
  const response = await openai.chat.completions.create({ ...body, model: "lfm-2.5-vision" });
  return c.json(response);
});

// Audio (Liquid AI)
app.post("/v1/audio/speech-to-speech", async (c) => {
  const formData = await c.req.formData();
  const liquidResponse = await fetch(`${process.env.LFM_BASE_URL}/audio/speech-to-speech`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LFM_API_KEY}` },
    body: formData,
  });
  if (!liquidResponse.ok) return c.json({ error: "Liquid AI Audio API failed" }, 500);
  return new Response(liquidResponse.body, {
    headers: { "Content-Type": liquidResponse.headers.get("Content-Type") || "audio/wav" },
  });
});

const port = process.env.PORT || 8787;
console.log(`[hugh-gateway] Listening on port ${port}`);

serve({
  fetch: app.fetch,
  port
});
