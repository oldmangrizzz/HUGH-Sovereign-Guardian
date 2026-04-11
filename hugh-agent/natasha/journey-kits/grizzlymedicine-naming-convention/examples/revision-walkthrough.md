# Revision Walkthrough — GrizzlyMedicine Lab Naming Convention Kit

> A worked example using a real lab document from the session it was built in.

---

## Scenario

The document `DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md` has just completed its
initial draft (the one Natasha wrote). Grizz forwards DeepSeek's peer review, which
identifies four corrections. We need to create v1.1 — a revision — while preserving
the original draft as an archived snapshot.

This is the exact workflow that played out in the lab on 20260405.

---

## Starting State

```
natasha/
└── DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md     ← the original draft
```

No archived revisions exist yet. This is the first revision pass.

---

## Step 1 — Archive the current draft

```bash
cd /Users/grizzmed/ProxmoxMCP-Plus/hugh-agent/natasha/

bash journey-kits/grizzlymedicine-naming-convention/src/begin-revision.sh \
  DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
```

**Output:**
```
✓  Archived:     DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
✓  Working copy: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  (ready for editing)

Revision history:
   DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
   → DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  [current]
```

**What happened:**  
The original draft is now `_v1.md` — archived, immutable snapshot.  
The flat-named file still exists as the working copy, with identical content for now.

---

## Step 2 — Edit the working copy

Apply the four corrections from DeepSeek's peer review directly to
`DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md`. The archived `_v1.md` is untouched
throughout this process.

When editing is complete, the flat-named file is the new current version (v1.1 in
human terms, though the filename stays flat).

---

## Step 3 — Verify the archive state

```bash
bash journey-kits/grizzlymedicine-naming-convention/src/list-revisions.sh \
  DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
```

**Output:**
```
Revision history: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md       2026-04-05 09:14  

  DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md          2026-04-05 11:32  [current]

Total archived revisions: 1
```

The original draft is preserved. The current flat file is the revised version.

---

## Step 4 — Second revision pass (DeepSeek Round 2)

DeepSeek reviews again and finds two more nits. We run the archiving protocol a
second time:

```bash
bash journey-kits/grizzlymedicine-naming-convention/src/begin-revision.sh \
  DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md
```

**Output:**
```
✓  Archived:     DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v2.md
✓  Working copy: DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  (ready for editing)

Revision history:
   DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md
   DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v2.md
   → DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md  [current]
```

Now the archive contains `_v1` (original draft) and `_v2` (round 1 revision).  
The flat file is the working copy for round 2 corrections.

---

## Final State After Both Revision Passes

```
natasha/
├── DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md      ← current (post round 2)
├── DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v1.md   ← original draft
└── DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER_v2.md   ← post round 1 revision
```

**The invariant holds at every step:**  
`DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md` is always the newest version.  
`_v1` is always older than `_v2`, which is always older than the flat file.

---

## Notes on This Example

- The paper was `DISTRESS_NEURON_INFRASTRUCTURE_RISK_PAPER.md` — no semver in the
  base name. This is a report-class document, so it uses the flat naming protocol
  rather than semantic versioning.
- For a spec like `HUGH_SPEC_Endocrine_v2.2.md`, the revision workflow would be:
  rename the file to `HUGH_SPEC_Endocrine_v2.3.md` directly. The `_vN` archiving
  protocol does not apply to semver-named files.
- The version numbers (`_v1`, `_v2`) reflect the *order* revisions were archived,
  not semantic significance. `_v2` is not "version 2.0" — it's "the second archived
  snapshot."
