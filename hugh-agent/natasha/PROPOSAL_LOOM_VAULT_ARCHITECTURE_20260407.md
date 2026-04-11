# PROPOSAL: LOOM Knowledge Architecture & Sovereign Vault System
**Version:** 1.0.0  
**Date:** 2026-04-07  
**Prepared by:** NA_Romanova  
**For Review:** AS_Stark (Full Spec & Build)  
**Classification:** Internal — GrizzLab R&D

---

## Executive Summary

This proposal defines the architecture for GrizzLab's sovereign knowledge infrastructure — combining Obsidian-based agent vaults, a self-hosted Heaper media/file layer, and CRDT-based conflict-free sync across the Proxmox cluster. The goal is a future-proof, vendor-independent knowledge system that operates local-first, survives hardware failures, and scales with the lab's multi-agent architecture.

**Core principle borrowed from Jan Lunge's Heaper methodology:** Create first. Structure emerges. True ownership means self-hosted, local-first, CRDT-synced.

---

## 1. Problem Statement

The lab currently lacks a unified, sovereign knowledge layer. Research documents, agent logs, session artifacts, and build specs are scattered across:
- Individual markdown files with inconsistent naming (now partially standardized via `MEMO_FILE_NAMING_CONVENTION.md`)
- Git repo (commit history is not a knowledge graph)
- Agent session logs that aren't cross-referenced
- No persistent media management (photos, PDFs, large files)
- No conflict-free sync between workshop and loom nodes

The three-year triptych was assembled from this scattered state. That won't scale.

---

## 2. Proposed Architecture

### 2.1 The Stack

```
┌─────────────────────────────────────────────────────┐
│                  AGENT INTERFACES                   │
│   Natasha  │  Tony  │  Lucius  │  HUGH  │  Grizz   │
└──────────┬──────────────────────────────────────────┘
           │  reads/writes via MCP or filesystem
┌──────────▼──────────────────────────────────────────┐
│              OBSIDIAN VAULT LAYER (Notes)            │
│  Per-agent vaults + shared lab vault                │
│  Bottom-up linking | Tag/Mention discipline          │
│  Dataview queries | Unlinked view                   │
└──────────┬──────────────────────────────────────────┘
           │  CRDT sync (Yjs / Heaper sync server)
┌──────────▼──────────────────────────────────────────┐
│           HEAPER DOCKER LAYER (Media/Files)          │
│  Photos | PDFs | Large binaries | Research media    │
│  Local-first thumbnails | Auto-dedup by checksum    │
│  Self-hosted on Proxmox CT                          │
└──────────┬──────────────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────────────┐
│              PROXMOX STORAGE LAYER                   │
│  workshop (192.168.4.100) │ loom (192.168.4.151)    │
│  Replicated via Heaper sync server                  │
└─────────────────────────────────────────────────────┘
```

### 2.2 Vault Structure

One vault per agent. One shared lab vault. No vault talks directly to another — cross-references happen via mentions.

```
LOOM/
├── vaults/
│   ├── lab/              ← Shared lab knowledge (specs, proposals, blueprints)
│   ├── natasha/          ← Natasha's session logs, tactical notes, analysis
│   ├── tony/             ← Tony's build logs, specs, benchmark data
│   ├── lucius/           ← Lucius's construction loop logs, research
│   ├── hugh/             ← HUGH's operational memory, somatic state logs
│   └── grizz/            ← Grizz's personal notes, ideation, research intake
└── heaper/               ← Media/file layer (Docker, managed separately)
```

### 2.3 Obsidian Vault Conventions

**Tag vs. Mention discipline (hard rule):**

| Type | Syntax | Meaning | Example |
|------|--------|---------|---------|
| Tag | `#type/value` | IS / HAS (classification) | `#status/draft` `#agent/tony` |
| Mention | `[[NoteTitle]]` | CONTEXT (connection) | `[[PAPER_3_Aragon_Spec]]` |

Never use tags for connections. Never use mentions for classification.

**Tag taxonomy (seed set):**
```
#status/draft | #status/final | #status/archived
#type/spec | #type/log | #type/proposal | #type/memo | #type/research
#agent/natasha | #agent/tony | #agent/lucius | #agent/hugh
#phase/design | #phase/build | #phase/review | #phase/deployed
#priority/critical | #priority/high | #priority/normal
#domain/inference | #domain/memory | #domain/ethics | #domain/infra
```

**Bottom-up rule:** No folder creation required before writing a note. Write first, link and tag after. Structure is discovered, not imposed.

### 2.4 Obsidian Dataview Queries (Required Views)

Every vault must implement the following views as Dataview notes:

**1. Unlinked Inbox** — Everything orphaned, nothing connected yet. Primary curation queue.
```dataview
TABLE file.ctime AS Created
FROM ""
WHERE length(file.inlinks) = 0 AND length(file.outlinks) = 0
SORT file.ctime DESC
```

**2. Active Work** — All notes tagged `#status/draft` modified in last 14 days
```dataview
TABLE file.mtime AS "Last Modified", tags
FROM #status/draft
SORT file.mtime DESC
```

**3. Agent Cross-Reference** — All notes that mention a specific agent
```dataview
TABLE file.mtime AS Modified
FROM [[AgentName]]
SORT file.mtime DESC
```

**4. Domain Map** — Group all notes by `#domain/` tag
```dataview
TABLE tags, file.mtime AS Modified
FROM ""
WHERE contains(tags, "domain")
GROUP BY tags
SORT file.mtime DESC
```

### 2.5 Heaper Docker Layer

Self-hosted Heaper handles what Obsidian cannot: photos, PDFs, large binaries, research media, receipts, DSLR archives.

**Proposed CT:** New CT on workshop (192.168.4.100) — call it `CT-117 heaper-ws` or run on `CT-120 mark1-armor` if Tony approves sharing the node.

**Docker deploy (one command):**
```bash
docker run -d \
  --name heaper \
  -p 7700:7700 \
  -v /opt/heaper/data:/data \
  -v /opt/heaper/config:/config \
  --restart unless-stopped \
  heaper/server:latest
```

**Storage layout on host:**
```
/opt/heaper/
├── data/
│   ├── notes.sqlite          ← Local SQLite (notes)
│   ├── notes-backup.json     ← JSON backup
│   ├── media/                ← Full-res files
│   └── thumbs/               ← Device previews (SSD-backed)
└── config/
    └── heaper.yml
```

**Heap assignments:**
```
lab-media     ← Shared lab: diagrams, photos, PDFs
research      ← Research papers, arxiv downloads
ethics        ← The origin ethics.pdf + triptych media
personal      ← Grizz personal (private heap)
```

### 2.6 CRDT Sync Between Nodes

**Problem:** Obsidian files on workshop and loom can diverge if both nodes edit simultaneously. Git sync is not conflict-free.

**Solution:** Use Heaper's built-in Yjs-based CRDT sync server, or deploy a standalone [Yjs WebSocket server](https://github.com/yjs/y-websocket) as a Docker container.

**Sync topology:**
```
workshop (192.168.4.100) ←─── CRDT sync server ───→ loom (192.168.4.151)
         ↑                        (CT-117)                    ↑
    vault writes                                        vault writes
    merge automatically                              merge automatically
```

**Obsidian plugin required:** [obsidian-livesync](https://github.com/vrtmrz/obsidian-livesync) — open source, self-hosted CouchDB backend, battle-tested. This is the production-ready path for self-hosted Obsidian CRDT sync.

**Deploy CouchDB for livesync:**
```bash
docker run -d \
  --name couchdb-livesync \
  -p 5984:5984 \
  -e COUCHDB_USER=admin \
  -e COUCHDB_PASSWORD=<vault_from_secrets.env> \
  -v /opt/couchdb/data:/opt/couchdb/data \
  --restart unless-stopped \
  couchdb:3
```

---

## 3. Migration Plan

### Phase 1 — Vault Bootstrap (Tony → Spec & Build)
- [ ] Define final vault directory structure on LOOM
- [ ] Create Obsidian vault configs for each agent
- [ ] Write tag taxonomy as `_meta/TAXONOMY.md` in each vault
- [ ] Create 4 required Dataview views per vault

### Phase 2 — Sync Infrastructure
- [ ] Deploy CouchDB on workshop (new CT or existing CT)
- [ ] Configure obsidian-livesync plugin on all vault clients
- [ ] Test conflict resolution with simultaneous edits
- [ ] Verify sync reaches loom node

### Phase 3 — Heaper Media Layer
- [ ] Confirm CT assignment with Tony (new CT-117 or reuse existing)
- [ ] Deploy Heaper Docker on assigned CT
- [ ] Import existing PDFs, research papers from natasha/ into research heap
- [ ] Archive ethics.pdf origin document into ethics heap
- [ ] Assign media heap permissions per agent

### Phase 4 — Agent Integration
- [ ] Define MCP or filesystem bridge so agents can write to their vault
- [ ] HUGH somatic logs → `hugh/` vault automatically
- [ ] Lucius construction loop logs → `lucius/` vault at q6hr check-in
- [ ] Tony build logs → `tony/` vault on commit
- [ ] Natasha session summaries → `natasha/` vault at checkpoint

### Phase 5 — Verification
- [ ] Confirm Unlinked view shows orphaned notes
- [ ] Confirm CRDT sync resolves conflicts between workshop/loom
- [ ] Confirm Heaper deduplication catches duplicate PDFs
- [ ] Confirm tag/mention discipline holds across all agents (audit)

---

## 4. Hardware & Resource Requirements

| Component | Host | CT | Storage | RAM |
|-----------|------|----|---------|-----|
| CouchDB (livesync) | workshop | CT-117 (new) | 20GB | 512MB |
| Heaper server | workshop | CT-117 (shared) or CT-120 | 500GB+ | 1GB |
| Obsidian vaults (files) | workshop + loom | host filesystem | 10GB | — |

**Note:** CT-117 can run both CouchDB and Heaper in Docker on the same container (Debian 12 + Docker). Minimal resource footprint.

---

## 5. What This Is NOT

- Not a replacement for Git. Git stays as the code and document version control layer. LOOM is the knowledge graph layer.
- Not a replacement for Convex. Convex is HUGH's operational memory at runtime. Vaults are the persistent, human-readable record.
- Not a cloud dependency. Zero data leaves the lab perimeter except what Grizz explicitly publishes.

---

## 6. Open Questions for Tony (Spec & Build Review)

1. **CT assignment:** New CT-117 on workshop, or co-locate Heaper on CT-120 (mark1-armor)? Recommend new CT for clean isolation.
2. **CouchDB auth:** Use `secrets.env` vault password or generate a dedicated livesync credential?
3. **Vault client access:** Should agents access vaults via filesystem mount (direct) or through an MCP bridge (abstracted)? Filesystem is simpler; MCP bridge allows audit logging.
4. **Lucius vault write path:** During 8-week construction loop, does Lucius write directly to his vault, or does a check-in script handle the transfer?
5. **ethics.pdf archive:** Confirm Grizz wants the Nov 2023 GPT-3.5 origin document formally archived into the ethics heap. This is the document that started everything — it should be preserved.
6. **Heaper licensing:** Offline tier is free with no account. Hosted sync requires subscription. Self-hosting is free up to 50GB, one-time license for more. Tony to confirm storage estimate before provisioning.

---

## 7. References

- Heaper project: https://heaper.de | Self-host docs: https://docs.heaper.de/docs/self-hosting
- Yjs CRDT: https://yjs.dev/
- obsidian-livesync: https://github.com/vrtmrz/obsidian-livesync
- Linking Your Thinking (Nick Milo): https://www.youtube.com/@linkingyourthinking
- Source video: https://youtu.be/Nd_v_3CcVno (Jan Lunge — "Folders Are Broken, So I Built Heaper")
- GrizzLab naming convention: `MEMO_FILE_NAMING_CONVENTION.md`
- Active build spec: `Digital-Person-Hypothesis-final/PAPER_3_THE_SOLUTION_Aragon_Class_Definitive_Spec.md`

---

*Prepared by NA_Romanova | 2026-04-07 | GrizzLab — Not for external distribution*
