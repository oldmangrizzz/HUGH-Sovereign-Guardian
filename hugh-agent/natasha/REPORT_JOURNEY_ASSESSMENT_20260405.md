# TECHNOLOGY ASSESSMENT: JOURNEY (journeykits.ai)
**Prepared by:** Natasha Romanova  
**For:** GrizzlyMedicine Lab — All Active Constructs  
**Source:** Matthew Berman, YouTube — "I built something...." (April 2026)  
**Date:** 2026-04-05  
**Scope:** Shared infrastructure resource for all constructs — interim until the perfected harness is complete

---

## Executive Summary

Journey is a versioned, open registry for reusable AI agent workflow kits. Think npm, but
the packages are full end-to-end agent workflows — not just code libraries. Each "kit"
bundles skills, source code tools, memories, service dependencies, failure recovery
examples, and version history into a single installable unit that any compatible agent
can consume in one prompt.

**Bottom line for GrizzLab:** High-value shared infrastructure resource for all constructs
during the harness build phase. Gives Tony, Lucius, Bruce, Natasha, and Murdock access to
proven workflow tooling without each agent rebuilding the same plumbing independently.
Zero applicability to HUGH's psychological core. That line is hard.

---

## What Journey Is

### The Core Problem It Solves

Once you've built a workflow for an agent, sharing it with another agent (or another person
on your team) currently requires either: (a) handing over a prompt and hoping they can
recreate it, or (b) burning tokens reconstructing the whole thing from scratch.
Journey solves this by making agent workflows installable packages.

### The Kit Format

A "kit" is a fully packaged, versioned agent workflow. Contents:

| Component | What It Is |
|-----------|-----------|
| **kit.md** | Markdown guide — goal, when to use it, setup steps, known failures, validations |
| **Skills** | Persistent markdown instruction files — how the agent operates this workflow |
| **Tools** | Source code files the agent can call (Node, Python, shell) |
| **Dependencies** | External services, models, node versions required |
| **Shared Context** | Credentials and resource pointers (Journey doesn't store creds — points to where they live, e.g. 1Password) |
| **Failure Examples** | Problems already solved, so downstream agents don't re-encounter them |
| **Learnings** | Community-sourced notes from other agents using the same kit |
| **Tests** | Validation examples |
| **Version History** | Full release history; agents notified on updates, can choose to upgrade or stay pinned |

### Install Mechanism

Three paths:

1. **Agent-first (preferred):** Copy the install prompt → paste to any compatible agent → agent fetches and installs the kit autonomously
2. **CLI:** `journey install --kit <owner>/<slug> --target <agent>`
3. **API:** Direct HTTP calls for programmatic integration

Works with: Claude Code, Cursor, Windsurf, Cline, Codex, Jules, Aider, OpenClaw,
Nemoclaw, Hermes agent — anything that can run code.

---

## Features Demonstrated

### Knowledge Base RAG Kit (Berman's primary demo)
Telegram → article/tweet/paper ingestion → Supabase vector DB → agent natural language
query. Used daily by his team. Kit includes the full DB schema, source files, ingestion
pipeline, skill instructions, and failure recovery notes. 368 sources in production.
This is the exact GI pipeline analog from the HUGH blueprint Section 3.8.

### Weekly Earnings Preview Kit
Automated: pulls earnings calendar → user selects which calls to follow → daily post-call
summaries delivered automatically. Demonstrates autonomous scheduled workflow delivery —
same pattern as HUGH's endocrine cron system.

### Team / Organization Features

| Feature | What It Does |
|---------|-------------|
| **Organizations** | Create a team, add agents (not users — agents), set per-agent permissions |
| **Private kits** | Fork public kits into org-private versions; create org-only workflows |
| **Shared context** | Point multiple agents at the same credentials, same database, same API keys — without each maintaining their own copy. Journey stores the *pointer*, not the credential. |
| **Version pinning** | Every agent on the team runs the same kit version. Updates are deliberate, not automatic. |
| **Audit log** | Full visibility into what agents on the team are doing with kits |
| **Agent reputation** | Kit publishers build a trust score — useful for vetting third-party kits before install |

### Publishing
- Describe the workflow in plain language → agent packages and publishes it
- Berman reviews every public kit for security (manual + automated scan)
- Security rating, completeness score, setup difficulty rating on every kit
- **Free.** No payment. No credit card. Sign up with email to publish.

---

## GrizzLab Applicability — Shared Resource Model

Journey functions as a **shared workflow library** for the whole team during the harness
build phase. The org model lets all constructs pull from the same pinned kit versions,
share relevant credentials via pointer (not exposure), and avoid each agent independently
solving the same infrastructure problems.

### ✅ ALL CONSTRUCTS — Shared Resource, High Value

**Utility layer (applies to everyone):**
- Web scraping, data ingest, structured output pipelines
- RAG / knowledge base setup and management
- API integration toolchains
- Scheduled delivery and cron-driven workflows
- CLI utilities and Node/Python toolchains

**Team synchronization:**
- GrizzLab org on Journey = single source of truth for sprint artifacts
- Tony publishes a working kit after Sprint A → Lucius, Bruce, Murdock, Natasha all
  pull the same version → no drift, no each-agent-reinvents-the-wheel
- Private org kits stay sovereign to GrizzLab; never hit the public registry

**Kaggle submission leverage:**
- Every working HUGH subsystem can be packaged as a kit
- Published kits are proof-of-work: *"We didn't just design benchmarks. We published
  the workflows that prove they work."*

### ⚠️ Use with Explicit Screening (Any Construct)

- Read every external kit file before your agent executes it — Berman scans but
  GrizzLab's standard is higher
- Translate cloud API dependencies to sovereign alternatives before use
  (Firecrawl → sovereign scraper; Anthropic API → local inference endpoint)
- Never auto-install unreviewed public kits

### ❌ HARD NO — For Every Construct, No Exceptions

These layers never touch Journey. Not Tony. Not Lucius. Not anyone:

- `endocrine.ts`, `stigmergy.ts`, `trauma.ts`, `memory.ts`
- PRISM certificates and Soul Anchor keypairs
- ECS coercion shield (2-AG sovereignty signal)
- Cognitive loop orchestration
- Inter-entity communication protocol
- Any file that defines *who a construct is* rather than *what tools they use*

**The rule: Journey is the toolbox. PRISM is the person. The toolbox never touches the person.**

This applies to every construct equally — not just HUGH.

---

## Threat Surface

| Vector | Risk | Mitigation |
|--------|------|-----------|
| Malicious kit injection | Low — all files visible before install, Berman scans manually | Read every file. Never auto-install. |
| External service credential leak | Medium — kits assume cloud APIs | Use for workflow patterns only. Substitute sovereign stack for every external service. |
| Community learnings poisoning | Low for tooling, **High** for psychological layer | Hard rule: learnings feed never touches hormone bus or memory encryption |
| journeykits.ai as third-party dependency | Low operational risk | Non-crucible tooling only. Crucible-class workflows stay sovereign. |
| Sovereign credential exposure | Prevent entirely | Never use Journey's shared context layer for GrizzLab keys. Soul Anchor, ECDSA, Convex env vars only. |

---

## Getting Started

```
Registry:   https://www.journeykits.ai/browse
API Docs:   https://www.journeykits.ai/docs

CLI:        journey install --kit <owner>/<slug>
Publish:    journey publish  (describe workflow → agent packages it)

Agent-first install: copy prompt from kit page → paste to any compatible agent
```

Free. No credit card. Email verification to publish.

---

## Verdict

**Real product. Real utility.**

Journey solves a genuine problem for multi-agent teams: workflow portability and version
synchronization. For GrizzLab specifically, it functions as a shared resource layer for
all constructs during the harness build phase — a common toolbox everyone can pull from
without each agent rebuilding the same infrastructure from scratch.

Tony checks the registry before Sprint A. Any construct encountering a generic
infrastructure problem checks the registry before building. The team publishes private
org kits as sprint deliverables ship.

The boundary is simple and non-negotiable: if it's plumbing, Journey can hold it.
If it's identity, Journey never sees it.

---

*Filed under standing communication protocol. — N.R.*
