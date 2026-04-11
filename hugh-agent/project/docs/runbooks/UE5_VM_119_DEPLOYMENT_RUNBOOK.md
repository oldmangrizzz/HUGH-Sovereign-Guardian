# H.U.G.H. UE5 VM 119 — Deployment Runbook

**Date:** March 31, 2026
**VM ID:** 119
**Name:** hugh-ue5-baremetal
**GPU:** 0000:01:00 (AMD Radeon — passed through)
**Console:** https://192.168.4.100:8006/#v1:0:119:6:console

---

## VM SPECIFICATIONS

| Resource | Allocation |
|----------|------------|
| **CPU** | 8 cores |
| **RAM** | 32 GB |
| **Disk** | 64 GB SSD (local-lvm) |
| **GPU** | 0000:01:00 (x-vga=1, pcie=1) |
| **Network** | virtio, bridge=vmbr0 |
| **BIOS** | OVMF (UEFI) |
| **Machine** | q35 |
| **Boot** | CDROM (Debian ISO) → Disk |

---

## INSTALLATION STEPS

### 1. Install Debian (via Proxmox Console)

1. Open console: https://192.168.4.100:8006/#v1:0:119:6:console
2. Boot from Debian ISO
3. Install Debian with:
   - **Hostname:** `hugh-ue5`
   - **Domain:** (leave blank or your local domain)
   - **Root password:** `[REDACTED]`
   - **User:** `ue5-render` / `[REDACTED]`
   - **Partitioning:** Guided - use entire disk
   - **Software selection:** 
     - [x] SSH server
     - [x] Standard system utilities
     - [ ] Desktop environment (we'll use headless Xvfb)

### 2. Post-Install Configuration

After Debian installs and reboots, SSH in or use console:

```bash
# Login as root
ssh root@hugh-ue5  # or via console

# Update system
apt-get update && apt-get upgrade -y

# Install required packages
apt-get install -y sudo git curl wget python3 python3-pip

# Add ue5-render to sudoers
echo 'ue5-render ALL=(ALL) NOPASSWD:ALL' >> /etc/sudoers
```

### 3. Deploy UE5 Preparation Script

Copy and run the preparation script:

```bash
# Copy script to VM (from your Mac)
scp scripts/prepare-proxmox-for-ue5.sh root@hugh-ue5:/root/

# Or paste the script content via console nano/vi

# Run it
cd /root
chmod +x prepare-proxmox-for-ue5.sh
./prepare-proxmox-for-ue5.sh localhost
```

This will:
- Install Vulkan drivers
- Install Xvfb
- Create ue5-render user
- Configure GPU passthrough
- Start Xvfb on :99

### 4. Deploy UE5 Service

```bash
# Copy service file
scp config/hugh-ue5.service root@hugh-ue5:/etc/systemd/system/

# Copy deployment script
scp scripts/deploy-ue5-service.sh root@hugh-ue5:/root/

# Run deployment
cd /root
chmod +x deploy-ue5-service.sh
./deploy-ue5-service.sh localhost
```

### 5. Install UE5 (Manual Step)

UE5 needs to be installed in the VM:

```bash
# As ue5-render user
sudo -i -u ue5-render
cd /home/ue5-render

# Option A: Download pre-built UE5 binary
wget https://github.com/EpicGames/UnrealEngine/releases/download/[VERSION]/UnrealEngine-[VERSION]-Linux.tar.gz
tar -xzf UnrealEngine-*.tar.gz

# Option B: Clone from GitHub (requires Epic access)
git clone git@github.com:EpicGames/UnrealEngine.git
cd UnrealEngine
./Setup.sh
./GenerateProjectFiles.sh
make
```

### 6. Start UE5 Service

```bash
# Check service status
systemctl status hugh-ue5

# Start service
systemctl start hugh-ue5

# Enable on boot
systemctl enable hugh-ue5

# View logs
journalctl -u hugh-ue5 -f
```

### 7. Verify GPU Access

```bash
# Check Vulkan
DISPLAY=:99 vulkaninfo --summary

# Check GPU
lspci | grep -i vga
nvidia-smi  # If NVIDIA
radeontop   # If AMD
```

### 8. Test Convex Connector

```bash
# Run connector test
sudo -u ue5-render DISPLAY=:99 python3 /home/ue5-render/convex-connector.py
```

Should see:
```
[Connector] Starting UE5 Convex Connector...
[Connector] Convex URL: https://effervescent-toucan-715.convex.cloud
[Connector] Poll interval: 500ms
[timestamp] World state: X entities, attentive=false
```

---

## DEPLOYMENT SCRIPTS REFERENCE

| Script | Purpose | Location |
|--------|---------|----------|
| `prepare-proxmox-for-ue5.sh` | Installs Vulkan, Xvfb, creates user | `/root/` in VM |
| `deploy-ue5-service.sh` | Deploys systemd service | `/root/` in VM |
| `config/hugh-ue5.service` | Systemd service file | `/etc/systemd/system/` |
| `convex-connector.py` | Polls Convex for world state | `/home/ue5-render/` |

---

## TROUBLESHOOTING

### GPU Not Detected

```bash
# Check GPU passthrough
lspci -nn | grep -i vga

# Check VFIO modules
lsmod | grep vfio

# Check IOMMU groups
find /sys/kernel/iommu_groups/ -type l
```

### Vulkan Initialization Fails

```bash
# Check ICD files
ls -la /usr/share/vulkan/icd.d/

# Set explicit ICD path
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/radeon_icd.x86_64.json

# Test Vulkan
DISPLAY=:99 vulkaninfo --summary
```

### Xvfb Not Running

```bash
# Check process
ps aux | grep Xvfb

# Restart Xvfb
pkill Xvfb
Xvfb :99 -screen 0 5120x2880x24 &

# Verify
xdpyinfo -display :99 | grep dimensions
```

### UE5 Crashes on Start

```bash
# Check logs
journalctl -u hugh-ue5 --no-pager -n 50

# Try with OpenGL fallback
# Edit /etc/systemd/system/hugh-ue5.service
# Add -opengl3 to ExecStart line

systemctl daemon-reload
systemctl restart hugh-ue5
```

---

## NEXT STEPS AFTER UE5 IS RUNNING

1. **Test Neural Field Rendering** — Open Proxmox console, should see UE5 window
2. **Verify Convex Connection** — Check connector logs for world state updates
3. **Test Wake Word Flare** — Say "Hubert", watch for global discharge animation
4. **Integrate with Kiosk** — Update `workshop.grizzlymedicine.icu` to show UE5 output

---

## ROLLBACK PROCEDURE

If UE5 VM fails:

```bash
# Stop VM
python3 manage_workshop_vm.py stop 119

# Destroy VM
python3 manage_workshop_vm.py destroy 119

# Create new VM with different ID
python3 manage_workshop_vm.py create --id=120 --name=hugh-ue5-v2 --gpu=0000:01:00
```

---

**END OF RUNBOOK**
