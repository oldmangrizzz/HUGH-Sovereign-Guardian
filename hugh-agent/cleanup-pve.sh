#!/bin/bash
# H.U.G.H. Infrastructure — PVE Node Disk Management
# Purges temporary logs and rotates system logs to prevent root disk saturation.

echo "[$(date)] Starting PVE cleanup pulse..."

# 1. Clean apt cache
apt-get clean

# 2. Remove old LXC creation logs in /tmp (often 2GB+ per log)
find /tmp -name "create-lxc-*.log" -mtime +1 -delete

# 3. Clean up old cloudflared artifacts
rm -f /tmp/cloudflared.deb

# 4. Vacuum journald logs (keep only last 500MB)
journalctl --vacuum-size=500M

# 5. Check disk space after cleanup
df -h /

echo "[$(date)] Cleanup pulse complete."
