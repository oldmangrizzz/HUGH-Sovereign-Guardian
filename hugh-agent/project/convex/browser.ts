"use node";

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

// ── BROWSER AGENT — Playwright HTTP wrapper running on VPS ────────────────
// Deploy browser-agent/server.js to your VPS (see comments in kvm.ts for pattern)
// Required env vars: BROWSER_AGENT_URL, BROWSER_AGENT_SECRET

type BrowserResult = {
  success: boolean;
  screenshotBase64?: string;
  text?: string;
  url?: string;
  title?: string;
  errorMessage?: string;
  durationMs: number;
};

async function browserAgentCall(
  agentUrl: string,
  agentSecret: string,
  payload: Record<string, unknown>,
  timeoutMs = 30000
): Promise<BrowserResult> {
  const start = Date.now();
  try {
    const res = await fetch(`${agentUrl}/browser`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Agent-Secret": agentSecret,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const durationMs = Date.now() - start;
    if (!res.ok) {
      const txt = await res.text();
      return { success: false, errorMessage: `HTTP ${res.status}: ${txt.slice(0, 200)}`, durationMs };
    }
    const data = await res.json() as BrowserResult;
    return { ...data, durationMs };
  } catch (err: unknown) {
    return {
      success: false,
      errorMessage: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

// ── INTERNAL: NAVIGATE + SCREENSHOT ───────────────────────────────────────
export const navigateInternal = internalAction({
  args: {
    url: v.string(),
    waitFor: v.optional(v.string()),   // CSS selector to wait for
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "BROWSER_AGENT_URL or BROWSER_AGENT_SECRET not configured", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, {
      action: "navigate",
      url: args.url,
      waitFor: args.waitFor,
      screenshot: true,
    });
  },
});

// ── INTERNAL: CLICK ────────────────────────────────────────────────────────
export const clickInternal = internalAction({
  args: {
    selector: v.string(),
    screenshot: v.optional(v.boolean()),
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "Browser agent not configured", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, {
      action: "click",
      selector: args.selector,
      screenshot: args.screenshot ?? true,
    });
  },
});

// ── INTERNAL: TYPE ─────────────────────────────────────────────────────────
export const typeInternal = internalAction({
  args: {
    selector: v.string(),
    text: v.string(),
    screenshot: v.optional(v.boolean()),
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "Browser agent not configured", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, {
      action: "type",
      selector: args.selector,
      text: args.text,
      screenshot: args.screenshot ?? true,
    });
  },
});

// ── INTERNAL: SCREENSHOT ───────────────────────────────────────────────────
export const screenshotInternal = internalAction({
  args: {
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (_ctx, _args): Promise<BrowserResult> => {
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "Browser agent not configured", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, { action: "screenshot" });
  },
});

// ── INTERNAL: GET PAGE TEXT ────────────────────────────────────────────────
export const getTextInternal = internalAction({
  args: {
    selector: v.optional(v.string()),
    issuedBy: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (_ctx, args): Promise<BrowserResult> => {
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "Browser agent not configured", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, {
      action: "getText",
      selector: args.selector ?? "body",
    });
  },
});

// ── PUBLIC: ADMIN BROWSER CONTROL ─────────────────────────────────────────
export const adminBrowser = action({
  args: {
    action: v.union(
      v.literal("navigate"),
      v.literal("click"),
      v.literal("type"),
      v.literal("screenshot"),
      v.literal("getText"),
    ),
    url: v.optional(v.string()),
    selector: v.optional(v.string()),
    text: v.optional(v.string()),
    waitFor: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<BrowserResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) {
      return { success: false, errorMessage: "BROWSER_AGENT_URL or BROWSER_AGENT_SECRET not configured. Deploy browser-agent to VPS first.", durationMs: 0 };
    }
    return browserAgentCall(agentUrl, agentSecret, {
      action: args.action,
      url: args.url,
      selector: args.selector,
      text: args.text,
      waitFor: args.waitFor,
      screenshot: true,
    });
  },
});

// ── PUBLIC: PING BROWSER AGENT ────────────────────────────────────────────
export const pingBrowserAgent = action({
  args: {},
  handler: async (ctx): Promise<{ online: boolean; error?: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const agentUrl = process.env.BROWSER_AGENT_URL;
    const agentSecret = process.env.BROWSER_AGENT_SECRET;
    if (!agentUrl || !agentSecret) return { online: false, error: "Not configured" };
    try {
      const res = await fetch(`${agentUrl}/ping`, {
        headers: { "X-Agent-Secret": agentSecret },
        signal: AbortSignal.timeout(5000),
      });
      return { online: res.ok };
    } catch (err: unknown) {
      return { online: false, error: err instanceof Error ? err.message : String(err) };
    }
  },
});
