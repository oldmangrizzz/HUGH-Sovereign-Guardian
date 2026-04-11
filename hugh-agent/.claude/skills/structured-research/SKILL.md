---
name: structured-research
description: "Turns questions into findings with confidence levels and citations. 2-4 queries, 3-6 sources, persistent doc. Scales to parallel multi-scout investigation."
---

# Structured Research — Findings With Confidence Levels

## Goal

Technical decisions made without research are usually made twice. The first time
with incomplete information, and the second time after the consequences arrive.

This kit doesn't produce comprehensive literature reviews. It produces *decision-ready*
findings: the specific facts that matter for the question at hand, confidence-labeled
so you know how much to trust them, with source citations so you can verify them,
and with explicit action recommendations so the research connects to a decision.

The key discipline is focus. 2-4 queries, 3-6 credible sources, a written document,
done. Not exhaustive. Timely. The research document persists, so if the same question
comes up again in three months, the prior findings are available without re-running
the investigation.

**Single question mode:** one agent investigates a focused question sequentially —
formulate queries, search, read actual pages, extract findings, write the document.

**Multi-scout mode:** when a question has 3+ genuinely independent angles (e.g., "Should
we migrate from Express to Fastify?" breaks into performance benchmarks, migration effort,
community health, and production war stories), multiple scout agents investigate their
angles simultaneously. Findings are compressed between waves into a unified brief. Faster
for broad questions; overkill for narrow ones.

## When to Use

**Single question mode:**
- Checking whether a dependency has a newer version or has been superseded
- Finding best practices for a specific technical problem
- Reading official documentation for an API or library before using it
- Verifying whether a pattern in the codebase has known issues
- Any time you need external information before making a code decision

**Multi-scout mode:**
- Evaluating multiple competing technologies or approaches
- Any question that naturally decomposes into 3+ independent sub-questions
- Research where parallel investigation would produce meaningfully better results
  than single-thread depth

**Use local-only mode when:**
- Researching internal patterns ("how does our codebase handle auth errors?")
- Checking existing library usage without needing external sources
- Air-gapped environments or when web search isn't appropriate

## Setup

No setup required for web-based research. The kit uses WebSearch and WebFetch
to find and read sources.

For local-only research, the kit uses Grep and Read to search the codebase.
No additional setup.

`.planning/research/` is created automatically on first run if it doesn't exist.

## Steps

### Step 1: Formulate

Convert the research question into 2-4 specific search queries. For each query,
target a different source type:

```
Official docs query:    "express.js middleware error handling site:expressjs.com"
Community/GitHub query: "express error middleware best practices 2025"
Technical comparison:   "express vs fastify error handling performance"
Release notes query:    "express 5.x changelog breaking changes" (if version-specific)
```

State the question clearly in one sentence before searching. This prevents scope
drift during the investigation.

---

### Step 2: Search and Read

Execute searches and read actual content — not just snippets:

- Use WebSearch for discovery (snippets tell you which pages to read)
- Use WebFetch to read the actual pages that look relevant
- Evaluate source credibility: official docs > GitHub repos > recent technical posts > forum answers
- Stop at 3-6 credible sources. Not exhaustive — focused.
- Note disagreements between sources rather than silently resolving them

**Do not fetch GitHub repository pages directly** — they're large HTML documents
that time out. Instead:
- Use WebSearch to find information about repos (snippets contain what you need)
- For README content, fetch the raw URL:
  `https://raw.githubusercontent.com/{user}/{repo}/{branch}/README.md`

---

### Step 3: Extract Findings

For each finding:

```
What:       The specific fact, recommendation, or pattern discovered
Source:     URL or reference
Relevance:  How this applies to the original question (one sentence)
Confidence: high (official docs, verified) | medium (community consensus) | low (single source)
Action:     What to do with this information, or "informational only"
```

Don't record every interesting thing found — only findings that bear on the
original question. Research scope creep produces long documents nobody reads.

---

### Step 4: Write the Research Document

Write findings to `.planning/research/{topic-slug}.md`:

```markdown
# Research: {Topic}

> Question: {The original question}
> Date: {ISO date}
> Confidence: {overall: high/medium/low}

## Findings

### 1. {Finding title}
**What:** {description}
**Source:** {URL}
**Confidence:** {high/medium/low}
**Action:** {recommendation or "informational"}

### 2. {Finding title}
...

## Summary
{2-3 sentences: what was learned, what the recommendation is}

## Open Questions
{Anything that couldn't be resolved — needs human judgment or deeper investigation}
```

---

### Step 5 (Multi-Scout Mode Only): Decompose, Deploy, Compress

If the question has 3+ independent angles:

**Decompose** into specific sub-questions, each:
- Independent (doesn't depend on another scout's findings)
- Specific (one clear question)
- Answerable in 3-6 sources

**Deploy scouts** in parallel, one per angle. Each follows the single-question
protocol (Steps 1-4) and writes its findings to
`.planning/research/fleet-{slug}/{angle-slug}.md`.

**Compress** after all scouts complete:
- Consensus: findings independently confirmed by multiple scouts
- Conflicts: findings that contradict (flag prominently, don't resolve silently)
- Gaps: angles without strong results
- Surprises: unexpected findings that change the question's framing

If gaps or conflicts exist, deploy a Wave 2 with targeted scouts to resolve them.
Wave 2 scouts receive the compressed brief as context — they don't re-research
what Wave 1 already covered.

**Write the unified report** to `.planning/research/fleet-{slug}/REPORT.md`.

---

## Constraints

- **Does not make decisions.** The kit produces findings and a recommendation.
  The decision is yours. Architecture choices, library adoptions, and migration
  commitments require human judgment — the kit informs, not decides.
- **Does not install packages or modify code.** Research is read-only. Apply
  findings separately.
- **2-4 queries, 3-6 sources, done.** Not exhaustive. If the question requires
  deeper investigation, run a second research pass on the specific open questions
  from the first.
- **Maximum 5 scouts per wave** in multi-scout mode (diminishing returns beyond that).
- **Maximum 2 waves** — if Wave 2 doesn't resolve conflicts, the question needs
  human judgment, not more searches.

## Safety Notes

- Research findings are only as good as their sources. `Confidence: high` means
  the finding comes from official documentation or has multiple corroborating
  sources — not that it's certainly correct. Verify critical decisions independently.
- The research document is persistent. If you run research on a topic and then
  the landscape changes (library deprecation, new version, breaking change), the
  old document may be stale. Check the date before acting on old research.
- For security-sensitive research (vulnerability assessment, crypto library selection,
  auth pattern evaluation), treat `Confidence: medium` findings with more skepticism
  than you would for other topics. Security mistakes compound.
