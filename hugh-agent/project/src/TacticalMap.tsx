import { useEffect, useRef, useState, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

// ── TYPES ──────────────────────────────────────────────────────────────────

type WaypointType = "waypoint" | "poi" | "hazard" | "objective" | "rally" | "casevac";

interface WaypointForm {
  label: string;
  description: string;
  waypointType: WaypointType;
}

const WAYPOINT_COLORS: Record<WaypointType, string> = {
  waypoint:  "#34d399",
  poi:       "#60a5fa",
  hazard:    "#ef4444",
  objective: "#f59e0b",
  rally:     "#a78bfa",
  casevac:   "#f472b6",
};

const WAYPOINT_ICONS: Record<WaypointType, string> = {
  waypoint:  "◈",
  poi:       "◉",
  hazard:    "⚠",
  objective: "◎",
  rally:     "⬡",
  casevac:   "✚",
};

const LAYER_DEFS = [
  { id: "satellite",  label: "SATELLITE",  icon: "🛰",  style: "mapbox://styles/mapbox/satellite-streets-v12" },
  { id: "dark",       label: "DARK OPS",   icon: "🌑",  style: "mapbox://styles/mapbox/dark-v11" },
  { id: "terrain",    label: "TERRAIN",    icon: "⛰",  style: "mapbox://styles/mapbox/outdoors-v12" },
  { id: "navigation", label: "NAV",        icon: "🧭",  style: "mapbox://styles/mapbox/navigation-night-v1" },
];

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

// ── COMPONENT ──────────────────────────────────────────────────────────────

export default function TacticalMap() {
  const mapboxToken = (import.meta as unknown as { env: Record<string, string> }).env?.VITE_MAPBOX_TOKEN ?? "";

  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);
  const markersRef   = useRef<Map<string, mapboxgl.Marker>>(new Map());
  const [sessionId]  = useState(() => uid());
  const [mapReady, setMapReady] = useState(false);
  const [activeStyle, setActiveStyle] = useState(LAYER_DEFS[0].id);
  const [sidePanel, setSidePanel] = useState<"layers" | "waypoints" | "osint" | "tracks" | null>("layers");
  const [pendingLngLat, setPendingLngLat] = useState<{ lng: number; lat: number } | null>(null);
  const [wpForm, setWpForm] = useState<WaypointForm>({ label: "", description: "", waypointType: "waypoint" });
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const [trackingActive, setTrackingActive] = useState(false);
  const trackIdRef = useRef<Id<"mapTracks"> | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const [selectedWaypoint, setSelectedWaypoint] = useState<string | null>(null);
  const [noToken, setNoToken] = useState(false);

  // ── CONVEX ──────────────────────────────────────────────────────────────
  const waypoints    = useQuery(api.tacticalMap.listWaypoints);
  const tracks       = useQuery(api.tacticalMap.listTracks);
  const feeds        = useQuery(api.tacticalMap.listFeeds);
  const addWaypoint  = useMutation(api.tacticalMap.addWaypoint);
  const deleteWp     = useMutation(api.tacticalMap.deleteWaypoint);
  const createTrack  = useMutation(api.tacticalMap.createTrack);
  const appendPoint  = useMutation(api.tacticalMap.appendTrackPoint);
  const closeTrack   = useMutation(api.tacticalMap.closeTrack);
  const deleteTrack  = useMutation(api.tacticalMap.deleteTrack);
  const toggleFeed   = useMutation(api.tacticalMap.toggleFeed);
  const fetchFeed    = useAction(api.tacticalMap.fetchFeed);
  const seedFeeds    = useMutation(api.tacticalMap.seedDefaultFeeds);

  // Seed default feeds on mount
  useEffect(() => { seedFeeds(); }, [seedFeeds]);

  // ── MAP INIT ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapboxToken) { setNoToken(true); return; }
    if (!mapContainer.current || mapRef.current) return;

    mapboxgl.accessToken = mapboxToken;

    const map = new mapboxgl.Map({
      container: mapContainer.current,
      style: LAYER_DEFS[0].style,
      center: [-98.5795, 39.8283], // CONUS center
      zoom: 4,
      projection: "globe" as unknown as mapboxgl.ProjectionSpecification,
      antialias: true,
    });

    map.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");
    map.addControl(new mapboxgl.ScaleControl({ unit: "imperial" }), "bottom-right");
    map.addControl(new mapboxgl.FullscreenControl(), "top-right");

    map.on("load", () => {
      // Atmosphere / fog for globe mode
      try {
        map.setFog({
          color: "rgb(4, 8, 12)",
          "high-color": "rgb(8, 16, 24)",
          "horizon-blend": 0.04,
          "space-color": "rgb(2, 4, 8)",
          "star-intensity": 0.8,
        });
      } catch (_) { /* non-globe fallback */ }
      setMapReady(true);
    });

    // Click to place waypoint
    map.on("click", (e) => {
      setPendingLngLat({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapboxToken]);

  // ── STYLE SWITCH ────────────────────────────────────────────────────────
  const switchStyle = useCallback((styleId: string) => {
    const def = LAYER_DEFS.find(l => l.id === styleId);
    if (!def || !mapRef.current) return;
    setActiveStyle(styleId);
    mapRef.current.setStyle(def.style);
    // Re-apply fog after style load
    mapRef.current.once("style.load", () => {
      try {
        mapRef.current?.setFog({
          color: "rgb(4, 8, 12)",
          "high-color": "rgb(8, 16, 24)",
          "horizon-blend": 0.04,
          "space-color": "rgb(2, 4, 8)",
          "star-intensity": 0.8,
        });
      } catch (_) { /* */ }
    });
  }, []);

  // ── SYNC WAYPOINT MARKERS ────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !waypoints) return;
    const map = mapRef.current;
    const currentIds = new Set(waypoints.map(w => w._id));

    // Remove stale markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id as Id<"mapWaypoints">)) {
        marker.remove();
        markersRef.current.delete(id);
      }
    });

    // Add/update markers
    waypoints.forEach(wp => {
      if (markersRef.current.has(wp._id)) return;
      const color = WAYPOINT_COLORS[wp.waypointType as WaypointType] ?? "#34d399";
      const icon  = WAYPOINT_ICONS[wp.waypointType as WaypointType] ?? "◈";

      const el = document.createElement("div");
      el.style.cssText = `
        width: 32px; height: 32px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(0,0,0,0.85);
        border: 1.5px solid ${color};
        border-radius: 4px;
        font-size: 14px;
        cursor: pointer;
        box-shadow: 0 0 12px ${color}66, 0 2px 8px rgba(0,0,0,0.9);
        transition: transform 0.15s;
        font-family: monospace;
        color: ${color};
      `;
      el.textContent = icon;
      el.title = wp.label;
      el.addEventListener("mouseenter", () => { el.style.transform = "scale(1.2)"; });
      el.addEventListener("mouseleave", () => { el.style.transform = "scale(1)"; });
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        setSelectedWaypoint(wp._id);
        setSidePanel("waypoints");
      });

      const popup = new mapboxgl.Popup({ offset: 20, closeButton: false, className: "tactical-popup" })
        .setHTML(`
          <div style="font-family:monospace;font-size:11px;color:#e2e8f0;background:#111;padding:8px 10px;border:1px solid ${color}44;border-radius:4px;min-width:120px;">
            <div style="color:${color};font-weight:700;margin-bottom:4px;">${icon} ${wp.label}</div>
            ${wp.description ? `<div style="color:#94a3b8;font-size:10px;">${wp.description}</div>` : ""}
            <div style="color:#374151;font-size:9px;margin-top:4px;">${wp.lat.toFixed(5)}, ${wp.lng.toFixed(5)}</div>
          </div>
        `);

      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([wp.lng, wp.lat])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.set(wp._id, marker);
    });
  }, [waypoints, mapReady]);

  // ── SYNC TRACKS ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !tracks) return;
    const map = mapRef.current;

    tracks.forEach(track => {
      const sourceId = `track-${track._id}`;
      const layerId  = `track-line-${track._id}`;
      let points: Array<{ lat: number; lng: number }> = [];
      try { points = JSON.parse(track.pointsJson); } catch (_) { return; }
      if (points.length < 2) return;

      const geojson: GeoJSON.Feature<GeoJSON.LineString> = {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: points.map(p => [p.lng, p.lat]),
        },
      };

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(geojson);
      } else {
        map.addSource(sourceId, { type: "geojson", data: geojson });
        map.addLayer({
          id: layerId,
          type: "line",
          source: sourceId,
          layout: { "line-join": "round", "line-cap": "round" },
          paint: {
            "line-color": track.color,
            "line-width": 2.5,
            "line-opacity": 0.85,
          },
        });
      }
    });
  }, [tracks, mapReady]);

  // ── OSINT OVERLAY ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current || !feeds) return;
    const map = mapRef.current;

    feeds.forEach(feed => {
      if (!feed.enabled || !feed.cachedDataJson) return;
      const sourceId = `osint-${feed._id}`;
      const layerId  = `osint-circles-${feed._id}`;

      let data: GeoJSON.FeatureCollection;
      try {
        const raw = JSON.parse(feed.cachedDataJson);
        // Handle GeoJSON FeatureCollection
        if (raw?.type === "FeatureCollection") {
          data = raw;
        } else if (raw?.features) {
          data = raw;
        } else {
          return;
        }
      } catch (_) { return; }

      if (map.getSource(sourceId)) {
        (map.getSource(sourceId) as mapboxgl.GeoJSONSource).setData(data);
      } else {
        map.addSource(sourceId, { type: "geojson", data });
        map.addLayer({
          id: layerId,
          type: "circle",
          source: sourceId,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 3, 4, 8, 10],
            "circle-color": feed.displayColor,
            "circle-opacity": 0.75,
            "circle-stroke-width": 1,
            "circle-stroke-color": feed.displayColor,
            "circle-stroke-opacity": 0.4,
          },
        });
      }
    });
  }, [feeds, mapReady]);

  // ── USER LOCATION ────────────────────────────────────────────────────────
  const centerOnUser = useCallback(() => {
    if (!navigator.geolocation || !mapRef.current) return;
    navigator.geolocation.getCurrentPosition(pos => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setUserLocation({ lat, lng });
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 14, duration: 1500 });

      if (userMarkerRef.current) {
        userMarkerRef.current.setLngLat([lng, lat]);
      } else {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 16px; height: 16px;
          background: #34d399;
          border: 2px solid #fff;
          border-radius: 50%;
          box-shadow: 0 0 0 4px rgba(52,211,153,0.3), 0 0 20px rgba(52,211,153,0.6);
        `;
        userMarkerRef.current = new mapboxgl.Marker({ element: el })
          .setLngLat([lng, lat])
          .addTo(mapRef.current!);
      }
    });
  }, []);

  // ── GPS TRACKING ─────────────────────────────────────────────────────────
  const startTracking = useCallback(async () => {
    if (!navigator.geolocation) return;
    const id = await createTrack({
      label: `Track ${new Date().toLocaleTimeString()}`,
      color: "#34d399",
      trackType: "breadcrumb",
      sessionId,
    });
    trackIdRef.current = id;
    setTrackingActive(true);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng, altitude } = pos.coords;
        setUserLocation({ lat, lng });
        if (userMarkerRef.current) {
          userMarkerRef.current.setLngLat([lng, lat]);
        }
        if (trackIdRef.current) {
          await appendPoint({
            trackId: trackIdRef.current,
            lat, lng,
            alt: altitude ?? undefined,
          });
        }
      },
      (err) => console.warn("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );
  }, [createTrack, appendPoint, sessionId]);

  const stopTracking = useCallback(async () => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (trackIdRef.current) {
      await closeTrack({ trackId: trackIdRef.current });
      trackIdRef.current = null;
    }
    setTrackingActive(false);
  }, [closeTrack]);

  // ── PLACE WAYPOINT ────────────────────────────────────────────────────────
  const handlePlaceWaypoint = useCallback(async () => {
    if (!pendingLngLat || !wpForm.label.trim()) return;
    await addWaypoint({
      label: wpForm.label.trim(),
      description: wpForm.description || undefined,
      lat: pendingLngLat.lat,
      lng: pendingLngLat.lng,
      waypointType: wpForm.waypointType,
      color: WAYPOINT_COLORS[wpForm.waypointType],
      sessionId,
    });
    setPendingLngLat(null);
    setWpForm({ label: "", description: "", waypointType: "waypoint" });
  }, [pendingLngLat, wpForm, addWaypoint, sessionId]);

  // ── NO TOKEN STATE ────────────────────────────────────────────────────────
  if (noToken || !mapboxToken) {
    return (
      <div className="min-h-screen flex items-center justify-center workshop-grid" style={{ background: "#080808" }}>
        <div className="panel-raised rounded-lg p-8 max-w-md w-full mx-4 relative">
          <div className="rivet-lg absolute" style={{ top: 10, left: 10 }} />
          <div className="rivet-lg absolute" style={{ top: 10, right: 10 }} />
          <div className="rivet-lg absolute" style={{ bottom: 10, left: 10 }} />
          <div className="rivet-lg absolute" style={{ bottom: 10, right: 10 }} />
          <div className="hazard-stripe h-1.5 rounded-t mb-6 -mx-8 -mt-8" style={{ borderRadius: "8px 8px 0 0" }} />
          <div className="text-center mb-4">
            <div className="text-4xl mb-3">🗺</div>
            <h2 className="text-lg font-black glow-emerald tracking-widest mb-2">TACTICAL MAP</h2>
            <p className="text-xs text-workshop-muted mb-4">Mapbox API key required to initialize the tactical display.</p>
          </div>
          <div className="weld-h mb-4" />
          <div className="space-y-3 text-xs font-mono text-workshop-pewter">
            <p className="text-workshop-chrome">To activate:</p>
            <ol className="space-y-2 list-decimal list-inside text-workshop-muted">
              <li>Get a free key at <span className="text-workshop-emerald">mapbox.com</span></li>
              <li>Add <code className="text-workshop-emerald-bright bg-black/40 px-1 rounded">VITE_MAPBOX_TOKEN</code> to your <code>.env.local</code></li>
              <li>Restart the dev server</li>
            </ol>
            <div className="mt-4 p-3 rounded" style={{ background: "#0a0a0a", border: "1px solid #1a1a1a" }}>
              <code className="text-workshop-emerald-bright text-[10px]">VITE_MAPBOX_TOKEN=pk.eyJ1Ijoi...</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full" style={{ height: "calc(100vh - 52px)", background: "#080808" }}>

      {/* ── MAP CANVAS ── */}
      <div ref={mapContainer} className="absolute inset-0" />

      {/* ── HUD OVERLAY — TOP LEFT ── */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-2">
        {/* Coordinates */}
        <div
          className="font-mono text-[10px] px-3 py-1.5 flex items-center gap-2"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "1px solid #2a2a2a",
            borderRadius: 4,
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="text-workshop-emerald">◈</span>
          <span className="text-workshop-pewter">
            {userLocation
              ? `${userLocation.lat.toFixed(5)}° N  ${userLocation.lng.toFixed(5)}° W`
              : "NO GPS FIX"}
          </span>
          {trackingActive && (
            <span className="w-1.5 h-1.5 rounded-full bg-workshop-emerald animate-pulse" />
          )}
        </div>

        {/* Waypoint count */}
        <div
          className="font-mono text-[10px] px-3 py-1.5 flex items-center gap-2"
          style={{
            background: "rgba(0,0,0,0.85)",
            border: "1px solid #2a2a2a",
            borderRadius: 4,
            backdropFilter: "blur(8px)",
          }}
        >
          <span className="text-workshop-silver">WPT</span>
          <span className="text-workshop-chrome">{waypoints?.length ?? 0}</span>
          <span className="text-workshop-dim">|</span>
          <span className="text-workshop-silver">TRK</span>
          <span className="text-workshop-chrome">{tracks?.length ?? 0}</span>
          <span className="text-workshop-dim">|</span>
          <span className="text-workshop-silver">OSINT</span>
          <span className="text-workshop-chrome">{feeds?.filter(f => f.enabled).length ?? 0}</span>
        </div>
      </div>

      {/* ── HUD OVERLAY — BOTTOM LEFT — GPS CONTROLS ── */}
      <div className="absolute bottom-10 left-3 z-10 flex flex-col gap-2">
        <button
          onClick={centerOnUser}
          className="btn-forge btn-silver text-[10px] px-3 py-2"
          title="Center on my location"
        >
          ⊕ MY POS
        </button>
        {!trackingActive ? (
          <button
            onClick={startTracking}
            className="btn-forge btn-emerald text-[10px] px-3 py-2"
          >
            ▶ TRACK
          </button>
        ) : (
          <button
            onClick={stopTracking}
            className="btn-forge btn-crimson text-[10px] px-3 py-2"
          >
            ■ STOP
          </button>
        )}
      </div>

      {/* ── SIDE PANEL TOGGLE BUTTONS ── */}
      <div className="absolute top-3 right-16 z-10 flex gap-1.5">
        {(["layers", "waypoints", "osint", "tracks"] as const).map(panel => (
          <button
            key={panel}
            onClick={() => setSidePanel(sidePanel === panel ? null : panel)}
            className={`font-mono text-[9px] px-2.5 py-1.5 rounded border transition-all tracking-widest ${
              sidePanel === panel
                ? "border-workshop-emerald text-workshop-emerald bg-workshop-emerald/10"
                : "border-workshop-dim text-workshop-muted hover:border-workshop-emerald/40 hover:text-workshop-emerald"
            }`}
            style={{ background: sidePanel === panel ? undefined : "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
          >
            {panel === "layers"    ? "🗂 LAYERS"    : ""}
            {panel === "waypoints" ? "◈ WPT"        : ""}
            {panel === "osint"     ? "📡 OSINT"     : ""}
            {panel === "tracks"    ? "〰 TRACKS"    : ""}
          </button>
        ))}
      </div>

      {/* ── SIDE PANEL ── */}
      {sidePanel && (
        <div
          className="absolute top-12 right-3 z-10 w-72 flex flex-col gap-0 overflow-hidden"
          style={{
            background: "rgba(8,8,8,0.95)",
            border: "1px solid #2a2a2a",
            borderRadius: 6,
            backdropFilter: "blur(16px)",
            maxHeight: "calc(100vh - 120px)",
          }}
        >
          {/* Panel header */}
          <div
            className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid #1a1a1a" }}
          >
            <span className="font-mono text-[10px] font-bold text-workshop-chrome tracking-widest">
              {sidePanel === "layers"    ? "🗂 MAP LAYERS"    : ""}
              {sidePanel === "waypoints" ? "◈ WAYPOINTS"      : ""}
              {sidePanel === "osint"     ? "📡 OSINT FEEDS"   : ""}
              {sidePanel === "tracks"    ? "〰 TRACKS"        : ""}
            </span>
            <button
              onClick={() => setSidePanel(null)}
              className="text-workshop-muted hover:text-workshop-chrome text-xs"
            >✕</button>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: "calc(100vh - 180px)" }}>

            {/* ── LAYERS PANEL ── */}
            {sidePanel === "layers" && (
              <div className="p-3 space-y-2">
                {LAYER_DEFS.map(layer => (
                  <button
                    key={layer.id}
                    onClick={() => switchStyle(layer.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all ${
                      activeStyle === layer.id
                        ? "border border-workshop-emerald bg-workshop-emerald/10"
                        : "border border-workshop-dim hover:border-workshop-emerald/30"
                    }`}
                    style={{ borderRadius: 4 }}
                  >
                    <span className="text-base">{layer.icon}</span>
                    <div>
                      <div className={`font-mono text-[10px] font-bold ${activeStyle === layer.id ? "text-workshop-emerald" : "text-workshop-chrome"}`}>
                        {layer.label}
                      </div>
                    </div>
                    {activeStyle === layer.id && (
                      <span className="ml-auto text-workshop-emerald text-xs">●</span>
                    )}
                  </button>
                ))}
                <div className="weld-h my-2" />
                <p className="font-mono text-[9px] text-workshop-muted px-1">
                  Click map to place waypoints. Use GPS controls bottom-left to track position.
                </p>
              </div>
            )}

            {/* ── WAYPOINTS PANEL ── */}
            {sidePanel === "waypoints" && (
              <div className="p-3 space-y-3">
                {(waypoints ?? []).length === 0 && (
                  <p className="font-mono text-[10px] text-workshop-muted text-center py-4">
                    No waypoints. Click map to place.
                  </p>
                )}
                {(waypoints ?? []).map(wp => (
                  <div
                    key={wp._id}
                    className={`flex items-start gap-2 p-2.5 rounded cursor-pointer transition-all ${
                      selectedWaypoint === wp._id ? "border border-workshop-emerald/50 bg-workshop-emerald/5" : "border border-workshop-dim hover:border-workshop-emerald/20"
                    }`}
                    style={{ borderRadius: 4 }}
                    onClick={() => {
                      setSelectedWaypoint(wp._id);
                      mapRef.current?.flyTo({ center: [wp.lng, wp.lat], zoom: 14, duration: 800 });
                    }}
                  >
                    <span style={{ color: WAYPOINT_COLORS[wp.waypointType as WaypointType] ?? "#34d399" }} className="text-sm mt-0.5">
                      {WAYPOINT_ICONS[wp.waypointType as WaypointType] ?? "◈"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-[10px] font-bold text-workshop-chrome truncate">{wp.label}</div>
                      {wp.description && (
                        <div className="font-mono text-[9px] text-workshop-muted truncate">{wp.description}</div>
                      )}
                      <div className="font-mono text-[9px] text-workshop-dim mt-0.5">
                        {wp.lat.toFixed(4)}, {wp.lng.toFixed(4)}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteWp({ id: wp._id }); }}
                      className="text-workshop-dim hover:text-workshop-crimson text-xs flex-shrink-0"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}

            {/* ── OSINT PANEL ── */}
            {sidePanel === "osint" && (
              <div className="p-3 space-y-2">
                {(feeds ?? []).map(feed => (
                  <div
                    key={feed._id}
                    className="p-2.5 rounded"
                    style={{ border: `1px solid ${feed.enabled ? feed.displayColor + "44" : "#1a1a1a"}`, borderRadius: 4 }}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-sm">{feed.iconEmoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] font-bold text-workshop-chrome truncate">{feed.name}</div>
                        <div className="font-mono text-[9px] flex items-center gap-1.5 mt-0.5">
                          <span
                            className="px-1.5 py-0.5 rounded"
                            style={{
                              background: feed.lastStatus === "ok" ? "#065f4620" : feed.lastStatus === "error" ? "#7f1d1d20" : "#1a1a1a",
                              color: feed.lastStatus === "ok" ? "#34d399" : feed.lastStatus === "error" ? "#ef4444" : "#64748b",
                              border: `1px solid ${feed.lastStatus === "ok" ? "#065f46" : feed.lastStatus === "error" ? "#7f1d1d" : "#2a2a2a"}`,
                            }}
                          >
                            {feed.lastStatus ?? "IDLE"}
                          </span>
                          {feed.lastFetchedAt && (
                            <span className="text-workshop-dim">
                              {Math.round((Date.now() - feed.lastFetchedAt) / 60000)}m ago
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => toggleFeed({ feedId: feed._id, enabled: !feed.enabled })}
                          className={`font-mono text-[9px] px-2 py-1 rounded border transition-all ${
                            feed.enabled
                              ? "border-workshop-emerald text-workshop-emerald bg-workshop-emerald/10"
                              : "border-workshop-dim text-workshop-muted"
                          }`}
                        >
                          {feed.enabled ? "ON" : "OFF"}
                        </button>
                        <button
                          onClick={() => fetchFeed({ feedId: feed._id })}
                          className="font-mono text-[9px] px-2 py-1 rounded border border-workshop-dim text-workshop-muted hover:border-workshop-silver/40 hover:text-workshop-chrome transition-all"
                        >
                          ↻
                        </button>
                      </div>
                    </div>
                    {feed.cachedDataJson && (() => {
                      try {
                        const d = JSON.parse(feed.cachedDataJson);
                        const count = d?.features?.length ?? "?";
                        return (
                          <div className="font-mono text-[9px] text-workshop-dim">
                            {count} features cached
                          </div>
                        );
                      } catch (_) { return null; }
                    })()}
                  </div>
                ))}
              </div>
            )}

            {/* ── TRACKS PANEL ── */}
            {sidePanel === "tracks" && (
              <div className="p-3 space-y-2">
                {(tracks ?? []).length === 0 && (
                  <p className="font-mono text-[10px] text-workshop-muted text-center py-4">
                    No tracks. Use GPS controls to record.
                  </p>
                )}
                {(tracks ?? []).map(track => {
                  let pts = 0;
                  try { pts = JSON.parse(track.pointsJson).length; } catch (_) { /* */ }
                  return (
                    <div
                      key={track._id}
                      className="flex items-center gap-2 p-2.5 rounded"
                      style={{ border: `1px solid ${track.active ? track.color + "66" : "#1a1a1a"}`, borderRadius: 4 }}
                    >
                      <div
                        className="w-3 h-3 rounded-sm flex-shrink-0"
                        style={{ background: track.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-mono text-[10px] font-bold text-workshop-chrome truncate">{track.label}</div>
                        <div className="font-mono text-[9px] text-workshop-dim">{pts} pts · {track.trackType}</div>
                      </div>
                      {track.active && (
                        <span className="w-1.5 h-1.5 rounded-full bg-workshop-emerald animate-pulse flex-shrink-0" />
                      )}
                      <button
                        onClick={() => deleteTrack({ trackId: track._id })}
                        className="text-workshop-dim hover:text-workshop-crimson text-xs flex-shrink-0"
                      >✕</button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── WAYPOINT PLACEMENT MODAL ── */}
      {pendingLngLat && (
        <div
          className="absolute inset-0 z-20 flex items-end justify-center pb-8"
          style={{ pointerEvents: "none" }}
        >
          <div
            className="w-80 rounded-lg overflow-hidden"
            style={{
              background: "rgba(8,8,8,0.97)",
              border: "1px solid #2a2a2a",
              borderTopColor: "#3a3a3a",
              boxShadow: "0 -8px 32px rgba(0,0,0,0.9)",
              pointerEvents: "all",
            }}
          >
            <div className="hazard-stripe h-1" />
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-mono text-[10px] font-bold text-workshop-chrome tracking-widest">◈ PLACE WAYPOINT</span>
                <button
                  onClick={() => setPendingLngLat(null)}
                  className="text-workshop-muted hover:text-workshop-chrome text-xs"
                >✕</button>
              </div>
              <div className="font-mono text-[9px] text-workshop-dim mb-3">
                {pendingLngLat.lat.toFixed(5)}°, {pendingLngLat.lng.toFixed(5)}°
              </div>

              {/* Type selector */}
              <div className="grid grid-cols-3 gap-1.5 mb-3">
                {(Object.keys(WAYPOINT_COLORS) as WaypointType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => setWpForm(f => ({ ...f, waypointType: type }))}
                    className={`font-mono text-[9px] py-1.5 rounded border transition-all flex items-center justify-center gap-1 ${
                      wpForm.waypointType === type
                        ? "border-current"
                        : "border-workshop-dim text-workshop-muted hover:border-workshop-dim/60"
                    }`}
                    style={wpForm.waypointType === type ? { color: WAYPOINT_COLORS[type], borderColor: WAYPOINT_COLORS[type], background: WAYPOINT_COLORS[type] + "15" } : {}}
                  >
                    <span>{WAYPOINT_ICONS[type]}</span>
                    <span className="uppercase">{type}</span>
                  </button>
                ))}
              </div>

              <input
                className="w-full mb-2 px-3 py-2 rounded font-mono text-xs text-workshop-chrome placeholder-workshop-dim outline-none"
                style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4 }}
                placeholder="Label (required)"
                value={wpForm.label}
                onChange={e => setWpForm(f => ({ ...f, label: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handlePlaceWaypoint()}
                autoFocus
              />
              <input
                className="w-full mb-3 px-3 py-2 rounded font-mono text-xs text-workshop-chrome placeholder-workshop-dim outline-none"
                style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", borderRadius: 4 }}
                placeholder="Description (optional)"
                value={wpForm.description}
                onChange={e => setWpForm(f => ({ ...f, description: e.target.value }))}
              />
              <button
                onClick={handlePlaceWaypoint}
                disabled={!wpForm.label.trim()}
                className="btn-forge btn-emerald w-full text-[10px] py-2 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ◈ CONFIRM WAYPOINT
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TACTICAL GRID OVERLAY (subtle) ── */}
      <div
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: "linear-gradient(rgba(16,185,129,0.015) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.015) 1px, transparent 1px)",
          backgroundSize: "80px 80px",
        }}
      />

      {/* ── CORNER BRACKETS ── */}
      <div className="absolute top-[60px] left-2 w-4 h-4 corner-tl pointer-events-none z-10" />
      <div className="absolute top-[60px] right-2 w-4 h-4 corner-tr pointer-events-none z-10" />
      <div className="absolute bottom-2 left-2 w-4 h-4 corner-bl pointer-events-none z-10" />
      <div className="absolute bottom-2 right-2 w-4 h-4 corner-br pointer-events-none z-10" />
    </div>
  );
}
