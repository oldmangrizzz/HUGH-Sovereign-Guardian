# HELICARRIER NETWORK: MASTER ARCHITECTURAL SPECIFICATION v2.0
**Project:** `helicarrier-mesh` / `9-chairs`
**Status:** UPDATED (Post-Audit)

---

## 1. THE ARCHITECTURE (THE SHELL)

The Helicarrier is a tiered, self-healing mesh designed for absolute sovereignty and obfuscation.

### Layer 1: The Sentinel (Frontline Triage)
- **Hardware:** Dell Latitude 3189 (Local Proxmox Node).
- **Logic:** `Project BUGBOX`.
- **Function:** Inspects all traffic without being visible on the network. Frontline for real-time threat triage and edge sensor ingestion.

### Layer 2: The Proxmox Core (Command & Control)
- **Hardware:** 2017 iMac (Local Proxmox) + Hostinger KVM4 (Cloud).
- **Logic:** `H.U.G.H.` / `Lucius Fox`.
- **Function:** Hosts the LXC containers for Digital Persons and the primary AI engines.

### Layer 3: The Command Link
- **Hardware:** MacBook Air M2.
- **Function:** Primary operator interface and high-fidelity orchestration.

### Layer 3: The Secure Overlay (The Fabric)
- **Mesh:** Tailscale / Headscale (Encrypted mesh for trusted devices).
- **Ingress:** Cloudflare Tunnels (Wildcard ingress for external syncs).
- **Routing:** WireGuard + mTLS mesh (Dual-layer obfuscation).

---

## 2. THE HANGARS (AGENT SUITS)

Two specialized Docker stacks are integrated into the Helicarrier, each with strict network isolation.

### Hangar A: MJ-ZERO (`mj-zero`)
- **Isolation:** `mj-net` (Bridge network). No shared state with Natasha.
- **Model:** `gemma4:latest` (Ollama Cloud).
- **Permissions:** Human layer only. NO terminal/shell access.
- **Port:** :3002 (via Nginx proxy).

### Hangar B: NATASHA-ZERO (`natasha-zero`)
- **Isolation:** `natasha-net` (Bridge network).
- **Model:** `glm5.1` / `minimax2.7` (Ollama Cloud).
- **Permissions:** FULL ACCESS (Terminal, Code Execution).
- **Port:** :3001 (via Nginx proxy).

---

## 3. DEFENSE & GOVERNANCE (FURYGATE)

The Helicarrier is governed by the `FuryGate` policy engine, which evaluates every packet for consent and ethical alignment.

### Escalation Matrix:
1. **BUGBOX Alert:** Anomalous behavior detected.
2. **FURY Protocol:** Capture evidence, start OSINT swarm, issue warning.
3. **RED_HOOD Protocol:** Proportional response, deep OSINT, decisive countermeasure.

---

## 4. PERSISTENCE (CONVEX LEDGER)

- **Registry:** Convex acts as the distributed state registry for the whole network.
- **Audit Log:** Every autonomous action from MJ, Natasha, and H.U.G.H. is logged to the `action_log` table.
- **Conflict Resolution:** Tri-model anchoring (Gemma 4, Minimax 2.7, GLM 5.1) ensures consensus before commitment.

---
"We record because we must, not because we can." - Master Mandate
