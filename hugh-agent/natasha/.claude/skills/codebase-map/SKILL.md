---
name: codebase-map
description: "Structural codebase index: files, exports, imports, dependency graph, roles. Keyword search. Inject compact slices into agents to cut token usage 60-80%."
---

# Codebase Map — Structural Intelligence Index

## Goal

When an AI agent starts work on an unfamiliar codebase, it spends its first
few thousand tokens doing reconnaissance: globbing for files, reading directory
structures, searching for class definitions. This isn't wasted work — but it
*is* redundant work. The same questions get asked again and again across sessions,
across agents, across conversations.

This kit solves that problem by building a persistent structural index on first run
and answering navigation questions from the index on every subsequent run.

The output is a queryable map: every file in the project, its inferred role
(component, hook, store, route, service, test, config, etc.), its exports, its
imports, and its dependency edges. Query it with keywords, get ranked results
back in seconds without touching the filesystem.

The secondary use case is agent context injection. A 15-file context slice from
the map is typically 800-1200 tokens. Without the map, an agent finding those
same 15 files through Glob and Read calls consumes 2000-5000 tokens and takes
multiple round-trips. For multi-agent workflows, that difference compounds fast.

## When to Use

**Generate the index when:**
- Starting work on any codebase you haven't mapped yet
- The codebase has changed significantly since the last map
- Onboarding a new AI agent or starting a new campaign

**Query the index when:**
- Looking for files related to a feature, module, or concept
- Asking "where is the auth logic?" or "what files handle payments?"
- Preparing context to inject into a sub-agent prompt

**Use the context slice format when:**
- Spawning agents that need to know "which files are relevant to X"
- Starting a fleet campaign where each agent covers a different domain
- Any workflow where reducing agent token usage matters

## Setup

**Prerequisites:**
- Node.js 18+ (for the index generator script)
- A project with TypeScript, JavaScript, Python, Go, or Rust source files

**One-time initialization:**

The `map-index.js` script lives in the Citadel harness at `scripts/map-index.js`.
If you're running this as a standalone kit, copy the script to your project's
`scripts/` directory, or run it from the Citadel harness pointed at your project root:

```bash
node scripts/map-index.js --generate --root /path/to/your/project
```

The index is written to `.planning/map/index.json` inside the target project.
If `.planning/map/` doesn't exist, the script creates it.

## Steps

### Step 1: Generate the Index

Run the index generator. For a first-time run or after significant codebase changes:

```bash
node scripts/map-index.js --generate --root .
```

Add `--force` to bypass the 5-minute cache and rebuild from scratch:

```bash
node scripts/map-index.js --generate --root . --force
```

**What happens during generation:**
1. The walker traverses the project tree, respecting `.gitignore`
2. Each source file is parsed for exports, imports, and top-level symbols
3. A role is inferred for each file based on naming patterns, directory placement,
   and export shapes (e.g., a file exporting a function starting with `use` is a hook)
4. Import paths are resolved to build a dependency graph
5. The full index is written to `.planning/map/index.json`

**Expected output:**
```
Map index generated: 847 files, 2,341 dependency links
Languages: TypeScript (612), JavaScript (183), CSS (52)
Roles: component (201), hook (87), store (23), route (44), service (31),
       test (156), config (89), utility (114), other (102)
Index written to .planning/map/index.json
```

---

### Step 2: Print Summary Statistics

To get a structural overview of the codebase without querying anything specific:

```bash
node scripts/map-index.js --stats
```

Outputs file count, line count, export count, dependency edge count, and
full breakdowns by language and by role. Useful for understanding the shape
of an unfamiliar project before diving in.

---

### Step 3: Query the Index

Search for files related to a concept, feature, or keyword:

```bash
node scripts/map-index.js --query "auth session token"
node scripts/map-index.js --query "payment stripe checkout"
node scripts/map-index.js --query "user profile avatar upload"
```

**Scoring model:**
- Path match: +3 per matching term
- Export/symbol match: +5 per matching term
- Role match: +1 per matching term

Results are sorted by score, capped at 20 files, and formatted for readability:

```
Results for "auth session token" (12 matches):

  Score  Role        Path
  -------------------------------------------------------
  18     service     src/auth/session.service.ts
  15     hook        src/auth/useSession.ts
  12     store       src/stores/auth.store.ts
  10     route       src/api/routes/auth.ts
  8      utility     src/auth/token-utils.ts
  ...
```

---

### Step 4: Generate a Context Slice (for Agent Injection)

When you need to inject codebase context into an AI agent prompt, use the slice
format. It's compact by design — built to be injected, not displayed.

```bash
node scripts/map-index.js --query "auth session" --max-files 15
```

Output format:
```
=== MAP SLICE: auth session ===
18  service   src/auth/session.service.ts      [SessionService, createSession, invalidateSession]  (187L)
15  hook      src/auth/useSession.ts           [useSession, useCurrentUser]  (94L)
12  store     src/stores/auth.store.ts         [authStore, useAuthStore]  (203L)
...
=== END MAP SLICE ===
```

**Inject this block** at the start of any agent prompt that needs to find auth-related
files. The agent reads the slice instead of running its own file discovery — saving
tokens and time.

**Token budget:** A 15-file slice is typically 800-1200 tokens. Equivalent exploratory
Glob + Read calls would consume 2000-5000 tokens across multiple round-trips.

---

### Step 5: Refresh the Index

The index is cached for 5 minutes. For active development sessions, this means
you only pay the generation cost once per session. After significant codebase
changes (a large refactor, adding a new module), force a rebuild:

```bash
node scripts/map-index.js --generate --force
```

For CI or pre-session automation, add this to your session startup script.
The generation time on a 10K-file repo is typically 3-5 seconds.

---

## Constraints

- **Supported languages only:** TypeScript, JavaScript, Python, Go, Rust. Other
  file types are skipped silently. The index will still work for mixed-language
  repos — it just maps what it can parse.
- **Not a content search.** The map indexes structure (exports, imports, roles),
  not file contents. For searching code patterns, use grep/ripgrep. The map tells
  you *which files* to search; the search tool tells you *what's in them*.
- **Not a replacement for reading files.** A context slice tells an agent which
  files are relevant. The agent still needs to read those files to understand
  the actual code.
- **Cache TTL is 5 minutes.** Queries against a stale index may miss files added
  since the last generation. Use `--force` if freshness is critical.

## Safety Notes

- The index contains file paths and exported symbol names — no file contents. It's
  safe to share in agent prompts even if the codebase contains sensitive code.
- The `.planning/map/` directory should be added to `.gitignore`. The index is
  generated from the codebase and doesn't need to be committed.
- On very large repos (50K+ files), first-run generation may take 30-60 seconds.
  The cache makes subsequent runs fast. If generation time is a concern, scope
  the `--root` to a subdirectory.
