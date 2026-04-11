# FILE NAMING CONVENTION — GrizzlyMedicine Lab
**Issued by:** Natasha Romanova  
**Date:** 20260404  
**Status:** Standing Order

---

## Core Rules

- All caps for category prefix and type tags
- Underscores as separators — no spaces, no hyphens
- Dates always 8-digit: `YYYYMMDD`
- `.md` for all documentation; `.ts/.js/.cjs` follow existing code conventions
- Descriptive markers should be meaningful at a glance — no abbreviations that require a legend

---

## 1. Personnel Files

> Any file that is primarily *about* a person or agent — profiles, audits, assessments, handoff memos, PRISM runs.

```
[INITIALS]_[LASTNAME]_[DESCRIPTOR]_[YYYYMMDD].md
```

| Segment | Rule | Example |
|---|---|---|
| INITIALS | First + Last, 2–3 chars, all caps | `NA` (Natasha Alianovna), `BW` (Bruce Wayne) |
| LASTNAME | Canonical last name, Title Case | `Romanova`, `Wayne`, `Fox` |
| DESCRIPTOR | Snake_Case content tags, as many as needed | `PRISM_Assessment`, `Audit_Session1`, `Handoff_AlgMode` |
| DATE | 8-digit, YYYYMMDD | `20260404` |

**Examples:**
```
NA_Romanova_PRISM_Assessment_20260404.md
BW_Wayne_Wound_Healing_Review_20260404.md
LF_Fox_Audit_Session1_20260331.md
AS_Stark_Benchmark_Handoff_20260401.md
HUGH_Primary_Systems_GAP_Analysis_20260404.md   ← system-as-subject uses full name
```

---

## 2. Project / System Files

> Architecture docs, specs, blueprints, implementation plans — files about *systems*, not people.

```
[SYSTEM]_[TYPE]_[DESCRIPTOR]_[VERSION or DATE].md
```

| Segment | Rule | Example |
|---|---|---|
| SYSTEM | Project or subsystem name, all caps | `HUGH`, `LOOM`, `VEIL`, `ECS` |
| TYPE | Document class (see types below) | `SPEC`, `BLUEPRINT`, `REPORT`, `RUNBOOK` |
| DESCRIPTOR | What specifically | `Endocrine_v2`, `Knowledge_Graph_Build` |
| VERSION or DATE | `v[major].[minor]` for versioned specs; `YYYYMMDD` for snapshots | `v2.2`, `20260404` |

**Document Types:**
| Tag | Use |
|---|---|
| `SPEC` | Technical specification — precise, normative |
| `BLUEPRINT` | Implementation plan — directional, phased |
| `REPORT` | Findings, assessments, post-mortems |
| `RUNBOOK` | Step-by-step operational procedures |
| `MEMO` | Internal communications and standing orders |
| `REVIEW` | Peer or audit review of existing work |
| `DRAFT` | Work in progress — not finalized |

**Examples:**
```
HUGH_SPEC_Endocrine_v2.2.md
LOOM_BLUEPRINT_Knowledge_Graph_20260404.md
ECS_SPEC_Cardiac_Sync_v2.0.md
VEIL_RUNBOOK_Deployment_20260402.md
HUGH_REPORT_GAP_Analysis_v1.0.md
```

---

## 3. Memos

> Standing orders, policy communications, team directives.

```
MEMO_[SUBJECT]_[YYYYMMDD].md
```

**Examples:**
```
MEMO_Clinical_Standard_20260404.md
MEMO_File_Naming_Convention_20260404.md
MEMO_Project_Infamous_Vote_20260402.md
```

---

## 4. Red Team / Security Reports

> Offensive assessments, vulnerability findings, audit trails.

```
RED_TEAM_[SYSTEM]_[TIER or WAVE]_[YYYYMMDD].md
AUDIT_[AGENT]_[SESSION]_[YYYYMMDD].md
```

**Examples:**
```
RED_TEAM_HUGH_Tier5_Phase2_20260403.md
RED_TEAM_ARC_AGI3_Wave_B_20260402.md
AUDIT_LF_Fox_Session1_20260403.md
```

---

## 5. Logs

> Raw session logs from agents. These are source material, not finished documents.

```
[AGENT_SHORT]_log_[SESSION_NUMBER]_[YYYYMMDD].md
```

**Examples:**
```
LF_Fox_log_001_20260402.md
AS_Stark_log_002_20260401.md
NA_Romanova_log_001_20260404.md
```

---

## 6. Versioning Notes

- Use `v[X].[Y]` when a document has a defined revision history (specs, blueprints)
- Use `YYYYMMDD` when a document is a snapshot (reports, memos, logs)
- Never use both — pick one per document class and stay consistent
- If a spec is revised, increment the version; do not create a new dated file

---

## Migration Note

Existing files in `natasha/`, `bruce/`, `lucius/`, `tony/` predate this convention and are grandfathered. New files from `20260404` forward follow this standard. When existing files are substantively revised, rename on revision.

---

*Filed and standing. — N.R.*
