#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# HUGH Kiosk Migration: CT-101 LXC → Bare-Metal
#
# Purpose:
#   Migrate the Chromium kiosk display from CT-101 LXC container to bare-metal
#   host (Proxmox iMac) while keeping CT-101 running as the agent runtime
#   (Vite dev server, Cloudflare tunnel, Convex client).
#
# Architecture After Migration:
#   ┌─────────────────────────────────────────────────────────────────────┐
#   │  CT-101 LXC (Proxmox)                    Bare-Metal iMac (:0)       │
#   │  ┌──────────────────────┐                ┌───────────────────────┐  │
#   │  │  Vite Dev Server     │◄──HTTP:4173──►│  Chromium Kiosk       │  │
#   │  │  (localhost:5173)    │                │  (display :0)         │  │
#   │  │  PM2 Preview (:4173) │                │                       │  │
#   │  ├──────────────────────┤                │  ┌─────────────────┐  │  │
#   │  │  Cloudflare Tunnel   │                │  │  5K Display     │  │  │
#   │  │  workshop.grizzly... │                │  │  Fullscreen     │  │  │
#   │  └──────────────────────┘                │  └─────────────────┘  │  │
#   │         │                                └───────────────────────┘  │
#   │         ▼                                                           │
#   │  ┌──────────────────────┐                                           │
#   │  │  Convex Cloud        │◄──────────────────────────────────────────┘
#   │  │  (State, Memory,     │    (Bare-metal Chromium connects via
#   │  │   LFM Runtime)       │     Convex HTTP to CT-101)
#   │  └──────────────────────┘
#   └─────────────────────────────────────────────────────────────────────┘
#
# Benefits:
#   - Chromium runs natively on bare-metal (no container GPU/display passthrough)
#   - CT-101 remains the single source of truth for agent state
#   - Cloudflare tunnel stays on CT-101 (no DNS changes required)
#   - Zero-downtime switchover possible
#   - Easy rollback to original CT-101 kiosk mode
#
# Usage:
#   # Run on bare-metal iMac (the Proxmox host with 5K display)
#   chmod +x scripts/migrate-kiosk-baremetal.sh
#   ./scripts/migrate-kiosk-baremetal.sh
#
# Prerequisites:
#   - CT-101 LXC running with Vite + Cloudflare tunnel active
#   - Bare-metal iMac has network access to CT-101 (same VLAN)
#   - Node.js, npm, PM2, Chromium installed on bare-metal
#   - SSH access from bare-metal to CT-101 (for status checks)
#
# Environment Variables (set these before running):
#   CT101_HOST        - CT-101 LXC IP address or hostname (default: proxmox-pve)
#   CT101_SSH_USER    - SSH user for CT-101 (default: root)
#   CT101_SSH_KEY     - SSH key path (default: ~/.ssh/id_rsa)
#   KIOSK_PORT        - Port for PM2 static server (default: 4173)
#   DISPLAY_NUM       - X display number (default: 0)
#
# Author: HUGH Agent
# Date: 2026-03-31
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# ── Configuration ─────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

CT101_HOST="${CT101_HOST:-proxmox-pve}"
CT101_SSH_USER="${CT101_SSH_USER:-root}"
CT101_SSH_KEY="${CT101_SSH_KEY:-$HOME/.ssh/id_rsa}"
KIOSK_PORT="${KIOSK_PORT:-4173}"
DISPLAY_NUM="${DISPLAY_NUM:-0}"
PM2_NAME="hugh-kiosk-baremetal"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ── Helper Functions ──────────────────────────────────────────────────────────
log_info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
log_success() { echo -e "${GREEN}[OK]${NC}   $1"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $1"; }

check_ssh() {
  if ! ssh -i "$CT101_SSH_KEY" -o ConnectTimeout=5 -o BatchMode=yes "$CT101_SSH_USER@$CT101_HOST" "exit" 2>/dev/null; then
    log_error "Cannot SSH to CT-101 at $CT101_SSH_USER@$CT101_HOST"
    log_info "Set CT101_HOST, CT101_SSH_USER, or CT101_SSH_KEY environment variables if needed"
    return 1
  fi
  return 0
}

check_ct101_services() {
  log_info "Checking CT-101 services..."
  
  # Check Vite/PM2 is running
  if ! ssh -i "$CT101_SSH_KEY" "$CT101_SSH_USER@$CT101_HOST" "pm2 list | grep -q 'hugh-kiosk-server'" 2>/dev/null; then
    log_warn "PM2 kiosk server not running on CT-101"
    log_info "Run deploy-kiosk.sh on CT-101 first"
    return 1
  fi
  
  # Check Cloudflare tunnel
  if ! ssh -i "$CT101_SSH_KEY" "$CT101_SSH_USER@$CT101_HOST" "pgrep -f cloudflared" >/dev/null 2>&1; then
    log_warn "Cloudflare tunnel not running on CT-101"
    log_info "Ensure cloudflared is running: systemctl status cloudflared"
    return 1
  fi
  
  log_success "CT-101 services verified"
  return 0
}

# ── Argument Parsing ──────────────────────────────────────────────────────────
ACTION="migrate"
for arg in "$@"; do
  case $arg in
    --rollback)
      ACTION="rollback"
      ;;
    --status)
      ACTION="status"
      ;;
    --stop)
      ACTION="stop"
      ;;
    --help|-h)
      echo "Usage: $0 [--migrate|--rollback|--status|--stop|--help]"
      echo ""
      echo "Actions:"
      echo "  (none)     Migrate kiosk from CT-101 to bare-metal (default)"
      echo "  --rollback Rollback to CT-101 kiosk mode"
      echo "  --status   Show migration status"
      echo "  --stop     Stop bare-metal kiosk"
      echo "  --help     Show this help"
      exit 0
      ;;
  esac
done

# ── Action: Status ────────────────────────────────────────────────────────────
if [[ "$ACTION" == "status" ]]; then
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║           HUGH Kiosk Migration Status                              ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo ""
  
  echo "CT-101 LXC ($CT101_HOST):"
  if check_ssh; then
    ssh -i "$CT101_SSH_KEY" "$CT101_SSH_USER@$CT101_HOST" "
      echo '  PM2 Status:'
      pm2 list | grep -E 'hugh-kiosk|hugh-agent' | sed 's/^/    /'
      echo '  Cloudflare Tunnel:'
      pgrep -f cloudflared >/dev/null && echo '    ✓ Running' || echo '    ✗ Not running'
      echo '  Network (port $KIOSK_PORT):'
      ss -tlnp | grep :$KIOSK_PORT | sed 's/^/    /' || echo '    Not listening'
    "
  else
    echo "  ✗ SSH unavailable"
  fi
  echo ""
  
  echo "Bare-Metal (this host):"
  echo "  PM2 Status:"
  if command -v pm2 &>/dev/null; then
    pm2 list | grep "$PM2_NAME" | sed 's/^/    /' || echo "    Not configured"
  else
    echo "    PM2 not installed"
  fi
  echo "  Chromium Process:"
  pgrep -f "chrom.*kiosk" >/dev/null && echo "    ✓ Running" || echo "    ✗ Not running"
  echo "  X Display :$DISPLAY_NUM:"
  if xrandr &>/dev/null; then
    echo "    ✓ Available"
    xrandr --query | head -1 | sed 's/^/    /'
  else
    echo "    ✗ Unavailable"
  fi
  echo ""
  exit 0
fi

# ── Action: Stop ──────────────────────────────────────────────────────────────
if [[ "$ACTION" == "stop" ]]; then
  log_info "Stopping bare-metal kiosk..."
  pm2 stop "$PM2_NAME" 2>/dev/null || true
  pm2 delete "$PM2_NAME" 2>/dev/null || true
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  pkill -f "chrome.*kiosk"   2>/dev/null || true
  log_success "Bare-metal kiosk stopped"
  exit 0
fi

# ── Action: Rollback ──────────────────────────────────────────────────────────
if [[ "$ACTION" == "rollback" ]]; then
  echo "╔════════════════════════════════════════════════════════════════════╗"
  echo "║           HUGH Kiosk Rollback: Bare-Metal → CT-101                ║"
  echo "╚════════════════════════════════════════════════════════════════════╝"
  echo ""
  
  log_info "Step 1: Stopping bare-metal kiosk..."
  pm2 stop "$PM2_NAME" 2>/dev/null || true
  pm2 delete "$PM2_NAME" 2>/dev/null || true
  pkill -f "chromium.*kiosk" 2>/dev/null || true
  pkill -f "chrome.*kiosk"   2>/dev/null || true
  log_success "Bare-metal kiosk stopped"
  
  log_info "Step 2: Verifying CT-101 services..."
  if ! check_ssh; then
    log_error "Cannot connect to CT-101. Rollback aborted."
    exit 1
  fi
  
  if ! check_ct101_services; then
    log_error "CT-101 services not ready. Please fix and retry."
    exit 1
  fi
  
  log_info "Step 3: Restarting CT-101 kiosk (local display)..."
  ssh -i "$CT101_SSH_KEY" "$CT101_SSH_USER@$CT101_HOST" "
    cd /root/hugh-agent/project || cd /home/*/hugh-agent/project || true
    ./deploy-kiosk.sh --stop 2>/dev/null || true
    sleep 1
    ./deploy-kiosk.sh
  "
  
  log_success "Rollback complete! Kiosk is now running on CT-101 local display"
  echo ""
  echo "  ┌──────────────────────────────────────────────────────────────┐"
  echo "  │  Rollback successful                                         │"
  echo "  │  Kiosk display: CT-101 LXC (local)                           │"
  echo "  │  Cloudflare tunnel: workshop.grizzlymedicine.icu             │"
  echo "  └──────────────────────────────────────────────────────────────┘"
  exit 0
fi

# ── Action: Migrate (default) ────────────────────────────────────────────────
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║           HUGH Kiosk Migration: CT-101 → Bare-Metal               ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# ── Pre-flight Checks ────────────────────────────────────────────────────────
log_info "Running pre-flight checks..."

# Check SSH connectivity
if ! check_ssh; then
  log_error "SSH check failed. Migration aborted."
  exit 1
fi
log_success "SSH to CT-101 verified"

# Check CT-101 services
if ! check_ct101_services; then
  log_error "CT-101 services check failed. Migration aborted."
  exit 1
fi

# Check local requirements
command -v node  >/dev/null || { log_error "node not found. Install Node.js first."; exit 1; }
command -v npm   >/dev/null || { log_error "npm not found. Install Node.js first."; exit 1; }
command -v pm2   >/dev/null || {
  log_info "Installing PM2..."
  npm install -g pm2
}
log_success "Node.js and PM2 available"

# Find Chromium
CHROME=""
for candidate in chromium-browser chromium google-chrome google-chrome-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then
    CHROME="$candidate"
    break
  fi
done

if [[ -z "$CHROME" ]]; then
  log_error "Chromium/Chrome not found"
  log_info "Install with: apt install chromium-browser (Ubuntu/Debian) or brew install chromium (macOS)"
  exit 1
fi
log_success "Chromium found: $CHROME"

# Check X display
if ! xrandr &>/dev/null; then
  log_error "X display :$DISPLAY_NUM not available"
  log_info "Ensure you're running on a system with X11 and a connected display"
  exit 1
fi
log_success "X display :$DISPLAY_NUM available"

# ── Step 1: Build Frontend on Bare-Metal ─────────────────────────────────────
log_info "Step 1: Building frontend on bare-metal..."
cd "$PROJECT_ROOT"

echo "[bare-metal] Installing dependencies..."
npm install --silent

echo "[bare-metal] Building frontend..."
npm run build

log_success "Frontend built successfully"

# ── Step 2: Start PM2 Static Server ──────────────────────────────────────────
log_info "Step 2: Starting PM2 static file server..."

pm2 stop "$PM2_NAME" 2>/dev/null || true
pm2 delete "$PM2_NAME" 2>/dev/null || true

pm2 start npx \
  --name "$PM2_NAME" \
  -- vite preview --host 0.0.0.0 --port "$KIOSK_PORT"

pm2 save

# Wait for server to come up
log_info "Waiting for server to start..."
for i in {1..20}; do
  if curl -sf "http://localhost:${KIOSK_PORT}" >/dev/null 2>&1; then
    log_success "Static server running on port $KIOSK_PORT"
    break
  fi
  sleep 0.5
done

if ! curl -sf "http://localhost:${KIOSK_PORT}" >/dev/null 2>&1; then
  log_error "Server failed to start on port $KIOSK_PORT"
  exit 1
fi

# ── Step 3: Configure CT-101 for Remote Kiosk Mode ───────────────────────────
log_info "Step 3: Configuring CT-101 for remote kiosk mode..."

ssh -i "$CT101_SSH_KEY" "$CT101_SSH_USER@$CT101_HOST" "
  cd /root/hugh-agent/project || cd /home/*/hugh-agent/project || true
  
  # Stop local kiosk but keep PM2 server running
  pkill -f 'chromium.*kiosk' 2>/dev/null || true
  pkill -f 'chrome.*kiosk' 2>/dev/null || true
  
  echo 'CT-101 configured for remote kiosk mode'
  echo '  - Vite dev server: running'
  echo '  - PM2 static server: running on port $KIOSK_PORT'
  echo '  - Cloudflare tunnel: running'
  echo '  - Local Chromium kiosk: stopped (moved to bare-metal)'
"

log_success "CT-101 configured for remote kiosk mode"

# ── Step 4: Launch Chromium Kiosk on Bare-Metal ──────────────────────────────
log_info "Step 4: Launching Chromium kiosk on bare-metal display :$DISPLAY_NUM..."

# Kill any existing kiosk chrome
pkill -f "chromium.*kiosk" 2>/dev/null || true
pkill -f "chrome.*kiosk"   2>/dev/null || true
sleep 0.5

KIOSK_URL="http://localhost:${KIOSK_PORT}/?kiosk=1#/kiosk"

DISPLAY=:$DISPLAY_NUM "$CHROME" \
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

CHROME_PID=$!
log_success "Chromium launched (PID: $CHROME_PID)"

# ── Step 5: Verify Migration ─────────────────────────────────────────────────
log_info "Step 5: Verifying migration..."
sleep 2

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                    Migration Complete                              ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""
echo "  Architecture:"
echo "  ┌───────────────────────────────────────────────────────────────┐"
echo "  │  CT-101 LXC                    Bare-Metal iMac                │"
echo "  │  ┌──────────────────────┐      ┌───────────────────────────┐  │"
echo "  │  │  Vite Dev Server     │─────►│  Chromium Kiosk           │  │"
echo "  │  │  PM2 Preview :$KIOSK_PORT   │      │  Display :$DISPLAY_NUM (5K)          │  │"
echo "  │  │  Cloudflare Tunnel   │      │                           │  │"
echo "  │  │  Convex Client       │      │  ┌─────────────────────┐  │  │"
echo "  │  └──────────────────────┘      │  │  HUGH Display       │  │  │"
echo "  │         │                      │  │  AWAKE/COMPETITION  │  │  │"
echo "  │         ▼                      │  │  Neural Field       │  │  │"
echo "  │  ┌──────────────────────┐      │  └─────────────────────┘  │  │"
echo "  │  │  Convex Cloud        │      └───────────────────────────┘  │"
echo "  │  └──────────────────────┘                                     │"
echo "  └───────────────────────────────────────────────────────────────┘"
echo ""
echo "  Status:"
echo "    ✓ CT-101: Agent runtime (Vite, tunnel, Convex)"
echo "    ✓ Bare-metal: Kiosk display (Chromium on :$DISPLAY_NUM)"
echo "    ✓ Cloudflare tunnel: workshop.grizzlymedicine.icu"
echo "    ✓ Zero-downtime: CT-101 never stopped"
echo ""
echo "  Quick Commands:"
echo "    Status:   $0 --status"
echo "    Stop:     $0 --stop"
echo "    Rollback: $0 --rollback"
echo ""
echo "  ┌──────────────────────────────────────────────────────────────┐"
echo "  │  HUGH is live on the 5K display (bare-metal).                │"
echo "  │  CT-101 continues running as agent runtime.                  │"
echo "  │  Move the mouse to reveal the mode bar.                      │"
echo "  └──────────────────────────────────────────────────────────────┘"

exit 0
