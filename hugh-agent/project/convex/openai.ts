import OpenAI from "openai";

export const openai = new OpenAI({
  baseURL: process.env.HUGH_GATEWAY_URL ?? process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.HUGH_GATEWAY_KEY ?? process.env.CONVEX_OPENAI_API_KEY ?? "dummy-key-for-analysis",
  timeout: 120000,
});
