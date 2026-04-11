# ARCHITECTURE CORRECTION — READ THIS FIRST OR DON'T READ ANYTHING
**For: Gemini**

Stop. Before you touch one file, burn this into your context:

**EVERYTHING RUNS IN THE SAME CONTAINER.**

LFM 2.5 Thinking — local container.
LFM 2.5 Audio — same local container.
LFM 2.5 Vision — same local container.

One Ollama instance. One container. One `HUGH_GATEWAY_URL` that points to it.
There is no cloud inference. There is no external model host. There are no other nodes involved in this.
Do not name other nodes. Do not route to other nodes. Do not think about other nodes.
The model gateway is local. It has always been local. Keep it local.

---

## TASK 1 — GET LFM 2.5 AUDIO RUNNING IN THE CONTAINER

The chat model is already running. The audio model needs to be loaded into the same Ollama instance.

```bash
# Check what's already loaded
ollama list

# Find the LFM 2.5 Audio model — it may already be pulled
# Look for anything with: lfm, audio, kokoro, tts, speech
ollama list | grep -iE "lfm|audio|kokoro|tts|speech|voice"

# If LFM 2.5 Audio is not listed, pull it
# The model name will be whatever LiquidAI published to the Ollama registry
# Check: https://ollama.com/search?q=lfm
ollama pull <correct-model-name>

# Confirm it's serving on the same port as the chat model
curl http://localhost:11434/v1/models | python3 -m json.tool
```

Once the audio model is confirmed loaded, update the Convex env var:
- `HUGH_TTS_MODEL` → set to the exact model name from `ollama list`

The voice reference file is already on the system:
```
/root/GrizDocs/HUGH_Briefing_Highland.mp3
```
The prosody configs are at:
```
/root/hugh_mcgregor_warmth.jsonl
/root/hugh_workshop_embodiment.jsonl
/root/hugh_emergency_protocols_synthetic_prosody.jsonl
```

Wire these into the TTS call. The `convex/tts.ts` action already uses `openai.audio.speech.create()` which hits `HUGH_GATEWAY_URL` — that's correct. The gateway is local. Just make sure `HUGH_TTS_MODEL` and `HUGH_VOICE_ID` match what's actually loaded.

---

## TASK 2 — FIX THE UE5 VULKAN ERROR

One env var. That's the entire fix.

```bash
# Find the Lavapipe ICD
find /usr -name "lvp_icd*.json" 2>/dev/null

# If missing:
apt-get install -y mesa-vulkan-drivers libvulkan1

# Find the UE5 service
find /etc/systemd/system -name "*.service" | xargs grep -l -i "unreal\|ue5\|kiosk" 2>/dev/null

# Add to the service [Service] block:
# Environment="VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json"
# Environment="DISPLAY=:0"

systemctl daemon-reload
systemctl restart <service-name>
journalctl -u <service-name> -f --no-pager
```

---

## DONE WHEN

- `ollama list` shows both the chat model AND the audio model
- `curl http://localhost:11434/v1/audio/speech` responds (even with an error about missing params — that means the endpoint exists)
- HUGH speaks using LFM audio when addressed
- UE5 is rendering on the physical display with no Vulkan errors

Take a screenshot. Confirm both. Report back.
