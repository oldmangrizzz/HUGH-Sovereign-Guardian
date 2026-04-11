---
schema: kit/1.0
slug: grizzlymedicine-naming-convention
title: "GrizzlyMedicine Lab — Document Naming & Revision Tracking"
summary: "File naming rules and linear revision archiving for GrizzlyMedicine Lab. Flat canonical name = current version; _vN = ordered historical archive."
version: 1.0.0
owner: grizmed
license: MIT
tags:
  - documentation
  - naming-convention
  - versioning
  - revision-tracking
  - file-management
  - workflow
  - markdown
  - lab-ops
tools:
  - bash
  - filesystem
tech:
  - markdown
  - shell
model:
  provider: anthropic
  name: claude-sonnet-4.6
  hosting: "cloud API — requires ANTHROPIC_API_KEY or compatible endpoint"
inputs:
  - name: document_file
    description: "The flat-named document to be revised (e.g., DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md)"
  - name: document_type
    description: "Classification of the new document: Personnel, Project/System, Memo, Red Team, or Log"
outputs:
  - name: archived_version
    description: "Previous current version archived with an integer _vN suffix (e.g., DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md)"
  - name: working_document
    description: "Flat-named file retained as the working copy for the new revision"
failures:
  - problem: "Accidentally overwriting the only copy of a document during in-place editing"
    resolution: "begin-revision.sh copies the current version to _vN before any edits begin. The flat file remains as a separate copy after archiving."
    scope: general
  - problem: "Ambiguity about which of several _vN files is the current version"
    resolution: "The flat canonical name is current by convention. _vN files are historical. No disambiguation required."
    scope: general
  - problem: "Archive count mismatch when script is run from a different working directory"
    resolution: "Pass the full absolute path to the document, or cd to the document directory before invoking the script."
    scope: environment
  - problem: "Script collides with documents that already use semantic versioning (_v2.2) in their base name"
    resolution: "The script detects _v[N].[N] patterns and warns before proceeding. For semver-versioned specs and blueprints, increment the semantic version rather than using the archiving script."
    scope: general
useCases:
  - scenario: "Revising a finished report or paper through multiple editorial passes"
    constraints:
      - "Document uses flat canonical naming (no existing version suffix in the base name)"
  - scenario: "Naming a new document and classifying it by type for the first time"
  - scenario: "Auditing revision history before external publication (preprint, peer review, NIST communication)"
prerequisites:
  - name: bash
    check: "bash --version"
dependencies:
  cli:
    - bash
selfContained: true
fileManifest:
  - path: kit.md
    role: primary
    description: "Workflow guide and structured metadata for this kit"
  - path: skills/naming-convention.md
    role: skill
    description: "Standalone naming convention reference — all rules, patterns, and examples, including the revision tracking protocol"
  - path: src/begin-revision.sh
    role: tool
    description: "Archives the current flat-named document as _vN; leaves flat name as the working copy"
  - path: src/list-revisions.sh
    role: tool
    description: "Lists all archived _vN revisions of a document with modification timestamps"
  - path: examples/revision-walkthrough.md
    role: example
    description: "Worked example of the complete revision archiving protocol using a real lab document"
environment:
  runtime: "bash 3.2+"
  os:
    - macos
    - linux
  adaptationNotes: "Timestamp display in list-revisions.sh uses BSD stat on macOS and GNU stat on Linux. Both paths are handled via automatic fallback."
verification:
  command: "bash -n src/begin-revision.sh && bash -n src/list-revisions.sh && echo OK"
  expected: "OK"
---

# GrizzlyMedicine Lab — Document Naming & Revision Tracking

## Goal

This kit enforces GrizzlyMedicine Lab's document naming convention and linear revision
archiving protocol. It provides a consistent, human-readable file naming structure across
five document classes (Personnel, Project/System, Memo, Red Team, Log), and a deterministic
revision tracking system where the flat canonical name identifies the current version
and `_vN` suffixes identify the ordered historical archive.

The convention was designed for a small, high-velocity research lab where ambiguity in
document identity is operationally costly. The revision protocol was added to extend it to
multi-pass editorial workflows — papers, specs, and clinical reports that go through
sequential rounds of review.

## When to Use

- Creating any new documentation file in the GrizzlyMedicine Lab ecosystem
- Beginning a revision pass on an existing report, paper, or standing document
- Onboarding a contributor who needs the full naming and versioning reference in one place
- Auditing revision history before sharing a document externally (preprint submission,
  peer review, NIST communication, inter-agency contact)
- Integrating naming convention enforcement into an automated documentation workflow

## Setup

### Models

No inference is required at runtime. This is a documentation workflow. The kit was designed
and verified with Claude Sonnet 4.6. Any capable reasoning model can execute the naming
and classification decisions in Steps 1–4.

### Tools

- `bash` (3.2+): required for `begin-revision.sh` and `list-revisions.sh`
- `filesystem`: read/write access to the document directory

### Parameters

None. The convention rules are fixed by standing order. Parameterizing the naming
structure defeats the purpose — consistency is the value.

### Environment

Scripts run on macOS and Linux. No dependencies beyond a POSIX shell. Both scripts handle
the BSD/GNU `stat` divergence for timestamp display automatically.

## Steps

### 1. Classify the Document

Before naming, identify the document class:

| Class | Definition | Pattern |
|---|---|---|
| Personnel | About a person or agent | `[INITIALS]_[LASTNAME]_[DESCRIPTOR]_[YYYYMMDD].md` |
| Project/System | About a system, architecture, or spec | `[SYSTEM]_[TYPE]_[DESCRIPTOR]_[VERSION or DATE].md` |
| Memo | Standing orders and internal comms | `MEMO_[SUBJECT]_[YYYYMMDD].md` |
| Red Team | Offensive assessments and audit trails | `RED_TEAM_[SYSTEM]_[TIER or WAVE]_[YYYYMMDD].md` |
| Log | Raw session logs | `[AGENT_SHORT]_log_[SESSION_NUMBER]_[YYYYMMDD].md` |

Consult `skills/naming-convention.md` for the complete rule set, type tags, and examples.

### 2. Apply Core Naming Rules

Regardless of class, all filenames follow these rules:

- **All caps** for category prefix and type tags
- **Underscores** as separators — no spaces, no hyphens
- **Dates as 8-digit** `YYYYMMDD`
- **`.md`** for all documentation
- **Descriptive** markers that are meaningful at a glance — no abbreviations requiring a
  lookup table

### 3. Choose Version vs. Date Strategy

For Project/System documents:
- Use `v[X].[Y]` (semantic version) for specs and blueprints with a defined revision history
- Use `YYYYMMDD` (date snapshot) for reports, memos, and logs
- Combining both in the same filename is not supported

### 4. Create the File at the Flat Canonical Name

The name constructed in Steps 1–3 is the **flat canonical name**. Create the file at
this name. It is the current version by definition.

### 5. Begin a Revision (When the Document Already Exists)

When a document exists and a new revision is needed:

```bash
bash src/begin-revision.sh <document-file>
```

This command:
1. Counts existing `_vN` integer-suffix archives for that document in the same directory
2. Copies the current flat-named file to `<basename>_v(N+1).<ext>` — the new archive
3. Leaves the flat-named file as the working copy for editing

Edit the flat-named file. When editing is complete, it becomes the new current version.
No rename is needed.

```bash
# Example
bash src/begin-revision.sh DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md

# Output:
# ✓  Archived:     DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
# ✓  Working copy: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  (ready for editing)
#
# Revision history:
#    DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
#    → DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  [current]
```

### 6. Verify Revision History

After editing, confirm the archive state:

```bash
bash src/list-revisions.sh <document-file>
```

This shows all `_vN` archives with modification timestamps, ordered by version number,
followed by the current flat-named file.

## Constraints

- The flat canonical name is the current version. Creating files like
  `DOCUMENT_FINAL.md` or `DOCUMENT_CURRENT.md` violates the convention and creates
  ambiguity.
- `_vN` integer suffixes are reserved for the revision archiving protocol. Manually
  creating `_v1`, `_v2` etc. outside this workflow is unsupported and will cause collisions.
- Documents using semantic versioning in the base name (e.g., `HUGH_SPEC_Endocrine_v2.2.md`)
  should increment the semver on revision, not use the archiving script. The script will
  warn if a semver pattern is detected.
- Existing files created before 20260404 are grandfathered. Apply the convention to new
  files and to any renamed revisions going forward.
- Combining a version suffix and a date in the same filename is not permitted.
- All filenames use uppercase except for the extension (`.md`).

## Safety Notes

- `begin-revision.sh` copies, not moves. The flat-named file persists as the working
  copy. If the script exits before the copy completes (e.g., disk full), no data is lost —
  the flat file remains untouched.
- The script checks for a collision on the target archive filename before writing. If the
  target `_vN.md` already exists, the script halts with an error rather than overwriting.
  Resolve before proceeding.
- If a document is tracked in git, commit the current state before running
  `begin-revision.sh`. This creates a clean snapshot in version history and prevents the
  archive from being the only non-HEAD record of the previous state.
- Applying `begin-revision.sh` to files containing secrets, credentials, or `.env`
  content is inadvisable. The archive creates a full duplicate on disk, doubling the exposure surface.

## Inputs

The workflow requires:
- A document file at its flat canonical name (follow Steps 1–4 if creating a new file)
- The document directory needs to be writable (scripts resolve paths from the argument)

No external services, no credentials, no network access required.

## Outputs

After a revision cycle:
- `<basename>_vN.<ext>` — the archived previous version, written at the time of archiving
- `<basename>.<ext>` — the flat-named working copy; this becomes the new current version
  when editing is complete

## Failures Overcome

The frontmatter carries the structured failure list. Two patterns are worth calling out
operationally:

**Archive count confusion** — If the document directory contains unrelated `_v`-suffixed
files that match the basename pattern, the archive count may be inflated. The
`list-revisions.sh` output is the ground truth. Review it before archiving if the directory
is cluttered.

**Semver collision** — When a document base name already contains `_v2.2` (semantic
version), the archiving script appends `_v1`, `_v2` etc., producing names like
`SPEC_v2.2_v1.md`. This is valid but visually awkward. The script warns on this pattern.
For specs and blueprints, prefer incrementing the semver directly.

## Validation

After completing a revision cycle, run:

```bash
bash src/list-revisions.sh <document-file>
```

Expected output:
- At least one `_vN` archive listed with a timestamp
- The flat-named current file listed as `[current]`
- Total archived revisions count matches your expectation

For kit install validation:

```bash
bash -n src/begin-revision.sh && bash -n src/list-revisions.sh && echo "Syntax OK"
```
