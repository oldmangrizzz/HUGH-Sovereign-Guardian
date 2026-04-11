# HUGH Kiosk Migration Runbook
## CT-101 LXC → Bare-Metal Display

**Date:** 2026-03-31  
**Author:** HUGH Agent  
**Status:** Ready for Execution  
**Rollback:** Supported (see Section 7)

---

## Executive Summary

This runbook describes the procedure to migrate the HUGH kiosk display from the CT-101 LXC container to bare-metal execution on the Proxmox iMac host, while maintaining CT-101 as the agent runtime (Vite dev server, Cloudflare tunnel, Convex client).

### Why Migrate?

| Aspect | Before (CT-101 Kiosk) | After (Bare-Metal Kiosk) |
|--------|----------------------|-------------------------|
| **Display Output** | Container passthrough | Native X11 on :0 |
| **GPU Access** | Virtual/limited | Direct hardware access |
| **Chromium Performance** | Container overhead | Native execution |
| **Camera Access** | Container permissions | Direct device access |
| **Agent Runtime** | CT-101 LXC | CT-101 LXC (unchanged) |
| **Cloudflare Tunnel** | CT-101 LXC | CT-101 LXC (unchanged) |
| **Downtime** | Required for migration | Zero-downtime switchover |

### Architecture After Migration

```
┌─────────────────────────────────────────────────────────────────────┐
│  CT-101 LXC (Proxmox)                    Bare-Metal iMac (:0)       │
│  ┌──────────────────────┐                ┌───────────────────────┐  │
│  │  Vite Dev Server     │◄──HTTP:4173──►│  Chromium Kiosk       │  │
│  │  (localhost:5173)    │                │  (display :0)         │  │
│  │  PM2 Preview (:4173) │                │                       │  │
│  ├──────────────────────┤                │  ┌─────────────────┐  │  │
│  │  Cloudflare Tunnel   │                │  │  5K Display     │  │  │
│  │  workshop.grizzly... │                │  │  Fullscreen     │  │  │
│  └──────────────────────┘                │  └─────────────────┘  │  │
│         │                                └───────────────────────┘  │
│         ▼                                                           │
│  ┌──────────────────────┐                                           │
│  │  Convex Cloud        │◄──────────────────────────────────────────┘
│  │  (State, Memory,     │    (Bare-metal Chromium connects via
│  │   LFM Runtime)       │     Convex HTTP to CT-101)
│  └──────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## 1. Prerequisites

### 1.1 System Requirements

| Component | Requirement | Verification Command |
|-----------|-------------|---------------------|
| **CT-101 LXC** | Running with Vite + tunnel | `ssh root@proxmox-pve "pm2 list"` |
| **Bare-Metal iMac** | Network access to CT-101 | `ping proxmox-pve` |
| **Node.js** | v18+ on bare-metal | `node --version` |
| **PM2** | Installed globally | `pm2 --version` |
| **Chromium** | Installed on bare-metal | `chromium-browser --version` |
| **X11** | Running on display :0 | `xrandr --query` |
| **SSH Key** | Passwordless SSH to CT-101 | `ssh root@proxmox-pve "exit"` |

### 1.2 Pre-Migration Checklist

- [ ] CT-101 LXC is running and accessible via SSH
- [ ] Cloudflare tunnel is active on CT-101
- [ ] Vite dev server is running on CT-101
- [ ] Bare-metal iMac has network connectivity to CT-101
- [ ] Node.js and npm installed on bare-metal
- [ ] PM2 installed globally (`npm install -g pm2`)
- [ ] Chromium/Chrome installed on bare-metal
- [ ] X11 display :0 is active and accessible
- [ ] SSH key configured for passwordless login to CT-101
- [ ] Backup of current configuration completed

### 1.3 Verify Prerequisites

Run this verification script on bare-metal:

```bash
#!/bin/bash
# Pre-migration verification

echo "=== Pre-Migration Verification ==="
echo ""

# SSH to CT-101
echo -n "SSH to CT-101: "
ssh -o BatchMode=yes root@proxmox-pve "exit" 2>/dev/null && echo "✓ PASS" || echo "✗ FAIL"

# CT-101 services
echo -n "CT-101 PM2 running: "
ssh root@proxmox-pve "pm2 list | grep -q hugh-kiosk" 2>/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "CT-101 tunnel running: "
ssh root@proxmox-pve "pgrep -f cloudflared" >/dev/null 2>&1 && echo "✓ PASS" || echo "✗ FAIL"

# Bare-metal requirements
echo -n "Node.js installed: "
command -v node >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "PM2 installed: "
command -v pm2 >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "Chromium installed: "
command -v chromium-browser >/dev/null || command -v chromium >/dev/null || command -v google-chrome >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "X11 display :0: "
xrandr >/dev/null 2>&1 && echo "✓ PASS" || echo "✗ FAIL"

echo ""
echo "If all checks pass, proceed with migration."
```

---

## 2. Migration Procedure

### 2.1 Overview

| Step | Action | Duration | Downtime |
|------|--------|----------|----------|
| 1 | Pre-flight checks | 1 min | No |
| 2 | Build frontend on bare-metal | 2-3 min | No |
| 3 | Start PM2 static server | 30 sec | No |
| 4 | Configure CT-101 for remote kiosk | 30 sec | No |
| 5 | Launch Chromium on bare-metal | 10 sec | ~2 sec |
| 6 | Verification | 1 min | No |

**Total Estimated Time:** 5-7 minutes  
**Expected Downtime:** < 2 seconds (during Chromium launch)

### 2.2 Step-by-Step Execution

#### Step 1: Navigate to Project Directory

```bash
cd /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/project
```

#### Step 2: Run Migration Script

```bash
chmod +x scripts/migrate-kiosk-baremetal.sh
./scripts/migrate-kiosk-baremetal.sh
```

The script will:
1. Verify SSH connectivity to CT-101
2. Verify CT-101 services (Vite, PM2, Cloudflare tunnel)
3. Check bare-metal requirements (Node, PM2, Chromium, X11)
4. Build the Vite frontend on bare-metal
5. Start PM2 static server on port 4173
6. Stop local Chromium kiosk on CT-101
7. Launch Chromium kiosk on bare-metal display :0
8. Verify migration success

#### Step 3: Monitor Output

Expected output:

```
╔════════════════════════════════════════════════════════════════════╗
║           HUGH Kiosk Migration: CT-101 → Bare-Metal               ║
╚════════════════════════════════════════════════════════════════════╝

[INFO] Running pre-flight checks...
[OK]   SSH to CT-101 verified
[OK]   CT-101 services verified
[OK]   Node.js and PM2 available
[OK]   Chromium found: chromium-browser
[OK]   X display :0 available
[INFO] Step 1: Building frontend on bare-metal...
[bare-metal] Installing dependencies...
[bare-metal] Building frontend...
[OK]   Frontend built successfully
[INFO] Step 2: Starting PM2 static file server...
[OK]   Static server running on port 4173
[INFO] Step 3: Configuring CT-101 for remote kiosk mode...
[OK]   CT-101 configured for remote kiosk mode
[INFO] Step 4: Launching Chromium kiosk on bare-metal display :0...
[OK]   Chromium launched (PID: 12345)
[INFO] Step 5: Verifying migration...

╔════════════════════════════════════════════════════════════════════╗
║                    Migration Complete                              ║
╚════════════════════════════════════════════════════════════════════╝
```

#### Step 4: Verify Display

1. Check that the 5K display shows the HUGH kiosk interface
2. Verify neural field animation is running
3. Check camera feeds are visible (if cameras connected)
4. Verify telemetry panel shows CT-101 status

#### Step 5: Verify Cloudflare Tunnel

```bash
# On CT-101
ssh root@proxmox-pve "curl -sf https://workshop.grizzlymedicine.icu >/dev/null && echo 'Tunnel OK' || echo 'Tunnel FAIL'"
```

Expected: `Tunnel OK`

---

## 3. Post-Migration Verification

### 3.1 Automated Verification Script

```bash
#!/bin/bash
# Post-migration verification

echo "=== Post-Migration Verification ==="
echo ""

# Check bare-metal kiosk
echo "Bare-Metal Kiosk:"
echo -n "  PM2 server running: "
pm2 list | grep -q hugh-kiosk-baremetal && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  Chromium process: "
pgrep -f "chrom.*kiosk" >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  Port 4173 listening: "
ss -tlnp | grep :4173 >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  HTTP response: "
curl -sf http://localhost:4173 >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

# Check CT-101
echo ""
echo "CT-101 LXC:"
echo -n "  SSH accessible: "
ssh -o BatchMode=yes root@proxmox-pve "exit" 2>/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  Vite server running: "
ssh root@proxmox-pve "curl -sf http://localhost:5173 >/dev/null" 2>/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  PM2 server running: "
ssh root@proxmox-pve "pm2 list | grep -q hugh-kiosk-server" 2>/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  Cloudflare tunnel: "
ssh root@proxmox-pve "pgrep -f cloudflared" >/dev/null 2>&1 && echo "✓ PASS" || echo "✗ FAIL"

echo -n "  Convex connectivity: "
ssh root@proxmox-pve "curl -sf \$VITE_CONVEX_URL >/dev/null" 2>/dev/null && echo "✓ PASS" || echo "⚠ CHECK MANUALLY"

# Check external access
echo ""
echo "External Access:"
echo -n "  Cloudflare tunnel: "
curl -sf https://workshop.grizzlymedicine.icu >/dev/null && echo "✓ PASS" || echo "✗ FAIL"

echo ""
echo "If all checks pass, migration is successful."
```

### 3.2 Manual Verification

1. **Visual Inspection**
   - Walk up to the 5K display
   - Confirm HUGH neural field is animating
   - Check mode indicator shows AWAKE (or last active mode)
   - Verify camera feeds are displaying (if cameras connected)

2. **Wake Word Test**
   - Say "Hughbert" or "Hey Hugh"
   - Listen for confirmation chime
   - Issue a voice command (e.g., "What's your status?")
   - Verify HUGH responds via TTS

3. **Mode Switching**
   - Move mouse to reveal mode bar
   - Click through modes: AWAKE → COMPETITION → DEEP → FORGE → SLEEP
   - Confirm each mode renders correctly

4. **Telemetry Check**
   - Verify CT-101 shows as "online" in container badge
   - Check LFM pulse lag is < 2 seconds
   - Confirm endocrine state (cortisol, dopamine, adrenaline) is updating

---

## 4. Monitoring and Maintenance

### 4.1 Daily Health Checks

```bash
# Quick status check
./scripts/migrate-kiosk-baremetal.sh --status
```

### 4.2 PM2 Log Monitoring

```bash
# Bare-metal kiosk server logs
pm2 logs hugh-kiosk-baremetal

# CT-101 agent runtime logs (via SSH)
ssh root@proxmox-pve "pm2 logs hugh-kiosk-server"
```

### 4.3 Resource Monitoring

```bash
# Bare-metal resource usage
htop

# Chromium memory usage
ps aux | grep -i chrom | awk '{sum+=$6} END {print "Chromium memory: " sum/1024 " MB"}'

# CT-101 resource usage (via SSH)
ssh root@proxmox-pve "htop -d 1"
```

### 4.4 Auto-Restart Configuration

PM2 is configured to auto-restart on failure. Verify:

```bash
pm2 describe hugh-kiosk-baremetal | grep "restart"
```

Expected: `restart time` should increment only on actual failures.

---

## 5. Troubleshooting

### 5.1 Common Issues

#### Issue: Chromium fails to launch on bare-metal

**Symptoms:**
```
[ERROR] Chromium failed to start
```

**Causes:**
- X11 display not available
- Chromium not installed
- Display permissions incorrect

**Resolution:**
```bash
# Check X11
xrandr --query

# Check Chromium
chromium-browser --version

# Check DISPLAY variable
echo $DISPLAY

# Restart X11 if needed (requires logout)
sudo systemctl restart display-manager
```

#### Issue: Cannot connect to CT-101

**Symptoms:**
```
[ERROR] SSH check failed
```

**Causes:**
- CT-101 LXC stopped
- Network connectivity issue
- SSH key changed

**Resolution:**
```bash
# Check CT-101 status from Proxmox host
pct status 101

# Start CT-101 if stopped
pct start 101

# Check network
ping proxmox-pve

# Re-test SSH
ssh -v root@proxmox-pve
```

#### Issue: Cloudflare tunnel not working

**Symptoms:**
- External URL returns 502
- Tunnel not showing as active on CT-101

**Resolution:**
```bash
# On CT-101
ssh root@proxmox-pve

# Check tunnel status
systemctl status cloudflared

# Restart tunnel
sudo systemctl restart cloudflared

# Verify tunnel
cloudflared tunnel list
```

#### Issue: Camera feeds not showing

**Symptoms:**
- Camera panels show "NO SIGNAL"
- Black squares instead of video

**Causes:**
- Camera permissions not granted
- Camera device not accessible
- Chromium needs restart after permission grant

**Resolution:**
1. Stop kiosk: `./scripts/migrate-kiosk-baremetal.sh --stop`
2. Launch browser manually: `chromium-browser http://localhost:4173`
3. Grant camera permissions when prompted
4. Close browser
5. Restart kiosk: `./scripts/migrate-kiosk-baremetal.sh`

### 5.2 Debug Mode

Enable verbose logging:

```bash
# Bare-metal kiosk with debug output
pm2 logs hugh-kiosk-baremetal --lines 100

# CT-101 debug
ssh root@proxmox-pve "pm2 logs hugh-kiosk-server --lines 100"

# Chromium debug (stop kiosk first, then launch manually)
DISPLAY=:0 chromium-browser --kiosk --enable-logging --v=1 http://localhost:4173/?kiosk=1#/kiosk
```

---

## 6. Zero-Downtime Switchover Procedure

For production environments requiring zero downtime:

### 6.1 Pre-Switchover Preparation

1. **Verify both systems are healthy:**
   ```bash
   ./scripts/migrate-kiosk-baremetal.sh --status
   ```

2. **Ensure CT-101 tunnel is stable:**
   ```bash
   ssh root@proxmox-pve "cloudflared tunnel list"
   ```

3. **Pre-build frontend on bare-metal:**
   ```bash
   cd /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/project
   npm run build
   ```

### 6.2 Switchover Execution

1. **Start bare-metal PM2 server (background):**
   ```bash
   pm2 start npx --name hugh-kiosk-baremetal -- vite preview --host 0.0.0.0 --port 4173
   ```

2. **Wait for server readiness:**
   ```bash
   until curl -sf http://localhost:4173 >/dev/null; do sleep 0.5; done
   ```

3. **Launch Chromium on bare-metal:**
   ```bash
   DISPLAY=:0 chromium-browser --kiosk --no-sandbox --app="http://localhost:4173/?kiosk=1#/kiosk" &
   ```

4. **Stop CT-101 local kiosk (optional):**
   ```bash
   ssh root@proxmox-pve "pkill -f 'chromium.*kiosk'"
   ```

**Total switchover time:** < 2 seconds

### 6.3 Post-Switchover Verification

Immediately verify:
1. Display shows HUGH interface (not blank)
2. Neural field is animating
3. Telemetry is updating
4. Cloudflare tunnel still accessible externally

---

## 7. Rollback Procedure

If issues arise, rollback to CT-101 kiosk mode:

### 7.1 Automated Rollback

```bash
./scripts/migrate-kiosk-baremetal.sh --rollback
```

This will:
1. Stop bare-metal Chromium kiosk
2. Stop bare-metal PM2 server
3. Verify CT-101 services
4. Restart CT-101 local kiosk

### 7.2 Manual Rollback

If automated rollback fails:

```bash
# Step 1: Stop bare-metal kiosk
pm2 stop hugh-kiosk-baremetal
pm2 delete hugh-kiosk-baremetal
pkill -f "chromium.*kiosk"

# Step 2: Restart CT-101 kiosk
ssh root@proxmox-pve "
  cd /root/hugh-agent/project
  ./deploy-kiosk.sh --stop
  ./deploy-kiosk.sh
"

# Step 3: Verify CT-101 kiosk
ssh root@proxmox-pve "pm2 list"
```

### 7.3 Rollback Verification

```bash
# Check CT-101 kiosk is running
ssh root@proxmox-pve "
  pm2 list | grep hugh-kiosk-server
  pgrep -f 'chromium.*kiosk'
  curl -sf http://localhost:4173
"

# Check display shows kiosk (visual inspection)
# Walk to 5K display and verify HUGH interface
```

---

## 8. Appendix

### 8.1 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `CT101_HOST` | `proxmox-pve` | CT-101 LXC hostname or IP |
| `CT101_SSH_USER` | `root` | SSH user for CT-101 |
| `CT101_SSH_KEY` | `~/.ssh/id_rsa` | SSH key path |
| `KIOSK_PORT` | `4173` | PM2 static server port |
| `DISPLAY_NUM` | `0` | X display number |

### 8.2 Port Requirements

| Port | Service | Direction |
|------|---------|-----------|
| 4173 | PM2 static server | CT-101 → Bare-metal |
| 5173 | Vite dev server | Internal CT-101 |
| 443 | Cloudflare tunnel | CT-101 → Cloudflare |
| 22 | SSH | Bare-metal → CT-101 |

### 8.3 File Locations

| File | Location |
|------|----------|
| Migration script | `scripts/migrate-kiosk-baremetal.sh` |
| Deploy script (CT-101) | `deploy-kiosk.sh` |
| Kiosk component | `src/HughKioskDisplay.tsx` |
| Vite config | `vite.config.ts` |
| PM2 config | `~/.pm2/ecosystem.config.js` |

### 8.4 Related Documentation

- `ARCHITECTURE_DIAGRAMS.md` - System architecture overview
- `DEFINITIVE_TECHNICAL_SPEC.md` - Technical specifications
- `KVM_AGENT_SPEC.md` - KVM agent configuration
- `deploy-kiosk.sh` - Original kiosk deployment script

### 8.5 Contact and Support

For issues or questions:
1. Check this runbook's troubleshooting section
2. Review PM2 logs: `pm2 logs`
3. Check CT-101 logs: `ssh root@proxmox-pve "pm2 logs"`
4. Verify Cloudflare tunnel status: `cloudflared tunnel list`

---

**Document Version:** 1.0  
**Last Updated:** 2026-03-31  
**Next Review:** After first production migration
