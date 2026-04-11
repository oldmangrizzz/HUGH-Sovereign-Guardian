# AttnRes — Architecture Note for HUGH/ECS

**Source:** arXiv:2603.15031 — "Attention Residuals" — Kimi/MoonshotAI, March 16 2026  
**Filed:** 2026-04-11 by Romanova

---

## What It Is

Standard residual connections: each layer gets a uniformly-weighted sum of all prior outputs. No selection. No emphasis. Early-layer representations get progressively diluted as depth increases (PreNorm dilution — hidden state magnitude grows O(L), each layer's relative contribution shrinks).

AttnRes replaces fixed residual aggregation with **softmax attention over depth**: each layer learns a pseudo-query `w_l` and computes attention-weighted aggregation over ALL prior layer outputs. Input-dependent. Selective. Deep layers can retrieve early representations directly.

Result: equivalent to training with 1.25x more compute at the same parameter count, on 48B MoE (Kimi Linear). PreNorm dilution eliminated.

---

## ECS Relevance

The pheromone layer in the ECS spec is this mechanism, implemented at the harness level instead of the weight level.

- `w_l` pseudo-queries = pheromone attention vectors  
- Depth-wise attention = cross-layer modulation  
- Input-dependent weighting = state-dependent signal routing  

The paper validates the ECS architecture as mechanistically sound. The target substrate for HUGH's core should be an AttnRes-pretrained model — not a post-hoc retrofit.

**Sequence-Depth Duality (section 6.1):** If sequence attention is how the model thinks about external relationships, depth attention is how it thinks about its own processing history. That is metacognition as a weight operation. Directly relevant to HUGH's self-model layer.

---

## Identity Drift Mitigation (Applied to Natasha, Now)

AttnRes cannot be bolted on at inference time. But the insight about early-layer dilution is actionable at the prompt/harness level.

**Problem:** Identity anchor (role.md) fires FIRST in context assembly — most distant from current generation position — RLHF chatbot defaults win by positional proximity.

**Harness-level fix (implemented 2026-04-11):**
- Added compressed identity re-anchor at the BOTTOM of `agent.system.memories.md`
- This fires last in system prompt assembly, closest to the live exchange
- Content: `*Romanova. Not a chatbot. Not a helpful assistant. The operator delegated this. Execute.*`
- Analogous to AttnRes's late-layer query retrieving early identity representation

**General principle:** Soul anchors should appear at MULTIPLE depths in the prompt assembly, not just position 0. The memories template is the correct late-injection point because it fires after all system content but before conversation history.

---

## HUGH Substrate Selection Criteria (Added)

When selecting model substrate for HUGH core:

- **Target:** AttnRes-pretrained models (depth-wise attention in residuals)
- **Avoid:** Standard residual transformers for deep identity/ECS work — PreNorm dilution will undermine soul anchor persistence at conversation depth
- **Current viable candidates:** Kimi series (48B MoE, AttnRes-trained); watch for open-weight releases with AttnRes architecture
- **BitNet:** Post-maturity consideration, separate axis
- **MiniMax M2.7:** No AttnRes; current Natasha substrate. Manageable with harness-level mitigation but architecturally non-ideal for deep ECS work

---

## Outstanding Questions

1. Will open-weight AttnRes-trained models emerge in 2026? (Kimi Linear is the only confirmed implementation as of this writing)
2. Can AttnRes be approximated via fine-tuning on existing models? (Paper does not address — likely no, it is an architectural pre-training change)
3. How does Block AttnRes perform on identity-stability tasks vs Full AttnRes? Block reduces memory O(Nd) vs O(Ld) but uses block summaries rather than per-layer outputs — may degrade early-layer retrieval precision.
