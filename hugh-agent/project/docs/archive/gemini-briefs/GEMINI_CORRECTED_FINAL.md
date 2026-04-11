# CORRECTED ARCHITECTURE — THIS SUPERSEDES ALL PREVIOUS BRIEFS
**For: Gemini**

Two corrections burned into your context permanently before you touch anything:

1. **NOT Ollama. Never was. It is llama.cpp running llama-server.**
2. **Everything — LFM 2.5 Thinking, LFM 2.5 Audio, LFM 2.5 Vision — runs in the same container (CT-101) via llama-server.**

Delete every `ollama` command you were planning to run. They are wrong.

---

## TASK 1 — CONFIRM WHAT'S RUNNING

```bash
# Find running llama-server instances and their ports
ps aux | grep llama-server
systemctl list-units --type=service | grep -i llama

# See what models are loaded and on which ports
curl http://localhost:8080/v1/models 2>/dev/null
curl http://localhost:8081/v1/models 2>/dev/null
curl http://localhost:11434/v1/models 2>/dev/null
# Try all ports until you find the server

# Check what HUGH_GATEWAY_URL is set to in the environment
grep -r "HUGH_GATEWAY" /root /home/hugh /etc 2>/dev/null | grep -v "Binary"
```

---

## TASK 2 — GET LFM 2.5 AUDIO LOADED IN LLAMA-SERVER

The audio model needs to be running in the same llama-server environment as the text model. Check if it's already loaded:

```bash
# List all model files on the system
find / -name "*.gguf" -not -path "*/proc/*" 2>/dev/null
find /root /home/hugh /models /opt -name "*audio*" -o -name "*tts*" -o -name "*speech*" -o -name "*lfm*" 2>/dev/null
```

If the LFM 2.5 Audio GGUF is present, load it. If llama-server is running as a systemd service, find the service file and check how it's configured:

```bash
find /etc/systemd/system -name "*.service" | xargs grep -l "llama" 2>/dev/null
```

If audio needs its own llama-server instance on a separate port, start it:

```bash
llama-server \
  --model /path/to/lfm-audio.gguf \
  --port 8081 \
  --host 0.0.0.0 \
  --ctx-size 4096
```

Once it's running, update the Convex env var:
- `HUGH_TTS_URL` → `http://localhost:8081` (or whatever port the audio server is on)

If the audio model runs on the SAME port as the text model, no new env var needed — `HUGH_GATEWAY_URL` covers it.

Update `convex/tts.ts` to use `HUGH_TTS_URL` if the port is different from `HUGH_GATEWAY_URL`:

```typescript
// In convex/tts.ts — at the top of the synthesize handler, replace the openai client usage:
const ttsBaseUrl = process.env.HUGH_TTS_URL ?? process.env.HUGH_GATEWAY_URL;
const ttsKey = process.env.HUGH_GATEWAY_KEY ?? "dummy";
const ttsClient = new OpenAI({ baseURL: ttsBaseUrl, apiKey: ttsKey });

const response = await ttsClient.audio.speech.create({
  model: process.env.HUGH_TTS_MODEL ?? "lfm-2.5-audio",
  voice: process.env.HUGH_VOICE_ID ?? "af_heart",
  input: cleanText,
  response_format: "mp3",
});
```

The voice file is:
```
/root/GrizDocs/HUGH_Briefing_Highland.mp3
```
Prosody configs:
```
/root/hugh_mcgregor_warmth.jsonl
/root/hugh_workshop_embodiment.jsonl
/root/hugh_emergency_protocols_synthetic_prosody.jsonl
```

Wire the voice file path into the TTS call however the llama-server audio endpoint expects it — check the llama-server docs for the exact `voice` parameter format for audio models.

---

## TASK 3 — FIX VULKAN (unchanged from before)

```bash
find /usr -name "lvp_icd*.json" 2>/dev/null
apt-get install -y mesa-vulkan-drivers libvulkan1   # if missing

# Add to UE5 service:
# Environment="VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.x86_64.json"
# Environment="DISPLAY=:0"

systemctl daemon-reload && systemctl restart <ue5-service>
```

---

## DONE WHEN

- `ps aux | grep llama-server` shows the audio model running
- `curl http://localhost:<audio-port>/v1/models` confirms it
- HUGH speaks using LFM audio with the Highland voice
- UE5 is rendering on the display with no Vulkan errors

Screenshot. Confirm. Report.
