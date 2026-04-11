#!/bin/bash
set -e

# ── H.U.G.H. UE5 DEPLOYMENT TO PROXMOX BARE-METAL ───────────────────────────
# This script prepares the Proxmox host for UE5 bare-metal deployment.
#
# Prerequisites:
#   - SSH access to pve.grizzlymedicine.icu (or run locally on Proxmox host)
#   - sudo/root privileges
#   - Internet connection for package installation
#
# Usage:
#   ./scripts/prepare-proxmox-for-ue5.sh [HOST]
#
# Arguments:
#   HOST — SSH target (default: localhost, meaning run locally on Proxmox)

HOST="${1:-localhost}"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"
}

error() {
    echo "[ERROR] $*" >&2
    exit 1
}

# ── SSH WRAPPER ──────────────────────────────────────────────────────────────
ssh_cmd() {
    if [ "$HOST" = "localhost" ]; then
        bash -c "$*"
    else
        ssh root@"$HOST" "$*"
    fi
}

# ── PRE-FLIGHT CHECKS ────────────────────────────────────────────────────────
log "Pre-flight checks..."

if [ "$HOST" != "localhost" ]; then
    if ! ssh root@"$HOST" echo "SSH connection successful" > /dev/null 2>&1; then
        error "Cannot connect to $HOST via SSH"
    fi
    log "✓ SSH connection to $HOST verified"
fi

# ── CREATE UE5-RENDER USER ───────────────────────────────────────────────────
log "Creating ue5-render user..."

ssh_cmd "
if ! id -u ue5-render > /dev/null 2>&1; then
    useradd -m -s /bin/bash -G video,render ue5-render
    echo '✓ Created ue5-render user with video/render groups'
else
    echo '✓ ue5-render user already exists'
fi
"

# ── INSTALL VULKAN DRIVERS ───────────────────────────────────────────────────
log "Installing Vulkan drivers and tools..."

ssh_cmd "
apt-get update
apt-get install -y mesa-vulkan-drivers libvulkan1 vulkan-tools libgl1-mesa-dri
echo '✓ Vulkan packages installed'
"

# Verify Vulkan installation
log "Verifying Vulkan installation..."
VULKAN_OUTPUT=\$(ssh_cmd "DISPLAY=:0 vulkaninfo --summary 2>&1 | head -5" || echo "Vulkan not yet initialized")
log "Vulkan status: \$VULKAN_OUTPUT"

# ── INSTALL XVFB ─────────────────────────────────────────────────────────────
log "Installing Xvfb and dummy video driver..."

ssh_cmd "
apt-get install -y xvfb xserver-xorg-video-dummy
echo '✓ Xvfb and dummy driver installed'
"

# ── CREATE XVFB CONFIGURATION ────────────────────────────────────────────────
log "Creating Xvfb configuration for 5120x2880 display..."

ssh_cmd "
mkdir -p /etc/X11/xorg.conf.d
cat > /etc/X11/xorg.conf.d/99-headless.conf << 'XRCONFIG'
Section \"Device\"
    Identifier \"Dummy Device\"
    Driver \"dummy\"
    VideoRam 256000
EndSection

Section \"Monitor\"
    Identifier \"Dummy Monitor\"
    HorizSync 28.0-80.0
    VertRefresh 48.0-75.0
    Modeline \"5120x2880_60.00\"  240.50  5120 5144 5168 5200  2880 2883 2888 2920  -hsync +vsync
EndSection

Section \"Screen\"
    Identifier \"Dummy Screen\"
    Device \"Dummy Device\"
    Monitor \"Dummy Monitor\"
    DefaultDepth 24
    SubSection \"Display\"
        Depth 24
        Modes \"5120x2880\"
    EndSubSection
EndSection
XRCONFIG
echo '✓ Xvfb configuration created at /etc/X11/xorg.conf.d/99-headless.conf'
"

# ── START XVFB ───────────────────────────────────────────────────────────────
log "Starting Xvfb on display :99..."

ssh_cmd "
# Kill any existing Xvfb on :99
pkill -f 'Xvfb :99' 2>/dev/null || true
sleep 1

# Start Xvfb
Xvfb :99 -screen 0 5120x2880x24 &
sleep 2

# Verify it's running
if pgrep -f 'Xvfb :99' > /dev/null; then
    echo '✓ Xvfb started on :99'
else
    echo 'ERROR: Xvfb failed to start' >&2
    exit 1
fi
"

# ── SET ENVIRONMENT VARIABLES ────────────────────────────────────────────────
log "Setting environment variables..."

ssh_cmd "
# Add to /etc/environment for system-wide access
if ! grep -q 'VK_ICD_FILENAMES' /etc/environment; then
    echo 'VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json' >> /etc/environment
    echo 'DISPLAY=:99' >> /etc/environment
    echo '✓ Environment variables added to /etc/environment'
else
    echo '✓ Environment variables already configured'
fi

# Add to ue5-render's .bashrc for interactive sessions
if ! grep -q 'VK_ICD_FILENAMES' /home/ue5-render/.bashrc; then
    cat >> /home/ue5-render/.bashrc << 'BASHRC'

# UE5 Vulkan environment
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json
export DISPLAY=:99
export DRI_PRIME=1
BASHRC
    echo '✓ Environment variables added to ue5-render .bashrc'
fi
"

# ── VERIFY INSTALLATION ──────────────────────────────────────────────────────
log "Running verification checks..."

ssh_cmd "
echo ''
echo '=== VERIFICATION SUMMARY ==='
echo ''

# Check user
if id ue5-render > /dev/null 2>&1; then
    echo '✓ ue5-render user exists'
    id ue5-render
else
    echo '✗ ue5-render user NOT found'
fi

# Check Vulkan packages
if dpkg -l | grep -q mesa-vulkan-drivers; then
    echo '✓ Vulkan drivers installed'
else
    echo '✗ Vulkan drivers NOT installed'
fi

# Check Xvfb config
if [ -f /etc/X11/xorg.conf.d/99-headless.conf ]; then
    echo '✓ Xvfb configuration exists'
else
    echo '✗ Xvfb configuration NOT found'
fi

# Check Xvfb process
if pgrep -f 'Xvfb :99' > /dev/null; then
    echo '✓ Xvfb running on :99'
    pgrep -af 'Xvfb :99'
else
    echo '✗ Xvfb NOT running'
fi

# Check Vulkan ICD
if [ -f /usr/share/vulkan/icd.d/radeon_icd.x86_64.json ]; then
    echo '✓ Radeon ICD found'
else
    echo '⚠ Radeon ICD not found — may need AMD GPU drivers'
fi

echo ''
echo '=== NEXT STEPS ==='
echo '1. Deploy hugh-ue5.service: sudo cp config/hugh-ue5.service /etc/systemd/system/'
echo '2. Reload systemd: sudo systemctl daemon-reload'
echo '3. Enable service: sudo systemctl enable hugh-ue5'
echo '4. Start service: sudo systemctl start hugh-ue5'
echo '5. Check status: sudo systemctl status hugh-ue5'
echo ''
"

log "✓ Proxmox host preparation complete!"
log ""
log "Deployment artifacts created:"
log "  - config/hugh-ue5.service (systemd service)"
log ""
log "Next: Run ./scripts/deploy-ue5-service.sh to install the systemd service"
