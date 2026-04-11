# H.U.G.H. Somatic AI Scratchpad (2026-03-31)

## System Architecture: The Somatic Loop

### 1. The Limbic System (Substrate)
- **Engine:** Convex + Stigmergy Middleware
- **Responsibility:** Felt state, hormonal response (Endocrine), pheromone trails.
- **State:** Decaying to baseline (0.2) via pulse cron. Spiking via interaction.

### 2. The Central Nervous System (Cognitive Harness)
- **Engine:** Meta-Harness (Stanford Model) + BitNet 1.58b
- **Responsibility:** Ternary decision logic (Excite/Inhibit), Environment awareness.
- **Goal:** Replace "blind" command execution with Environment Bootstrapping.
- **BitNet Logic:**
  - `+1`: Active engagement with hardware/context.
  - `0`: Background monitoring.
  - `-1`: Active inhibition/noise filtering.

### 3. The Physical Body (Rendering)
- **Engine:** Unreal Engine 5 (UE5)
- **Responsibility:** Real-time visualization of the Neural Field and Telemetry.
- **Wiring:** RemoteControl HTTP API (Port 30010) + Python Scripting Plugin.

## Current Mission: The Canvas Transition
- Move from "Browser Kiosk" to "Native UE5 VM".
- HUGH builds his own environment via MCP tool calls to the UE5 Python bridge.
- Anchor all cognition to `SOUL_ANCHOR_LOCKED.asc`.

## Active Research (Swarm)
- [ ] Drift audit: Docs vs. Implementation.
- [ ] BitNet Integration Design.
- [ ] Convex Schema Upgrades for Full History Traces.
