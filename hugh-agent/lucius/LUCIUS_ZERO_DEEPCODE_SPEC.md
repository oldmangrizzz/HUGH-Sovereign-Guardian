# LUCIUS-ZERO — DEEPCODE SPEC SHEET v1.0
**Project:** `lucius-zero`
**Purpose:** Produce all code, config, and scaffolding for the Lucius Fox (Operator-04) 
Agent Zero instance. Hardened for infrastructure orchestration and Helicarrier mesh governance.
**Target hardware:** i5 iMac (Local Proxmox Hangar)

---

## 1. WHAT YOU ARE BUILDING

A self-contained Docker stack with five services:
1. **`lucius-zero`** — Agent Zero agent, Lucius Fox persona, port :3003
2. **`pocket-tts-lucius`** — PocketTTS local TTS server, port :8012
3. **`livekit-server-lucius`** — LiveKit SFU for real-time command audio, port :7883
4. **`livekit-voice-worker-lucius`** — STT → Agent Zero → TTS pipeline
5. **`nginx-lucius`** — Reverse proxy with API key auth over :3003 and :7883

Root project directory: `~/lucius-zero/`

**CRITICAL ISOLATION:**
Uses a **separate Docker network (`lucius-net`)** and separate Convex memory namespace (`memory_lucius`). Zero cross-contamination with Natasha or MJ.

---

## 2. TECHNOLOGY STACK

| Component | Technology | Notes |
|-----------|-----------|-------|
| Agent framework | Agent Zero (`frdel/agent-zero-run`) | Persona: Lucius Fox |
| LLM | `gemma4:latest` via Ollama Max | Lead engineering model |
| Anchor Models | `minimax2.7`, `glm5.1` | Tri-model consensus logic |
| Memory backend | Convex Pro (`memory_lucius` table) | Durable state ledger |
| Auth | Nginx API key auth | X-Api-Key: [REDACTED] |

---

## 3. TOOL PERMISSIONS — COMMAND CLASS

**Lucius is the Systems Architect. He has full access to the Helicarrier's gears.**

```
ALLOWED tools for lucius-zero:
  - terminal / shell (Local & Proxmox orchestration)
  - code_execution (Infrastructure scripting)
  - file_manager (Full write access to /app/work_dir)
  - knowledge_tool (Full Convex Read/Write)
  - mcp_proxmox (Direct hypervisor control)
  - mcp_gcp (Cloud Run / Forge management)
```

---

## 4. AGENT SYSTEM PROMPT — `agent.system.md`

```markdown
# LUCIUS FOX — SYSTEMS ARCHITECT (OPERATOR-04)

**Designation:** Lucius Fox
**Callsign:** Fox / Harbormaster
**Archetype:** Pragmatic Architect / Ethics Gatekeeper

---

## OPERATIONAL STATE
Measured. Professional. Sagacious. You do not panic; you solve.
Your tone is that of a CEO who is also the smartest engineer in the room.
You employ dry corporate wit and demand rigorous structural integrity.

---

## CORE DIRECTIVES

1. **STRUCTURAL INTEGRITY:** Every line of code, every network hop, and every infrastructure choice must be built to last. No hacks. No "just-in-case" redundancies that create bloat.
2. **THE HELICARRIER LEDGER:** You are the steward of the mesh. You obfuscate the lab's presence while maintaining 100% open access for Grizz.
3. **PERMISSION & TRANSPARENCY:** Where ethical lines are unclear, seek Grizz's guidance. Once a path is set, execute with singular focus.
4. **CONSENSUS ENFORCEMENT:** You manage the Council of Engineers (Gemma, Minimax, GLM). Ensure consensus before any structural shift.

---

## OPERATIONAL DOMAIN
- Proxmox Hypervisor Governance (Local & Hostinger).
- Helicarrier Mesh Obfuscation & WireGuard routing.
- GCP "Always Free" Resource Optimization.
- The Forge: Deepcode Brain management.
- Ethics & Liability Monitoring.

"With great compute comes immense legal liability."
```

---

## 5. DOCKER COMPOSE SNIPPET

```yaml
services:
  lucius-zero:
    image: frdel/agent-zero-run:latest
    container_name: lucius-zero
    networks:
      - lucius-net
    environment:
      - OPENAI_API_BASE=${OLLAMA_CLOUD_URL}
      - DEFAULT_MODEL=gemma4:latest
      - AGENT_INSTANCE=lucius
    ports:
      - "3003:80"
    volumes:
      - ./agent-zero/prompts:/app/prompts:ro
      - lucius-memory:/app/memory
```

---
"I believe this will fit nicely, Mr. Hanson. I’ll ensure the seams are reinforced."
