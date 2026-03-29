"use node";
/**
 * livekit.ts — LiveKit room management for H.U.G.H.
 *
 * Required env vars:
 *   LIVEKIT_URL        — wss://tonyai-yqw0fr0p.livekit.cloud
 *   LIVEKIT_API_KEY    — APIHsYnMUCy2jhz
 *   LIVEKIT_API_SECRET — 1IJFXjoEWqyZp1TnkZAHE8J83QRbeEOTdkzdmRIcVOF
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

function getRoomService() {
  const url = process.env.LIVEKIT_URL;
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  if (!url || !apiKey || !apiSecret) {
    throw new Error("LiveKit env vars not configured (LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET)");
  }
  // RoomServiceClient expects https:// not wss://
  const httpUrl = url.replace(/^wss?:\/\//, "https://");
  return new RoomServiceClient(httpUrl, apiKey, apiSecret);
}

// ── GENERATE ACCESS TOKEN ─────────────────────────────────────────────────
export const generateToken = action({
  args: {
    roomName: v.string(),
    participantName: v.string(),
    canPublish: v.optional(v.boolean()),
    canSubscribe: v.optional(v.boolean()),
    ttlSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      throw new Error("LiveKit API credentials not configured");
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: args.participantName,
      ttl: args.ttlSeconds ?? 3600,
    });

    at.addGrant({
      roomJoin: true,
      room: args.roomName,
      canPublish: args.canPublish ?? true,
      canSubscribe: args.canSubscribe ?? true,
    });

    return { token: await at.toJwt(), roomName: args.roomName };
  },
});

// ── LIST ROOMS ────────────────────────────────────────────────────────────
export const listRooms = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const svc = getRoomService();
    const rooms = await svc.listRooms();
    return rooms.map((r) => ({
      name: r.name,
      numParticipants: r.numParticipants,
      maxParticipants: r.maxParticipants,
      creationTime: Number(r.creationTime),
      metadata: r.metadata,
      activeRecording: r.activeRecording,
    }));
  },
});

// ── LIST PARTICIPANTS ─────────────────────────────────────────────────────
export const listParticipants = action({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const svc = getRoomService();
    const participants = await svc.listParticipants(args.roomName);
    return participants.map((p) => ({
      identity: p.identity,
      name: p.name,
      state: p.state,
      joinedAt: Number(p.joinedAt),
      metadata: p.metadata,
    }));
  },
});

// ── CREATE / ENSURE ROOM ──────────────────────────────────────────────────
export const ensureRoom = action({
  args: {
    roomName: v.string(),
    maxParticipants: v.optional(v.number()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const svc = getRoomService();
    const room = await svc.createRoom({
      name: args.roomName,
      maxParticipants: args.maxParticipants,
      metadata: args.metadata,
    });
    return {
      name: room.name,
      numParticipants: room.numParticipants,
      creationTime: Number(room.creationTime),
    };
  },
});

// ── DELETE ROOM ───────────────────────────────────────────────────────────
export const deleteRoom = action({
  args: { roomName: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const svc = getRoomService();
    await svc.deleteRoom(args.roomName);
    return { deleted: true };
  },
});

// ── REMOVE PARTICIPANT ────────────────────────────────────────────────────
export const removeParticipant = action({
  args: { roomName: v.string(), participantIdentity: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthorized");
    const svc = getRoomService();
    await svc.removeParticipant(args.roomName, args.participantIdentity);
    return { removed: true };
  },
});

// ── INTERNAL: HUGH TOKEN (no auth check — called from actions) ────────────
export const hughToken = internalAction({
  args: {
    roomName: v.string(),
    identity: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    if (!apiKey || !apiSecret) throw new Error("LiveKit not configured");

    const at = new AccessToken(apiKey, apiSecret, {
      identity: args.identity ?? "hugh-primary",
      ttl: 86400,
    });
    at.addGrant({
      roomJoin: true,
      room: args.roomName,
      canPublish: true,
      canSubscribe: true,
    });
    return { token: await at.toJwt() };
  },
});
