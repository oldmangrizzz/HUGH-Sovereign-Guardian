#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# Grizzly MCP Fleet — Mac Setup Script
# Builds Docker images & installs Claude Desktop config for all 3 MCP servers.
#
# Usage:
#   cd ~/ProxmoxMCP-Plus
#   chmod +x setup-mac.sh
#   ./setup-mac.sh
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
CLAUDE_CONFIG_DIR="$HOME/Library/Application Support/Claude"
CLAUDE_CONFIG_FILE="$CLAUDE_CONFIG_DIR/claude_desktop_config.json"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
error() { echo -e "${RED}[✗]${NC} $1"; }

echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Grizzly MCP Fleet — Setup"
echo "  Proxmox · Hostinger SSH · Convex.dev"
echo "═══════════════════════════════════════════════════════"
echo ""

# ── Pre-flight checks ──────────────────────────────────────────────────────
if ! command -v docker &>/dev/null; then
    error "Docker not found. Install Docker Desktop for Mac first."
    exit 1
fi

if ! docker info &>/dev/null 2>&1; then
    error "Docker daemon not running. Start Docker Desktop first."
    exit 1
fi

info "Docker is running"

# ── Build all 3 MCP server images ──────────────────────────────────────────
echo ""
echo "── Building Docker Images ─────────────────────────────"

echo ""
info "Building grizzly/proxmox-mcp..."
docker build -t grizzly/proxmox-mcp:latest -f "$REPO_DIR/Dockerfile.proxmox" "$REPO_DIR"

echo ""
info "Building grizzly/hostinger-ssh-mcp..."
docker build -t grizzly/hostinger-ssh-mcp:latest -f "$REPO_DIR/hostinger-ssh-mcp/Dockerfile" "$REPO_DIR/hostinger-ssh-mcp"

echo ""
info "Building grizzly/convex-mcp..."
docker build -t grizzly/convex-mcp:latest -f "$REPO_DIR/convex-mcp/Dockerfile" "$REPO_DIR/convex-mcp"

info "All 3 images built successfully"

# ── Convex auth check ──────────────────────────────────────────────────────
echo ""
echo "── Convex Authentication ──────────────────────────────"

if [ -d "$HOME/.config/convex" ] && [ -n "$(ls -A "$HOME/.config/convex" 2>/dev/null)" ]; then
    info "Convex auth config found at ~/.config/convex"
else
    warn "No Convex auth found. Running 'npx convex login' now..."
    npx convex@latest login
    if [ $? -eq 0 ]; then
        info "Convex login successful"
    else
        error "Convex login failed. You can retry later with: npx convex login"
    fi
fi

# ── Install Claude Desktop config ─────────────────────────────────────────
echo ""
echo "── Claude Desktop Configuration ───────────────────────"

mkdir -p "$CLAUDE_CONFIG_DIR"

if [ -f "$CLAUDE_CONFIG_FILE" ]; then
    # Backup existing config
    BACKUP="$CLAUDE_CONFIG_FILE.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$CLAUDE_CONFIG_FILE" "$BACKUP"
    warn "Existing config backed up to: $BACKUP"

    # Merge: add our servers into existing config
    if command -v python3 &>/dev/null; then
        python3 -c "
import json, sys

existing_path = '$CLAUDE_CONFIG_FILE'
new_path = '$REPO_DIR/claude_desktop_config.json'

with open(existing_path) as f:
    existing = json.load(f)
with open(new_path) as f:
    new_servers = json.load(f)

if 'mcpServers' not in existing:
    existing['mcpServers'] = {}

existing['mcpServers'].update(new_servers.get('mcpServers', {}))

with open(existing_path, 'w') as f:
    json.dump(existing, f, indent=2)

print('Merged 3 MCP servers into existing config')
"
        info "Config merged successfully"
    else
        # Fallback: overwrite with our config
        cp "$REPO_DIR/claude_desktop_config.json" "$CLAUDE_CONFIG_FILE"
        warn "python3 not found — replaced config (backup saved)"
    fi
else
    cp "$REPO_DIR/claude_desktop_config.json" "$CLAUDE_CONFIG_FILE"
    info "Config installed fresh"
fi

# ── Verify ─────────────────────────────────────────────────────────────────
echo ""
echo "── Verification ─────────────────────────────────────────"

echo "Docker images:"
docker images --format "  {{.Repository}}:{{.Tag}}  ({{.Size}})" | grep grizzly/ || true

echo ""
echo "Claude Desktop config:"
python3 -c "
import json
with open('$CLAUDE_CONFIG_FILE') as f:
    cfg = json.load(f)
servers = cfg.get('mcpServers', {})
for name in servers:
    cmd = ' '.join(servers[name].get('args', [])[:4])
    print(f'  ✓ {name}: {cmd}...')
" 2>/dev/null || echo "  (install python3 for config verification)"

# ── Done ───────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════════"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "    1. Restart Claude Desktop to pick up the new config"
echo "    2. Each MCP server will auto-start when Claude needs it"
echo "    3. Test with: \"List my Proxmox VMs\""
echo "                  \"Show Docker containers on Hostinger\""
echo "                  \"What Convex tables do I have?\""
echo "═══════════════════════════════════════════════════════"
echo ""
