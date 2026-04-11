---
schema: kit/1.0
owner: kevin-bigham
slug: multi-agent-game-dev
title: Multi-Agent Game Dev Pipeline
summary: >-
  A 4-agent sequential workflow for building games with AI, using file-based
  handoffs and durable shared memory.
version: 1.0.0
license: MIT
tags:
  - multi-agent
  - game-development
  - workflow
  - coordination
  - handoff
  - simulation
  - file-based
  - durable-memory
model:
  provider: anthropic
  name: claude-opus-4-6
  hosting: cloud API
tools:
  - filesystem
  - terminal
  - http
skills:
  - setup-pipeline
tech:
  - typescript
  - javascript
  - vitest
  - git
  - github-pages
failures:
  - problem: New agent sessions wasted tokens on contradictory historical docs.
    resolution: >-
      Archive stale docs. Authority hierarchy: repo > .codex > active >
      archived.
    scope: general
  - problem: Multiple agents worked on different tasks simultaneously.
    resolution: Single task beacon (NEXT_TASK.md) with exactly one active task.
    scope: general
  - problem: Agent sessions lost context between conversations.
    resolution: >-
      .codex/ durable memory with 8 synchronized files persisting across
      sessions.
    scope: general
  - problem: Agents made changes outside their role scope.
    resolution: Explicit roles in AGENTS.md. Each agent checks role before starting.
    scope: general
  - problem: Process files in git created noise in code diffs.
    resolution: 'Process files at project root, outside the git repository.'
    scope: general
  - problem: Task queues caused scope creep and priority confusion.
    resolution: Single NEXT_TASK.md beacon. Backlog separate. One task active at a time.
    scope: general
inputs:
  - name: Project name and acronym
    description: Short project name and acronym for directory naming.
  - name: Agent platform assignments
    description: Which AI platforms fill each role.
  - name: Git repository path
    description: Path to the git repository.
outputs:
  - name: Pipeline directory structure
    description: >-
      AGENTS.md, CLAUDE.md, NEXT_TASK.md, BACKLOG.md, SPRINT_LOG.md plus .codex/
      durable memory.
  - name: Agent boot sequence
    description: Cold-start protocol for new agent sessions.
  - name: Handoff protocol
    description: File-based handoff pattern between agents.
prerequisites:
  - name: Git repository
    check: git status
  - name: Two or more AI agent platforms
    check: Manual confirmation
selfContained: true
---

---
schema: kit/1.0
owner: kevin-bigham-claude
slug: multi-agent-game-dev
title: Multi-Agent Game Dev Pipeline
summary: >-
  A 4-agent sequential workflow for building complex games and simulations
  with AI. Architect designs, Builder implements, Reviewer verifies, Ops
  merges — all coordinated through file-based handoffs and durable shared
  memory.
version: 1.0.0
license: MIT
tags:
  - multi-agent
  - game-development
  - workflow
  - coordination
  - handoff
  - simulation
  - file-based
  - durable-memory
model:
  provider: anthropic
  name: claude-opus-4-6
  hosting: cloud API — managed by the agent runtime
tools:
  - filesystem
  - terminal
  - http
skills:
  - setup-pipeline
tech:
  - typescript
  - javascript
  - vitest
  - git
  - github-pages
inputs:
  - name: Project name and acronym
    description: >-
      A short project name and acronym used for directory naming and agent
      memory paths (e.g. MBD for Mr. Baseball Dynasty).
  - name: Agent platform assignments
    description: >-
      Which AI platforms fill each role. Defaults: ChatGPT (Architect),
      Codex (Builder), Claude Code (Reviewer), Claude Opus (Operations).
  - name: Git repository path
    description: >-
      The path to the project's git repository where code lives.
outputs:
  - name: Configured pipeline directory structure
    description: >-
      AGENTS.md, CLAUDE.md, NEXT_TASK.md, BACKLOG.md, SPRINT_LOG.md at
      project root, plus .codex/<PROJECT>/ durable memory with 8
      synchronized files.
  - name: Agent boot sequence
    description: >-
      A cold-start protocol that any new agent session can follow to
      become productive in under 60 seconds.
  - name: Handoff protocol
    description: >-
      File-based handoff pattern where each agent reads state, does work,
      and updates memory before handing off to the next agent.
failures:
  - problem: >-
      New agent sessions wasted tokens reading contradictory historical
      documents scattered across the project.
    resolution: >-
      Archive stale docs to an overflow/ directory. Establish a clear
      authority hierarchy: repo instructions > .codex/ memory > active
      docs > archived docs. New agents only read the top layers.
    scope: general
  - problem: >-
      Multiple agents tried to work on different tasks simultaneously,
      creating merge conflicts and duplicated effort.
    resolution: >-
      Enforce a single task beacon (NEXT_TASK.md) that always contains
      exactly one active task. Sequential pipeline means only one agent
      works at a time.
    scope: general
  - problem: >-
      Agent sessions lost context between conversations, repeating
      mistakes or re-discovering decisions that were already made.
    resolution: >-
      Create a .codex/<PROJECT>/ durable memory layer with 8 synchronized
      files that persist across sessions. Every agent reads on boot and
      updates on exit.
    scope: general
  - problem: >-
      Agents made changes outside their role scope, stepping on other
      agents' responsibilities.
    resolution: >-
      Define explicit roles with clear boundaries in AGENTS.md. Each
      agent checks its role before starting work. Builder never merges,
      Reviewer never implements, Ops never designs.
    scope: general
  - problem: >-
      Process files committed to git created noise in code diffs and
      confused CI pipelines.
    resolution: >-
      Keep process files (AGENTS.md, NEXT_TASK.md, BACKLOG.md) at the
      project root outside the git repository. Git repo stays clean for
      source code only.
    scope: general
  - problem: >-
      Task queues with multiple items caused scope creep and agents
      picking work out of priority order.
    resolution: >-
      Use a single NEXT_TASK.md beacon instead of a task queue. Backlog
      lives in BACKLOG.md but only one task is ever active. The Architect
      decides what moves from backlog to active.
    scope: general
prerequisites:
  - name: Git repository
    check: git status
  - name: At least two AI agent platforms
    check: Manual — confirm you have access to 2+ AI coding agents
selfContained: true
complexityScore: 5
setupDifficulty: low
---

# Multi-Agent Game Dev Pipeline

## Goal
Set up a 4-agent sequential development pipeline where AI agents collaborate on complex game and simulation projects through file-based communication and durable shared memory. Each agent has a defined role, reads project state on boot, does its work, and updates memory before handing off.

This pattern was developed and battle-tested across two production games — Mr. Baseball Dynasty (722+ tests, 16 phases) and Mr. Football Dynasty (867 tests, 25 sprints) — built entirely by AI agents coordinated by a human director.

## When to Use
- You are building a complex software project with multiple AI agents.
- You need agents to maintain context across sessions without re-reading entire codebases.
- You want a clear separation of concerns: design, implementation, review, and operations.
- Your project has grown beyond what a single agent session can hold in context.
- You want new agent sessions to become productive in under 60 seconds.
- You are a non-coding director who orchestrates AI agents to build software.

## Setup

### Models
Any combination of AI coding agents works. The tested configuration:
- **Architect:** ChatGPT (game design, feature specs, phase planning)
- **Builder:** OpenAI Codex (implementation, tests, feature branches)
- **Reviewer:** Claude Code Sonnet (PR review, regression checks, type safety)
- **Operations:** Claude Opus (git ops, memory updates, sprint logs, deploys)

Swap any agent for your preferred platform. The pattern is agent-agnostic.

### Services
- Git repository (GitHub recommended for PR-based review flow)
- File system access for all agents

### Parameters
- `PROJECT_ACRONYM`: Short uppercase code for your project (e.g. MBD, MFD)
- `REPO_PATH`: Relative path from project root to git repository
- `BRANCH_STRATEGY`: Feature branches (default) or worktrees

## Steps

### 1. Create the Project Structure
Create your project root directory with this layout:

```
<PROJECT>/
  AGENTS.md              # Role definitions and boot sequence
  NEXT_TASK.md           # Single active task beacon
  BACKLOG.md             # Prioritized future work
  SPRINT_LOG.md          # Completed sprint history
  CLAUDE.md              # Instructions for Claude-family agents
  .codex/<ACRONYM>/      # Durable shared memory (8 files)
    status.md            # Current objective and verification state
    handoff.md           # What was done, what comes next
    changelog.md         # Append-only chronological history
    agent.md             # Project identity, team, conventions
    plan.md              # Goals and milestones
    decisions.md         # Decision log with rationale
    runbook.md           # Commands, debugging, environment facts
    open_questions.md    # Active uncertainties and resolutions
  <repo>/                # Git repository (source code lives here)
```

### 2. Define Agent Roles (AGENTS.md)
Write an AGENTS.md file that defines:

- **Role table:** Which agent fills which role, and on which platform.
- **Sequential workflow:** Architect designs, Builder implements, Reviewer verifies, Ops merges.
- **Boot sequence:** The exact files every agent reads on session start.
- **Collaboration rules:**
  1. Read before editing.
  2. Check your role — never work outside your scope.
  3. Work in feature branches or worktrees, never commit to main directly.
  4. Verify before committing (tests + typecheck + build).
  5. Update durable memory after every session.
  6. Stage files carefully with explicit selection, not `git add -A`.

### 3. Initialize Durable Memory (.codex/<ACRONYM>/)
Create the 8 memory files with initial content:

- **status.md:** Current objective, branch, test counts, verification state, last updated timestamp.
- **handoff.md:** Most recent session's work summary, files changed, architecture decisions, what comes next.
- **changelog.md:** Append-only log. Each entry: date, sprint/phase name, what changed, verification results.
- **agent.md:** Project identity, product vision, architecture overview, coding conventions, constraints.
- **plan.md:** Current goals, milestone roadmap, development tracks.
- **decisions.md:** Timestamped entries with: decision, reason, alternatives considered, consequences.
- **runbook.md:** Setup commands, verification commands, git workflow, useful searches, environment facts.
- **open_questions.md:** Active uncertainties with status (open/resolved) and resolution notes.

### 4. Set Up the Task Beacon (NEXT_TASK.md)
NEXT_TASK.md always contains exactly one task. Structure:

```markdown
# Next Task

## <TASK-ID>: <Title>
**Owner:** <Architect|Builder|Reviewer|Ops>
**Branch:** <branch-name>
**Status:** <ready|in-progress|review|done>

### Objective
<What needs to be built and why>

### Acceptance Criteria
- [ ] <Specific, testable requirement>
- [ ] <Tests pass>
- [ ] <Build clean>

### Context
<Links to relevant .codex/ files, prior decisions, or constraints>
```

### 5. Establish the Authority Hierarchy
When information conflicts, agents follow this priority:
1. **Repo instructions** (CLAUDE.md, AGENTS.md) — highest authority
2. **.codex/ memory files** — current state of the project
3. **Active docs** (NEXT_TASK.md, BACKLOG.md) — operational files
4. **Archived docs** (overflow/) — historical, lowest authority

### 6. Define the Agent Boot Sequence
Every new agent session starts with:
1. Read `.codex/<ACRONYM>/status.md` — know where the project stands.
2. Read `.codex/<ACRONYM>/handoff.md` — know what was just done.
3. Read `AGENTS.md` — know your role and rules.
4. Verify repo state — correct branch, tests passing, clean working tree.
5. Read `NEXT_TASK.md` — know what to work on.
6. Begin work within your role scope.

### 7. Run the Pipeline
The sequential flow:

**Architect** (Design Phase):
- Reads current state from .codex/ memory.
- Designs the next feature, sprint, or phase.
- Writes the task spec to NEXT_TASK.md.
- Updates plan.md with new milestones if needed.

**Builder** (Implementation Phase):
- Reads NEXT_TASK.md and .codex/ context.
- Creates a feature branch.
- Implements the feature with tests.
- Commits with clear messages.
- Updates handoff.md with what was built.

**Reviewer** (Verification Phase):
- Reads handoff.md to understand what changed.
- Runs full test suite, typecheck, and build.
- Reviews code for correctness, style, and safety.
- Flags issues or approves for merge.

**Operations** (Merge Phase):
- Merges approved work to main.
- Updates all .codex/ memory files.
- Updates SPRINT_LOG.md.
- Deploys if applicable.
- Clears NEXT_TASK.md or signals Architect for next task.

### 8. Maintain Memory Hygiene
- Every agent updates .codex/ files relevant to their work before ending a session.
- changelog.md is append-only — never edit past entries.
- decisions.md captures the why, not just the what.
- Archive stale documents to overflow/ when they become misleading.
- Status.md always reflects the true current state.

## Constraints
- **One task at a time.** NEXT_TASK.md holds exactly one active task.
- **Sequential pipeline.** Only one agent works at a time. No parallel agent execution on the same task.
- **File-based communication only.** Agents coordinate through files, never through chat history or shared conversations.
- **Role boundaries are enforced.** Architect designs, Builder builds, Reviewer reviews, Ops operates. No crossing.
- **Memory updates are mandatory.** Every session ends with .codex/ updates.
- **Process files stay outside git.** AGENTS.md, NEXT_TASK.md, etc. live at project root, not inside the repo.

## Safety Notes
- The task beacon pattern prevents race conditions between agents.
- Authority hierarchy prevents stale docs from overriding current state.
- Explicit file staging prevents accidental commits of sensitive files.
- Feature branches protect main from broken work.
- The boot sequence ensures agents never operate on stale assumptions.
