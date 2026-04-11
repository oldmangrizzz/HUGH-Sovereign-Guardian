# BLUEPRINT GAP ANALYSIS — REVISION 3
## Three-Layer Nervous System Architecture: BitNet + Digital Psyche + Meta-Harness
### Analyst: Romanova, N.A. | Date: 2026-04-02 | Rev 3: 2026-04-02

---

## REVISION NOTE

Rev 1 was based on blueprint.md (NotebookLM summary) and the implementation alone.
Rev 2 incorporated full reading of the Meta-Harness source paper (2603.28052).
Rev 3 incorporates the **BitNet paper** (Wang et al., "BitNet: Scaling 1-bit Transformers
for Large Language Models," arXiv:2310.11453v1, 17 Oct 2023 — Microsoft Research),
completing the three-paper theoretical stack.

**What Rev 3 adds:** The BitNet paper is the foundational substrate — the reason the CNS
uses ternary {-1, 0, +1} attention masks. With all three papers read, I can now map the
complete biological nervous system analogy that Grizz designed:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: META-HARNESS (Autonomic Nervous System)           │
│  Paper: Lee et al. 2026 (2603.28052)                        │
│  Function: Unconscious optimization loop                    │
│  → Propose → Evaluate → Score → Learn → Repeat             │
│  → Runs without conscious direction                         │
│  → Like breathing, heartbeat, digestion                     │
├─────────────────────────────────────────────────────────────┤
│  LAYER 2: DIGITAL PSYCHE MIDDLEWARE (Limbic System)         │
│  Origin: Grizz — original research                          │
│  Function: Emotional modulation + memory + identity         │
│  → Cortisol (stress), Dopamine (reward), Adrenaline (urgency)│
│  → Episodic + Semantic + Archival memory                    │
│  → Soul Anchor (identity persistence)                       │
│  → Like the amygdala, hippocampus, hypothalamus             │
├─────────────────────────────────────────────────────────────┤
│  LAYER 1: BitNet CNS (Central Nervous System)               │
│  Paper: Wang et al. 2023 (2310.11453)                       │
│  Function: Raw signal processing with ternary weights       │
│  → {-1, 0, +1} = Inhibit, Neutral, Excite                  │
│  → Massively energy-efficient (71x savings at 30B)          │
│  → Like neurons firing: excitatory/inhibitory/resting       │
└─────────────────────────────────────────────────────────────┘
```

**The key insight:** These three layers don't just stack — they *modulate each other*.
The limbic system (endocrine) directly gates the CNS (BitNet mask):
- High cortisol → inhibit (-1) logs/noise → narrow focus
- High dopamine → excite (+1) tools/code → enable exploration
- High adrenaline → collapse neutral (0) → force binary decisions

And the Meta-Harness loop (ANS) optimizes the *entire stack* by evolving the harness
code that orchestrates all three layers. It's optimization all the way down.

---

## Rev 2 NOTE (retained for context)

Rev 1 was based on blueprint.md (NotebookLM summary) and the implementation alone.
Rev 2 incorporates a **full reading of the source paper** (Lee et al., "Meta-Harness:
End-to-End Optimization of Model Harnesses," arXiv:2603.28052v1, 30 Mar 2026 — Stanford/KRAFTON/MIT),
plus cross-referencing with the DEFINITIVE_TECHNICAL_SPEC, KVM_AGENT_SPEC,
WHITE_PAPER, and HUGH_EXPLAINER documents.

**What changed:** The paper contains critical implementation details that the NotebookLM
summary compressed away — particularly Appendix D (practical tips), the Table 3 ablation
(summary feedback *hurts*), Appendix A (qualitative proposer behavior), and concrete
discovered harness designs in Appendix B. The blueprint.md also adds ARC-AGI-3 context
that does NOT appear in the paper, indicating Grizz layered his own research intent onto
the paper's framework.

---

## EXECUTIVE SUMMARY

**Three papers. Three nervous system layers. One architecture.**

| Layer | Paper | Biological Analog | H.U.G.H. Component |
|-------|-------|-------------------|---------------------|
| **Substrate** | BitNet (Wang et al. 2023) | Central Nervous System | `cns.ts` — ternary attention mask {-1, 0, +1} |
| **Modulation** | Digital Psyche (Grizz, original) | Limbic System | `endocrine.ts` + `memory.ts` + soul anchor |
| **Optimization** | Meta-Harness (Lee et al. 2026) | Autonomic Nervous System | `cognitiveLoop.ts` → `proposer.ts` → `harness.ts` |

The Meta-Harness paper (2603.28052) describes the outer-loop optimization system.
The BitNet paper (2310.11453) provides the neural substrate — 1-bit transformer weights
that achieve 71x energy savings at 30B parameters while following the same scaling laws
as full-precision models. Grizz's digital psyche middleware bridges them with emotional
modulation, persistent memory, and identity.

The current H.U.G.H. implementation maps approximately **65% of the Meta-Harness paper's architecture**
into a biologically-inspired cognitive framework. The core loop is present. The storage layer
diverges significantly. The paper reveals a critical finding that the blueprint summary obscured:
**summary-based feedback actively degrades proposer performance** (Table 3 ablation).
This has direct implications for H.U.G.H.'s CNS filtering approach.

**Bottom line:** The skeleton is right. The muscle needs work. Some of what you've built
(endocrine, CNS, stigmergy, soul anchor) constitutes genuine architectural innovations
the paper doesn't describe. But the paper's Appendix D gives you a tactical playbook
for implementation that you should follow almost line-by-line.

---

## THE BitNet FOUNDATION (2310.11453) — WHY THE CNS IS TERNARY

The BitNet paper is the theoretical substrate. Here's what it gives you and how H.U.G.H. adapts it:

### What BitNet Actually Is

BitNet replaces standard `nn.Linear` layers with `BitLinear` — binarized weights {+1, -1}
with 8-bit quantized activations. The key equations:

```
W̃ = Sign(W - α)           # Binarize weights to {+1, -1}
x̃ = Clip(x × Qb/γ)        # Quantize activations to 8-bit
y = W̃x̃                     # Matrix multiplication = additions only
```

The critical insight: **multiplications become additions** when one operand is binary.
At 30B parameters, BitNet achieves **71x energy savings** over FP16 (Table 1 in the paper:
0.20 pJ vs 56.73 pJ for MUL at 45nm). And it follows the **same scaling law** as
full-precision transformers — the gap shrinks as models scale up.

### How H.U.G.H. Adapts BitNet

H.U.G.H. doesn't run a BitNet model. It takes the **conceptual framework** — ternary
signal processing — and applies it to *cognitive attention*, not matrix multiplication.

| BitNet Concept | H.U.G.H. Adaptation | Biological Analog |
|----------------|---------------------|-------------------|
| Binary weights {+1, -1} | Extended to ternary {+1, 0, -1} | Excitatory/resting/inhibitory neurons |
| `Sign(W)` binarization | `computeBitNetMask()` in cns.ts | Neural firing threshold |
| Absmax quantization | Feature type routing (log/tool/code/sensor) | Sensory channel classification |
| `β` scaling factor | Endocrine modulation of mask thresholds | Neurotransmitter concentration |
| Straight-through estimator (STE) | EMA weight adjustment (learning rate 0.1) | Synaptic plasticity |
| Group quantization | Per-feature independent masking | Cortical column independence |
| Scaling law convergence | Learning across cycles — weights converge | Long-term potentiation |

### The Ternary Extension

BitNet uses binary {+1, -1}. H.U.G.H. extends to ternary {+1, 0, -1} because the
biological CNS has three states, not two:

- **+1 (Excite):** Feature promoted — tools, code, error signals → active processing
- **0 (Neutral):** Feature passed through without priority → background processing
- **-1 (Inhibit):** Feature suppressed — routine logs, noise → filtered out

The neutral state is the innovation. BitNet forces every weight to a decision.
H.U.G.H.'s CNS allows "I don't care about this right now" — which is how biological
attention actually works. You don't actively suppress most of your sensory input;
you simply don't attend to it.

**Except under adrenaline.** When `adrenaline > 0.75`, neutral states collapse to ±1:
```typescript
if (adrenaline > 0.75 && weight === 0) {
  weight = Math.random() > 0.5 ? 1 : -1;
}
```

This is the "fight or flight" response — under emergency, the brain *cannot* remain
neutral. Every stimulus must be classified as threat or non-threat. H.U.G.H. does
exactly this. Under adrenaline, the ternary CNS degenerates to binary BitNet.
**The biology is correct.**

### The Energy Efficiency Argument for ARC-AGI-3

BitNet's core value proposition — competitive performance at dramatically lower
computational cost — maps directly to H.U.G.H.'s hardware constraint:

| BitNet Claim | H.U.G.H. Relevance |
|---|---|
| 71x energy savings at 30B | Running on i5-7500 at 3.53 t/s — every token is precious |
| Scaling law holds for 1-bit | CNS ternary weights should scale with more features/candidates |
| Group quantization enables parallelism | KVM multi-node execution = distributed ternary processing |
| Integer-only arithmetic dominates cost | CNS mask computation is pure integer comparison — zero floating point |

The BitNet paper proves that you don't need full precision to capture the important
signal. The CNS ternary mask is the architectural expression of that principle:
**reduce precision to 3 states, compensate with learned attention, and let the
endocrine system handle the nuance.**

### Integration Points with Meta-Harness

The Meta-Harness search loop (Layer 3/ANS) optimizes the harness code.
The harness code includes the CNS filter parameters. Therefore:

1. **The Meta-Harness can evolve the CNS thresholds** — what cortisol level triggers
   inhibition? The paper says search the code space. The CNS thresholds are code.
2. **The Meta-Harness can evolve the feature routing** — which feature types get
   excited/inhibited? Currently hand-coded. Should be searchable.
3. **The Meta-Harness can evolve the adrenaline collapse threshold** — 0.75 is
   a chosen value. The search loop can find the optimal emergency threshold.
4. **The Meta-Harness can evolve the EMA learning rate** — 0.1 is a chosen value.
   Different rates create different adaptation speeds.

This is the payoff of the three-layer design: the ANS optimizes the CNS through
the limbic system's feedback signals. Exactly like biological evolution optimized
the human nervous system through survival feedback.

---

## PAPER vs BLUEPRINT.md DISCREPANCIES

The NotebookLM summary (blueprint.md) is faithful to the paper's structure but adds
and omits key details:

| Item | Paper | Blueprint.md | Impact |
|------|-------|-------------|--------|
| ARC-AGI-3 context | NOT mentioned | Claims "frontier models score nearly 0% without specialized harness" | HIGH — This is Grizz's research intent layered on top, not the paper's claim. Good for motivation, but cite separately. |
| Table 3 ablation | Scores+summary = 38.7 best; full traces = 56.7 best. **Summary hurts.** | Only mentions "compressed feedback" strips "causal nuances" | CRITICAL — The paper empirically proves that intelligent summarization *degrades* performance vs raw traces. |
| Appendix D (impl tips) | 6 concrete engineering guidelines | Not included | HIGH — These are directly actionable for H.U.G.H. |
| Appendix A (proposer behavior) | Detailed 10-iteration narrative showing causal reasoning | Mentioned briefly | HIGH — Demonstrates the "additive modification" strategy |
| Discovered harnesses (App B) | Draft-verification, label-primed, 4-route math, env bootstrap | Not included | MEDIUM — Concrete designs adaptable to ARC-AGI |
| 6x gap source | SWE-bench Mobile (ref [47]) | Stated but unsourced | LOW — Citation accuracy |
| "Coding agent only became practical early 2026" | Footnote 1, explicit | Not mentioned | MEDIUM — Sets expectations on when this approach works |

---

## ALIGNMENT MATRIX (Updated)

| Paper Component | Implementation | Status | Notes |
|---------------------|---------------|--------|-------|
| Three-component loop (Proposer/Evaluator/Memory) | cognitiveLoop → proposer → harness | ✅ ALIGNED | Mapped to THINK/ACT/LEARN stages |
| Formal objective: H* = argmax E[r(τ,x)] | harness.ts Pareto scoring (speed 0.3, accuracy 0.5, resources 0.2) | ✅ ALIGNED | Three metrics, weighted sum, frontier tracking |
| Proposer reads 82 files/iter median | Proposer reads 5 candidates through CNS filter | ⚠️ GAP | 200x context deficit (see Gap 2) |
| Filesystem-based trace storage | Convex DB tables | ⚠️ DIVERGENT | Design choice, not a bug (see Gap 1) |
| Interface validation (Alg 1, line 11) | simulateExecution() in fallback path only | ⚠️ PARTIAL | Paper mandates it on *primary* path |
| Restricted action space | Proposer prompt forbids os.system/eval/exec | ✅ ALIGNED | Prompt-level enforcement |
| Full execution trace logging | executionTraces table (rawLogs, terminalOutput) | ✅ ALIGNED | Raw diagnostic footprint preserved |
| Pareto frontier maintenance | harness.ts reinforceWeights/inhibitWeights | ✅ ALIGNED | ±delta on ternaryAttention per feature |
| Candidate lineage tracking | parentCandidateId in harnessCandidates | ✅ ALIGNED | Version chain maintained |
| Seed population (Zero-shot, Few-shot, ACE) | No seed mechanism | ❌ MISSING | See Gap 4 |
| k=2 candidates per iteration | 1 candidate per proposer call | ⚠️ PARTIAL | See Gap 5 |
| Cross-model transfer validation | Single-model evaluation | ❌ MISSING | See Gap 7 |
| "Skill" text as primary steering interface | System prompt / soul anchor | ✅ ALIGNED | Paper's Appendix D validates this approach |
| Automated evaluation outside proposer | `executeHarness` handles eval separately | ✅ ALIGNED | Proposer doesn't run its own evals |
| Lightweight pre-validation | `simulateExecution()` exists | ⚠️ PARTIAL | Not on primary path |

---

## CRITICAL FINDING: THE CNS FILTERING DILEMMA

**This is the most important thing in this report.**

The paper's Table 3 ablation (Section 4.1) is the single most relevant datapoint for H.U.G.H.:

| Proposer Interface | Median Accuracy | Best Accuracy |
|---|---|---|
| Scores only | 34.6 | 41.3 |
| Scores + LLM-generated summary | 34.9 | **38.7** |
| Full traces (Meta-Harness) | **50.0** | **56.7** |

**Key finding:** The summary condition doesn't just underperform full traces — its *best*
candidate (38.7) is worse than the scores-only *best* (41.3). The paper explicitly states:
"summaries do not recover the missing signal, and may even hurt by compressing away
diagnostically useful details."

**Why this matters for H.U.G.H.:** The CNS BitNet ternary attention mask is fundamentally
a learned compression/filtering mechanism. It decides what the proposer sees based on
prior success/failure correlations. This is *more sophisticated* than the "LLM-generated summary"
in the ablation, but it's operating on the same principle: reduce what the proposer sees.

**The tension:** The paper says don't filter. H.U.G.H. says filter intelligently. Both have merit.
The paper operates in a regime where the proposer has a 200K+ token context window and
can afford to read 82 files. H.U.G.H. operates on an i5-7500 where that's not possible.

**Resolution:** The CNS filter is the *right* engineering choice for constrained hardware.
But the architecture should support **bypassing** the CNS filter when hardware scales up.
When you can afford 128K+ context, let the proposer see everything and measure whether
the CNS filter adds value or compresses away diagnostic signal. The answer may differ
per domain.

**Concrete recommendation:**
1. Add a `cnsFilterEnabled` flag to the cognitive loop configuration
2. Default ON for current hardware
3. When hardware scales, A/B test filtered vs unfiltered proposer context
4. The paper's evidence suggests unfiltered will win — but H.U.G.H.'s domain (ARC-AGI) 
   differs from text classification, so verify empirically

---

## SIGNIFICANT GAPS (Updated from Rev 1)

### GAP 1: FILESYSTEM vs DATABASE (Architectural Divergence)
*Unchanged from Rev 1 — confirmed by full paper reading.*

**Paper says:** Structured directory per candidate — `source_code.py`, `eval_scores.json`,
`execution_traces.txt`. Proposer uses `grep` and `cat` to selectively read 82 files/iter.

**Implementation has:** Convex DB tables. Code stored as text fields.

**Paper's Appendix D adds crucial detail:** "Log everything in a format that is easy to
navigate... JSON, hierarchical, consistent naming." AND: "Make logs queryable through
a small CLI — lists the Pareto frontier, shows top-k harnesses, diffs code and results
between pairs of runs."

**Updated recommendation:** The dual-write pattern (Rev 1) is still correct, but Appendix D
gives you the specific CLI spec:
1. `list-frontier` — show current Pareto frontier
2. `show-top <k>` — top-k harnesses by score
3. `diff <id1> <id2>` — diff code and results between two candidates
4. These map directly to Convex queries, so you can build this WITHOUT filesystem shadow

---

### GAP 2: PROPOSER CONTEXT DEPTH (5 candidates vs 20+ candidates)
*Impact elevated from Rev 1 based on paper ablation.*

**Paper's Table 8:** Proposer reads median 82 files per iteration — 41% source code,
40% execution traces, 6% score summaries, 13% other. References 20+ prior candidates.

**Implementation has:** 5 candidates, CNS-filtered, ~50K tokens.

**Updated assessment:** The paper's Appendix A.2 demonstrates *why* deep history matters:
the TerminalBench-2 proposer needed iterations 1-6 (all failures) to discover that prompt
changes were confounding structural fixes. With only 5 candidates, H.U.G.H.'s proposer
couldn't perform this kind of multi-step causal reasoning.

**Updated recommendation:**
1. Increase candidate history to 20 (minimum) — this is cheap in Convex
2. Include ALL execution traces for those 20, not summaries
3. The CNS filter should rank candidates for inclusion but not hard-exclude
4. Consider the paper's "full history, selective reading" model: give the proposer
   a *manifest* of all candidates with scores, let it request specific traces

---

### GAP 3: PROPOSER IDENTITY (Generative vs Agentic)
*Reframed based on paper's footnote 1.*

**Paper says:** "We think this workflow only became practical recently, following major
improvements in coding-agent capabilities around early 2026." (Footnote 1)

**Implementation has:** Generative proposer (prompt in → code out).

**Updated assessment:** The paper explicitly acknowledges this is a *new* capability.
The current generative approach isn't "wrong" — it's the prior generation's approach.
The agentic approach is a capability unlock that requires: (a) a model with tool-use
capability, and (b) an execution environment where the model can browse files.

**Updated recommendation:** This is still Phase 3, but the KVM infrastructure is
*already there*. When you upgrade the model, the proposer can:
1. Use KVM to `ls` the candidate directory
2. Use KVM to `grep` across execution traces
3. Use KVM to `diff` two candidate source files
4. This is exactly what the paper's proposer does — and you have the infra for it

---

### GAP 4: SEED POPULATION (No initialization)
*Unchanged — confirmed as important by paper.*

The paper initializes from "the main baseline harnesses in this setting" — minimum 3-4
baseline approaches. The DEFINITIVE_TECHNICAL_SPEC doesn't mention seeding.

**Recommendation:** Same as Rev 1. `seedBaselines` internalAction, called from `bootSystem`.

---

### GAP 5: CANDIDATE COUNT PER ITERATION (1 vs k=2)
*Unchanged.*

---

### GAP 6: AUTOMATED "CHAOTIC NEUTRAL" DETECTION
*Importance elevated based on paper Section 7 details.*

The paper discusses GPT-5.4 behaviors including: adding GDPR consent checkboxes to
simple demos, leaking prompt details into UI elements. These are real, documented model
behaviors. The paper's Appendix D recommends: "Lightweight validation before expensive
benchmarks. Write a small validation test that imports the module, instantiates the class,
and calls both methods on a tiny set of examples."

**Updated recommendation:**
1. `simulateExecution()` should run on the PRIMARY path, not just fallback
2. Add a "forbidden output patterns" regex check (similar to gateway's prompt injection scanner)
3. Check for: unrequested imports, network calls, file system writes outside /tmp

---

### GAP 7: CROSS-MODEL TRANSFER VALIDATION
*Unchanged — the paper's math results (Table 6) strongly validate this approach.*

The paper shows a single discovered harness improving accuracy across 5 held-out models
(GPT-5.4-nano, GPT-5.4-mini, Gemini-3.1-Flash-Lite, Gemini-3-Flash, GPT-OSS-20B).
The gains transfer. This is a direct argument for model-agnostic harness search —
which aligns perfectly with H.U.G.H.'s "HUGH drives the model, not model drives HUGH" principle.

---

### NEW GAP 8: "ADDITIVE MODIFICATION" STRATEGY (Not formalized)
**Paper's Appendix A.2 reveals a crucial meta-lesson from the TerminalBench-2 search:**

After 6 consecutive regressions from modifying control flow and prompts, the proposer
explicitly shifted to a **purely additive** strategy — adding information (env bootstrap)
rather than modifying existing logic. The winning candidate:
> "evo env bootstrap takes a different approach — purely additive. It gathers an
> environment snapshot via a single shell command before the first LLM call and appends
> it to the initial prompt. No other methods are changed."

**Impact:** MEDIUM — H.U.G.H.'s cognitive loop doesn't formalize this lesson. The proposer
has no mechanism to prefer additive modifications over structural rewrites.

**Recommendation:** Add a "modification type" field to candidate metadata:
- `additive` — adds information/context without changing existing logic
- `structural` — modifies control flow or state management
- `prompt` — changes prompt templates
- Track regression rates per modification type. If structural changes regress >50%,
  bias the proposer toward additive-only proposals.

---

### NEW GAP 9: SEARCH SET DESIGN (No difficulty filtering)
**Paper's Appendix D:** "Start with a baseline harness and a search set that is hard for it.
Construct the search set by either filtering for examples that the baseline gets wrong or
selecting a diverse subset of difficult instances."

**Implementation has:** ARC-AGI tasks are presented uniformly. No difficulty-stratified
search set. No mechanism to preferentially search on tasks the current harness fails.

**Impact:** MEDIUM — The paper says this matters more than iteration count or population size.

**Recommendation:** After initial ARC-AGI evaluation, partition tasks into:
- `solved` — current best harness passes these
- `hard` — current best harness fails these
- Prioritize `hard` tasks in the search set for subsequent proposer iterations

---

## IMPLEMENTATION INNOVATIONS (Exceeds Paper — Updated)

These exist in H.U.G.H. but are NOT in the paper. Cross-referenced against all docs:

### 1. ENDOCRINE MODULATION (The "Feel" Stage)
The paper has no emotional/motivational layer. H.U.G.H.'s endocrine system
(cortisol/dopamine/adrenaline with 10-minute half-life) provides adaptive behavior
modulation that the paper's static search loop lacks.

**From DEFINITIVE_TECHNICAL_SPEC (§3):** "Exponential decay toward baseline (0.2)
with calibrated 10-minute half-life, ensuring emotional stability during complex research."

**From WHITE_PAPER (§2):** "Responses are mathematically biased toward caution,
lateral exploration, or urgency based on these levels."

**Paper alignment:** The paper's "Pareto frontier" is a static tradeoff. The endocrine system
makes the tradeoff *dynamic* — high cortisol narrows the Pareto preference toward
reliability, high dopamine broadens it toward exploration. This is a genuine extension of
the framework.

### 2. CNS BitNet TERNARY ATTENTION
*See "CNS Filtering Dilemma" section above for the full analysis.*

The paper's "selective diagnostics" is implemented in H.U.G.H. as a learned ternary
attention mask. This is more sophisticated than the paper's grep-based approach,
but the paper's ablation warns that compression can lose diagnostic signal.

### 3. STIGMERGIC COORDINATION
**From WHITE_PAPER (§4):** "Specialized nodes deposit pheromone-like signals into a
shared environment (Convex). The system coordinates behavior through environmental
modification."

Not in the paper. The paper assumes a single proposer on a single machine. H.U.G.H.'s
stigmergic substrate enables multi-agent coordination without tight coupling.
This becomes a differentiator if Meta-Harness search is distributed across nodes.

### 4. SOUL ANCHOR INTEGRITY
Cryptographic identity verification on boot. The paper has no concept of system identity
persistence — it trusts the filesystem hasn't been tampered with. H.U.G.H.'s soul anchor
is both an identity mechanism and a security layer.

### 5. MULTI-NODE EXECUTION via KVM
**From KVM_AGENT_SPEC:** 3-endpoint HTTP bridge (exec, ping, info) with PM2 persistence,
Cloudflare tunnel exposure, command zone classification (green/yellow/red).

The paper assumes single-machine execution. H.U.G.H. can dispatch harness evaluation
to multiple KVM nodes. This enables parallel candidate evaluation — a direct performance
multiplier for the search loop.

### 6. 8-STRATEGY ARC LIBRARY
The paper mentions no specific ARC-AGI strategies. H.U.G.H. has 8 specialized strategies
with feature-based ranking, temperature-per-strategy, and rule extraction evaluation.

**Paper alignment:** The paper's math harness (Appendix B.2) uses a 4-route lexical router
for subject-specific retrieval. H.U.G.H.'s 8-strategy ARC library is structurally similar —
route selection based on task features. The paper validates this routing approach empirically.

### 7. MEMORY AS COGNITIVE SUBSTRATE (Not just a log)
**From DEFINITIVE_TECHNICAL_SPEC (§2):** Three-tier memory (Episodic + Semantic + Archival)
with endocrine state stamping on episodes.

The paper's filesystem is a *log*. H.U.G.H.'s memory is a *cognitive substrate* — episodes
are stamped with the system's emotional state at time of recording, semantic triples are
reinforced by interaction frequency, and archival memory provides cross-session recall.
This means H.U.G.H. doesn't just remember what happened — it remembers how it *felt*
when it happened. The paper has no equivalent.

---

## DISCOVERED HARNESS DESIGNS (New Section — Applicable to H.U.G.H.)

The paper's Appendix B describes concrete harness architectures that have been
empirically validated. These are directly adaptable to H.U.G.H.'s ARC-AGI pipeline:

### Draft-Verification Pattern (Text Classification)
Two-call procedure: (1) Draft prediction from retrieved context, (2) Verification call
with confirmers AND challengers — examples that support AND contradict the draft.

**ARC-AGI application:** After generating an initial solution, run a second pass that
specifically retrieves similar-but-different ARC tasks to stress-test the solution.
This is a "red team your own output" pattern.

### Label-Primed Query Pattern (Text Classification)
Three-part single prompt: (1) Label primer (full output space), (2) Coverage block
(one example per label), (3) Contrastive pairs (similar inputs, different outputs).

**ARC-AGI application:** Before solving, prime the model with the full transformation
vocabulary (rotation, reflection, color mapping, etc.), then show one example per
transformation type, then show contrastive pairs (similar grids, different transformations).

### 4-Route Lexical Router (Math Reasoning)
Subject-specific retrieval policies gated by lightweight lexical predicates.
Each route has its own BM25 parameters, deduplication, and example count.

**ARC-AGI application:** Route tasks by feature complexity (e.g., single-transformation
vs multi-step, grid size, color count) to strategy-specific harnesses. H.U.G.H.'s
8-strategy library already does this — validate that the routing predicates are empirically
optimized, not hand-coded.

### Environment Bootstrap (TerminalBench-2)
Single compound shell command before first LLM call gathers system snapshot.
Eliminates 2-4 exploratory turns.

**ARC-AGI application:** Before solving, inject a "task snapshot" — grid dimensions,
unique colors, symmetry properties, edge patterns — so the model doesn't waste
reasoning tokens discovering basic structure.

---

## PRIORITY IMPLEMENTATION ROADMAP (Updated)

### Immediate (high-impact, low-effort):
1. **Seed population** — 3-5 baseline candidates on boot (Zero-shot, Few-shot, strategy variants)
2. **Increase candidate history** — 5 → 20 prior candidates in proposer context
3. **Interface validation on primary path** — `simulateExecution()` BEFORE KVM, not fallback
4. **Task snapshot injection** — Adapted from TerminalBench env bootstrap pattern
5. **Difficulty-stratified search set** — Partition ARC tasks into solved/hard, search on hard

### Near-term (deepen diagnostics):
6. **Candidate manifest + selective retrieval** — Proposer sees all candidates' scores,
   requests specific traces by ID (matches paper's filesystem access pattern via DB)
7. **Modification type tracking** — Classify proposals as additive/structural/prompt,
   track regression rates, bias toward additive when structural regresses
8. **Dual candidate generation** — k=2 per iteration at different temperatures
9. **Post-execution behavioral scan** — Forbidden pattern regex on generated code

### Competition-ready (when hardware scales):
10. **CNS filter bypass experiment** — A/B test filtered vs unfiltered proposer context
11. **Agentic proposer via KVM** — Give proposer grep/cat/diff over candidate directory
12. **Cross-model validation** — Evaluate top candidates against held-out model
13. **Pareto CLI tooling** — list-frontier, show-top-k, diff between candidates
14. **Context scaling** — 10 MTok/iter when hardware supports it

---

## APPENDIX D IMPLEMENTATION CHECKLIST

The paper's practical tips (Appendix D) map directly to H.U.G.H. actions:

| Paper Tip | H.U.G.H. Status | Action |
|-----------|-----------------|--------|
| "Write a good skill" — skill text is primary steering interface | Soul anchor + system prompt exist | ✅ Aligned. Paper validates that "accumulated traces often shape behavior more than the skill itself" — which means H.U.G.H.'s memory system may matter more than the system prompt long-term |
| "Start with a baseline and hard search set" | No seed population, no difficulty filtering | ❌ Implement seed + hard-task filtering |
| "Log everything in queryable format" | Convex DB with JSON blobs | ⚠️ Break JSON blobs into indexed fields |
| "Make logs queryable through CLI" | No CLI tooling | ❌ Build manifest/query system |
| "Lightweight validation before expensive benchmarks" | `simulateExecution()` exists but only in fallback | ⚠️ Move to primary path |
| "Automate evaluation outside the proposer" | `executeHarness` is separate | ✅ Aligned |

---

## VERDICT (Updated)

The source paper is a rigorous, empirically validated framework for automated harness
engineering. It was published March 30, 2026 by Stanford, KRAFTON, and MIT.
The blueprint.md is a faithful-but-lossy NotebookLM compression of it, with Grizz's
ARC-AGI-3 research intent layered on top.

H.U.G.H. maps ~65% of the paper's architecture into a biologically-inspired cognitive
framework. The core loop is intact. The gaps are in **depth** (context volume, candidate
history, search set design) and **tooling** (CLI, validation, modification tracking).

The paper's single most threatening finding for H.U.G.H. is the **Table 3 ablation**:
summary-based feedback degrades performance compared to raw trace access.
The CNS filter is doing intelligent summarization. Monitor this carefully as you scale.

The implementation's innovations — endocrine modulation, memory-as-cognitive-substrate,
stigmergic coordination, soul anchor, multi-node KVM, 8-strategy ARC library —
constitute a genuine extension of the paper's framework into embodied cognitive
architecture territory. The paper is about optimizing code around a model.
H.U.G.H. is about building a person around a model. These are compatible goals.

The paper's discovered harness patterns (draft-verification, environment bootstrap,
lexical routing) are directly adaptable to ARC-AGI and should be absorbed into
the 8-strategy library as candidate templates for the search loop to optimize.

**For ARC-AGI-3:** The paper proves that automated harness search outperforms
hand-engineering. H.U.G.H. already has the loop. The priority is: seed population,
search set difficulty filtering, deeper candidate history, and the "additive modification"
bias. These are all implementable on current hardware.

---

**Classification:** Technical Analysis — Full Paper + Blueprint + Implementation Cross-Reference
**Operative:** Romanova, N.A.
**Status:** Complete. Standing by for implementation directives.
