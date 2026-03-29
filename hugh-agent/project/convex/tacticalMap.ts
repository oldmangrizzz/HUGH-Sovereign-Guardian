import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

// ── WAYPOINTS ──────────────────────────────────────────────────────────────

export const listWaypoints = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("mapWaypoints")
      .withIndex("by_visible", (q) => q.eq("visible", true))
      .collect();
  },
});

export const addWaypoint = mutation({
  args: {
    label: v.string(),
    description: v.optional(v.string()),
    lat: v.number(),
    lng: v.number(),
    altitude: v.optional(v.number()),
    waypointType: v.string(),
    color: v.optional(v.string()),
    icon: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    sessionId: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await ctx.auth.getUserIdentity();
    return await ctx.db.insert("mapWaypoints", {
      ...args,
      createdBy: undefined,
      visible: true,
    });
  },
});

export const updateWaypoint = mutation({
  args: {
    id: v.id("mapWaypoints"),
    label: v.optional(v.string()),
    description: v.optional(v.string()),
    waypointType: v.optional(v.string()),
    color: v.optional(v.string()),
    visible: v.optional(v.boolean()),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { id, ...patch } = args;
    const filtered = Object.fromEntries(
      Object.entries(patch).filter(([, v]) => v !== undefined)
    );
    await ctx.db.patch(id, filtered);
  },
});

export const deleteWaypoint = mutation({
  args: { id: v.id("mapWaypoints") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});

// ── TRACKS ─────────────────────────────────────────────────────────────────

export const listTracks = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("mapTracks").collect();
  },
});

export const createTrack = mutation({
  args: {
    label: v.string(),
    color: v.string(),
    trackType: v.string(),
    sessionId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("mapTracks", {
      ...args,
      active: true,
      pointsJson: "[]",
    });
  },
});

export const appendTrackPoint = mutation({
  args: {
    trackId: v.id("mapTracks"),
    lat: v.number(),
    lng: v.number(),
    alt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const track = await ctx.db.get(args.trackId);
    if (!track) throw new Error("Track not found");
    const points = JSON.parse(track.pointsJson) as Array<{ lat: number; lng: number; alt?: number; ts: number }>;
    points.push({ lat: args.lat, lng: args.lng, alt: args.alt, ts: Date.now() });
    // Keep last 500 points to stay under 1MB
    const trimmed = points.slice(-500);
    await ctx.db.patch(args.trackId, { pointsJson: JSON.stringify(trimmed) });
  },
});

export const closeTrack = mutation({
  args: { trackId: v.id("mapTracks") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.trackId, { active: false });
  },
});

export const deleteTrack = mutation({
  args: { trackId: v.id("mapTracks") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.trackId);
  },
});

// ── OSINT FEEDS ────────────────────────────────────────────────────────────

export const listFeeds = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("osintFeeds").collect();
  },
});

export const seedDefaultFeeds = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("osintFeeds").collect();
    if (existing.length > 0) return;

    const defaults = [
      {
        name: "USGS Earthquakes (M2.5+)",
        feedType: "earthquake",
        sourceUrl: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
        enabled: true,
        refreshIntervalMs: 5 * 60 * 1000,
        displayColor: "#f59e0b",
        iconEmoji: "🌍",
      },
      {
        name: "NOAA Active Wildfires",
        feedType: "wildfire",
        sourceUrl: "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/Active_Fires/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
        enabled: true,
        refreshIntervalMs: 10 * 60 * 1000,
        displayColor: "#ef4444",
        iconEmoji: "🔥",
      },
      {
        name: "OpenSky ADS-B Aircraft",
        feedType: "adsb",
        sourceUrl: "https://opensky-network.org/api/states/all",
        enabled: false,
        refreshIntervalMs: 30 * 1000,
        displayColor: "#60a5fa",
        iconEmoji: "✈️",
      },
      {
        name: "NWS Active Alerts",
        feedType: "weather",
        sourceUrl: "https://api.weather.gov/alerts/active?status=actual&message_type=alert",
        enabled: true,
        refreshIntervalMs: 5 * 60 * 1000,
        displayColor: "#a78bfa",
        iconEmoji: "⚡",
      },
    ];

    for (const feed of defaults) {
      await ctx.db.insert("osintFeeds", {
        ...feed,
        lastFetchedAt: undefined,
        lastStatus: undefined,
        cachedDataJson: undefined,
        errorMessage: undefined,
      });
    }
  },
});

export const toggleFeed = mutation({
  args: { feedId: v.id("osintFeeds"), enabled: v.boolean() },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedId, { enabled: args.enabled });
  },
});

// ── OSINT FETCH ACTION ─────────────────────────────────────────────────────
// Fetches a single OSINT feed and caches the result.

export const fetchFeed = action({
  args: { feedId: v.id("osintFeeds") },
  handler: async (ctx, args) => {
    const feed = await ctx.runQuery(internal.tacticalMap.getFeedById, { feedId: args.feedId });
    if (!feed || !feed.enabled) return null;

    try {
      const res = await fetch(feed.sourceUrl, {
        headers: { "Accept": "application/json", "User-Agent": "GrizzlyMedicine-HUGH/1.0" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      // Truncate to avoid 1MB limit — keep first 200 features for GeoJSON
      let payload = data;
      if (data?.features && Array.isArray(data.features)) {
        payload = { ...data, features: data.features.slice(0, 200) };
      }
      await ctx.runMutation(internal.tacticalMap.updateFeedCache, {
        feedId: args.feedId,
        cachedDataJson: JSON.stringify(payload),
        status: "ok",
        errorMessage: undefined,
      });
      return "ok";
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      await ctx.runMutation(internal.tacticalMap.updateFeedCache, {
        feedId: args.feedId,
        cachedDataJson: undefined,
        status: "error",
        errorMessage: msg,
      });
      return "error";
    }
  },
});

export const getFeedById = internalQuery({
  args: { feedId: v.id("osintFeeds") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.feedId);
  },
});

export const updateFeedCache = internalMutation({
  args: {
    feedId: v.id("osintFeeds"),
    cachedDataJson: v.optional(v.string()),
    status: v.string(),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.feedId, {
      cachedDataJson: args.cachedDataJson,
      lastStatus: args.status,
      lastFetchedAt: Date.now(),
      errorMessage: args.errorMessage,
    });
  },
});

// ── LAYER STATE ────────────────────────────────────────────────────────────

export const getLayerState = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("mapLayerState")
      .withIndex("by_session", (q) => q.eq("sessionId", args.sessionId))
      .collect();
  },
});

export const setLayerVisibility = mutation({
  args: {
    sessionId: v.string(),
    layerId: v.string(),
    visible: v.boolean(),
    opacity: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("mapLayerState")
      .withIndex("by_session_and_layer", (q) =>
        q.eq("sessionId", args.sessionId).eq("layerId", args.layerId)
      )
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { visible: args.visible, opacity: args.opacity });
    } else {
      await ctx.db.insert("mapLayerState", args);
    }
  },
});
