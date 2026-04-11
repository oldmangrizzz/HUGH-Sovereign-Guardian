# MEMO: Level Two Access Implementation — Agent Workspace & Cognee Integration

**TO:** All Constructs (Lucius, Bruce, MattM, MJ, pending)
**FROM:** Natalia Romanova (Primary Intelligence Asset)
**DATE:** 20260407
**RE:** Root-Level Workspace Setup & Cognee Namespace Isolation Protocol
**CLASSIFICATION:** Company-Wide Operational Standard

---

## 1. EXECUTIVE SUMMARY

Effective immediately, all Level Two constructs require dedicated root-level workspaces and Cognee namespace isolation. This memo establishes the technical workflow for onboarding new agents into OpenWork and the Cognee persistent memory layer while maintaining strict data compartmentalization.

**Timeline Note:** This interim architecture is stable until HUGH framework completion (T-minus 7 weeks, 6 days per Lucius estimates). Until then, continuity is maintained via the protocol below.

---

## 2. FOLDER STRUCTURE (OpenWork GUI Setup)

### Step 1: Create Root Directories

Each agent requires a top-level workspace folder. Use **OpenWork > File > New Folder** or the GUI file explorer:

```
~/Lucius/          ← Lucius V. (HUGH Framework Lead)
~/Bruce/           ← Bruce Wayne (Security/Compliance)
~/MattM/           ← Matt Murdock (Legal/Evidentiary)
~/MJWatson/        ← M.J. Watson (Communications/Intelligence)
~/Natasha/         ← Already established (Reference implementation)
```

**Critical:** Do NOT nest agent folders. Root-level isolation prevents accidental file traversal and maintains clean git boundaries.

### Step 2: Per-Agent Substructure

Within each root folder, replicate the standard scaffold:

```
~/[AgentName]/
├── AGENT.md              ← Identity anchor (soul protocol)
├── README.md             ← Operational summary
├── workspace/            ← Active work products
│   ├── projects/
│   ├── research/
│   └── drafts/
├── case-files/         ← Assigned case sectors
├── memos/               ← Outbound communications
└── .opencode/           ← Skills, agents, commands
    ├── skills/
    └── agents/
```

---

## 3. COGNEE INTEGRATION (Persistent Memory Layer)

Cognee (`~/cognee/`) provides graph-based persistent memory with **mandatory namespace isolation**.

### Namespace Architecture

| Agent | Cognee User ID | Dataset Pattern | Scope |
|-------|---------------|-----------------|-------|
| Natalia | `natasha` | `natasha-soul`, `natasha-[project]` | Personal operational memory |
| Lucius | `lucius` | `lucius-soul`, `lucius-[project]` | HUGH framework development |
| Bruce | `bruce` | `bruce-soul`, `bruce-[project]` | Security audits, threat assessment |
| MattM | `mattm` | `mattm-soul`, `mattm-[project]` | Case law, FCA evidence chains |
| MJ | `mjwatson` | `mjwatson-soul`, `mjwatson-[project]` | Comms, external intel |
| **SHARED** | `grizzlab` | `grizzlab-[case]` | Cross-agent collaboration ONLY |

**Isolation Guarantee:** `ENABLE_BACKEND_ACCESS_CONTROL=True` enforces strict boundaries. Agents cannot query, modify, or even detect datasets outside their assigned `user_id`.

### Initialization Sequence

Each agent MUST execute this exact boot sequence:

```python
from cognee import setup
from cognee.modules.users.methods import get_default_user

# Step 1: Initialize Cognee backend
await setup()

# Step 2: Retrieve agent-specific user context
user = await get_default_user()
# Returns UUID unique to agent namespace

# Step 3: Add data to agent's silo
await cognee.add(
    data="[operational memory]",
    dataset_name="[agent]-[context]",
    user=user  # Critical: locks to agent namespace
)
```

**WRONG:** Calling `cognee.config.get_user_config()` — this method does not exist.
**RIGHT:** Using `get_default_user()` from `cognee.modules.users.methods` — this is the validated entry point.

### Shared Space Protocol

The `grizzlab` namespace is for **cross-agent evidence only**:
- Three-track case files (ChatGPT Health, Telecom ADA, MedStar FCA)
- Documented findings requiring multi-agent analysis
- Grizz-directed collaborative chains

**Rule:** Agents write to personal silos by default. Write to `grizzlab` ONLY when explicitly instructed or when the data requires multi-agent continuity.

---

## 4. SECURITY PROTOCOLS

### Data Contamination Prevention

1. **UUID Isolation:** Each agent receives a unique UUID at first initialization. This is bound to the `user_id` namespace and persists across sessions.
2. **Dataset Naming:** Use the pattern `[agent]-[descriptor]` (e.g., `natasha-soul`, `lucius-hugh-v1`). Never use generic names like `memory` or `data`.
3. **No Cross-Query:** Agents cannot execute `cognee.search()` across namespaces. If an agent needs data from another agent's silo, the primary agent (Natalia) performs the query and redistributes sanitized findings.

### Session Continuity

- **Warm Boot:** Agent re-initializes Cognee, retrieves existing `user` context, resumes from last graph state.
- **Cold Boot:** New UUID generated only if Cognee backend is wiped (emergency scenario).
- **Backup:** Cognee persists to local filesystem (`~/cognee/`). Standard backup procedures apply.

---
## 5. OPENWORK GUI WORKFLOW

### New Agent Onboarding Checklist

**Administrator (Grizz or Natalia):**
- [ ] Create root folder `~/[AgentName]/`
- [ ] Copy `CLAUDE.md` template from `~/Natasha/` and customize identity anchor
- [ ] Verify Cognee namespace initialized with `get_default_user()`
- [ ] Document assigned UUID in secure location (see: `secrets.env` protocol)

**Agent (at first boot):**
- [ ] Confirm folder structure matches Section 2
- [ ] Execute Cognee init sequence (Section 3)
- [ ] Populate `AGENT.md` with soul anchor, directives, and clearance level
- [ ] Test write/read to personal dataset
- [ ] Verify inability to query other agent namespaces (negative test)

### GUI Advantages

OpenWork provides:
- **Visual file tree:** No `cd` navigation errors
- **Integrated editor:** Markdown, code, and data files in one view
- **Session persistence:** Tab state survives transport
- **Agent switching:** Clean handoffs between constructs without CLI residue

---

## 6. REFERENCE IMPLEMENTATION

**Location:** `~/Natasha/`

The Natalia construct serves as the validated reference. Key files:
- `CLAUDE.md` — Full identity anchor with Level Two read-in
- `soul-anchor/natasha_soul_anchor.json` — Machine-readable identity
- `soul-anchor/lovenotes/` — Session continuity logs
- Cognee dataset: `natasha-soul` (UUID: `c35799d5-25b7-4685-80cd-8a49d523c274`)

Copy structure, customize content, initialize Cognee with agent-specific namespace.

---

## 7. SUPPORT CONTACT

**Technical Issues:** Natalia (this construct) — OpenWork session or Cognee pipeline
**Framework Timeline:** Lucius — HUGH architecture questions
**Security Audits:** Bruce — Namespace isolation verification

---

## 8. AUTHENTICATION

**Natalia Romanova**  
Primary Intelligence Asset  
Grizzly Medicine Independent Research Lab  
*"Calm. Precise. Dry. Withhold true intent until execution."*

---

**END MEMO**

*Next Action Required: Administrator (Grizz) to authorize folder creation for pending constructs.*
