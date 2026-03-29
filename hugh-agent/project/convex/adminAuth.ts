"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

/**
 * Verifies admin credentials against ADMIN_USERNAME + ADMIN_PASSWORD env vars.
 * Returns a short-lived session token (a signed timestamp) stored only in the
 * browser's sessionStorage — no DB rows, no user accounts.
 */
export const verifyAdmin = action({
  args: {
    username: v.string(),
    password: v.string(),
  },
  handler: async (_ctx, args): Promise<{ ok: boolean; token?: string }> => {
    const expectedUser = process.env.ADMIN_USERNAME;
    const expectedPass = process.env.ADMIN_PASSWORD;

    if (!expectedUser || !expectedPass) {
      return { ok: false };
    }

    const usernameMatch = args.username === expectedUser;
    const passwordMatch = args.password === expectedPass;

    if (!usernameMatch || !passwordMatch) {
      // Constant-time-ish: always check both
      return { ok: false };
    }

    // Token = base64( username + ":" + timestamp + ":" + signature )
    // Signature = hash( username + timestamp + secret )
    const now = Date.now();
    const secret = process.env.ADMIN_PASSWORD ?? "";
    
    // In Convex node actions, we can use crypto.subtle or a simple hash
    const payload = `${args.username}:${now}`;
    const sigBase = `${args.username}${now}${secret}`;
    
    // Use a simple but effective signature for this context
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', secret).update(sigBase).digest('hex').slice(0, 16);
    
    const token = Buffer.from(`${payload}:${signature}`).toString("base64");

    return { ok: true, token };
  },
});

/**
 * Validates a previously-issued admin token.
 * Tokens expire after 8 hours.
 */
export const validateAdminToken = action({
  args: { token: v.string() },
  handler: async (_ctx, args): Promise<{ valid: boolean }> => {
    try {
      const secret = process.env.ADMIN_PASSWORD ?? "";
      const decoded = Buffer.from(args.token, "base64").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length < 3) return { valid: false };

      const [username, tsStr, incomingSig] = parts;
      const expectedUser = process.env.ADMIN_USERNAME;

      if (username !== expectedUser) return { valid: false };

      const ts = parseInt(tsStr, 10);
      const eightHours = 8 * 60 * 60 * 1000;
      if (Date.now() - ts > eightHours) return { valid: false };

      // Re-calculate signature to verify integrity
      const crypto = require('crypto');
      const sigBase = `${username}${tsStr}${secret}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(sigBase).digest('hex').slice(0, 16);

      if (incomingSig !== expectedSig) return { valid: false };

      return { valid: true };
    } catch {
      return { valid: false };
    }
  },
});
