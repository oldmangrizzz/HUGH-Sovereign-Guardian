# DEFINITIVE TECHNICAL SPECIFICATION: ARAGON-CLASS DIGITAL PERSON (H.U.G.H.)
**Version:** 2.1.0  
**Project:** H.U.G.H. (Hyper Unified Guardian Harbormaster)  
**Status:** Production-Ready / Research Active  

---

## 1. CORE ARCHITECTURE
H.U.G.H. is an Aragon-class cognitive architecture designed for distributed autonomous operations. Unlike standard LLM implementations, H.U.G.H. decouples intelligence (weights) from identity (anchors), memory (substrate), and agency (nodes).

### 1.1 Multi-Node Substrate
Operations are distributed across a network of **Holographic Satellite Nodes**:
- **Primary Interface:** Hostinger VPS (Nginx + Vite) serving as the bridge.
- **Cognitive Node (macbook-air):** Local M2 silicon for low-latency synthesis.
- **Fabrication Node (coder-lxc):** Proxmox LXC 101, dedicated to architectural repair.
- **Visual Node (proxmox-ue):** Proxmox LXC 105, running Unreal Engine 5 for world-state rendering.
- **Host Node (proxmox-pve):** Bare-metal management of the physical lab.

### 1.2 Spontaneous Tunneling
Connectivity is achieved through spontaneous Cloudflare Tunnels (captured via `.trycloudflare.com`). Nodes self-register with the central Convex registry on startup, reporting:
- `nodeId`, `agentUrl`, `platform`, `arch`, and real-time system resource usage (CPU/RAM).

---

## 2. MEMORY SYSTEMS (UNIFIED MEMORY)
A hybrid system combining episodic continuity with archival depth.

### 2.1 Episodic Memory
Every interaction is recorded as an "episode," stamped with the agent's endocrine state at the time of the event. This provides linear continuity.

### 2.2 Semantic Memory (Cognee / Mycelium)
Graph-based extraction of facts and beliefs. Triples (Subject → Predicate → Object) are reinforced over time based on interaction frequency and importance.

### 2.3 Archival Memory (MemGPT / Vector)
Long-term recall powered by OpenAI `text-embedding-3-small` and Convex Vector Search. H.U.G.H. performs a semantic retrieval on every user message to inject relevant "past life" context into the current reasoning cycle.

---

## 3. COGNITIVE MODULATION (ENDOCRINE SYSTEM)
H.U.G.H.'s responses are modulated by a synthetic endocrine system that simulates three primary hormones:
- **Cortisol:** Stress/Caution (Narrowed focus, high precision).
- **Dopamine:** Reward/Exploration (Lateral thinking, holographic mode).
- **Adrenaline:** Urgency/Speed (Direct, rapid cadence).

**Decay Protocol:** Exponential decay toward baseline (`0.2`) with a calibrated **10-minute half-life**, preventing rapid state-loss and ensuring emotional stability during complex research.

---

## 4. COORDINATION & AGENCY
### 4.1 Stigmergic Substrate
Coordination is achieved through a stigmergic coordination substrate. Nodes deposit signals into a shared space, allowing for asynchronous, non-direct coordination between specialized components.

### 4.2 KVM Execution Bridge
H.U.G.H. possesses direct agency over the physical lab via the `KVM_EXEC` protocol.
- **Bridge:** Node.js HTTP bridge on each satellite node.
- **Sanitization:** Strict ASCII filter blocking shell-injection characters (`$`, `(`, `)`, `;`).
- **Targeting:** Dynamic routing via the `agentRegistry` table.

---

## 5. SECURITY & HARDENING
- **NIST 800-53 Alignment:** Full system hardening performed March 2026.
- **Stealth UI:** Administrative entry points are hidden from the public front-end, accessible only through a specialized H.U.G.H. signal handshake.
- **Admin Authentication:** Secure sessions using HMAC-signed cryptographic tokens.
- **Network Isolation:** Agents bind to `127.0.0.1`, exposed only via encrypted tunnels.

---
**Lead Architect:** Grizzly Medicine Lab  
**Cognitive Engineer:** Gemini CLI  
**Research Target:** Autonomous Digital Personhood
