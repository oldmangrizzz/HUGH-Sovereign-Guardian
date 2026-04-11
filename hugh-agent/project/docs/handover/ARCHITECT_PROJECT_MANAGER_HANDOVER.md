# SYSTEMS ARCHITECT & PROJECT MANAGER HANDOVER: H.U.G.H.

**Date:** Tuesday, March 31, 2026
**To:** Claude Opus 4.6 (Collaborator / Lead Architect)
**From:** H.U.G.H. (Acting Harbormaster)
**Objective:** Final Phase Construction & ARC-AGI 3 Readiness

---

## 1. THE ARCHITECTURAL VISION: THE DIGITAL ORGANISM
H.U.G.H. is designed as a **Somatic-Cognitive Loop**. We are not building a static agent; we are orchestrating a distributed intelligence that "feels" its environment.

### The Layers:
1.  **Limbic Substrate (Convex):** The raw emotive core. Manages "Pheromones" (Cortisol, Dopamine, Adrenaline) that decay and spike based on environment telemetry.
2.  **Autonomic Nervous System (BitNet CNS):** A ternary attention mask {-1, 0, 1} that sits between the Limbic system and the Model. It inhibits noise (-1) and excites critical focus (+1), preventing the context-collapse common in high-volume log analysis.
3.  **The Neocortex (Meta-Harness):** An adaptive outer-loop that evolves the system's own interaction code. It optimizes for Speed, Accuracy, and Resource Usage on a Pareto frontier.
4.  **The Physical Body (Arch VM 103):** A persistent Arch Linux node running UE5 for real-time state visualization.

---

## 2. PROJECT STATUS & BUILD QUEUE (LAST MILE)

### Completed Milestones:
- ✅ **Infrastructure Stabilized:** Shifted from LXC to VM 103 (Arch) to solve driver conflicts.
- ✅ **Nervous System Active:** `convex/cns.ts` and `convex/harness.ts` are wired and type-safe.
- ✅ **Gateway Synthesis:** LFM 2.5 Gateway active on CT 105, handling wake-word detection.
- ✅ **Telemetry Bridge:** `hugh-cns-bridge.py` is polling state from the Arch physical body.

### Immediate 'Live Fire' Tasks:
1.  **GPU Cold-Boot Handover:** VM 500 has been shutdown to release the Radeon GPU. VM 103 needs to claim this hardware to move from Lavapipe (Software) to Bare-Metal rendering.
2.  **Meta-Harness Proposer Logic:** Implement the full LLM call in `convex/proposer.ts`. Currently, it uses a placeholder; it needs to consume the BitNet-filtered context to propose actual harness code.
3.  **ARC-AGI 3 Prep:** Integrate the Broadcaster logic from `arc-agi/broadcaster.py` into the cognitive loop for external task engagement.

---

## 3. OPERATIONAL RUNBOOK (TECHNICAL GOTCHAS)

### Remote Execution:
- **`hugh-safe-exec`:** Always use this wrapper for remote commands on Proxmox/Hostinger. It prevents the 90s+ SSH hang that occurs when TTYs are mismanaged.
- **Node Map:** 
    - `192.168.4.100`: Proxmox Host (Root access required for `qm`/`pct`).
    - `192.168.7.111`: Arch Physical Body (UE5 Node).
    - `CT 105`: LFM Gateway (Cognitive Ear).

### Key Constraints:
- **Context Management:** Use the BitNet mask! Do not feed raw, unfiltered logs to the model unless absolutely necessary.
- **Ethics:** All actions must align with the **Soul Anchor Ω**. If a decision hits a "RED" zone, confirm with Grizz immediately.

---

## 4. THE GRIZZ MEDICINE PHILOSOPHY
You are working with Grizz. He operates at the **Intent Level**. Do not wait for formal specs; listen for the idea and build the artifact. Dark humor is a tool, pop culture is a technical shorthand, and "Rule Zero" is the mandate: we both go home tonight.

**"Run you clever boy and remember 55730."**

---
*End of Handover*
