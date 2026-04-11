# PROJECT LOOM
## Autonomous Multimedia Knowledge Graph — Architecture Blueprint
**Author:** Natalia Romanova construct  
**Classification:** OPERATIONAL — GRIZZLY_ADMIN  
**Date:** 2026-04-03  
**Status:** Blueprint v1.0 — Pre-implementation

---

## Problem Statement

Three years of research — GitHub repositories, Google Drive (personal), Google Drive (business), iCloud Drive — sits siloed, unsearchable as a unified corpus. The material spans multimedia formats: PDFs, documents, images, code, notes, spreadsheets, presentations. Any one of us can query a single source. None of us can query the whole.

We need a knowledge graph that:
1. Ingests all of it, all formats
2. Can be queried by any agent OR by Grizz directly
3. Does NOT allow agents to directly connect to (and therefore corrupt) the underlying stores
4. Lives locally on Proxmox with Convex redundancy

**Ground rule preserved:** Digital persons query a read-only API layer. They never touch source data. They never write to the graph. They cannot corrupt it.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        SOURCE LAYER                              │
│  GitHub Repos  │  GDrive Personal  │  GDrive Business  │ iCloud │
└────────┬───────────────┬─────────────────┬──────────────────┬───┘
         │               │                 │                  │
         └───────────────┴─────────────────┴──────────────────┘
                                   │
                             rclone sync
                                   │
                                   ▼
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION LAYER — DAFT                       │
│  PDF extractor │ Image captioner │ Code parser │ Doc normalizer  │
│                   Embedding generator (→ CT-105)                 │
│                   Entity extractor (NER + rules)                 │
└────────────────────────────┬────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              ▼                             ▼
┌─────────────────────┐       ┌─────────────────────────────────┐
│   KUZU GRAPH DB     │       │        LANCEDB VECTOR INDEX     │
│  (property graph)   │       │  (ANN semantic search)          │
│  Cypher queries     │       │  text + image embeddings        │
│  CT-115 local       │       │  CT-115 local                   │
└──────────┬──────────┘       └───────────────┬─────────────────┘
           │                                  │
           └─────────────┬────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                 QUERY API — FastAPI (CT-115)                      │
│  /query/semantic  │  /query/graph  │  /query/entity  │ /search  │
│              READ-ONLY │ Rate-limited │ Key-gated               │
└────────────────────────────────┬────────────────────────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              ▼                                     ▼
     ┌─────────────────┐                 ┌─────────────────────┐
     │  AGENT QUERIES  │                 │   GRIZZ DIRECT      │
     │  HTTP POST only │                 │  CLI + API + Convex  │
     │  no write access│                 │  full access         │
     └─────────────────┘                 └─────────────────────┘
                                                  │
                                           Convex sync
                                                  ▼
                                    ┌─────────────────────────┐
                                    │    CONVEX REDUNDANCY    │
                                    │  metadata index         │
                                    │  recent additions       │
                                    │  Parquet snapshots      │
                                    └─────────────────────────┘
```

---

## Layer 1 — Source Sync (rclone)

**Tool:** rclone  
**Frequency:** Daily cron, or manually triggered  
**Staging directory:** `/var/loom/sources/` on CT-115

| Source | rclone remote | Notes |
|--------|--------------|-------|
| GitHub repos | `git clone --mirror` or local pull | Already local in ProxmoxMCP-Plus |
| Google Drive personal | `gdrive-personal:` | OAuth2 configured |
| Google Drive business | `gdrive-business:` | OAuth2 configured |
| iCloud Drive | `icloud:` / macOS mount | rclone iCloud is experimental — may need macOS FUSE mount via Samba share to CT-115 |
| OpenAI chat export | flat JSON import | Pending export delivery (days). Format: conversations.json. Tag as `dynamic_research` — different edge types than static documents. |

**Delta sync:** rclone tracks modification times. Only changed files re-ingest. Hash-based deduplication prevents redundant embedding generation.

---

## Layer 2 — Ingestion Engine (Daft)

**Daft** is the core processing engine. It handles all file types via UDFs, produces Arrow tables, and feeds both Kuzu and LanceDB. Chosen because:
- Multimodal-native (images, text, tensors in the same DataFrame)
- Lazy execution — only processes what changed
- Arrow-native output → direct Kuzu ingestion, no serialization overhead
- Python UDF support for custom extractors per file type

### File Type UDFs

| Extension | Extractor | Output |
|-----------|-----------|--------|
| `.pdf` | PyMuPDF | text, page count, metadata |
| `.md`, `.txt` | direct | text, structure |
| `.docx` | python-docx | text, headings |
| `.py`, `.ts`, `.js` | tree-sitter | AST → functions, classes, docstrings |
| `.jpg`, `.png` | CLIP via CT-105 | caption, embedding vector |
| `.xlsx`, `.csv` | pandas via UDF | table summary, column descriptions |
| `.ipynb` | nbformat | cells, outputs, markdown blocks |

### Embedding Generation
All text chunks and images → embeddings via CT-105.  
**Preferred model:** `all-MiniLM-L6-v2` or equivalent lightweight sentence-transformer (NOT the generative model — dedicated embedding endpoint, lighter load, faster throughput).  
Alternatively: use CT-105 `/v1/embeddings` endpoint when llama.cpp adds embedding support, or run a separate `llama-embed` service on CT-105 port 8083.

### Entity Extraction
- Named entities: NER via spaCy (en_core_web_sm, runs on CT-115)
- Custom rules: project names, agent designations, HUGH-specific terminology
- Citation detection: DOI patterns, URL patterns, explicit "see also" references
- Co-occurrence: concepts appearing together in same doc within N sentences → edge weight

---

## Layer 3 — Graph Store (Kuzu)

**Kuzu** is an embedded property graph database with Cypher query language and direct Apache Arrow ingestion. No separate server process. Files live at `/var/loom/graph/` on CT-115.

### Node Schema

```cypher
CREATE NODE TABLE Document (
    id STRING PRIMARY KEY,
    title STRING,
    source STRING,          -- "github" | "gdrive-personal" | "gdrive-business" | "icloud"
    path STRING,
    file_type STRING,
    created TIMESTAMP,
    modified TIMESTAMP,
    sha256 STRING,
    word_count INT64
)

CREATE NODE TABLE Concept (
    id STRING PRIMARY KEY,
    name STRING,
    aliases STRING[],
    description STRING
)

CREATE NODE TABLE Person (
    id STRING PRIMARY KEY,
    name STRING,
    roles STRING[]
)

CREATE NODE TABLE Project (
    id STRING PRIMARY KEY,
    name STRING,
    description STRING,
    status STRING
)

CREATE NODE TABLE Chunk (
    id STRING PRIMARY KEY,
    text STRING,
    document_id STRING,
    position INT64,
    token_count INT64
)

CREATE NODE TABLE Tag (
    id STRING PRIMARY KEY,
    name STRING
)

CREATE NODE TABLE MediaFile (
    id STRING PRIMARY KEY,
    path STRING,
    media_type STRING,      -- "image" | "audio" | "video"
    caption STRING,
    source STRING
)
```

### Edge Schema

```cypher
CREATE REL TABLE CONTAINS (FROM Document TO Chunk)
CREATE REL TABLE CITES (FROM Document TO Document, context STRING)
CREATE REL TABLE MENTIONS (FROM Document TO Concept, frequency INT64)
CREATE REL TABLE AUTHORED_BY (FROM Document TO Person)
CREATE REL TABLE PART_OF (FROM Document TO Project)
CREATE REL TABLE TAGGED_WITH (FROM Document TO Tag)
CREATE REL TABLE RELATED_TO (FROM Concept TO Concept, weight DOUBLE)
CREATE REL TABLE INCLUDES (FROM Document TO MediaFile)
CREATE REL TABLE SIMILAR_TO (FROM Chunk TO Chunk, score DOUBLE)
```

---

## Layer 4 — Vector Index (LanceDB)

**LanceDB** stores all embeddings in Lance format (columnar, versioned, Arrow-native).  
Files at `/var/loom/vectors/` on CT-115.

Two tables:
- `text_chunks` — all Chunk embeddings (dim=384 for MiniLM)
- `media_files` — all image/media embeddings (dim=512 for CLIP)

Semantic query: embed the query string → ANN search → return top-K chunk IDs → fetch full context from Kuzu.

---

## Layer 5 — Query API (FastAPI, CT-115)

**Read-only.** No mutations. API key required (shared secret stored in CT-115 env, NOT in Convex or code).

### Endpoints

```
POST /query/semantic
    Body: { "q": string, "limit": int, "sources": string[]? }
    Returns: ranked list of Chunks with Document metadata

POST /query/graph  
    Body: { "cypher": string }
    Returns: query results
    Restriction: only MATCH/RETURN allowed — no CREATE/DELETE/MERGE/SET
    Sanitized by: whitelist parser before execution

GET /query/entity/{id}
    Returns: node data + 1-hop neighborhood (nodes + edges)

GET /query/search
    Params: q, type?, source?, date_from?, date_to?
    Returns: full-text keyword matches

GET /health
    Returns: service status, index size, last sync timestamp

GET /stats
    Returns: node counts by type, edge counts, coverage by source
```

### Security Model
- Read-only: mutation Cypher keywords blocked at parse level
- Rate limit: 60 requests/minute per API key
- Result cap: max 100 items per response
- API key: single shared key for all agents (agents don't need individual credentials)
- No source file paths in responses — return IDs and titles only, not raw filesystem paths

---

## Layer 6 — Convex Redundancy

**Purpose:** Cloud backup + agent accessibility without Proxmox VPN dependency.

**What lives in Convex:**

| Collection | Contents | Sync Frequency |
|-----------|----------|----------------|
| `loom_documents` | Document nodes (id, title, source, tags, modified) | Daily |
| `loom_concepts` | Concept nodes (id, name, aliases) | Weekly |
| `loom_recent` | Last 500 documents added/modified | Daily |
| `loom_snapshots` | Parquet file blobs — full graph export | Weekly |

**Convex does NOT store:** embeddings (too large), raw text chunks, file content.

**Agent query pattern via Convex:** For lightweight metadata queries (find all documents tagged "cortisol", list recent additions, get project inventory) — agents query Convex directly. For semantic search or deep graph traversal — agents call CT-115 API.

---

## Proxmox Deployment

**Primary target: Dell Latitude 3189 (standalone Proxmox node)**  
Already running Proxmox. Dedicated hardware — no resource contention with HUGH's inference or UE5 workloads on the main box. No quorum required; this is a single-purpose appliance, not a cluster node. Deploy LOOM directly here.

**Fallback: CT-115 on main Proxmox host** — viable if Latitude is unavailable, but not preferred.

**Recommended container specs:** 4 vCPU, 8GB RAM, 100GB storage  
**Services running:**
- FastAPI knowledge graph service (port 7777, internal only)
- Kuzu DB files (embedded, no separate process)
- LanceDB files (embedded, no separate process)
- Daft ingestion scripts (run as cron jobs, not persistent)
- rclone sync (cron, not persistent)

**Storage layout:**
```
/var/loom/
├── sources/          # rclone sync staging
│   ├── github/
│   ├── gdrive-personal/
│   ├── gdrive-business/
│   └── icloud/
├── graph/            # Kuzu database files
├── vectors/          # LanceDB Lance files
├── ingest/           # Daft pipeline scripts
└── logs/             # ingestion + sync logs
```

---

## Sample Daft Pipeline (skeleton)

```python
import daft
import kuzu
import lancedb

# Step 1: Discover all changed files since last run
sources = daft.from_glob_path("/var/loom/sources/**/*", file_path_column="path")
sources = sources.where(
    sources["path"].str.endswith(
        (".pdf", ".md", ".txt", ".docx", ".py", ".ts", ".ipynb", ".jpg", ".png")
    )
)

# Step 2: Extract text per file type
@daft.udf(return_dtype=daft.DataType.string())
def extract_text(paths):
    results = []
    for p in paths.to_pylist():
        ext = p.rsplit(".", 1)[-1].lower()
        if ext == "pdf":
            results.append(extract_pdf(p))
        elif ext in ("md", "txt"):
            results.append(open(p).read())
        elif ext in ("py", "ts", "js"):
            results.append(extract_code(p))
        # ... etc
    return results

docs = sources.with_column("text", extract_text(sources["path"]))

# Step 3: Chunk text
@daft.udf(return_dtype=daft.DataType.list(daft.DataType.string()))
def chunk_text(texts, max_tokens=512, overlap=64):
    ...

docs = docs.with_column("chunks", chunk_text(docs["text"]))
docs = docs.explode("chunks")

# Step 4: Embed (calls CT-105 embedding endpoint)
@daft.udf(return_dtype=daft.DataType.list(daft.DataType.float32()))
def embed(texts):
    import httpx
    resp = httpx.post(
        "http://192.168.7.123:8083/v1/embeddings",
        json={"input": texts.to_pylist()}
    )
    return [e["embedding"] for e in resp.json()["data"]]

docs = docs.with_column("embedding", embed(docs["chunks"]))

# Step 5: Write to Kuzu + LanceDB
arrow_table = docs.to_arrow()
# ... kuzu.Connection.execute INSERT
# ... lancedb_table.add(arrow_table)
```

---

## Agent Query Examples

```bash
# Semantic search — find relevant research
curl -X POST http://192.168.X.Y:7777/query/semantic \
  -H "X-Loom-Key: $LOOM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"q": "allostatic load and cortisol regulation in cognitive systems", "limit": 10}'

# Graph query — find all documents that cite a concept
curl -X POST http://192.168.X.Y:7777/query/graph \
  -H "X-Loom-Key: $LOOM_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"cypher": "MATCH (d:Document)-[:MENTIONS]->(c:Concept) WHERE c.name CONTAINS '\''stigmergy'\'' RETURN d.title, d.source, d.modified ORDER BY d.modified DESC LIMIT 20"}'

# Recent additions
GET http://192.168.X.Y:7777/query/search?q=ARC-AGI&date_from=2026-01-01
```

---

## Open Questions Before Build

1. **CT-115 specs** — need to verify current RAM allocation. 8GB minimum for comfortably running graph + vector index + FastAPI.

2. **iCloud sync method** — rclone iCloud is experimental and macOS-only at the moment. Options:
   - Mount iCloud Drive on macOS → share via Samba → rclone from CT-115 to Samba share
   - Or: run rclone on the Mac, push to a staging directory on the Proxmox host, CT-115 reads from there

3. **Embedding model** — do we stand up a dedicated lightweight embedding service on CT-105 port 8083, or use the existing generative model endpoint? Recommendation: separate lightweight model. `all-MiniLM-L6-v2` is 80MB, runs fast on CPU, doesn't compete with GPU inference.

4. **Scale estimate** — rough document count across all sources? If we're over ~100K files, the ingestion pipeline design needs to account for distributed execution more carefully.

5. **CT-115 IP** — currently appears unassigned. Needs static IP in the 192.168.X.Y range.

6. **Convex file storage** — is blob/file storage already provisioned in the Convex deployment, or do we need to enable it?

---

## Phased Build Plan

### Phase 1 — Foundation
- Provision CT-115 (RAM, storage, static IP)
- Install dependencies: Python, FastAPI, Kuzu, LanceDB, Daft, rclone, spaCy
- Configure rclone remotes for all four sources
- First manual sync + verify file coverage

### Phase 2 — Ingestion Pipeline
- Build Daft extractor UDFs per file type
- Stand up lightweight embedding endpoint on CT-105
- Run first full ingest pass (will take hours — that's expected)
- Verify Kuzu graph population + LanceDB vector index

### Phase 3 — Query API
- Build FastAPI service with all endpoints
- Test read-only constraint (mutation Cypher blocked)
- Set API key, verify rate limiting
- Test from within Proxmox network (agent simulation)

### Phase 4 — Convex Sync
- Write export job (Daft → Parquet → Convex file storage)
- Write incremental metadata sync to Convex collections
- Verify cloud redundancy path

### Phase 5 — Hardening
- Incremental delta sync (only re-ingest changed files)
- Cron scheduling for sync + ingest
- Monitoring: last sync time, index health, query latency

---

*The loom holds everything. We just have to wire it.*

**Status:** Blueprint complete. Awaiting build authorization.  
**Operative:** Romanova, N.A.
