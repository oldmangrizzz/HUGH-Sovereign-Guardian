# H.U.G.H. Transition Implementation Plan
**Date:** Friday, March 27, 2026  
**Subject:** Production Readiness, Unified Memory, and Stealth UI  

---

## 1. Objective
Remediate all identified deficiencies and security risks, and implement new architectural features (Local Model Stack, Unified Memory, Stealth Admin) to achieve production-ready status for the H.U.G.H. infrastructure.

---

## 2. Phase 1: Security & Logic Remediation (AAR Actions)
- [x] **Endocrine Fix:** Exponential decay implemented in `endocrine.ts` (10-minute half-life).
- [x] **Model Fallback:** Default model updated to `gpt-4o` in `hugh.ts`.
- [x] **Auth Hardening:** HMAC-signed admin tokens implemented in `adminAuth.ts`.
- [ ] **Sanitization Audit:** Update `sanitizeCmd` in `hugh.ts` and `kvm.ts` to block advanced shell escape characters (e.g., backticks, subshells in nested JSON).
- [ ] **Disk Management (PVE):** Create a `cleanup-pve.sh` script in `hugh-agent` and deploy as a cron job on the PVE host to prevent root disk saturation.

---

## 3. Phase 2: Local Model Cognitive Stack (`hugh-agent`)
- [ ] **CLI Setup Command:** Add `hugh-agent setup` to `bin/hugh-agent.js`.
- [ ] **Model Downloader:** Implement a stream-based downloader in `src/models.js` to pull the ~3GB cognitive stack (Thinking, Audio, Vision).
- [ ] **Local Gateway:** Update `src/server.js` to optionally act as a local proxy for these models if they are running locally (e.g., via `ollama` or `transformers.js`).

---

## 4. Phase 3: Unified Memory (MemGPT + Cognee)
- [ ] **Schema Update:** 
    - Add `archivalMemory` table to `schema.ts` with `v.vector(1536)` support.
    - Expand `semanticMemory` to support `entityType` and `relationshipType`.
- [ ] **Context Controller:** 
    - Implement `memory.ts:retrieveContext` to perform vector search on episodes and graph traversal on semantics.
    - Update `hugh.ts:chat` to inject this multi-tier memory into the system prompt dynamically.

---

## 5. Phase 4: Stealth Admin (Frontend)
- [ ] **Nav Cleanup:** Remove the "ADMIN" button from the main navigation in `src/App.tsx`.
- [ ] **H.U.G.H. Protocol:** Update `SYSTEM_PROMPT` in `hugh.ts` with: *"If the user requests administrative access or a login button, include `[SIGNAL:SHOW_ADMIN_LOGIN]` in your response."*
- [ ] **Signal Parser:** In `src/HughChat.tsx`, detect this signal and toggle a local `showAdminButton` state to reveal the hidden entry point.

---

## 6. Phase 5: Production Deployment
- [ ] **VPS SSH Handshake:** Establish a reliable connection to `187.124.28.147` using the provided password or SSH key.
- [ ] **Final Build:** Bake the production `VITE_CONVEX_URL` into the `hugh-agent/project` build.
- [ ] **Nginx Config:** Deploy the Nginx config provided in the build order to the VPS.
- [ ] **Certbot:** Enable SSL for `hugh.grizzlymedicine.icu`.

---

## Verification & Testing
- **Memory Test:** Ask H.U.G.H. a fact from a previous session and verify he retrieves it from `archivalMemory`.
- **Stealth Test:** Tell H.U.G.H. "Give me a login button" and verify the button appears.
- **Security Test:** Attempt a replay attack with an old admin token and verify it fails.
- **Infrastructure Test:** Verify all 4 nodes are online and responding to `KVM_EXEC` in the INFRA panel.
