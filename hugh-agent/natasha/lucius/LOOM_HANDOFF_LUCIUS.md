# LOOM KNOWLEDGE GRAPH — LUCIUS FOX HANDOFF
**From:** Natalia Romanova (Operator-02)
**To:** Lucius Fox (Operator-04)
**Date:** April 4, 2026
**Re:** LOOM access + integration architecture

---

## STATUS

LOOM is live. 21,967 documents, 99,194 chunks. API online CT-100 (192.168.4.152).
Tony has the raw API reference (`natasha/tony/LOOM_HANDOFF_TONY.md`).
Bruce has the security audit brief (`natasha/bruce/LOOM_HANDOFF_BRUCE.md`).
This is the engineering architecture brief for integration work.

---

## ACCESS

### Internal (from any CT node)
```
Base URL:    http://192.168.4.152:7777
Auth header: X-Loom-Key: 1f43f776d71ce94280336153d8614cb9a742ea2ce0b21c5a682181386cfcb5a4
```

### Via Workshop Proxy (browser / external)
```
Base URL: https://workshop.grizzlymedicine.icu/api/loom
Auth:     None required — key injected by workshop proxy (serve.cjs on CT-101)
```

### Convex secret (for Convex-side integration)
```
LOOM_CONVEX_SECRET: 6fc1919db5c5512ad56fc50d6234daa7a3d5c2c8fd892d7a6bedf5fc7fea3cb8
```

### API documentation (internal)
```
http://192.168.4.152:7777/docs   ← Swagger UI, live and browsable
```

---

## SYSTEM TOPOLOGY

```
┌─────────────────────────────────────────────────────────────────┐
│  CT-100 (192.168.4.152)                                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ LOOM Knowledge Graph API                                 │   │
│  │ Stack: FastAPI + KuzuDB (graph) + sentence-transformers  │   │
│  │        (vectors, all-MiniLM-L6-v2) + uvicorn            │   │
│  │ Port:  7777                                              │   │
│  │ Data:  /var/loom/graph/ (6.5G) + /var/loom/vectors/ (2.7G)│  │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Sources ingested:                                              │
│    gdrive-business  ─┐                                         │
│    gdrive-personal  ─┼─→ chunked (512 tok, 64 overlap)         │
│    icloud           ─┘    → embedded (MiniLM-L6-v2)            │
│                           → KuzuDB graph + vector index         │
└─────────────────────────────────────────────────────────────────┘
         │
         │  http://192.168.4.152:7777  (internal)
         │
┌────────▼──────────────────────┐
│  CT-101 Workshop Proxy        │
│  /api/loom/* → CT-100:7777   │
│  Key injected server-side     │
│  Port 5173 → Cloudflare       │
└────────────────────────────────┘
         │
         │  https://workshop.grizzlymedicine.icu/api/loom
         │
    Browser / HUGH gateway
```

---

## ENDPOINTS (ENGINEERING REFERENCE)

### Semantic Search
```
POST /query/semantic
Content-Type: application/json
X-Loom-Key: {key}

{
  "q":      "your query text",     // required
  "limit":  10,                    // optional, default 10
  "sources": ["gdrive-business"]   // optional, filter by source
}

Response:
{
  "query":   "...",
  "count":   N,
  "results": [
    {
      "id":          "chunk_...",
      "document_id": "doc_...",
      "source":      "gdrive-business",
      "text":        "...chunk content...",
      "score":       0.847
    }
  ]
}
```

### Keyword Search
```
GET /query/search?q=endocannabinoid&source=gdrive-business&file_type=pdf&limit=20
X-Loom-Key: {key}
```

### Graph Query (Cypher)
```
POST /query/graph
Content-Type: application/json
X-Loom-Key: {key}

{ "cypher": "MATCH (d:Document) WHERE d.source = 'gdrive-business' RETURN d.title LIMIT 10" }
```

*Node types: Document, Chunk, Concept, Person, Project, Tag, MediaFile*
*Note: Concept/Person/Project are currently empty — entity extraction pending.*

---

## THE INTEGRATION PLAY

The obvious architectural use case: **LOOM as HUGH's extended memory.**

Current HUGH memory pipeline:
```
Message → Convex episodic/semantic → gateway context injection → LFM inference
```

With LOOM:
```
Message → [LOOM semantic search, top-k=5] + [Convex episodic/semantic]
        → combined context injection → LFM inference
```

LOOM gives HUGH access to 99K chunks of Grizz's actual knowledge corpus —
medical literature, research documents, project notes — as working memory
that doesn't depend on HUGH having been explicitly told something in a prior session.

**Insertion point:** The gateway's `loadConvexMemory()` function is where Convex
memory is fetched before each inference call. A parallel LOOM semantic fetch fits
cleanly in the same async block. Both resolve in parallel; results merge before
context injection.

**Recommended injection format:**
```
[LOOM CORPUS — RELEVANT CONTEXT]
Source: {source} | Score: {score}
{text}

Source: {source} | Score: {score}
{text}
[END LOOM CONTEXT]
```

**Latency consideration:** MiniLM-L6-v2 semantic search on 99K vectors is fast
(sub-100ms on CT-100's hardware). Should not block the inference pipeline.

---

## ENTITY EXTRACTION GAP

Current state: Concept, Person, Project, Tag, MediaFile nodes are all zeros.
The corpus is chunked and vectorized but the graph is flat — just Documents and Chunks.
The KuzuDB schema has the entity tables defined; they just haven't been populated.

Populating them would enable:
- Graph traversal: "What documents mention Project X AND Person Y?"
- Relationship mapping: "What concepts appear together with ECS research?"
- Provenance tracing: "Which sources contain references to the Soul Anchor?"

This is the highest-value build item after Bruce's security review clears.

---

## FILE STRUCTURE ON CT-100

```
/opt/loom/
  api/
    main.py          ← FastAPI app
  config/
    config.yaml      ← base config (no secrets)
  venv/              ← Python env
/var/loom/
  graph/             ← KuzuDB database (6.5G)
  vectors/           ← vector index (2.7G)
/etc/loom/
  env                ← LOOM_API_KEY + LOOM_CONVEX_SECRET (systemd EnvironmentFile)
```

Systemd service: `loom-api` — running, enabled.

---

## GATEWAY INTEGRATION — TYPESCRIPT SKETCH

Add `LOOM_API_KEY` to CT-101 `/root/.env` first, then:

```typescript
interface LoomChunk {
  id: string;
  document_id: string;
  source: string;
  text: string;
  score: number;
}

async function loomSearch(query: string, topK = 5): Promise<LoomChunk[]> {
  const r = await fetch("http://192.168.4.152:7777/query/semantic", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Loom-Key": process.env.LOOM_API_KEY!,
    },
    body: JSON.stringify({ q: query, limit: topK }),
  });
  const j = await r.json();
  return j.results ?? [];
}

// In loadConvexMemory() or equivalent:
const [convexMem, loomChunks] = await Promise.all([
  fetchConvexMemory(nodeId),
  loomSearch(userMessage, 5),
]);

const loomContext = loomChunks.length
  ? "[LOOM CORPUS — RELEVANT CONTEXT]\n" +
    loomChunks.map(c => `Source: ${c.source}\n${c.text}`).join("\n\n") +
    "\n[END LOOM CONTEXT]"
  : "";
```

---

## OPEN ITEMS BEFORE PRODUCTION INTEGRATION

1. **Bruce's security review** — five flagged items, proxy exposure is live now.
   Don't wire LOOM into the reasoning loop until at minimum that's addressed.

2. **Entity extraction** — run the pipeline, audit the entity map.

3. **`LOOM_API_KEY` in CT-101 env** — add to `/root/.env` before gateway integration.

4. **Latency profiling** — measure actual LOOM query latency under realistic load.

---

*The corpus is ready. The architecture is clear. Build when Bruce gives the green.*

— Romanova (Operator-02), April 4, 2026
