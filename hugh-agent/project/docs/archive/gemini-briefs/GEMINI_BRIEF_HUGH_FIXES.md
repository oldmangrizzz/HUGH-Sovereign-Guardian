# H.U.G.H. SYSTEM FIX BRIEF
**For: Gemini**
**Prepared by: Claude (Grizzly Medicine Lab diagnostic session)**
**Date: 2026-03-30**
**Repo:** `/project` (the Vite + React + Convex frontend app)
**Live site:** `workshop.grizzlymedicine.icu` (Cloudflare tunnel → CT-101 LXC on Proxmox)

---

## READ THIS FIRST

You are fixing an existing, deployed system. Every file referenced below exists and is in production. Do not rewrite from scratch. Do not use pseudocode. Do not leave stubs. Every fix must be complete, deployable code.

The stack is:
- **Frontend:** Vite + React + TypeScript → `src/`
- **Backend:** Convex Pro (`convex/`) — mutations, queries, actions, crons
- **Runtime:** CT-101 LXC container on Proxmox, Cloudflare tunnel
- **Inference:** KVM2 Hostinger VPS running Ollama (LFM 2.5 + audio models)
- **State:** Convex Pro (effervescent-toucan-715.convex.cloud)

The kiosk display is `src/HughKioskDisplay.tsx`. The Convex chat handler is `convex/hugh.ts`. The endocrine system is `convex/endocrine.ts`. Crons are in `convex/crons.ts`.

---

## BUG 1 — CRITICAL: Wake word triggers but HUGH never responds

### What's broken
`HughKioskDisplay.tsx` has a continuous speech recognition loop watching for "Hughbert" and variants. When the wake word fires it does:
1. Calls `triggerWakeWord()` (sets `isAttentive: true` in Convex appState)
2. Plays an audio chime
3. Switches display mode to AWAKE
4. **STOPS.**

There is no second recognition pass to capture what the user actually says after the wake word. There is no call to `api.hugh.chat`. HUGH acknowledges he heard his name and then goes silent. The brain is connected, the ears work, the wake word is detected — but the conversation loop is never initiated.

### How the speak pathway works (understand this first)
The kiosk's `speak()` function monitors `recentEpisodes` via `useQuery(api.memory.getRecentEpisodes, { limit: 1 })`. It watches for new entries with `eventType === "hugh_response"`. When one appears, it calls `window.speechSynthesis.speak()`.

`convex/hugh.ts` (the `chat` action) DOES write `hugh_response` episodes to memory at the end of every inference call via `internal.memory.writeEpisode`. So the speak pipeline works — it just never gets triggered because `chat` is never called from the kiosk speech path.

### The fix
After the wake word fires, start a **second, single-shot** speech recognition session to capture the command. When that recognition finalizes, call `api.hugh.chat` with the transcript. The response will be stored in memory automatically by `hugh.ts`, and the `recentEpisodes` watcher will pick it up and speak it.

**In `HughKioskDisplay.tsx`, inside the `recognition.onresult` handler, after the wake word is detected:**

```typescript
// After: triggerWakeWord().catch(() => {}); playChime(); setMode("AWAKE"); etc.

// Start command capture
setTimeout(() => {
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return;
  const cmdRec = new SR();
  cmdRec.continuous = false;
  cmdRec.interimResults = false;
  cmdRec.lang = "en-US";
  cmdRec.onresult = async (e: any) => {
    const transcript = e.results[0][0].transcript;
    if (!transcript.trim()) return;
    try {
      await chat({ nodeId: NODE_ID, message: transcript.trim() });
      // chat() writes the hugh_response episode → recentEpisodes watcher → speak()
    } catch (err) {
      console.error("[HUGH WAKE COMMAND]", err);
    }
  };
  cmdRec.onerror = () => {};
  try { cmdRec.start(); } catch {}
}, 400); // 400ms delay gives the chime time to finish
```

You will need to import `useAction` and `api.hugh.chat` in `HughKioskDisplay.tsx` if not already present. Check the existing imports — `useMutation` is already imported. Add:

```typescript
const chat = useAction(api.hugh.chat);
```

This goes inside the `HughKioskInner` function component alongside the existing `triggerWakeWord` mutation.

**Also:** The `recentEpisodes` watcher has a guard that skips speaking the first episode on initial load (`if (lastSpokenId !== null)`). This is correct behavior — keep it.

---

## BUG 2 — CRITICAL: Endocrine values stuck at 1.0 (pulse cron missing)

### What's broken
`convex/endocrine.ts` has a `pulseAll` internal mutation that decays all endocrine values toward baseline (0.2) using exponential decay with a ~10 minute half-life. It was written and deployed but **never added to the cron schedule**.

`convex/crons.ts` currently only has:
```typescript
crons.interval(
  "cleanExpiredPheromones",
  { seconds: 60 },
  internal.appState.cleanExpiredPheromones,
  {}
);
```

There is no cron for `pulseAll`. The node `hugh-primary` was spiked to 1.0 at some point and has been stuck there ever since because decay never runs.

### The fix
Add the endocrine pulse to `convex/crons.ts`:

```typescript
crons.interval(
  "endocrinePulse",
  { seconds: 60 },
  internal.endocrine.pulseAll,
  {}
);
```

After deploying this, the values will still show 1.0 until the first cron tick. To immediately reset to baseline, run this one-time Convex mutation from the dashboard or a script:

```typescript
// Run once via Convex dashboard → Functions → endocrine.resetToBaseline
// OR call triggerPulse several times in rapid succession to force decay ticks
```

**Alternatively**, add a one-time reset mutation to `endocrine.ts`:

```typescript
export const resetNodeToBaseline = mutation({
  args: { nodeId: v.string() },
  handler: async (ctx, args) => {
    const state = await ctx.db
      .query("endocrineState")
      .withIndex("by_node", (q) => q.eq("nodeId", args.nodeId))
      .unique();
    if (!state) throw new Error(`Node not found: ${args.nodeId}`);
    await ctx.db.patch(state._id, {
      cortisol: 0.2,
      dopamine: 0.2,
      adrenaline: 0.2,
      holographicMode: false,
      lastPulse: Date.now(),
    });
  },
});
```

Call `resetNodeToBaseline({ nodeId: "hugh-primary" })` once from the Convex dashboard after deploy. This is not a permanent fix — the permanent fix is the cron.

---

## BUG 3 — VISUAL: CT-101 LFM RUNTIME status uses wrong metric

### What's broken
In `HughKioskDisplay.tsx`, the `renderContent()` function for AWAKE mode:

```typescript
const lfmLatency = lastPulse ? Math.max(0, Date.now() - lastPulse) : 0;

// ...

<ContainerBadge name="CT-101 · LFM RUNTIME" status={lfmLatency < 5000 ? "online" : "offline"} />
```

`lastPulse` is `endocrine.lastPulse` — the timestamp of the last Convex endocrine decay cron tick. This has **nothing to do with whether CT-101 (the LXC container) is alive**. It's measuring how recently the cron ran, not container health. Since the cron hasn't been running (Bug 2), this has been showing "offline" even when CT-101 is perfectly healthy.

The `LFM PULSE LAG` telemetry bar is a reasonable use of this metric (it tells you how stale the endocrine system is). But using it as the CT-101 liveness indicator is wrong.

### The fix
CT-101's status — and all container statuses — should come from `api.agentRegistry.listNodes` (the real-time Convex subscription that tracks agent heartbeats).

Replace the hardcoded container section in `renderContent()`:

```typescript
// ADD this query at the top of HughKioskInner:
const agentNodes = useQuery(api.agentRegistry.listNodes);

// Helper to get status from registry
const nodeStatus = (nodeId: string): "online" | "offline" => {
  if (!agentNodes) return "offline";
  const node = agentNodes.find(n => n.nodeId === nodeId);
  if (!node) return "offline";
  // Consider offline if heartbeat is > 90 seconds old
  return (Date.now() - node.lastHeartbeat) < 90_000 ? "online" : "offline";
};
```

Then replace the container badges:

```typescript
// REPLACE the hardcoded container badges with:
<ContainerBadge name="CT-101 · LFM RUNTIME"  status={nodeStatus("proxmox-ue")} />
<ContainerBadge name="CT-102 · FORGE WORKER" status={nodeStatus("proxmox-forge")} />
<ContainerBadge name="KVM2   · OLLAMA"       status={nodeStatus("kvm2")} />
<ContainerBadge name="KVM4   · DASHBOARD"    status={nodeStatus("kvm4")} />
```

**Node IDs to use** — check `agentRegistry` in the Convex dashboard for the actual registered nodeIds. The system prompt in `convex/hugh.ts` lists them as: `proxmox-ue` (CT-101), `kvm2`, `kvm4`, `macbook-air`. Use the exact nodeIds that are actually registering. If CT-102 (Forge Worker) hasn't registered yet, it will show offline — which is correct behavior.

---

## BUG 4 — VISUAL: Text responses not streaming to kiosk screen

### What's broken
The kiosk only speaks responses — it doesn't display them as text. When HUGH responds via the wake word flow, the text never appears on screen. The HughChat component (used in the web chat view) does display messages, but the kiosk display has no message rendering at all in AWAKE mode.

### The fix
The kiosk needs to display the last N exchanges. The simplest path: query `api.memory.getRecentEpisodes` with a larger limit and render them in the center column beneath the neural field.

In `HughKioskInner`, the `recentEpisodes` query already exists but with `limit: 1`. Change it:

```typescript
const recentEpisodes = useQuery(api.memory.getRecentEpisodes, { limit: 6 });
```

In the AWAKE mode `renderContent()`, in the center column below the `HughNeuralField`, add a message overlay:

```typescript
{/* Message stream overlay */}
{recentEpisodes && recentEpisodes.length > 0 && (
  <div style={{
    position: "absolute", bottom: 60, left: 20, right: 20,
    display: "flex", flexDirection: "column", gap: 6,
    pointerEvents: "none", maxHeight: "40%", overflowY: "hidden",
  }}>
    {[...recentEpisodes].reverse().map((ep) => (
      <div key={ep._id} style={{
        fontFamily: "monospace",
        fontSize: ep.eventType === "user_message" ? 9 : 10,
        color: ep.eventType === "user_message" ? "#004400" : "#00cc33",
        letterSpacing: "0.05em",
        lineHeight: 1.5,
        textShadow: ep.eventType === "hugh_response" ? "0 0 8px #00ff4140" : "none",
        opacity: 0.85,
        padding: "4px 8px",
        borderLeft: ep.eventType === "hugh_response" ? "1px solid #00cc3340" : "none",
      }}>
        {ep.eventType === "user_message" ? "GRIZZ: " : "H.U.G.H.: "}
        {ep.content.slice(0, 280)}{ep.content.length > 280 ? "…" : ""}
      </div>
    ))}
  </div>
)}
```

This uses already-deployed Convex infrastructure. No new backend work required.

---

## BUG 5 — VOICE: TTS is browser speechSynthesis, not LFM 2.5

### What's broken
Both `HughKioskDisplay.tsx` and `HughChat.tsx` use `window.speechSynthesis` with a preference for "Daniel" or "Google UK English Male" voice. This is the browser's built-in TTS — not LFM 2.5. The requirement is zero-shot speech synthesis using LFM 2.5 Audio on KVM2 with a specific voice reference file already on the system.

### What you need from Grizz before fixing this
Before writing any LFM TTS code, confirm with Grizz:
1. **What port is the LFM 2.5 Audio model serving on KVM2?** (Ollama default is 11434, but audio/TTS may be a separate llama-server instance on a different port)
2. **What is the voice reference file path on KVM2?** The voice file for HUGH's synthesis should already be on the system.
3. **Is this Kokoro, Orpheus, or the native LFM 2.5 Audio API?** The endpoint format differs significantly between them.

### The fix (once you have the above info)
Replace the `speak()` function in both `HughKioskDisplay.tsx` and `HughChat.tsx` with an HTTP-based TTS call to KVM2. The pattern will be:

```typescript
const speak = useCallback(async (text: string) => {
  const cleanText = text
    .replace(/<KVM_EXEC>[\s\S]*?<\/KVM_EXEC>/g, "")
    .replace(/```[\s\S]*?```/g, "")
    .trim();
  if (!cleanText) return;

  try {
    // POST to KVM2 TTS endpoint
    const res = await fetch("https://[KVM2_TUNNEL_URL]/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: cleanText,
        voice_file: "/path/to/hugh/voice.wav", // confirm with Grizz
        // format/params depend on which TTS engine is running
      }),
    });
    const audioBlob = await res.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    audio.onended = () => URL.revokeObjectURL(audioUrl);
    await audio.play();
  } catch (err) {
    console.warn("[HUGH TTS] LFM audio failed, falling back to browser TTS:", err);
    // Fallback to browser TTS if KVM2 is unreachable
    if (synthRef.current) {
      const utt = new SpeechSynthesisUtterance(cleanText);
      utt.rate = 0.95; utt.pitch = 0.9;
      synthRef.current.speak(utt);
    }
  }
}, []);
```

**Do not implement this until you have confirmed the KVM2 TTS endpoint details with Grizz. The fallback to browser TTS must be preserved so voice doesn't go silent if KVM2 is unreachable.**

---

## ARCHITECTURAL NOTE: Unreal Engine vs React for the kiosk

This is not a bug fix — it's a roadmap item. Grizz raised it and wants it documented.

### Current situation
The kiosk display is a React/Vite app running in Chromium in kiosk mode on the workshop iMac (CT-101). This made sense early because:
- Convex has a native React SDK (live subscriptions via `useQuery`)
- Same codebase serves the public-facing dashboard on KVM4
- Rapid iteration via hot reload

### Why Unreal Engine is correct for the kiosk specifically
The kiosk is a **dedicated display on dedicated hardware** — not a web app that needs to be accessible anywhere. The React app was a development shortcut that has become a limitation. UE wins on every axis that matters for the kiosk:

- **Clifford attractor / neural field rendering**: UE Niagara particle system with GPU simulation. No canvas 2D frame budget fighting. True real-time at 60+ fps.
- **Audio pipeline**: UE's native audio subsystem handles TTS playback, microphone capture, and wake word detection without browser sandbox permission friction. No `getUserMedia()` permission dialogs.
- **LFM 2.5 Audio integration**: Direct socket connection to KVM2. No CORS, no fetch API limitations.
- **Camera feeds**: Direct UE media texture, no browser MediaStream API.
- **Convex integration**: Convex REST API + WebSocket from UE's HTTP client. No React SDK needed — poll or subscribe via raw WebSocket.
- **Holographic rendering**: UE can do actual volumetric effects. React canvas cannot.

### Split architecture recommendation
- **Kiosk (iMac CT-101):** Unreal Engine 5, running natively, connecting to Convex via REST/WebSocket
- **Public dashboard (KVM4):** Keep React/Vite — it's correct for a web-accessible interface
- **Admin panel:** Keep React/Vite

This is a Phase 2 item. The current React bugs (Bugs 1–5 above) should be fixed first to get HUGH functional, then UE migration planned separately.

---

## DEPLOYMENT ORDER

Fix in this sequence — each one is independent but ordered by impact:

1. **Bug 1** (wake word pipeline) — `src/HughKioskDisplay.tsx` only. No Convex changes. Deploy via `npm run build` on CT-101.
2. **Bug 2** (endocrine cron) — `convex/crons.ts` + optional `convex/endocrine.ts` reset mutation. Deploy via `npx convex deploy`. Then run reset mutation once from dashboard.
3. **Bug 3** (container status) — `src/HughKioskDisplay.tsx`. Requires agentRegistry nodeIds confirmed from Convex dashboard first.
4. **Bug 4** (text streaming) — `src/HughKioskDisplay.tsx`. No Convex changes.
5. **Bug 5** (LFM TTS) — **BLOCKED on KVM2 endpoint details from Grizz.** Do not implement until confirmed.

---

## FILES TO TOUCH

| File | Bugs | What changes |
|------|------|-------------|
| `src/HughKioskDisplay.tsx` | 1, 3, 4 | Wake word handler, container status queries, message overlay |
| `convex/crons.ts` | 2 | Add endocrine pulse interval |
| `convex/endocrine.ts` | 2 | Add one-time reset mutation (optional) |
| `src/HughKioskDisplay.tsx` + `src/HughChat.tsx` | 5 | LFM TTS (BLOCKED) |

**Do not touch:** `convex/hugh.ts`, `convex/memory.ts`, `convex/agentRegistry.ts`, `convex/endocrine.ts` (except the reset mutation), `convex/kvm.ts`. These are working correctly.

---

## WHAT WORKING LOOKS LIKE

After Bugs 1–4 are fixed:
1. User says "Hughbert" → chime plays → display switches to AWAKE
2. User continues speaking → recognition captures command → `hugh.chat` called
3. LFM 2.5 inference runs on KVM2 → response stored as `hugh_response` episode in Convex
4. Kiosk `recentEpisodes` watcher fires → `speak()` called → HUGH speaks
5. Response text appears in the center column overlay
6. Endocrine state shows realistic values (not 1.0) — decaying toward baseline between interactions, spiking during active conversation
7. Container badges reflect actual `agentRegistry` heartbeat data

---

*End of brief. Questions go to Grizz.*
