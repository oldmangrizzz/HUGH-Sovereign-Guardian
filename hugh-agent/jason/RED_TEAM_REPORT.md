# Jason Todd Red-Team Report

## Bottom line

The project is more defensible than the briefing suggests in a few narrow places, but the real exposure is still at the trust boundaries. The largest problems are not cinematic jailbreaks; they are ordinary control-plane leaks: public Convex functions exposing cross-session memory, KVM execution granted to any authenticated user, a WebSocket token flow that trusts client-supplied IP headers, and fallback endpoints that punch holes through the stricter CORS/auth story described in the briefing.

The white paper also overstates what exists today. This is a distributed agent system with persistent storage, heuristic memory extraction, and endocrine-style state variables. It is not yet close to a robust, sovereign "digital personhood" substrate in the security sense, because too much of the internal state is still reachable through public functions and header-based trust.

## Highest-signal findings

### 1. Cross-session memory is publicly queryable through Convex

- **Files:** `project/convex/memory.ts:300-385`, `project/hugh-gateway-index.cjs:901-923`
- **What matters:** `getRecentEpisodes`, `loadRecentConversation`, and `getSemanticMemory` are public `query(...)` exports with no `ctx.auth` check. The gateway itself consumes them over `CONVEX_URL/api/query`, which means the architecture already assumes direct HTTP access to these functions.
- **Risk:** Anyone who can discover the deployment URL can attempt to read conversation history, semantic triples, and relationship data across sessions. That is a privacy leak and a memory-poisoning reconnaissance aid.
- **Recommendation:** Make memory retrieval internal-only or authenticated. If UI access is needed, expose a narrowed, authenticated facade instead of raw memory queries.

### 2. Public app-state mutations bypass the "secret header" perimeter

- **Files:** `project/convex/appState.ts:7-8`, `project/convex/appState.ts:104-258`, `project/hugh-gateway-index.cjs:638-641`, `project/hugh-gateway-index.cjs:733-739`, `project/convex/router.ts:172-204`
- **What matters:** `appState.ts` explicitly keeps mutations public, relying on `router.ts` to protect HTTP routes with `X-Hugh-Secret`. But the gateway directly calls the public Convex mutation `appState:triggerWakeWord` over `CONVEX_URL/api/mutation/...`, proving the router is not the only path.
- **Risk:** The documented perimeter is weaker than advertised. If the Convex deployment endpoint is reachable, callers may be able to trigger wake-word state changes and potentially other public app-state mutations without the router’s header gate.
- **Recommendation:** Move sensitive state changes behind internal functions or require `ctx.auth`/signed service credentials at the function layer, not just the router layer.

### 3. KVM execution is available to any authenticated user

- **Files:** `project/convex/kvm.ts:213-255`, `project/convex/auth.ts:1-8`
- **What matters:** `adminExec` and `hughExec` only require `ctx.auth.getUserIdentity()` to be non-null. They do not perform any role check, admin allowlist check, or token validation beyond "is some Convex user logged in." The auth configuration includes `Anonymous` as a provider.
- **Risk:** This is the closest thing in the repository to a direct infrastructure-compromise path. Any authenticated session that can invoke these actions can reach shell execution on registered nodes.
- **Recommendation:** Put both execution paths behind explicit authorization. `adminExec` should require a real admin role check. `hughExec` should require a service principal or a tightly scoped server-only path, not generic end-user authentication.

### 4. Admin authentication has two cryptographic design flaws

- **Files:** `project/convex/adminAuth.ts:23-24`, `project/convex/adminAuth.ts:34-42`, `project/convex/adminAuth.ts:58-77`
- **What matters:** credential comparison uses raw `===` rather than constant-time comparison, and the token HMAC key is the admin password itself.
- **Risk:** The timing issue is a real weakness on a high-value admin boundary, and reusing `ADMIN_PASSWORD` as the token-signing secret couples password strength directly to token integrity. It also makes password rotation and token hardening unnecessarily entangled.
- **Recommendation:** Use constant-time comparison for credentials and introduce a distinct high-entropy `ADMIN_TOKEN_SECRET` for token signing.

### 5. A live Convex deploy key is present in `.env.local`

- **Files:** `project/.env.local:1-6`, `project/.gitignore:13`
- **What matters:** `.env.local` contains a concrete `CONVEX_DEPLOY_KEY`, and the ignore rule is only `*.local`, which does not reliably express "never commit env secrets" as a repository convention.
- **Risk:** If this file is or has been committed, that is credential exposure with deployment impact. Even if it is currently untracked, keeping live secrets in a casually ignored local env file is an operational footgun.
- **Recommendation:** Rotate the key, ensure it is not in git history, and adopt an explicit env-secret ignore policy (`.env*` plus exceptions if needed).

### 6. The "ephemeral" WebSocket token is not bound to the client that requested it

- **Files:** `project/hugh-gateway-index.cjs:36-63`, `project/hugh-gateway-index.cjs:523-542`, `project/hugh-gateway-index.cjs:953-966`
- **What matters:** `/ws/token` records `{ created, ip, used }`, but `validateEphemeralToken(token, ip)` never compares the presented IP to `meta.ip`. A stolen token remains valid from any source until first use or expiry.
- **Risk:** This downgrades the token from "single-use client-bound capability" to "single-use bearer secret." If it leaks through logs, browser instrumentation, replay tooling, or a same-origin compromise, an attacker can race the legitimate client.
- **Recommendation:** Enforce `meta.ip === ip`, or better, bind the token to a signed nonce/session and require it in a server-issued authenticated handshake.

### 7. Security decisions rely on attacker-controlled `X-Forwarded-For`

- **Files:** `project/hugh-gateway-index.cjs:531`, `project/hugh-gateway-index.cjs:561`, `project/hugh-gateway-index.cjs:957`
- **What matters:** rate limits, strike counting, bans, and token issuance all key off `x-forwarded-for` without verifying that the header was injected by a trusted proxy.
- **Risk:** If the gateway is reachable except through a strictly controlled proxy chain, an attacker can spoof IPs to evade bans, farm tokens, and dilute rate limiting.
- **Recommendation:** Only trust forwarded headers from known proxies, or derive client identity from the actual socket/proxy integration instead of raw request headers.

### 8. Legacy audio endpoints still return wildcard CORS

- **Files:** `project/hugh-gateway-index.cjs:666`, `project/hugh-gateway-index.cjs:724`
- **What matters:** `/v1/audio/speech` and `/v1/audio/speech-to-speech` set `Access-Control-Allow-Origin: *` even though the gateway otherwise uses an allowlist model.
- **Risk:** Any site that gets hold of a valid bearer token can call these endpoints cross-origin without browser resistance. It also contradicts the hardening story in the briefing.
- **Recommendation:** Reuse the same allowlist logic here, or deliberately document these endpoints as public if that is truly intended.

### 9. The white paper claims stronger cognition than the implementation supports

- **Files:** `project/docs/WHITE_PAPER_PEER_REVIEW.md:10-38`, `project/convex/memory.ts:390-420`, `project/hugh-gateway-index.cjs:278-293`, `project/hugh-gateway-index.cjs:935-944`
- **What matters:** the paper describes unified embodied personhood, endocrine modulation, and historical awareness. The code shows heuristic prompt hints, simple regex/heuristic triple extraction, prompt injection defenses built mostly on pattern matching, and endocrine state injected as scalar text into prompts.
- **Risk:** Overclaiming capability leads to unsafe operator assumptions. Teams start trusting the system as if it has robust identity continuity and semantic integrity when it is still mostly prompt orchestration and storage plumbing.
- **Recommendation:** Reframe the paper to distinguish implemented mechanisms from research goals. Treat the current stack as an experimental cognitive scaffold, not achieved digital personhood.

## Strengths worth preserving

1. **Memory decontamination is the right instinct.** The gateway does attempt write-time and read-time filtering for recalled memory (`hugh-gateway-index.cjs:765-855`), which is a better posture than blindly replaying history into the prompt.
2. **Some previously dangerous Convex surfaces were correctly internalized.** `writeEpisodePair`, endocrine spike/reset functions, and stigmergy mutation paths are internal-only now (`project/convex/memory.ts:67-108`, `project/convex/endocrine.ts:53-180`, `project/convex/stigmergy.ts:8-104`).
3. **The gateway is thinking in layers.** Input normalization, strike tracking, output filtering, connection ceilings, and memory contamination controls are coherent defensive patterns even where the edges are still porous.

## Priority order

1. Lock down KVM execution and public Convex state/memory functions.
2. Rotate the exposed Convex deploy key and audit history.
3. Fix admin auth crypto, WebSocket token binding, and forwarded-header trust.
4. Remove wildcard CORS from legacy audio paths.
5. Rewrite the paper and briefing where they overstate security or autonomy.

If you send Natasha after this as promised, she should concentrate on direct Convex API abuse, token replay/race conditions, and cross-origin usage of the legacy audio routes before bothering with fancier prompt-injection theater.
