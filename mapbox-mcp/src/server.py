"""
Mapbox MCP Server — Grizzly Workshop
Provides geocoding, directions, static maps, isochrones, and style management
via the Mapbox APIs, exposed as MCP tools over stdio.
"""

import os
import json
import logging
import base64
from typing import Optional
from mcp.server.fastmcp import FastMCP
import requests

# ── Config ──────────────────────────────────────────────────────────────────
MAPBOX_PUBLIC_TOKEN = os.environ.get("MAPBOX_PUBLIC_TOKEN", "")
MAPBOX_SECRET_TOKEN = os.environ.get("MAPBOX_SECRET_TOKEN", "")
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")

logging.basicConfig(level=getattr(logging, LOG_LEVEL))
logger = logging.getLogger("MapboxMCP")

BASE_URL = "https://api.mapbox.com"

mcp = FastMCP("MapboxMCP")


def _token():
    """Return the best available token."""
    return MAPBOX_SECRET_TOKEN or MAPBOX_PUBLIC_TOKEN


def _get(url: str, params: dict = None, raw: bool = False):
    """Make authenticated GET request to Mapbox API."""
    params = params or {}
    params["access_token"] = _token()
    resp = requests.get(url, params=params, timeout=30)
    resp.raise_for_status()
    if raw:
        return resp.content
    return resp.json()


def _post(url: str, data: dict = None, json_body: dict = None):
    """Make authenticated POST request to Mapbox API."""
    params = {"access_token": _token()}
    resp = requests.post(url, params=params, json=json_body, data=data, timeout=30)
    resp.raise_for_status()
    return resp.json()


# ── Geocoding ───────────────────────────────────────────────────────────────

@mcp.tool()
def geocode_forward(query: str, limit: int = 5, country: str = "", types: str = "") -> str:
    """Search for a place by name/address and return coordinates.

    Args:
        query: Place name, address, or landmark to search for.
        limit: Max results (1-10, default 5).
        country: Comma-separated ISO 3166 country codes to filter (e.g. "US,CA").
        types: Comma-separated feature types (e.g. "place,address,poi").
    """
    params = {"limit": min(limit, 10)}
    if country:
        params["country"] = country
    if types:
        params["types"] = types
    result = _get(f"{BASE_URL}/search/geocode/v6/forward", {**params, "q": query})
    features = result.get("features", [])
    out = []
    for f in features:
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [])
        out.append({
            "name": props.get("full_address") or props.get("name", ""),
            "coordinates": coords,
            "place_type": props.get("feature_type", ""),
            "mapbox_id": props.get("mapbox_id", ""),
        })
    return json.dumps(out, indent=2)


@mcp.tool()
def geocode_reverse(longitude: float, latitude: float, types: str = "") -> str:
    """Convert coordinates to a human-readable address.

    Args:
        longitude: Longitude (-180 to 180).
        latitude: Latitude (-90 to 90).
        types: Comma-separated feature types to filter.
    """
    params = {"longitude": longitude, "latitude": latitude}
    if types:
        params["types"] = types
    result = _get(f"{BASE_URL}/search/geocode/v6/reverse", params)
    features = result.get("features", [])
    out = []
    for f in features:
        props = f.get("properties", {})
        out.append({
            "name": props.get("full_address") or props.get("name", ""),
            "feature_type": props.get("feature_type", ""),
        })
    return json.dumps(out, indent=2)


# ── Directions ──────────────────────────────────────────────────────────────

@mcp.tool()
def get_directions(
    coordinates: str,
    profile: str = "driving",
    alternatives: bool = False,
    steps: bool = False,
    geometries: str = "geojson",
) -> str:
    """Get driving/walking/cycling directions between waypoints.

    Args:
        coordinates: Semicolon-separated lon,lat pairs (e.g. "-73.99,40.73;-118.24,34.05").
        profile: Routing profile — "driving", "driving-traffic", "walking", or "cycling".
        alternatives: Whether to return alternative routes.
        steps: Whether to include turn-by-turn instructions.
        geometries: Response geometry format — "geojson", "polyline", or "polyline6".
    """
    params = {
        "alternatives": str(alternatives).lower(),
        "steps": str(steps).lower(),
        "geometries": geometries,
        "overview": "full",
    }
    result = _get(f"{BASE_URL}/directions/v5/mapbox/{profile}/{coordinates}", params)
    routes = result.get("routes", [])
    out = []
    for r in routes:
        out.append({
            "duration_seconds": r.get("duration"),
            "distance_meters": r.get("distance"),
            "summary": r.get("legs", [{}])[0].get("summary", "") if r.get("legs") else "",
            "geometry": r.get("geometry") if geometries == "geojson" else "(encoded)",
        })
    return json.dumps(out, indent=2)


# ── Static Maps ─────────────────────────────────────────────────────────────

@mcp.tool()
def get_static_map(
    longitude: float,
    latitude: float,
    zoom: int = 13,
    width: int = 600,
    height: int = 400,
    style: str = "streets-v12",
    marker: bool = True,
) -> str:
    """Generate a static map image URL centered on given coordinates.

    Args:
        longitude: Center longitude.
        latitude: Center latitude.
        zoom: Zoom level (0-22).
        width: Image width in pixels (max 1280).
        height: Image height in pixels (max 1280).
        style: Mapbox style ID (e.g. "streets-v12", "satellite-v9", "dark-v11").
        marker: Whether to place a pin marker at the center.
    """
    overlay = ""
    if marker:
        overlay = f"pin-s+ff0000({longitude},{latitude})/"
    url = (
        f"{BASE_URL}/styles/v1/mapbox/{style}/static/"
        f"{overlay}{longitude},{latitude},{zoom}/{width}x{height}"
        f"?access_token={MAPBOX_PUBLIC_TOKEN}"
    )
    return json.dumps({"map_url": url, "note": "Open this URL in a browser to view the map."})


# ── Isochrones ──────────────────────────────────────────────────────────────

@mcp.tool()
def get_isochrone(
    longitude: float,
    latitude: float,
    contours_minutes: str = "5,10,15",
    profile: str = "driving",
    polygons: bool = True,
) -> str:
    """Get reachable areas from a point within given travel times.

    Args:
        longitude: Center longitude.
        latitude: Center latitude.
        contours_minutes: Comma-separated minutes (e.g. "5,10,15"). Max 4 values, each 1-60.
        profile: Travel mode — "driving", "walking", or "cycling".
        polygons: Return polygons (True) or linestrings (False).
    """
    params = {
        "contours_minutes": contours_minutes,
        "polygons": str(polygons).lower(),
        "generalize": 500,
    }
    result = _get(f"{BASE_URL}/isochrone/v1/mapbox/{profile}/{longitude},{latitude}", params)
    return json.dumps(result, indent=2)


# ── Matrix ──────────────────────────────────────────────────────────────────

@mcp.tool()
def get_matrix(
    coordinates: str,
    profile: str = "driving",
    annotations: str = "duration,distance",
) -> str:
    """Calculate travel time/distance matrix between multiple points.

    Args:
        coordinates: Semicolon-separated lon,lat pairs.
        profile: Routing profile.
        annotations: "duration", "distance", or "duration,distance".
    """
    params = {"annotations": annotations}
    result = _get(f"{BASE_URL}/directions-matrix/v1/mapbox/{profile}/{coordinates}", params)
    return json.dumps({
        "durations": result.get("durations"),
        "distances": result.get("distances"),
        "destinations": [{"name": d.get("name", ""), "location": d.get("location")} for d in result.get("destinations", [])],
    }, indent=2)


# ── Styles ──────────────────────────────────────────────────────────────────

@mcp.tool()
def list_styles(limit: int = 10) -> str:
    """List Mapbox styles for the authenticated account.

    Args:
        limit: Max number of styles to return.
    """
    # Need the username from the token
    token_info = _get(f"{BASE_URL}/tokens/v2", {"access_token": _token()})
    username = token_info.get("code")  # fallback
    # Try to get username from token metadata
    try:
        # Decode JWT payload to get username
        token = _token()
        payload = token.split('.')[1]
        # Add padding
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        username = decoded.get("u", "")
    except Exception:
        username = "oldmangrizzz"  # fallback to known username

    result = _get(f"{BASE_URL}/styles/v1/{username}", {"limit": limit})
    styles = []
    for s in result if isinstance(result, list) else []:
        styles.append({
            "id": s.get("id"),
            "name": s.get("name"),
            "owner": s.get("owner"),
            "created": s.get("created"),
            "modified": s.get("modified"),
        })
    return json.dumps(styles, indent=2)


@mcp.tool()
def get_style(style_id: str) -> str:
    """Retrieve a specific Mapbox style by ID.

    Args:
        style_id: The style ID to retrieve.
    """
    try:
        token = _token()
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        username = decoded.get("u", "oldmangrizzz")
    except Exception:
        username = "oldmangrizzz"

    result = _get(f"{BASE_URL}/styles/v1/{username}/{style_id}")
    return json.dumps({
        "id": result.get("id"),
        "name": result.get("name"),
        "version": result.get("version"),
        "sources": list(result.get("sources", {}).keys()),
        "layers_count": len(result.get("layers", [])),
        "center": result.get("center"),
        "zoom": result.get("zoom"),
    }, indent=2)


# ── Tilequery ───────────────────────────────────────────────────────────────

@mcp.tool()
def tilequery(
    longitude: float,
    latitude: float,
    tileset: str = "mapbox.mapbox-streets-v8",
    radius: int = 0,
    limit: int = 5,
) -> str:
    """Query features at a point from a Mapbox tileset.

    Args:
        longitude: Query longitude.
        latitude: Query latitude.
        tileset: Tileset ID to query.
        radius: Search radius in meters (0 = exact point).
        limit: Max features to return (1-50).
    """
    params = {"radius": radius, "limit": min(limit, 50)}
    result = _get(f"{BASE_URL}/v4/{tileset}/tilequery/{longitude},{latitude}.json", params)
    features = result.get("features", [])
    out = []
    for f in features:
        out.append({
            "properties": f.get("properties", {}),
            "geometry_type": f.get("geometry", {}).get("type"),
            "tilequery": f.get("properties", {}).get("tilequery", {}),
        })
    return json.dumps(out, indent=2)


# ── Map Matching ────────────────────────────────────────────────────────────

@mcp.tool()
def map_match(
    coordinates: str,
    profile: str = "driving",
    geometries: str = "geojson",
) -> str:
    """Snap GPS traces to roads using the Map Matching API.

    Args:
        coordinates: Semicolon-separated lon,lat pairs of GPS trace points.
        profile: Routing profile — "driving", "walking", or "cycling".
        geometries: Geometry format — "geojson", "polyline", or "polyline6".
    """
    params = {"geometries": geometries, "overview": "full"}
    result = _get(f"{BASE_URL}/matching/v5/mapbox/{profile}/{coordinates}", params)
    matchings = result.get("matchings", [])
    out = []
    for m in matchings:
        out.append({
            "confidence": m.get("confidence"),
            "distance_meters": m.get("distance"),
            "duration_seconds": m.get("duration"),
        })
    return json.dumps(out, indent=2)


# ── Optimization ────────────────────────────────────────────────────────────

@mcp.tool()
def optimize_route(
    coordinates: str,
    profile: str = "driving",
    roundtrip: bool = True,
    source: str = "any",
    destination: str = "any",
) -> str:
    """Find optimal visiting order for multiple waypoints (TSP solver).

    Args:
        coordinates: Semicolon-separated lon,lat pairs (2-12 points).
        profile: Routing profile.
        roundtrip: Whether to return to starting point.
        source: "any" or "first" to fix the starting point.
        destination: "any" or "last" to fix the ending point.
    """
    params = {
        "roundtrip": str(roundtrip).lower(),
        "source": source,
        "destination": destination,
        "geometries": "geojson",
        "overview": "full",
    }
    result = _get(f"{BASE_URL}/optimized-trips/v1/mapbox/{profile}/{coordinates}", params)
    trips = result.get("trips", [])
    out = []
    for t in trips:
        out.append({
            "distance_meters": t.get("distance"),
            "duration_seconds": t.get("duration"),
            "waypoint_order": [wp.get("waypoint_index") for wp in result.get("waypoints", [])],
        })
    return json.dumps(out, indent=2)


# ── Account Info ────────────────────────────────────────────────────────────

@mcp.tool()
def get_account_info() -> str:
    """Get information about the authenticated Mapbox account."""
    try:
        token = _token()
        payload = token.split('.')[1]
        payload += '=' * (4 - len(payload) % 4)
        decoded = json.loads(base64.urlsafe_b64decode(payload))
        username = decoded.get("u", "unknown")

        # Get token scopes
        scopes = decoded.get("scopes", [])

        return json.dumps({
            "username": username,
            "token_type": "secret" if token.startswith("sk.") else "public",
            "scopes": scopes,
        }, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    if not MAPBOX_PUBLIC_TOKEN and not MAPBOX_SECRET_TOKEN:
        logger.error("No Mapbox token configured. Set MAPBOX_PUBLIC_TOKEN or MAPBOX_SECRET_TOKEN.")
        exit(1)
    logger.info(f"Starting MapboxMCP with {'secret' if MAPBOX_SECRET_TOKEN else 'public'} token")
    mcp.run()
