/**
 * authHelpers.ts — Reusable Auth Gates for Convex Functions
 *
 * Created during Phase 2 hardening (NX-08).
 * Defeats the Anonymous auth bypass (NX-06) by requiring real email claims.
 *
 * Usage:
 *   import { requireAdmin, requireIdentity } from "./authHelpers";
 *   // In handler: await requireAdmin(ctx);
 */

type AuthCtx = {
  auth: {
    getUserIdentity(): Promise<{
      tokenIdentifier: string;
      email?: string;
      name?: string;
    } | null>;
  };
};

/**
 * Requires admin-level access.
 * Checks identity exists AND email is in ADMIN_EMAILS allowlist.
 * Defeats Anonymous auth bypass — anonymous tokens have no email.
 */
export async function requireAdmin(ctx: AuthCtx): Promise<{ email: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  const adminEmails = (process.env.ADMIN_EMAILS || "me@grizzlymedicine.org")
    .split(",")
    .map((e) => e.trim().toLowerCase());
  if (!identity.email || !adminEmails.includes(identity.email.toLowerCase())) {
    throw new Error("Forbidden — admin access required");
  }
  return { email: identity.email };
}

/**
 * Requires authenticated identity with a real email claim.
 * Defeats Anonymous auth bypass — anonymous tokens have no email.
 */
export async function requireIdentity(ctx: AuthCtx): Promise<{ email: string }> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthorized");
  if (!identity.email) throw new Error("Unauthorized — email claim required");
  return { email: identity.email };
}
