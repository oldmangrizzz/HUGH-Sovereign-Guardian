# Design: HUGH Central Nervous System (CNS) with BitNet 1.58b + Meta-Harness

## Overview
The Central Nervous System (CNS) acts as the cognitive gatekeeper for HUGH. It leverages the ternary logic of BitNet 1.58b ({-1, 0, 1}) to manage the high-volume diagnostic context produced by the Meta-Harness framework. By applying a ternary "Attention/Inhibition" mask, the CNS ensures the Proposer Agent focuses only on the most critical execution traces and environmental variables, drastically reducing context noise and improving optimization speed.

## Core Concepts

### 1. The Ternary Attention Mask (W_ternary)
The CNS assigns a weight $w \in \{-1, 0, 1\}$ to every discrete "environment feature" (e.g., a specific log file, a tool definition, a code snippet, or a hardware status).

| Weight | Mode | Action |
| :--- | :--- | :--- |
| **1** | **Excite / Act** | Critical context. Forced inclusion in the Proposer's prompt. Highlighted as the primary diagnostic focus. |
| **0** | **Neutral / Observe** | Passive context. Included in the background if context window permits. Not prioritized. |
| **-1** | **Inhibit / Filter** | Noise. Explicitly removed from the context to prevent hallucination or "context-stuffing" performance degradation. |

### 2. Integration with Meta-Harness
Meta-Harness provides the **Execution Traces** and **Scores**. The CNS consumes these to "learn" which features are relevant to specific failures.
*   **Trace Analysis:** If a trace shows a `TimeoutError` in `Tool X`, the CNS boosts the weight of `Tool X`'s definition and the `network_logs` to `1`.
*   **Counterfactual Filtering:** If a successful run had `Feature Y` disabled, the CNS might inhibit `Feature Y` (weight `-1`) for the next optimization iteration to simplify the solution.

---

## Logic Flow (Pseudo-code)

```typescript
/**
 * HUGH Central Nervous System (CNS)
 * Orchestrates Meta-Harness attention using BitNet ternary logic.
 */
class HUGH_CNS {
  private ternaryWeights: Map<string, number>; // Feature ID -> {-1, 0, 1}

  constructor() {
    this.ternaryWeights = new Map();
  }

  /**
   * Phase 1: Environment Bootstrap
   * Collects all possible context from the Meta-Harness environment.
   */
  async bootstrapEnvironment(projectRoot: string): Promise<EnvironmentSnapshot> {
    const traces = await MetaHarness.getLatestTraces();
    const tools = await MetaHarness.getToolDefinitions();
    const code = await MetaHarness.getCurrentHarness();
    
    return { traces, tools, code };
  }

  /**
   * Phase 2: Compute Mask
   * Generates the ternary mask based on historical scores and current trace errors.
   */
  computeTernaryMask(snapshot: EnvironmentSnapshot, history: ExecutionHistory): TernaryMask {
    const mask = new Map<string, number>();

    for (const feature of snapshot.allFeatures()) {
      // 1. Identify Criticality (Excite)
      if (this.isRelatedToError(feature, snapshot.latestError)) {
        mask.set(feature.id, 1); 
      }
      // 2. Identify Irrelevance (Inhibit)
      else if (this.isRedundant(feature, history)) {
        mask.set(feature.id, -1);
      }
      // 3. Default (Neutral)
      else {
        mask.set(feature.id, 0);
      }
    }
    return mask;
  }

  /**
   * Phase 3: Application of the BitNet Mask
   * Transforms raw environment data into an 'Attention-Focused' prompt for the Proposer.
   */
  applyMask(snapshot: EnvironmentSnapshot, mask: TernaryMask): FocusedContext {
    return {
      excite: snapshot.filter(f => mask.get(f.id) === 1),
      observe: snapshot.filter(f => mask.get(f.id) === 0),
      // Inhibit (-1) items are discarded here
    };
  }

  /**
   * Phase 4: Meta-Harness Optimization
   * The Proposer Agent receives the filtered context and generates a fix.
   */
  async proposeFix(focusedContext: FocusedContext): Promise<HarnessUpdate> {
    const prompt = `
      FOCUS (High Priority): ${focusedContext.excite}
      CONTEXT (Observational): ${focusedContext.observe}
      TASK: Analyze the failure in FOCUS and propose a harness update.
    `;
    return await ProposerAgent.generate(prompt);
  }

  /**
   * Phase 5: Weight Update (Learning)
   * Adjusts ternary weights based on the success of the proposed fix.
   */
  updateWeights(feedback: OptimizationFeedback) {
    // If the fix succeeded, reward the features marked '1'
    // If it failed, reconsider the 'Inhibit' choices
    this.ternaryWeights = BitNetOptimizer.step(this.ternaryWeights, feedback);
  }
}
```

## CNS Component Architecture in HUGH

1.  **Ternary Sensor Array:** Maps hardware/plugin states to ternary IDs.
2.  **Attention Buffer:** A high-speed cache for features marked `1`.
3.  **Inhibition Filter:** A regex-based or embedding-based "trash compactor" for features marked `-1`.
4.  **BitLinear Controller:** The decision engine that converts continuous "Relevance Scores" into discrete $\{-1, 0, 1\}$ weights.

## Key Benefits
*   **Noise Suppression:** By inhibiting irrelevant logs (-1), we avoid the "lost in the middle" problem in LLMs.
*   **Explicit Actionability:** Marking critical tools as `1` forces the agent's attention to the root cause.
*   **Computational Efficiency:** Reducing the proposer's input context size lowers token costs and latency, mimicking the integer-only efficiency of BitNet hardware.
