#!/bin/bash
set -e

# ── H.U.G.H. UE5 SERVICE DEPLOYMENT ──────────────────────────────────────────
# Deploys the UE5 systemd service to Proxmox bare-metal host.
#
# Prerequisites:
#   - prepare-proxmox-for-ue5.sh has been run
#   - UE5 binary installed at /home/ue5-render/UnrealEngine
#   - SSH access to pve.grizzlymedicine.icu
#
# Usage:
#   ./scripts/deploy-ue5-service.sh [HOST]

HOST="${1:-localhost}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[ERROR] $*" >&2
    exit 1
}

ssh_cmd() {
    if [ "$HOST" = "localhost" ]; then
        bash -c "$*"
    else
        ssh root@"$HOST" "$*"
    fi
}

# ── VERIFY PREREQUISITES ─────────────────────────────────────────────────────
log "Verifying prerequisites..."

if [ ! -f "config/hugh-ue5.service" ]; then
    error "config/hugh-ue5.service not found. Run this script from the project root."
fi

if [ "$HOST" != "localhost" ]; then
    if ! ssh root@"$HOST" echo "connected" > /dev/null 2>&1; then
        error "Cannot connect to $HOST via SSH"
    fi
fi

# Check if prepare script was run
ssh_cmd "
if ! id -u ue5-render > /dev/null 2>&1; then
    echo 'ERROR: ue5-render user not found. Run prepare-proxmox-for-ue5.sh first.' >&2
    exit 1
fi

if ! pgrep -f 'Xvfb :99' > /dev/null; then
    echo 'WARNING: Xvfb not running on :99. UE5 may fail to start.' >&2
fi
"

log "✓ Prerequisites verified"

# ── DEPLOY SYSTEMD SERVICE ───────────────────────────────────────────────────
log "Deploying hugh-ue5.service to /etc/systemd/system/..."

ssh_cmd "
# Backup existing service if it exists
if [ -f /etc/systemd/system/hugh-ue5.service ]; then
    cp /etc/systemd/system/hugh-ue5.service /etc/systemd/system/hugh-ue5.service.bak.\$(date +%Y%m%d%H%M%S)
    echo '✓ Backed up existing service'
fi

# Copy new service file
cat > /etc/systemd/system/hugh-ue5.service << 'SERVICEFILE'
[Unit]
Description=H.U.G.H. UE5 Motor Cortex
Documentation=https://github.com/GrizzMedicine/H.U.G.H.
After=network.target display-manager.service
Wants=display-manager.service

[Service]
Type=simple
User=ue5-render
Group=video
Environment=\"DISPLAY=:99\"
Environment=\"XDG_RUNTIME_DIR=/run/user/\$(id -u ue5-render)\"
Environment=\"VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json\"
Environment=\"DRI_PRIME=1\"
Environment=\"CONVEX_URL=https://effervescent-toucan-715.convex.cloud\"
WorkingDirectory=/home/ue5-render
ExecStart=/home/ue5-render/UnrealEngine/Engine/Binaries/Linux/UnrealEditor-Cmd /Game/Maps/Entry -windowed -ResX=5120 -ResY=2880 -opengl3
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=hugh-ue5

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=read-only
ReadWritePaths=/home/ue5-render /tmp /var/tmp

[Install]
WantedBy=multi-user.target
SERVICEFILE

echo '✓ Service file deployed'
"

# ── RELOAD AND ENABLE ────────────────────────────────────────────────────────
log "Reloading systemd daemon..."

ssh_cmd "
systemctl daemon-reload
echo '✓ Systemd daemon reloaded'
"

log "Enabling hugh-ue5 service..."

ssh_cmd "
systemctl enable hugh-ue5
echo '✓ Service enabled (will start on boot)'
"

# ── START SERVICE ────────────────────────────────────────────────────────────
log "Starting hugh-ue5 service..."

ssh_cmd "
systemctl start hugh-ue5
sleep 3
echo '✓ Service started'
"

# ── VERIFY STATUS ────────────────────────────────────────────────────────────
log "Verifying service status..."

ssh_cmd "
echo ''
echo '=== UE5 SERVICE STATUS ==='
systemctl status hugh-ue5 --no-pager -l

echo ''
echo '=== RECENT LOGS ==='
journalctl -u hugh-ue5 --no-pager -n 20

echo ''
echo '=== UE5 PROCESS ==='
ps aux | grep UnrealEditor | grep -v grep || echo 'No UE5 process found (may still be initializing)'

echo ''
echo '=== DISPLAY :99 ==='
DISPLAY=:99 xdpyinfo 2>/dev/null | grep dimensions || echo 'Cannot query display :99'
"

# ── DEPLOY CONVEX CONNECTOR ──────────────────────────────────────────────────
log "Deploying Convex connector script..."

ssh_cmd "
cat > /home/ue5-render/convex-connector.py << 'PYTHON'
#!/usr/bin/env python3
\"\"\"
UE5 Convex Connector — Polls Convex world state for neural field rendering.
\"\"\"

import requests
import time
import os
import sys

CONVEX_URL = os.environ.get("CONVEX_URL", "https://effervescent-toucan-715.convex.cloud")
POLL_INTERVAL_MS = 500

def get_world_snapshot():
    \"\"\"Fetch world state from Convex.\"\"\"
    try:
        response = requests.get(f\"{CONVEX_URL}/api/world-snapshot\", timeout=5)
        response.raise_for_status()
        return response.json()
    except Exception as e:
        print(f\"[ERROR] World snapshot failed: {e}\", file=sys.stderr)
        return None

def main():
    print(f\"[Connector] Starting UE5 Convex Connector...\")
    print(f\"[Connector] Convex URL: {CONVEX_URL}\")
    print(f\"[Connector] Poll interval: {POLL_INTERVAL_MS}ms\")
    
    last_wake_word_ts = None
    
    while True:
        try:
            world_state = get_world_snapshot()
            if world_state:
                # Check for wake word trigger
                current_wake_word = world_state.get(\"lastWakeWordTs\")
                if current_wake_word and current_wake_word != last_wake_word_ts:
                    print(f\"[FLARE] Wake word detected at {current_wake_word_ts}\")
                    last_wake_word_ts = current_wake_word_ts
                
                # Log state
                entities = world_state.get(\"entitiesJson\", \"[]\")
                print(f\"[{time.time()}] World state: {len(entities)} entities, attentive={world_state.get('isAttentive', False)}\")
            
        except Exception as e:
            print(f\"[ERROR] Polling failed: {e}\", file=sys.stderr)
        
        time.sleep(POLL_INTERVAL_MS / 1000.0)

if __name__ == \"__main__\":
    main()
PYTHON

chown ue5-render:ue5-render /home/ue5-render/convex-connector.py
chmod +x /home/ue5-render/convex-connector.py
echo '✓ Convex connector deployed to /home/ue5-render/convex-connector.py'
"

log "✓ UE5 service deployment complete!"
log ""
log "Service is now running. Check status with:"
log "  ssh root@$HOST 'systemctl status hugh-ue5'"
log "  ssh root@$HOST 'journalctl -u hugh-ue5 -f'"
log ""
log "To test Convex connector:"
log "  ssh root@$HOST 'sudo -u ue5-render DISPLAY=:99 python3 /home/ue5-render/convex-connector.py'"
