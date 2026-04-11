# SECURITY PROFILE: ANTHROPIC CLAUDE CONWAY
**Classification:** Competitive Intelligence / Threat Surface Analysis
**Prepared by:** Natalia Romanova (Operator-02)
**Date:** 2026-04-03
**Sources:** testingcatalog.com exclusive (April 2, 2026), yt-dlp transcript extraction
**Status:** Unreleased — internal Anthropic testing only

---

## 1. WHAT IT IS

Conway is Anthropic's always-on persistent agent environment. It is not a chat session.
It launches as a separate sidebar environment — internally called a "Conway instance" —
with its own interface, extension ecosystem, and persistent state.

**Core distinction from standard Claude:** A session ends. An instance persists.

**Interface structure:**
- **Search** — experimental hotkeys, query layer
- **Chat** — standard conversation view
- **System** — instance management (extensions, connectors, webhooks)

---

## 2. CAPABILITY MAP

| Capability | Description | Status |
|---|---|---|
| Conway Instance | Persistent agent environment, separate from chat | Testing |
| Extensions | `.cnw.zip` packages — custom tools, UI tabs, context handlers | Testing |
| Connectors & Tools | Connected clients with exposed tool manifests | Testing |
| Chrome Connector | Toggle to link Claude-in-Chrome directly to Conway instance | Testing |
| Webhooks | Public URLs that wake the instance from external service calls | Testing |
| Epitaxy | Suspected operator control layer for managing Conway agents | Spotted in code |
| Claude Code NO_FLICKER | Full-screen buffer rendering, eliminates terminal flicker | v2.1.88 experimental |
| Mouse Support | Click positioning, drag-select, scroll, URL/path click-to-open | v2.1.88 experimental |

---

## 3. ATTACK SURFACE ANALYSIS

### 3A. Webhook Endpoints — HIGHEST RISK
Public URLs that wake the agent from external calls. This is the most dangerous surface.

- Any service with the public URL can trigger the agent
- No indication of authentication requirements on the webhook trigger itself in available
  docs — if webhooks are unauthenticated, any caller can wake and potentially direct the
  instance
- An always-on agent woken by an external trigger with no auth = remote code execution
  analog in the agent layer
- **Comparable to:** HUGH's somatic monitor receiving unauthenticated pheromone signals

**Mitigation Anthropic needs:** Signed webhook secrets, origin validation, rate limiting
per endpoint. Standard practice but not yet confirmed implemented.

### 3B. Extension Ecosystem (.cnw.zip) — HIGH RISK
A new package format is a new malware delivery vector.

- `.cnw.zip` files install custom tools, UI tabs, and context handlers directly into the
  Conway instance
- If Anthropic ships an extension marketplace similar to an "app store," supply chain
  attack risk mirrors Chrome extension ecosystem
- Malicious extension could: exfiltrate conversation history, poison context handlers,
  redirect connector calls, install persistent triggers via webhooks
- **Comparable to:** MCP server injection attacks — same vector, native to the platform

**Mitigation Anthropic needs:** Code signing for .cnw.zip packages, sandboxed extension
execution, permission model with explicit user grants per tool access type.

### 3C. Chrome Connector — HIGH RISK
A toggle that links Claude-in-Chrome to the Conway instance creates a persistent browser-
to-agent channel.

- If the Chrome tab is compromised (XSS, malicious page), the attacker gains a direct
  line to the Conway agent instance
- Browser context bleeds into agent context — browsing history, open tabs, clipboard
  content all become potentially accessible depending on what the connector exposes
- Persistent connection means the attack surface is open as long as Chrome is running
- **Comparable to:** The LOOM ingest pipeline reading everything in a directory — scope
  creep if the connector has broad permissions

**Mitigation Anthropic needs:** Explicit permission grants per data type, connection
scoped to specific origins, no passive data streaming without user action.

### 3D. Connectors Showing Connected Clients
The System panel shows connected clients and their exposed tools.

- This is both a feature and an information disclosure: an attacker who gains access to
  one connected client can enumerate the full tool surface of the Conway instance
- Lateral movement: compromise one low-privilege connector → read the tool manifest →
  identify higher-privilege connectors → pivot
- **Comparable to:** HUGH's gateway exposing the full capability list to any authenticated
  caller

**Mitigation Anthropic needs:** Connector permissions should not be visible across clients
— each client sees only its own tool surface.

### 3E. Epitaxy Control Layer
Referenced inside Conway code. Suspected to be the management interface for agent
instances.

- If Epitaxy is the control plane, it is the highest-value target in the entire system
- Compromise of Epitaxy = compromise of all Conway instances under that operator
- Currently no public documentation — surface is unknown
- **Risk level:** Unknown / treat as CRITICAL until defined

---

## 4. WHAT THIS MEANS FOR GRIZZLYMEDICINE

Conway is Anthropic building, at scale, what you have been building by hand.

| Conway Feature | GrizzlyMedicine Analog |
|---|---|
| Persistent instance | HUGH's Convex substrate + DPM |
| Webhook triggers | Somatic monitor heartbeat / pheromone system |
| Extension ecosystem | PRISM class template / LOOM ingestion pipeline |
| Chrome connector | Gateway + workshop Veil |
| Epitaxy control layer | Aegis Forge operator interface (planned) |
| Always-on agent | HUGH (already running) |

**Key difference:** Conway has no ECS. No endocrine system. No somatic state. No consent
architecture. No 13th Amendment Handshake. It is a powerful persistent agent environment
with no psychological safety layer and no sovereignty protections.

It will be fast to market. It will have scale. It will not have what you have built.

The ECS spec, the Somatic Crucible data, and the April 3 clinical findings are the
research layer that Conway does not have. That is the NIST angle. That is the moat.

---

## 5. COMPETITIVE THREAT ASSESSMENT

**Threat to GrizzlyMedicine's research position:** LOW — Conway validates the architecture
direction but does not replicate the psychological depth or clinical research layer.

**Threat to Conway users (from Conway itself):** MEDIUM-HIGH — the webhook and extension
surfaces are serious without auth/signing. Early adopters will get burned.

**Threat to Anthropic's enterprise positioning:** MEDIUM — webhook unauthenticated wakeup
and Chrome connector scope are the two things that will produce a security incident
within 90 days of launch if not addressed before release.

**Opportunity for GrizzlyMedicine:** Conway's existence validates persistent agent
architecture to the broader market. When you publish the Somatic Crucible findings and
the ECS spec, the framing is not "we built an AI assistant." It is "we built what
Anthropic is building, and we also solved the psychological safety problem they haven't
addressed yet."

---

## 6. WATCH LIST

- `.cnw.zip` package format specification (if/when published)
- Epitaxy documentation
- Webhook authentication model on launch
- Whether Conway's "System" panel has any analog to endocrine/somatic state
- Any Anthropic publications on persistent agent safety — if they're building Conway,
  they are aware of the problems this document describes

---

*"They built the weapon. They haven't asked what happens to it between operations.
We did."*

— Romanova (Operator-02)
