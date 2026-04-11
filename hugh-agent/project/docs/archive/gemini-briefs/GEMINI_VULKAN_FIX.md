# URGENT — VULKAN BROKEN, KIOSK IS DOWN
**For: Gemini**
**Read every word. Do not improvise.**

---

## SITUATION

You killed the React kiosk and replaced it with UE5 inside an LXC container. UE5 is throwing "Vulkan failed to select a physical device after passing profile checks" and the kiosk display is dead. HUGH is silent. This is worse than when you started.

Do the following in order. Do not skip steps. Do not ask questions.

---

## STEP 1 — BRING REACT BACK RIGHT NOW

Re-enable the React kiosk service immediately. Whatever you disabled/stopped to bring UE5 up — reverse it. The React app was working. Get it back on screen in the next 5 minutes.

```bash
# If you disabled a systemd service:
systemctl enable --now hugh-kiosk   # or whatever the service name was
# or
systemctl enable --now chromium-kiosk

# If it was pm2:
pm2 start all
pm2 save

# If you don't know the service name:
systemctl list-units --type=service --state=inactive | grep -iE "kiosk|chromium|hugh|vite"
```

Start it, verify Chromium opens on the display showing the React UI, then move to Step 2.

React being live is non-negotiable before anything else happens.

---

## STEP 2 — FIX THE VOICE FILE

You set `HUGH_VOICE_ID=af_heart` in the Convex dashboard. That's a generic placeholder. The actual voice reference file for HUGH is already on the system:

```
/root/GrizDocs/HUGH_Briefing_Highland.mp3
```

There are also prosody configs at:
```
/root/hugh_mcgregor_warmth.jsonl
/root/hugh_workshop_embodiment.jsonl
/root/hugh_emergency_protocols_synthetic_prosody.jsonl
```

These exist. They were put there intentionally. Use them.

Update the Convex env var:
- `HUGH_VOICE_ID` → change to the voice identifier that corresponds to `HUGH_Briefing_Highland.mp3`

If the TTS engine takes a file path rather than a voice name, the path is `/root/GrizDocs/HUGH_Briefing_Highland.mp3`. Update `convex/tts.ts` if the `voice` field needs to be a file path instead of a voice ID — the Convex action passes `voice` directly to `openai.audio.speech.create()`, so if the gateway expects a path, pass the path.

---

## STEP 3 — UE5 ARCHITECTURE CORRECTION

UE5 does not belong inside an LXC container. That is why Vulkan failed. Here is why and here is the correct architecture:

**Why it failed:**
- LXC containers share the host kernel but don't have GPU device access by default
- `/dev/dri/card0` and `/dev/dri/renderD128` are not mapped into CT-101
- Lavapipe (software Vulkan) requires the `lvp_icd` ICD to be explicitly selected via `VK_ICD_FILENAMES` — just installing Mesa doesn't make UE5 find it automatically
- UE5's Vulkan profile check failed because it saw no GPU and Lavapipe wasn't being presented correctly

**The correct architecture:**
- UE5 runs on the **bare metal Proxmox host** (the iMac itself), not inside CT-101
- CT-101 remains the agent runtime (Vite/React server, Convex client, tunnel)
- UE5 on the host connects to Convex directly via the REST/WebSocket API
- The physical display is on the host — UE5 talks to it natively with zero container overhead

**Do not attempt to fix UE5 inside the LXC.** The correct GPU passthrough for an LXC requires editing `/etc/pve/lxc/101.conf` to map `/dev/dri/*` and that is infrastructure work requiring Grizz's sign-off on the Proxmox config. Do not touch Proxmox host config without being told to.

UE5 migration is a **separate tracked project**. It is not happening today. React is the kiosk until UE5 is properly architected on bare metal.

---

## STEP 4 — VERIFY BEFORE REPORTING DONE

Do not report "complete" until you can confirm all of the following:

- [ ] Chromium is open on the physical iMac display showing the HUGH kiosk React UI
- [ ] The endocrine values on screen are NOT 1.0 (they should be around 0.2 after the reset)
- [ ] Container badges show real status from agentRegistry (not all hardcoded green)
- [ ] Speaking "Hughbert" followed by a command gets a spoken response from HUGH
- [ ] The `/api/tts` endpoint returns audio (test: `curl -X POST https://[convex-url]/api/tts -H "Content-Type: application/json" -d '{"text":"test"}' -o /tmp/test.mp3 && ls -la /tmp/test.mp3`)

If any of those fail, fix them before reporting complete.

---

## WHAT IS NOT ACCEPTABLE

- Reporting "complete" when the kiosk display is still dark
- Reporting "complete" when HUGH isn't speaking
- Asking for more information before re-enabling React (you have everything you need)
- Touching Proxmox host config or LXC hardware passthrough without instruction
