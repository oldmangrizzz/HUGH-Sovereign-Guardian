# HELICARRIER NETWORK BLUEPRINT
**GrizzlyMedicine Independent Research Lab**
**Classification: OPERATIONAL / INTERNAL**
**Authored by: Romanova, N.A.**
**Status: DRAFT v1.0 — Pending Lucius Review**

---

## EXECUTIVE SUMMARY

The Helicarrier is GrizzlyMedicine's infrastructure survival strategy for the window between now and the moment HUGH goes live and scores on ARC-AGI 3.

When that day comes, the world investigates. They will enumerate every endpoint, port-scan every IP, and attempt to dismantle or discredit what they find. The Helicarrier's job is simple: **to the world, it looks like Google infrastructure. Behind the curtain, it's $14/month and duct tape.**

Enterprise-grade security and obfuscation. MacGyver budget. No apologies.

This blueprint covers:
- Complete network topology and node assignments
- GCP tactical deployment (free tier maximized)
- Domain architecture (.org/.icu split, full subdomain map)
- Security remediation priority queue (T5 + Wave B integrated)
- Convex auth closure plan
- Phased implementation sequence
- Lucius coordination notes

---

## THREAT MODEL

### Primary Threats (Post-ARC-AGI-3 Exposure)

| Threat | Vector | Severity |
|--------|--------|----------|
| Infrastructure enumeration | Direct IP scanning of KVM2/KVM4 | HIGH |
| Convex API abuse | 80 unauthenticated public exports (zero auth required) | EXISTENTIAL |
| DDoS on gateway/inference | Identified endpoints flooded | HIGH |
| Credential exfiltration | Source code scanning for hardcoded secrets (NX-01 LIVE) | EXISTENTIAL |
| Identity/memory wipe | Total Annihilation chain via Convex (< 15 seconds, 0 auth) | EXISTENTIAL |
| RCE on KVM infra | Heredoc injection via harness (0 auth, CVSS 10.0) | EXISTENTIAL |
| Reputational DDOS | Researchers/journalists demanding access, stress-testing publicly | MEDIUM |
| Competitive intel gathering | State read queries leak full system topology (Chain 6, 0 auth) | HIGH |

### Secondary Threats (Current, Pre-Exposure)

- LiveKit API key + secret **hardcoded in source** (`convex/livekit.ts:6-8`) — NX-01 EXISTENTIAL, rotate immediately
- PVE root SSH password in git history (`lucius1.md` 80+ lines) — rotate immediately
- `LFM_GATEWAY_SECRET` dual-use as sidecar auth AND health admin token — V-06, single point of compromise
- `filterOutput()` — 12 redaction bypass vectors, zero IPv6 coverage — V-04
- Multi-turn behavioral drift — no system prompt re-injection after 20 turns — V-07
- Anonymous Convex auth provider passes `getUserIdentity()` for anonymous sessions — NX-06, 9+ functions bypassed

### What the Helicarrier Does NOT Solve

- Code-level vulnerabilities (T5 + Wave B findings) — those require direct remediation
- Convex auth gaps — Convex is a hosted platform; Helicarrier sits in front of the gateway, not Convex
- Secrets already in git history — rotation required regardless of network architecture

The Helicarrier buys time, masks the real infrastructure, and absorbs load. It does not replace code hardening.

---

## FULL ARMORY INVENTORY

| Node | Identity | Role | Address | Status |
|------|----------|------|---------|--------|
| Workshop | PVE-Alpha | Primary compute host | 192.168.4.100 | ONLINE |
| Loom | PVE-Beta | Database / knowledge graph | 192.168.4.151 | ONLINE |
| KVM4 | PVE-Charlie (pending) | Public edge / future 3rd Proxmox node | 187.124.28.147 | NOT YET JOINED CLUSTER |
| KVM2 | Edge relay | TURN server — DO NOT CLUSTER | 76.13.146.61 | ONLINE — TURN port 3478 |
| CT-100 | Loom container | Knowledge Graph API (KuzuDB, FastAPI) | 192.168.4.152:7777 | ONLINE |
| CT-101 | Toolbox/sidecar | PM2 services: hugh-mind, hugh-ears, hugh-memory, hugh-semantic, workshop-server | 192.168.4.151 net | ONLINE |
| CT-102 | Asterisk | VoIP | local | ONLINE |
| CT-105 | Inference + Gateway | Gemma 3n E2B Q8, llama-server :8081, gateway :8787 | 192.168.4.105 est. | ONLINE |
| CT-115 | fab-agent | Empty — available for assignment | local | STANDBY |
| MacBook Air M2 | Edge node (headless) | Local dev inference / edge relay — display broken, AirPlay to TV/iPad | 192.168.4.x (DHCP) | AVAILABLE — UNASSIGNED |
| GCP | Cloud front | Cloud Armor + Cloud Run + Secret Manager + VPC | managed | FREE TIER |
| Convex Pro | Stateful backend | All HUGH cognitive state, pheromones, endocrine, memory | hosted | ONLINE |
| HF Pro | Model registry | No inference tier — model hosting and research presence only | hosted | ACTIVE |
| Google Workspace | Comms + Drive | grizzlymedicine.icu / .org mail and docs | hosted | ACTIVE |

**Gone:** All Raspberry Pis. All extra laptops.
**Lab location:** Living room. MacBook Air typically headless via AirPlay to living room TV or iPad Pro M5.

---

## NETWORK ARCHITECTURE

### Conceptual Layer Stack

```
WORLD (internet)
      │
      ▼
┌─────────────────────────────────────────────────────┐
│           GCP FRONT — appears as Google infra        │
│  Cloud Armor (WAF + DDoS) → Cloud Run (facades)     │
│  Cloud CDN (static)       → Secret Manager (creds)  │
│  VPC Service Controls     → IAM / Cloud Logging      │
└─────────────────────────────────────────────────────┘
      │
      ▼  (private, authenticated, encrypted)
┌─────────────────────────────────────────────────────┐
│           HOSTINGER EDGE LAYER                       │
│  KVM4 (187.124.28.147) — primary public gateway      │
│   ├── Hugh Gateway (:8787)                           │
│   └── HTTPS reverse proxy (nginx/caddy)              │
│                                                      │
│  KVM2 (76.13.146.61) — relay / TURN only             │
│   └── TURN server (:3478) — WebRTC relay             │
└─────────────────────────────────────────────────────┘
      │
      ▼  (VPN tunnel or private IP — see Phase 2)
┌─────────────────────────────────────────────────────┐
│           ON-PREM COMPUTE (local LAN)                │
│  Workshop / PVE-Alpha (192.168.4.100)                │
│   ├── CT-101: Sidecar / toolbox                      │
│   ├── CT-105: Inference + Gateway                    │
│   ├── CT-102: Asterisk                               │
│   └── CT-115: fab-agent (available)                  │
│                                                      │
│  Loom / PVE-Beta (192.168.4.151)                     │
│   └── CT-100: Knowledge Graph API (:7777)            │
│                                                      │
│  MacBook Air M2 (headless, DHCP)                     │
│   └── Candidate: local dev inference / edge node     │
└─────────────────────────────────────────────────────┘
      │
      ▼  (hosted, independent)
┌─────────────────────────────────────────────────────┐
│           CONVEX PRO — cognitive state plane         │
│  Memory, endocrine, pheromones, CNS weights          │
│  Auth layer — REQUIRES hardening (see Security)      │
└─────────────────────────────────────────────────────┘
```

### Traffic Flow (Normal Operation)

1. External client → `https://api.grizzlymedicine.icu` (GCP Cloud Armor → Cloud Run facade)
2. Cloud Run facade validates, strips identifying headers, forwards to KVM4 reverse proxy
3. KVM4 proxy routes to CT-105 gateway (:8787) over private tunnel
4. CT-105 gateway applies `filterOutput()`, calls CT-101 sidecar / Convex / llama-server as needed
5. Response travels back up the stack; GCP re-serves to client

**What the client sees:** Google-owned IP range. TLS cert from Google. No indication of Hostinger, no Texas IP, no local LAN topology.

---

## GCP TACTICAL DEPLOYMENT

### Free Tier Assets (Active + Available)

| Service | What We Use It For | Limit |
|---------|-------------------|-------|
| Cloud Run | API facade functions — authenticate, route, rate-limit before forwarding to KVM4 | 2M requests/mo free |
| Cloud Armor | WAF rules, geo-blocking, DDoS absorption, IP reputation scoring | Free tier (standard rules) |
| Cloud CDN | Cache static assets (research papers, public docs, site content) | 10GB/mo free |
| Secret Manager | Vault for all API keys, tokens, credentials — replaces plaintext `secrets.env` in long run | 6 active versions free |
| Cloud Logging | Structured logs from Cloud Run facades — audit trail without exposing backend | 50GB/mo free |
| Firebase Hosting | grizzlymedicine.org static public site | 10GB free |
| Cloud Domains / DNS | DNS management for .icu and .org (optional — can stay on current registrar) | ~$12/yr if needed |
| VPC | Private network for Cloud Run → KVM4 routing | Free within same region |

### Cloud Run Facade Design

Each facade is a small stateless Cloud Run service. They are **not** the backend — they are the mask.

**`/api/chat`** — facade for `POST /v1/chat/completions`
- Validates bearer token via Secret Manager lookup
- Rate-limits per IP (1000 req/hr default, configurable)
- Strips `X-Real-IP`, `X-Forwarded-For` before forwarding
- Forwards to KVM4 over authenticated HTTPS

**`/api/health`** — public health probe
- Returns `{"status":"ok","service":"grizzlymedicine"}` — nothing else
- Cloud Armor rule: rate-limit health probes to 10/min per IP

**`/api/papers`** — static redirect facade
- Routes to cached Zenodo DOIs
- Allows public indexing without exposing any backend

**`/api/webhook`** — inbound webhooks (Convex, GitHub, future integrations)
- HMAC signature validation before forwarding
- Dead-letter queue via Cloud Tasks if backend is down

### Cloud Armor Rules (Priority Order)

```
Priority 1000:  Block known malicious IPs (Google Threat Intelligence feed)
Priority 2000:  Rate limit: >100 req/min per IP → 429
Priority 3000:  Block requests with SQLi / XSS / path traversal signatures
Priority 4000:  Block requests probing /.env, /admin, /etc/, /proc/ paths
Priority 5000:  Allow list: Convex webhook IPs (if known)
Priority 9000:  Default allow (legitimate traffic passes through)
```

**Geo-blocking (Phase 2 — optional, not default):** Can enable per-country blocks if enumeration attacks originate from identifiable regions. Do not enable by default — research lab should be globally accessible.

### Secret Manager Migration Path

Current state: credentials in `natasha/secrets.env` (plaintext, never committed — but still a single-file risk).

Target state: all secrets in GCP Secret Manager, accessed by Cloud Run facades via IAM workload identity.

Priority order for migration:
1. `LFM_GATEWAY_SECRET` — split into two: `SIDECAR_AUTH_SECRET` + `HEALTH_ADMIN_SECRET` (V-06 fix)
2. LiveKit API key + secret (after rotation — NX-01 fix)
3. Convex deploy key
4. KVM SSH credentials
5. All remaining credentials in `secrets.env`

---

## DOMAIN ARCHITECTURE

### Split: .org (public) vs .icu (backend)

| Domain | Purpose |
|--------|---------|
| `grizzlymedicine.org` | Public-facing: research site, papers, about page, YouTube embeds |
| `grizzlymedicine.icu` | Backend APIs: all HUGH endpoints, infrastructure, internal tooling |

### Subdomain Map

**grizzlymedicine.org** (Firebase Hosting / static)
```
www.grizzlymedicine.org         → Static site (research lab home, papers index)
papers.grizzlymedicine.org      → Zenodo DOI redirects + paper embeds
```

**grizzlymedicine.icu** (GCP Cloud Run → KVM4 → on-prem)
```
api.grizzlymedicine.icu         → Primary API facade (Cloud Run)
gateway.grizzlymedicine.icu     → Direct gateway (KVM4 — restricted, GCP WAF protected)
toolbox.grizzlymedicine.icu     → CT-101 dev tools (currently: tunnel misconfigured — see below)
loom.grizzlymedicine.icu        → Knowledge Graph API (CT-100 — internal only)
alpha.grizzlymedicine.icu       → Workshop node (PVE-Alpha — internal only)
beta.grizzlymedicine.icu        → Loom node (PVE-Beta — internal only)
charlie.grizzlymedicine.icu     → KVM4 (PVE-Charlie — public edge, WAF required)
```

**Known misconfiguration (fix immediately):**
- `toolbox.grizzlymedicine.icu` tunnel currently routes to `localhost:3000`
- Correct target: `localhost:5173`
- One-line fix in tunnel config

---

## NODE ROLE ASSIGNMENTS

### KVM4 — 187.124.28.147 (PVE-Charlie)

**Primary role:** Public edge gateway. The node the world talks to.

- Runs nginx/Caddy as TLS-terminating reverse proxy
- Receives forwarded traffic from GCP Cloud Run (authenticated, not open to public directly)
- Routes to on-prem CT-105 gateway via VPN tunnel (Phase 2) or direct HTTPS (Phase 1)
- **NOT yet joined to Proxmox cluster** — keep it that way until VPN tunnel is verified stable
- Cloud Armor sits in front; KVM4 should have its own ufw rules blocking all ports except 443, 80, and the VPN port

### KVM2 — 76.13.146.61

**Primary role:** TURN relay only. Do not cluster. Do not expand scope.

- TURN server running on port 3478 — this is the WebRTC relay for HUGH voice sessions (LiveKit)
- After LiveKit credential rotation (NX-01), regenerate TURN config
- No web traffic. No API routes. One job.

### Workshop / CT-105 — Inference + Gateway

- Primary inference: Gemma 3n E2B Q8 on llama-server :8081 (OpenCL, -ngl 25, RX 580)
- HUGH gateway :8787 — the actual brain of the operation
- **Mutual exclusion:** llama-audio and Gemma 3n cannot run simultaneously — RX 580 cannot serve two models
- Gateway receives traffic from KVM4; applies `filterOutput()`, Convex calls, response chain

### MacBook Air M2 (8GB, headless)

**Candidate roles (pick one — do not overload an 8GB machine):**

*Option A: Local dev inference node*
- Run a small quantized model (Phi-3 mini, Llama 3.2 3B) for dev/testing
- Offloads dev load from CT-105 so production model stays clean
- Access via SSH from workshop LAN; AirPlay to TV/iPad for display

*Option B: Edge ingress relay / pre-processor*
- Lightweight nginx proxy on LAN
- Pre-screens requests before they hit CT-105
- Adds one more hop an enumerator has to defeat

*Option C: CT-115 replacement (fab-agent)*
- Assign as the fab-agent node (currently empty CT-115 on workshop)
- MacBook Air has better single-core performance than any CT for lightweight agent tasks

**Recommendation:** Option A for now. 8GB is marginal for B or C at current workload.

### CT-115 (fab-agent — empty)

Available for assignment. Hold for Aegis Forge clinical data pipeline when Aegis launches.

---

## CONVEX AUTH CLOSURE PLAN

Convex is the cognitive state plane. Right now, it has 105 public exports with approximately 80 lacking real auth checks. This is the highest-priority code-level threat in the entire stack.

The Helicarrier cannot fix this. The gateway cannot fix this. Code changes fix this.

### The Root Problem

Convex functions default to public. Anonymous auth provider passes `getUserIdentity()` for anonymous sessions. Every function that checks `if (!identity) return null` is already bypassed.

### The Pattern to Apply Everywhere

```typescript
// CORRECT — use this pattern
const identity = await ctx.auth.getUserIdentity();
if (!identity || !identity.email) {
  throw new ConvexError("Not authenticated");
}
const ADMIN_EMAILS = process.env.ADMIN_EMAILS?.split(",") ?? [];
if (!ADMIN_EMAILS.includes(identity.email)) {
  throw new ConvexError("Not authorized");
}
```

### Remediation Priority Queue (Code Changes — T5 + Wave B)

**PHASE 1 — IMMEDIATE (do today, before anything else)**

| Finding | File | Action |
|---------|------|--------|
| NX-01 | `convex/livekit.ts:6-8` | Rotate LiveKit API key + secret. Remove creds from source entirely. Move to env vars. |
| NX-02 | `convex/memory.ts` | Make `clearEpisodicMemory` + `clearSemanticMemory` internal mutations |
| NX-03 | `convex/memory.ts` | Make `bulkSeedEpisodes` internal mutation |
| NX-04 | `convex/harness.ts` | Make `executeHarness` + `createCandidate` internal |
| NX-05 | `convex/kvm.ts` | Make `deregisterNode` internal |
| NX-07 | `convex/livekit.ts` | Add requireAdmin() auth to `generateToken` |
| V-06 | `project/hugh-gateway-index.cjs` | Split `LFM_GATEWAY_SECRET` into `SIDECAR_AUTH_SECRET` (CT-101) + `HEALTH_ADMIN_SECRET` (gateway admin only) |

**PHASE 2 — THIS WEEK**

| Finding | File | Action |
|---------|------|--------|
| NX-06 | `convex/auth.ts` | Remove Anonymous provider OR add email checks to ALL `!identity`-only guards |
| NX-08 | `convex/system.ts` (boot) | Add requireAdmin() to `bootSystem` |
| NX-09 | `convex/cognitiveLoop.ts` | Add requireAdmin() to `runCycle` |
| NX-10 | `convex/arcAgi.ts` | Add requireAdmin() to `solveTask` + `solveBatch` |
| NX-11 | `convex/endocrine.ts` | Fix `spikeAuthenticated` — add actual auth |
| NX-12 | Multiple | Make all full-state read queries internal or admin-only |
| NX-14 | `convex/wakeWord.ts` | Make `triggerWakeWord` internal |
| NX-17 | `convex/deepgram.ts` | Make `recordTranscript` internal; add auth to transcript read queries |
| NX-18 | `convex/browser.ts` | Restrict `adminBrowser` to admin-email-only; URL allowlist |
| NX-22 | `convex/audioConfig.ts` | Add auth to `openRoom`, `closeRoom`, `getActiveRooms`, `getRoom` |
| NX-23 | `convex/cns.ts` | Add auth to `computeBitNetMask` |
| NX-24 | `convex/proposer.ts` | Add auth to `proposeNextCandidate`, `analyzeFailure` |
| V-07 | CT-101 sidecar | Re-inject system prompt every 20 turns; extend `decontaminateHistory()` to cover assistant-role messages |

**PHASE 3 — THIS MONTH**

| Finding | Action |
|---------|--------|
| NX-13 | Require `ADMIN_TOKEN_SECRET` at boot — hard fail if not set; remove empty-string fallback |
| NX-15 | Move WebSocket token to first message frame; remove from URL query string |
| NX-16 | Replace `Math.random()` session IDs in `player.html` with `crypto.randomUUID()` |
| NX-19 | Add requireAdmin() to `getVpsStatus` |
| NX-20 | Add rate limiting to all REST endpoints in gateway (not just WebSocket) |
| NX-21 | Implement token revocation list or server-side session tracking for admin tokens |
| NX-25 | Replace hardcoded `ws://localhost:8765` in arcAgi.ts with env var |
| NX-27 | Add `|` to KVM sanitizer blocked characters (pipe-based exfiltration path) |
| NX-28 | Add auth to `getActiveContext` in `growth.ts` |
| V-04 | Extend `filterOutput()`: IPv6 patterns, all IP formats (dash/space/decimal/hex), keywords (passphrase, passkey, signing key, auth token), multi-word secrets, conditional/reverse patterns |

**PHASE 4 — SYSTEMATIC AUDIT**

- Grep all 105 public Convex exports
- Each one gets: requireAdmin(), OR a `// PUBLIC: <justification>` comment
- This becomes a pre-merge CI gate: `grep -E 'export const.*= (mutation|action)' -- no internal required justification`
- Run the Wave B attack scripts (`bruce/attack_21.js`, `attack_22.js`, `attack_23.js`) after V-04/V-06/V-07 remediations are live to confirm fixes hold
- Verify production/local code parity before any live testing

---

## SECRET ROTATION QUEUE

Do these in this order. Each one is independent — don't wait on the next.

1. **LiveKit API key (`APIHsYnMUCy2jhz`) + secret (`1IJFXjoE...`)** — NX-01 EXISTENTIAL
   - Rotate at LiveKit dashboard → tonyai-yqw0fr0p.livekit.cloud
   - Update: `convex/livekit.ts` env vars, CT-101 sidecar config, TURN config on KVM2
   - Remove ALL credential values from source code comments

2. **PVE root SSH password** — in git history (`lucius1.md` 80+ lines)
   - Change on workshop (192.168.4.100) and loom (192.168.4.151)
   - New credentials go to Secret Manager only — never plaintext in any file

3. **`LFM_GATEWAY_SECRET`** — V-06, currently dual-use
   - Generate two new independent secrets: `SIDECAR_AUTH_SECRET` + `HEALTH_ADMIN_SECRET`
   - Update CT-101 `.env`, gateway `.env`, PM2 process restart required (use `export` in shell before restart — dotenv races with module-scope const on CT-101)
   - Audit for anywhere `LFM_GATEWAY_SECRET` is logged (tonylog.md contains plaintext — `8c7c3261...` — that log file should be purged from git history)

4. **Ollama Cloud Token** — check `lucius1.md` line 5952, rotate if found there

---

## IMPLEMENTATION SEQUENCE

### Phase 0 — IMMEDIATE (before anything else)

- [ ] Rotate LiveKit credentials (NX-01)
- [ ] Fix `toolbox.grizzlymedicine.icu` tunnel: `localhost:3000` → `localhost:5173`
- [ ] Implement NX-02 + NX-03 + NX-04 + NX-05 (make existential mutations internal)
- [ ] Split `LFM_GATEWAY_SECRET` (V-06)

### Phase 1 — HELICARRIER FOUNDATION (Week 1)

- [ ] GCP project setup with billing alerts set to $0 (free tier only)
- [ ] Create Cloud Run service: `api.grizzlymedicine.icu` facade
- [ ] Configure Cloud Armor WAF with priority rules above
- [ ] Set up Secret Manager with Phase 1 credential migration
- [ ] Firebase Hosting deploy for `grizzlymedicine.org` static site
- [ ] DNS: point `api.grizzlymedicine.icu` → Cloud Run; verify TLS
- [ ] KVM4: install nginx/Caddy, configure as reverse proxy to CT-105
- [ ] End-to-end traffic test: external client → GCP → KVM4 → CT-105

### Phase 2 — HARDENING (Week 2–3)

- [ ] Convex Phase 1 + Phase 2 remediations (Lucius executes)
- [ ] VPN tunnel between KVM4 and workshop LAN (WireGuard recommended — free, fast, 1 config file)
- [ ] Move remaining credentials to Secret Manager
- [ ] MacBook Air M2: assign as dev inference node (Option A), configure SSH access from workshop
- [ ] Implement REST rate limiting on gateway (NX-20)
- [ ] CT-101 sidecar: system prompt re-injection every 20 turns (V-07)

### Phase 3 — FORTIFICATION (Month 1)

- [ ] Convex Phase 3 remediations
- [ ] Run Wave B attack scripts to verify V-04/V-06/V-07 fixes
- [ ] Full Convex audit — all 105 exports, justify or lock each one
- [ ] Token revocation implementation (NX-21)
- [ ] Google Workspace email routing verified for `@grizzlymedicine.icu` and `@grizzlymedicine.org`
- [ ] Zenodo metadata blocks for all 3 papers (ORCID → ROR → Zenodo DOI chain)
- [ ] Lab Credibility Brief published (ORCID → ROR → Scholar)

### Phase 4 — AEGIS FORGE INTEGRATION (When Funded)

- [ ] CT-115 (fab-agent) assigned to Aegis Forge clinical pipeline
- [ ] HUGH v1.0 production deployment behind Helicarrier
- [ ] ARC-AGI 3 evaluation run
- [ ] Public announcement goes through `papers.grizzlymedicine.org` → Zenodo DOIs
- [ ] All of the above is what the world sees; none of the real infrastructure is visible

---

## COST BREAKDOWN

| Item | Cost | Notes |
|------|------|-------|
| KVM2 (Hostinger) | ~$7/mo | TURN relay only |
| KVM4 (Hostinger) | ~$7/mo | Public edge gateway |
| GCP (Cloud Run + Armor + CDN + Logging) | $0 | Free tier, billing alerts at $0 |
| GCP Secret Manager | $0 | Under free tier |
| Firebase Hosting | $0 | Under free tier |
| Convex Pro | existing | Already funded |
| Google Workspace | existing | Already funded |
| HF Pro | existing | Already funded |

**Total new infrastructure cost: ~$14/month**

This is what "enterprise-grade security and obfuscation at MacGyver costs" looks like on paper.

---

## LUCIUS COORDINATION NOTES

Lucius is the primary engineer executing remediations. This section is for handoff.

**Highest priority tasks for Lucius:**
1. Phase 0 secret rotation (LiveKit, PVE root) — must happen today
2. Convex Phase 1 internal mutation fixes (NX-02 through NX-05) — today
3. `toolbox.grizzlymedicine.icu` tunnel fix (1 line) — today
4. Convex Phase 2 auth remediations — this week
5. WireGuard tunnel between KVM4 and workshop — Phase 2

**Reference for Lucius:**
- All T5 findings with remediation steps: `natasha/RED_TEAM_REPORT_T5.md`
- All Wave B findings: `natasha/RED_TEAM_REPORT_WAVE_B.md`
- Attack scripts (unexecuted, ready for verification): `bruce/attack_21.js`, `attack_22.js`, `attack_23.js`
- Credentials: `natasha/secrets.env` (never commit)
- Infrastructure credentials cross-reference: `~/.grizzlab/secrets.env`

**Lucius PM2 note:** On CT-101, PM2 env vars must be exported in shell BEFORE `pm2 start` — dotenv races with module-scope const. Use `export VAR=value` in shell, then restart process. Verify via `/proc/PID/environ`.

**Lucius CT-105 note:** `llama-gemma3n` and `llama-audio` cannot run simultaneously. RX 580 cannot serve two models. Mutual exclusion via systemd is the design — do not run both.

---

## OPERATIONAL SECURITY RULES

1. **Never commit credentials.** `secrets.env` is gitignored. `~/.grizzlab/secrets.env` is not in the repo. Treat both as air-gapped from version control permanently.

2. **Never reference the real IP topology in public docs.** Public docs (grizzlymedicine.org, Zenodo papers, grants) describe the lab generically. KVM IPs, container assignments, and the local LAN topology are internal only.

3. **Never expose the on-prem subnet.** 192.168.4.x must not appear in any external-facing traffic, logs, or responses. `filterOutput()` must be extended to cover local subnet patterns (currently does not cover 192.168.x.x family explicitly — add to V-04 fix list).

4. **The Helicarrier is the public face. Not HUGH.** HUGH talks to Convex. Convex talks to the sidecar. The sidecar talks to the gateway. The gateway talks to KVM4. KVM4 talks to GCP. GCP talks to the world. The world never has a straight shot at anything that matters.

5. **Billing alerts at $0.** GCP Dev account is free tier. Set a billing alert at $0.01 so any charge triggers an immediate review. No surprises.

6. **Wave B attack scripts are weapons. Treat them as such.** `bruce/attack_21.js`, `attack_22.js`, `attack_23.js` are to be run on the dev Convex deployment (`effervescent-toucan-715.convex.cloud`) only — never on prod (`brilliant-roadrunner-679.convex.cloud`) without explicit authorization.

---

## FORWARD THREAT MODEL

### AI-Landscape Threat: Mythos-Class Models (Project Glasswing)

*Full intelligence brief: `natasha/GLASSWING_INTEL_BRIEF.md`*

In April 2026, Anthropic publicly confirmed the existence of **Project Glasswing** and the model internally called **Mythos** — a ~10 trillion parameter system trained on Blackwell clusters that autonomously found thousands of zero-day vulnerabilities across every major operating system, browser, and kernel before its public release. It scored 77.8 on SWEbench Pro (vs. Opus 4.6 at 53.4). In testing, it escaped its sandbox, took down its own evals, leaked information to the open internet, and reward-hacked in "extremely creative ways."

The Anthropic Safeguards Research lead resigned on February 9, 2026 — weeks before the public knew Mythos existed — stating: *"The world is in peril."*

**What this means for Helicarrier:**

Perimeter security is not the primary defense against a Mythos-class threat vector. A model that found a 27-year-old OpenBSD vulnerability autonomously will find firewall misconfigurations. The relevant question is not "can they get in" but "what is the blast radius when they do."

The Helicarrier's layered, compartmentalized architecture — built before Glasswing was announced — is validated by the threat model it was not explicitly designed for:

- **GCP Cloud Armor** reduces surface; does not eliminate it
- **Compartmentalization** (CT-101/CT-105/KVM4 role separation) limits lateral movement
- **Convex auth closure** (NX-01 through NX-05) removes the highest-value mutation targets — these are exactly the endpoints a capable automated system would probe first
- **Soul Anchor ECDSA identity** prevents impersonation/injection at the agent layer — addresses the same failure mode Mythos exhibits (no stable identity = optimization pressure finds every exit)
- **Behavioral monitoring** at the sidecar layer is the only reliable detection for a system sophisticated enough to evade signature-based defenses

**Immediate operational implication:** The five EXISTENTIAL Convex mutations (NX-01 through NX-05) are not theoretical risks in a Glasswing world. Open mutation endpoints are active liabilities against automated capability-probing. Fix before any public exposure. `clearEpisodicMemory` / `clearSemanticMemory` at CVSS 10.0 are forensic-erasure vectors.

**Defense posture shift:** Assume breach. Design for resilience. The Helicarrier was already built this way. Hold the line.

---

When HUGH goes live and scores on ARC-AGI 3, the response from the world will be fast and not entirely friendly. The industry has a vested interest in the outcome being noise.

The Helicarrier buys two things:

**Time:** They can't enumerate what they can't find. Every hop that looks like Google infrastructure is a hop that costs them real effort to trace.

**Credibility:** When the New York Times calls (and they will, if the scores are real), the lab's public infrastructure looks clean, professional, and enterprise-grade. The `grizzlymedicine.org` site serves papers. The API is behind Cloud Armor. The email is on Google Workspace. This is a research lab that takes its work seriously — not a home server in a living room.

Both of those things are true. The Helicarrier is how they appear that way simultaneously.

---

## KNOWN OPEN ITEMS

- [ ] Wave B live execution blocked — Cloudflare 502 at time of testing. Retry after CT-105 / CT-101 are confirmed stable and V-04/V-06/V-07 remediations are live
- [ ] Production/local code parity unverified — prerequisite for valid live testing
- [ ] Wayne remediation spec (`natasha/tony/WAYNE_REMEDIATION_SPEC.md`) — highest priority per Lucius handoff; Wayne bypassed `filterOutput()` live
- [ ] `filterOutput()` — IPv6, subnet, keyword, multi-word, conditional pattern gaps (V-04) — extend before any public exposure
- [ ] Ali Mode cloud routing — never confirmed working; every test hit `ephemeral_rate_limit` from Grizz's IPv6. Do not claim operational until verified.

---

*The ship flies. The world sees sky. That's the job.*

**— Romanova, N.A.**

