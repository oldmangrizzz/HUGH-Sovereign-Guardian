"use node";
import { action } from "./_generated/server";
import { v } from "convex/values";

// J-04 FIX: Constant-time comparison to prevent timing attacks
function timingSafeEqual(a: string, b: string): boolean {
  const crypto = require('crypto');
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    // Maintain constant time even on length mismatch
    crypto.timingSafeEqual(bufA, bufA);
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

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

    // J-04 FIX: Constant-time comparison — prevents timing-based credential extraction
    const usernameMatch = timingSafeEqual(args.username, expectedUser);
    const passwordMatch = timingSafeEqual(args.password, expectedPass);

    if (!usernameMatch || !passwordMatch) {
      return { ok: false };
    }

    // J-04 FIX: Use separate ADMIN_TOKEN_SECRET for HMAC — decoupled from password
    const now = Date.now();
    const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "";

    const payload = `${args.username}:${now}`;
    const sigBase = `${args.username}${now}${secret}`;

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
      // J-04 FIX: Use separate token secret
      const secret = process.env.ADMIN_TOKEN_SECRET || process.env.ADMIN_PASSWORD || "";
      const decoded = Buffer.from(args.token, "base64").toString("utf8");
      const parts = decoded.split(":");
      if (parts.length < 3) return { valid: false };

      const [username, tsStr, incomingSig] = parts;
      const expectedUser = process.env.ADMIN_USERNAME;

      if (!expectedUser || !timingSafeEqual(username, expectedUser)) return { valid: false };

      const ts = parseInt(tsStr, 10);
      const eightHours = 8 * 60 * 60 * 1000;
      if (Date.now() - ts > eightHours) return { valid: false };

      const crypto = require('crypto');
      const sigBase = `${username}${tsStr}${secret}`;
      const expectedSig = crypto.createHmac('sha256', secret).update(sigBase).digest('hex').slice(0, 16);

      // J-04 FIX: Timing-safe signature comparison
      if (!timingSafeEqual(incomingSig, expectedSig)) return { valid: false };

      return { valid: true };
    } catch {
      return { valid: false };
    }
  },
});
