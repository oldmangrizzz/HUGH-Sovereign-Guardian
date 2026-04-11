---
schema: kit/1.0
owner: lilu
slug: context-guard
title: Context Guard
summary: >-
  Persistent context protection for AI coding agents — safeguard files survive
  sessions, rate limits, and compaction.
version: 1.0.0
license: MIT
tags:
  - context
  - memory
  - persistence
  - session-management
  - agent-workflow
model:
  provider: anthropic
  name: claude-opus-4-6
  hosting: cloud API — requires ANTHROPIC_API_KEY
tools:
  - >-
    pre-commit-check — Pre-commit hook reminding the agent to update safeguard
    files before every git commit
  - >-
    pre-compact-save — PreCompact hook that backs up safeguard files before
    context compaction
  - >-
    check-slash-commands — UserPromptSubmit hook enforcing skill invocation for
    slash commands
skills:
  - >-
    start — Session recovery: reads safeguard files, cross-references plans,
    flags dropped tasks, commits orphaned work
  - >-
    end — Session save point: updates safeguard files, paginates, archives
    plans, commits and pushes
  - >-
    audit — On-demand integrity check: verifies all files, plans, git state,
    task registry, and archives
  - >-
    save — Mid-session checkpoint: updates safeguard files, commits, pushes,
    paginates large files
  - >-
    itemise — Adds hierarchical section numbers to code files for targeted
    reading
failures:
  - problem: >-
      Context lost after rate limits or session restarts — agent starts fresh
      with no memory
    resolution: >-
      External safeguard files persist across sessions; /start recovers full
      context in one command
    scope: general
  - problem: Tasks dropped between sessions — agent forgets what was pending
    resolution: >-
      TASK_REGISTRY.md with cross-referencing ensures nothing is lost; /audit
      catches dropped tasks
    scope: general
  - problem: Context compaction silently loses work mid-session
    resolution: >-
      PreCompact hook backs up safeguard files automatically; auto-checkpoint
      protocol keeps files current throughout the session
    scope: environment
  - problem: >-
      Safeguard files grow indefinitely, consuming context window budget on
      every session start
    resolution: >-
      Automatic pagination archives older content into numbered page files when
      files exceed 300 lines; /start reads only current pages
    scope: general
  - problem: >-
      Sessions crash or overflow without /end, leaving uncommitted work with no
      record
    resolution: >-
      /start detects uncommitted changes, cross-references with safeguard files,
      and commits orphaned work automatically
    scope: general
inputs:
  - name: project-name
    description: Name of the project to protect
  - name: project-description
    description: Brief description of the project
outputs:
  - name: safeguard-files
    description: >-
      SESSION_LOG.md, TASK_REGISTRY.md, DECISIONS.md, COMMENTS.md,
      FEATURE_LIST.json — persistent state that survives across sessions
  - name: session-recovery
    description: Full context recovery via /start at any session start
fileManifest:
  - path: .claude/hooks/pre-commit-check.sh
    role: template
    description: .claude/hooks/pre-commit-check.sh
  - path: .claude/hooks/pre-compact-save.sh
    role: template
    description: .claude/hooks/pre-compact-save.sh
  - path: .claude/hooks/check-slash-commands.sh
    role: template
    description: .claude/hooks/check-slash-commands.sh
  - path: .claude/settings.json
    role: template
    description: .claude/settings.json
  - path: install.sh
    role: installer
    description: One-command installer for Context Guard
  - path: templates/CLAUDE.md
    role: template
    description: Template for project instruction file with all protocols
  - path: templates/SESSION_LOG.md
    role: template
    description: Template for session history log
  - path: templates/TASK_REGISTRY.md
    role: template
    description: Template for permanent task registry
  - path: templates/DECISIONS.md
    role: template
    description: Template for architectural decisions register
  - path: templates/COMMENTS.md
    role: template
    description: Template for verbatim user comments log
  - path: templates/FEATURE_LIST.json
    role: template
    description: Template for feature pass/fail tracker (JSON)
prerequisites:
  - name: git
    check: git --version
verification:
  command: ls .claude/skills/start/SKILL.md && echo 'Context Guard installed'
selfContained: true
environment:
  runtime: Any AI coding agent with skill support
  os: 'cross-platform (macOS, Linux, Windows via Git Bash)'
  platforms:
    - claude-code
  adaptationNotes: >-
    The reference implementation uses Claude Code and CLAUDE.md. To adapt for
    other agents, replace CLAUDE.md with your agent's instruction file and map
    the 5 skills to your agent's skill/command system. The core principle —
    external state files that survive context windows — is LLM-agnostic.
---

---
schema: "kit/1.0"
slug: "context-guard"
title: "Context Guard"
summary: "Persistent context protection for AI coding agents — safeguard files survive sessions, rate limits, and compaction."
version: "1.0.0"
license: "MIT"
tags:
  - context
  - memory
  - persistence
  - session-management
  - agent-workflow
model:
  provider: anthropic
  name: claude-opus-4-6
  hosting: "cloud API — requires ANTHROPIC_API_KEY"
selfContained: true
environment:
  runtime: "Any AI coding agent with skill support"
  os: "cross-platform (macOS, Linux, Windows via Git Bash)"
  platforms:
    - claude-code
  adaptationNotes: "The reference implementation uses Claude Code and CLAUDE.md. To adapt for other agents, replace CLAUDE.md with your agent's instruction file and map the 5 skills to your agent's skill/command system. The core principle — external state files that survive context windows — is LLM-agnostic."
tools:
  - name: pre-commit-check
    description: "Pre-commit hook reminding the agent to update safeguard files before every git commit"
  - name: pre-compact-save
    description: "PreCompact hook that backs up safeguard files before context compaction"
  - name: check-slash-commands
    description: "UserPromptSubmit hook enforcing skill invocation for slash commands"
skills:
  - name: start
    description: "Session recovery — reads all safeguard files, cross-references plans, flags dropped tasks"
  - name: end
    description: "Session save point — updates safeguard files, commits, pushes, reports summary"
  - name: audit
    description: "On-demand integrity check — verifies all files, plans, git state, task registry"
  - name: save
    description: "Mid-session checkpoint — updates safeguard files without git operations"
  - name: itemise
    description: "Itemisation Protocol — adds hierarchical section numbers to code files for targeted reading"
inputs:
  - name: project-name
    description: "Name of the project to protect"
  - name: project-description
    description: "Brief description of the project"
outputs:
  - name: safeguard-files
    description: "SESSION_LOG.md, TASK_REGISTRY.md, DECISIONS.md, COMMENTS.md, FEATURE_LIST.json — persistent state that survives across sessions"
  - name: session-recovery
    description: "Full context recovery via /start at any session start"
failures:
  - problem: "Context lost after rate limits or session restarts — agent starts fresh with no memory"
    resolution: "External safeguard files persist across sessions; /start recovers full context in one command"
    scope: "core"
  - problem: "Tasks dropped between sessions — agent forgets what was pending"
    resolution: "TASK_REGISTRY.md with cross-referencing ensures nothing is lost; /audit catches dropped tasks"
    scope: "core"
  - problem: "Context compaction silently loses work mid-session"
    resolution: "PreCompact hook backs up safeguard files automatically; auto-checkpoint protocol keeps files current throughout the session"
    scope: "core"
prerequisites:
  - name: git
    check: "git --version"
verification:
  command: "ls .claude/skills/start/SKILL.md && echo 'Context Guard installed'"
---

# Context Guard

## Goal

Prevent data loss across AI coding agent sessions. When an agent session ends — whether by rate limit, crash, context compaction, or the user closing the terminal — everything the agent learned, decided, and was working on is preserved in external files. The next session recovers full context with a single command.

The core principle is LLM-agnostic: external state files survive context windows regardless of which model or agent framework you use. The reference implementation targets Claude Code, but the pattern applies to any AI coding agent that supports skills or commands.

## When to Use

- Any project where an AI coding agent works across multiple sessions
- Long-running projects where continuity matters — decisions, task history, and user feedback must persist
- Teams or individuals who hit rate limits, session timeouts, or context compaction regularly
- Projects where you need an audit trail of what was done, decided, and why

## Setup

### Option 1: One-Command Install

```bash
git clone https://github.com/atreiou/claude-context-guard.git
cd claude-context-guard
./install.sh /path/to/your/project
```

### Option 2: Manual Install

1. Copy the `.claude/` folder into your project root
2. Copy the `templates/` folder into your project root

### First Run

Open your agent in the project and type `/start`. On first run, it will:
1. Detect this is a new project (no safeguard files yet)
2. Ask for your project name and description
3. Create all safeguard files from the templates
4. Offer to run `/itemise` for numbered code addressing (optional)

## Steps

Context Guard provides five commands:

1. **`/start`** — Type this at the start of every session. Reads all safeguard files, cross-references plans against the task registry, flags dropped tasks, checks git state, and summarises the project. One command, full recovery.

2. **`/save`** — Mid-session checkpoint. Updates all safeguard files with current progress. No git operations. Use during long sessions or before risky operations.

3. **`/audit`** — On-demand integrity check. Everything `/start` does plus: checks for stale tasks, verifies decisions, checks for unarchived plans, file integrity, and saves a timestamped report to `audits/`.

4. **`/end`** — Session save point. Updates all safeguard files, archives plans, commits and pushes all changes, verifies clean git state, and reports a summary. Optional but gives a guaranteed clean handoff.

5. **`/itemise`** — Applies hierarchical section numbers to code files so every block is referenceable by address (e.g. "check section 2.3.1"). Creates backups, verifies integrity, cleans up. Togglable per project.

### What Gets Created

| File | Purpose |
|------|---------|
| `CLAUDE.md` | Auto-read every session. Project rules, protocols, and pointers to safeguard files |
| `SESSION_LOG.md` | Running history of every session — what happened, errors hit, next steps |
| `TASK_REGISTRY.md` | Every task ever created with status. Cross-referenced by /start and /audit |
| `DECISIONS.md` | Architectural decisions register — the "why" behind every choice |
| `COMMENTS.md` | User's verbatim comments logged as a safety net against context loss |
| `FEATURE_LIST.json` | Pass/fail feature tracker (JSON — harder for LLMs to accidentally overwrite) |
| `plans/` | Archived plans from every session |

### Hooks

| Hook | Event | Purpose |
|------|-------|---------|
| `pre-commit-check.sh` | PreToolUse (Bash) | Reminds agent to update safeguard files before git commits |
| `pre-compact-save.sh` | PreCompact | Backs up safeguard files before context compaction |
| `check-slash-commands.sh` | UserPromptSubmit | Enforces skill invocation for `/commands` |

## Constraints

- The reference implementation uses Claude Code's skill system and CLAUDE.md. To use with other agents, you need to map the 5 skills to your agent's command system and replace CLAUDE.md with your agent's instruction file.
- Safeguard files are local and gitignored by default — they contain project-specific session data, not shareable code.
- The `/itemise` command modifies code files (adds comment-based section numbers). It creates backups and verifies integrity, but review the changes before committing.
- Hooks use `$CLAUDE_PROJECT_DIR` which is Claude Code-specific. Other agents may need different environment variable references.

## Safety Notes

- Safeguard files (SESSION_LOG.md, TASK_REGISTRY.md, etc.) should be gitignored — they may contain session-specific details not appropriate for public repos.
- Never store credentials, API keys, or sensitive data in safeguard files.
- The pre-compact hook copies files to `compaction-backups/` — also gitignored and safe to delete periodically.
- The `/itemise` command always creates `.itemise-backup` files before modifying code and restores from backup on any verification failure.
