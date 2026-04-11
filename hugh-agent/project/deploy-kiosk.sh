#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HUGH Kiosk Deployer
# Run on the Proxmox iMac (the host running the 27" 5K display).
#
# What it does:
#   1. Builds the Vite frontend
#   2. Ensures PM2 is running the static file server
#   3. Launches Chromium in kiosk mode on the 5K display
#
# Usage:
#   chmod +x deploy-kiosk.sh
#   ./deploy-kiosk.sh             # full deploy + kiosk launch
#   ./deploy-kiosk.sh --no-kiosk  # build + serve only (for first run / camera permissions)
#   ./deploy-kiosk.sh --stop      # kill the kiosk and PM2 server
#
# Requirements: node, npm, pm2, chromium-browser (or google-chrome)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT=4173
PM2_NAME="hugh-kiosk-server"
KIOSK_URL="http://localhost:${PORT}/?kiosk=1#/kiosk"

# ── Arg parsing ───────────────────────────────────────────────────────────────
NO_KIOSK=false
STOP=false
for arg in "$@"; do
  case $arg in
    --no-kiosk) NO_KIOSK=true ;;
    --stop)     STOP=true ;;
  esac
done

# ── Stop mode ─────────────────────────────────────────────────────────────────
if [[ "$STOP" == "true" ]]; then
  echo "[kiosk] Stopping..."
  pm2 stop "$PM2_NAME" 2>/dev/null || true
  pm2 delete "$PM2_NAME" 2>/dev/null || true
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  pkill -f "chrome.*kiosk"   2>/dev/null || true
  echo "[kiosk] Stopped."
  exit 0
fi

# ── Checks ────────────────────────────────────────────────────────────────────
command -v node  >/dev/null || { echo "ERROR: node not found"; exit 1; }
command -v npm   >/dev/null || { echo "ERROR: npm not found";  exit 1; }
command -v pm2   >/dev/null || { npm install -g pm2; }

# Find Chromium
CHROME=""
for candidate in chromium-browser chromium google-chrome google-chrome-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" && "$NO_KIOSK" == "false" ]]; then
  echo "WARNING: No Chromium/Chrome found. Install with: apt install chromium-browser"
  echo "         Running --no-kiosk mode instead."
  NO_KIOSK=true
fi

# ── Build ─────────────────────────────────────────────────────────────────────
echo "[kiosk] Installing dependencies..."
cd "$SCRIPT_DIR"
npm install --silent

echo "[kiosk] Building frontend..."
npm run build

# ── Serve ─────────────────────────────────────────────────────────────────────
echo "[kiosk] Starting static file server on port ${PORT}..."
pm2 stop   "$PM2_NAME" 2>/dev/null || true
pm2 delete "$PM2_NAME" 2>/dev/null || true

pm2 start npx \
  --name "$PM2_NAME" \
  -- vite preview --host 0.0.0.0 --port "$PORT"

pm2 save

# Wait for server to come up
echo "[kiosk] Waiting for server..."
for i in {1..20}; do
  if curl -sf "http://localhost:${PORT}" >/dev/null 2>&1; then
    echo "[kiosk] Server up."
    break
  fi
  sleep 0.5
done

# ── Launch Chromium kiosk ──────────────────────────────────────────────────────
if [[ "$NO_KIOSK" == "false" ]]; then
  echo "[kiosk] Launching Chromium kiosk on display :0..."

  # Kill any existing kiosk chrome
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  pkill -f "chrome.*kiosk"   2>/dev/null || true
  sleep 0.5

  DISPLAY=:0 "$CHROME" \
    --kiosk \
    --no-sandbox \
    --disable-infobars \
    --disable-session-crashed-bubble \
    --disable-restore-session-state \
    --autoplay-policy=no-user-gesture-required \
    --use-fake-ui-for-media-stream \
    --start-fullscreen \
    --window-position=0,0 \
    --app="$KIOSK_URL" \
    >/dev/null 2>&1 &

  echo "[kiosk] Chromium launched in kiosk mode: $KIOSK_URL"
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  HUGH is live on the 5K display.                    │"
  echo "  │  Move the mouse to reveal the mode bar.             │"
  echo "  │  Admin panel: http://localhost:${PORT}              │"
  echo "  └─────────────────────────────────────────────────────┘"
else
  echo ""
  echo "  [kiosk] Server running at http://localhost:${PORT}"
  echo "  [kiosk] Navigate to http://localhost:${PORT} in your browser."
  echo "  [kiosk] After granting camera permission, re-run without --no-kiosk."
fi
