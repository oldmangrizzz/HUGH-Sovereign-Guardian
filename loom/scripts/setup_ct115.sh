#!/bin/bash
# LOOM — CT-115 provisioning script
# Run as root on the Proxmox host:
#   pct exec 115 -- bash /tmp/setup_ct115.sh
# Or copy and run inside CT-115 directly.

set -euo pipefail

echo "=== LOOM CT-115 Setup ==="

# ── System packages ───────────────────────────────────────────────────────────
apt-get update -qq
apt-get install -y -qq \
    python3 python3-pip python3-venv \
    git curl wget rsync \
    rclone \
    libgl1 libglib2.0-0 \
    build-essential libffi-dev \
    ca-certificates

# ── Directory layout ──────────────────────────────────────────────────────────
mkdir -p /var/loom/{sources/{github,gdrive-personal,gdrive-business,icloud,openai},graph,vectors,logs,snapshots,config}

# ── Python venv ───────────────────────────────────────────────────────────────
python3 -m venv /opt/loom/venv
source /opt/loom/venv/bin/activate

pip install --upgrade pip -q
pip install -r /opt/loom/requirements.txt -q

# ── spaCy model ───────────────────────────────────────────────────────────────
python3 -m spacy download en_core_web_sm -q

# ── Systemd service — API ─────────────────────────────────────────────────────
cat > /etc/systemd/system/loom-api.service << 'EOF'
[Unit]
Description=LOOM Knowledge Graph Query API
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/loom
EnvironmentFile=/etc/loom/env
ExecStart=/opt/loom/venv/bin/uvicorn api.main:app --host 0.0.0.0 --port 7777
Restart=on-failure
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# ── Systemd service — ingest timer ───────────────────────────────────────────
cat > /etc/systemd/system/loom-ingest.service << 'EOF'
[Unit]
Description=LOOM Ingestion Pipeline (delta run)
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/loom
EnvironmentFile=/etc/loom/env
ExecStart=/opt/loom/venv/bin/python -m ingest.pipeline --source all
StandardOutput=append:/var/loom/logs/ingest.log
StandardError=append:/var/loom/logs/ingest.log
EOF

cat > /etc/systemd/system/loom-ingest.timer << 'EOF'
[Unit]
Description=Run LOOM ingest pipeline daily at 03:00

[Timer]
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# ── Systemd service — sync timer ─────────────────────────────────────────────
cat > /etc/systemd/system/loom-sync.service << 'EOF'
[Unit]
Description=LOOM Convex sync
After=network.target

[Service]
Type=oneshot
User=root
WorkingDirectory=/opt/loom
EnvironmentFile=/etc/loom/env
ExecStart=/opt/loom/venv/bin/python -m sync.export
StandardOutput=append:/var/loom/logs/sync.log
StandardError=append:/var/loom/logs/sync.log
EOF

cat > /etc/systemd/system/loom-sync.timer << 'EOF'
[Unit]
Description=Run LOOM Convex sync daily at 04:00

[Timer]
OnCalendar=*-*-* 04:00:00
Persistent=true

[Install]
WantedBy=timers.target
EOF

# ── Env file template ─────────────────────────────────────────────────────────
mkdir -p /etc/loom
cat > /etc/loom/env << 'EOF'
LOOM_CONFIG=/var/loom/config/config.yaml
LOOM_API_KEY=CHANGEME
LOOM_EMBED_URL=http://192.168.7.123:8083/v1/embeddings
LOOM_EMBED_MODEL=all-MiniLM-L6-v2
CONVEX_URL=CHANGEME
LOOM_CONVEX_SECRET=CHANGEME
EOF
chmod 600 /etc/loom/env

# ── Initialize schema ─────────────────────────────────────────────────────────
cp /var/loom/config/config.yaml /var/loom/config/config.yaml.bak 2>/dev/null || true
source /opt/loom/venv/bin/activate
LOOM_CONFIG=/var/loom/config/config.yaml python3 -m schema.init

# ── Enable and start services ─────────────────────────────────────────────────
systemctl daemon-reload
systemctl enable loom-api.service
systemctl enable loom-ingest.timer
systemctl enable loom-sync.timer
systemctl start loom-api.service
systemctl start loom-ingest.timer
systemctl start loom-sync.timer

echo ""
echo "=== LOOM setup complete ==="
echo "API running on port 7777"
echo "IMPORTANT: Edit /etc/loom/env and set LOOM_API_KEY, CONVEX_URL, LOOM_CONVEX_SECRET"
echo "IMPORTANT: Configure rclone remotes: rclone config"
echo "Run first ingest manually: source /opt/loom/venv/bin/activate && python -m ingest.pipeline --source all --full"
