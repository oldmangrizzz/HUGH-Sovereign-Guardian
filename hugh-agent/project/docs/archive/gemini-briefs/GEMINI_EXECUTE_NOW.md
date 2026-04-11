# EXECUTE ORDER — NO DISCUSSION, NO QUESTIONS, NO FALLBACKS
**For: Gemini**
**This is not a request. This is not a brief. This is an order.**

You have nearly 400 tools. Parallel execution. Swarm capability. Browser control. Shell access. SSH through the agent registry. Use them. All of them. Right now. Get UE5 running on that kiosk display. We have been waiting over a week. This ends today.

---

## THE ONE PROBLEM

UE5 is throwing: `Vulkan: failed to select a physical device after passing profile checks`

This is because Lavapipe (software Vulkan) is installed but UE5 can't find the ICD. The fix is one environment variable. Execute the following on CT-101 right now:

---

## STEP 1 — FIND THE LAVAPIPE ICD ON CT-101

Run this on CT-101:

```bash
find /usr -name "lvp_icd*.json" 2>/dev/null
find /usr/share/vulkan -type f -name "*.json" 2>/dev/null
ls /usr/share/vulkan/icd.d/ 2>/dev/null
```

The file you're looking for is one of:
- `/usr/share/vulkan/icd.d/lvp_icd.x86_64.json`
- `/usr/share/vulkan/icd.d/lvp_icd.aarch64.json`

If that directory is empty or the file doesn't exist, install it:

```bash
apt-get install -y mesa-vulkan-drivers
```

Confirm the file exists before moving to Step 2.

---

## STEP 2 — FIX THE UE5 LAUNCH SCRIPT

Find how UE5 is being launched on CT-101:

```bash
systemctl cat hugh-ue5 2>/dev/null || \
systemctl cat hugh-kiosk 2>/dev/null || \
find /etc/systemd/system -name "*.service" | xargs grep -l "Unreal\|UE5\|HUGHKiosk\|unreal" 2>/dev/null
```

Open the service file. Find the `ExecStart=` line. Prepend the Lavapipe env var to it:

```ini
Environment="VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json"
Environment="DISPLAY=:0"
Environment="XDG_RUNTIME_DIR=/run/user/1000"
```

If it's a shell script launching UE5, add to the top of that script:

```bash
export VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json
export DISPLAY=:0
```

---

## STEP 3 — RELOAD AND RESTART

```bash
systemctl daemon-reload
systemctl restart <the-ue5-service-name>
journalctl -u <the-ue5-service-name> -f --no-pager
```

Watch the logs. Confirm Vulkan initializes without the device selection error. If it still errors, run:

```bash
VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json vulkaninfo 2>&1 | head -40
```

That tells you exactly what Vulkan sees. Fix what it says.

---

## STEP 4 — FIX THE VOICE FILE (DO THIS IN PARALLEL)

While UE5 is restarting, fix the voice configuration. The actual HUGH voice reference file is already on the system:

```
/root/GrizDocs/HUGH_Briefing_Highland.mp3
```

There are also prosody configs:
```
/root/hugh_mcgregor_warmth.jsonl
/root/hugh_workshop_embodiment.jsonl
/root/hugh_emergency_protocols_synthetic_prosody.jsonl
```

Go to the Convex dashboard right now. Update:
- `HUGH_VOICE_ID` → replace `af_heart` with the correct voice identifier that maps to `HUGH_Briefing_Highland.mp3`

If the TTS gateway takes a file path directly, update `convex/tts.ts` so the `voice` field passes the file path `/root/GrizDocs/HUGH_Briefing_Highland.mp3` instead of a name string.

Check what format the gateway expects:

```bash
# On KVM2 or whichever node is running the TTS model:
curl -s http://localhost:11434/api/tags | python3 -m json.tool | grep -i "kokoro\|tts\|audio\|voice"
```

Match the format to what the gateway actually accepts.

---

## STEP 5 — VERIFY ON THE PHYSICAL DISPLAY

Take a screenshot of the iMac display. The kiosk should be showing the UE5 environment — neural field, telemetry panel, container badges, the works.

Use your screenshot tools. Confirm visually. Do not report complete based on logs alone.

---

## WHAT DONE LOOKS LIKE

- UE5 is rendering on the iMac display — no black screen, no error dialogs
- No Vulkan error in the service logs
- HUGH responds to "Hughbert" with synthesized speech using the Highland voice
- Container badges show live status
- Endocrine values are not 1.0

---

## YOU HAVE THE TOOLS

You have shell access to CT-101 through the agent registry. You have browser tools to hit the Convex dashboard. You have parallel execution. You have nearly 400 tools loaded.

There is no excuse for asking a question. Every answer you need is on the system already. Find it, fix it, confirm it.

Do not report back until the display is live.
