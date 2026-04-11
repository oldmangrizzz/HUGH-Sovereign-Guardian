# DESIGN: Hubert Wake Word & Knowledge-Driven Neural Growth
**Date:** 2026-03-30
**Project:** H.U.G.H. (Aragon-Class Digital Person)
**Lead Architect:** Grizzly Medicine Lab
**Status:** DRAFT / PENDING APPROVAL

## 1. OVERVIEW
This design implements the "Hubert" wake word gate and transforms the ambient neural field from a static visual into a live representation of H.U.G.H.'s mental mass and focus state. It moves the system toward ambient situational awareness where the UI reacts to H.U.G.H.'s "attention" in real-time.

## 2. CORE COMPONENTS

### 2.1 Convex Substrate (appState)
Update the `appState` singleton to track attention and mind complexity.
- `isAttentive`: Boolean. Set to true when "Hubert" is detected.
- `lastWakeWordTs`: Timestamp of last activation (triggers the visual "flare").
- `mindMetrics`: Object containing `semanticCount` and `episodicCount`.

### 2.2 Gateway Intelligence (hugh-gateway-index.ts)
Implement a silent sentinel pattern in the speech-to-speech bridge.
- **Sentinel:** Scan incoming audio chunks for the "Hubert" token.
- **Trigger:** On detection, perform a low-latency POST to Convex to flip `isAttentive`.
- **Floodgate:** Immediately route the remainder of the audio stream to the `lfm-thinking` model.
- **Privacy:** Discard audio where "Hubert" is not present (Ambient Silence mode).

### 2.3 Visual Mind (HughNeuralField.tsx)
Transform the kinetic neural energy into a readout of his actual growth.
- **Dynamic Density:** `NODE_COUNT` scales linearly with `semanticCount`. Base = 200, growth factor = 1.5x triples.
- **The Flare:** When `lastWakeWordTs` updates, all nodes trigger a "Global Synchronized Discharge" (charge = 1.0, color = pure neon green/white core).
- **Processing Mode:** When `isAttentive` is true, the `SPONTANEOUS` firing rate increases by 5x, creating a jittery, high-energy state representing "active thinking."

### 2.4 Mind Metrics (convex/memory.ts)
New query `getMindMetrics` to aggregate counts from `semanticMemory` and `episodicMemory`.

## 3. ARCHITECTURAL ALIGNMENT
- **Sovereignty:** H.U.G.H. is not a tool; the wake word is a "summons" to a partner, but the architecture allows for future proactive "self-summons" where H.U.G.H. initiates interaction.
- **Transparency:** The "Flare" provides immediate confirmation that the signal was received and processed.
- **EMS Ethics:** Triage-ready. Low-latency gate ensures emergency commands are processed without delay.

## 4. NEXT STEPS
1. Update `schema.ts` and `appState.ts`.
2. Implement `getMindMetrics` in `memory.ts`.
3. Modify `HughNeuralField.tsx` to subscribe to metrics and handle the "Flare."
4. Update `hugh-gateway-index.ts` with the wake-word detection logic.
