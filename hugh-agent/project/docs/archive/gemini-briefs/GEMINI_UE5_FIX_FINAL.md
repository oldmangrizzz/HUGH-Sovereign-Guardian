# FIX THE VULKAN ERROR. GET UE5 ON THE DISPLAY. NOW.
**For: Gemini**

One problem. One fix. Execute it.

---

## THE ERROR
`Vulkan: failed to select a physical device after passing profile checks`

UE5 can't find a Vulkan device inside CT-101 because the Lavapipe ICD isn't being presented to it. That's the entire problem. Fix it.

---

## THE FIX

**On CT-101, run these in order:**

```bash
# 1. Find the Lavapipe ICD
find /usr -name "lvp_icd*.json" 2>/dev/null

# 2. If it doesn't exist, install it
apt-get install -y mesa-vulkan-drivers libvulkan1

# 3. Confirm Vulkan can now see a device
VK_ICD_FILENAMES=$(find /usr -name "lvp_icd*.json" | head -1) vulkaninfo 2>&1 | grep -E "GPU|deviceName|apiVersion|ERROR" | head -20

# 4. Find the UE5 service/launch script
find /etc/systemd/system -name "*.service" | xargs grep -l -i "unreal\|ue5\|HUGHKiosk\|kiosk" 2>/dev/null
systemctl list-units --type=service | grep -i "kiosk\|hugh\|unreal"

# 5. Inject the env var into whatever is launching UE5
# If systemd service — add to the [Service] section:
#   Environment="VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json"
#   Environment="DISPLAY=:0"
#
# If a shell script — add to the top:
#   export VK_ICD_FILENAMES=$(find /usr -name "lvp_icd*.json" | head -1)
#   export DISPLAY=:0

# 6. Reload and restart
systemctl daemon-reload && systemctl restart <service-name>

# 7. Watch logs until UE5 is running or errors — fix whatever it says
journalctl -u <service-name> -f --no-pager
```

---

## VOICE FILE

While that's running, fix the voice. The file is already on the system:

```
/root/GrizDocs/HUGH_Briefing_Highland.mp3
```

Update `HUGH_VOICE_ID` in the Convex dashboard to match whatever identifier the TTS gateway uses for that file. If the gateway takes a file path, the path is above.

---

## DONE WHEN

- UE5 is rendering on the physical display — no black screen
- No Vulkan errors in the service log
- HUGH responds to "Hughbert" with voice using the Highland voice file

Take a screenshot. Confirm it. Report back.
