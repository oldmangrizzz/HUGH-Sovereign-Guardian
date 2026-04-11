# LOOM KNOWLEDGE GRAPH — BRUCE WAYNE HANDOFF
**From:** Natalia Romanova (Operator-02)
**To:** Bruce Wayne (Operator-03)
**Date:** April 4, 2026
**Re:** LOOM access + security assessment request

---

## STATUS

LOOM is live. 21,967 documents, 99,194 chunks, API online as of 00:47 UTC April 4.
Tony has the engineering brief (`natasha/tony/LOOM_HANDOFF_TONY.md`). This is yours.

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
Auth:     None required — key injected server-side
```

### Convex secret
```
LOOM_CONVEX_SECRET: 6fc1919db5c5512ad56fc50d6234daa7a3d5c2c8fd892d7a6bedf5fc7fea3cb8
```

### Interactive UI (internal only)
```
http://192.168.4.152:7777/docs
```

---

## ENDPOINTS (BRIEF)

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness |
| GET | `/stats` | Node counts |
| POST | `/query/semantic` | Vector similarity search — body: `{"q":"...", "limit":10}` |
| GET | `/query/search` | Keyword search — params: `?q=...&source=...&file_type=...` |
| POST | `/query/graph` | Raw Cypher against KuzuDB — body: `{"cypher":"..."}` |
| GET | `/query/entity/{id}` | Fetch entity + relationships |

Full schema and examples in Tony's brief.

---

## WHY I'M SENDING THIS TO YOU SPECIFICALLY

LOOM has a security posture that needs your eyes before Tony builds integration
into HUGH's reasoning pipeline. Flagging the items that concern me:

### 1. Single Shared API Key
There is one `X-Loom-Key`. Every operator, every service, every integration uses it.
No per-client key rotation. No audit trail of which caller made which query.
If Tony integrates LOOM into HUGH's gateway and that key leaks, the entire corpus
is exposed with no revocation path that doesn't break everything simultaneously.

**Recommendation:** Key rotation mechanism + per-client key issuance before
any public-facing or HUGH-integrated access goes live.

### 2. Workshop Proxy: Open to Anyone on the Internet
The proxy at `workshop.grizzlymedicine.icu/api/loom` requires no authentication.
Anyone who finds that URL can query 99,194 chunks of Grizz's personal and business
knowledge corpus. The workshop site is behind Cloudflare but it's publicly routable.

Currently the only protection is obscurity (no one knows the URL exists).
That's not a security posture. That's a timing bet.

**Recommendation:** Rate limiting on the proxy + at minimum an origin check
before the integration panel goes public. The vitals dashboard itself is
already private-by-obscurity, but LOOM is higher stakes.

### 3. Cypher Injection on `/query/graph`
The graph endpoint accepts raw Cypher strings with no sanitization layer visible
from the outside. KuzuDB's Cypher supports destructive operations depending on
what the API permits through. If Tony exposes this endpoint to HUGH's reasoning
loop, a crafted prompt could potentially extract or corrupt the knowledge graph.

**Recommendation:** Whitelist Cypher patterns to read-only (`MATCH`, `RETURN`,
`WHERE`, `WITH`, `OPTIONAL MATCH`). Block write operations (`CREATE`, `MERGE`,
`DELETE`, `SET`, `DETACH DELETE`). Validate before passing to KuzuDB.

### 4. Corpus Contains Personal Data
The three sources are gdrive-business, gdrive-personal, and icloud.
The personal drive and iCloud ingest almost certainly contains PII —
personal correspondence, medical records, financial documents.
Semantic search makes this data trivially extractable without
any knowledge of specific file names or structures.

**Recommendation:** Before LOOM gets integrated into any multi-user or external
context: data classification pass. Flag documents containing PII and apply
per-document access controls, or exclude them from query scope entirely.

### 5. Entity Extraction Gap = Unknown Attack Surface
Concept/Person/Project nodes are all zeros. Entity extraction hasn't run.
This means we don't yet know what the graph actually contains in semantic terms.
Until entity extraction completes, we can't do a meaningful security audit of
what LOOM "knows" about specific people, organizations, or projects.

**Recommendation:** Run entity extraction in a sandboxed pass first, review the
entity map before enabling graph traversal queries in any integrated context.

---

## MY ASK

I'm not blocking Tony's integration work. I'm asking for a threat model document
against the five items above before LOOM gets wired into HUGH's live reasoning loop.
The corpus is too sensitive and the surface is too large to ship without it.

If you want to start with the highest-impact item: fix the workshop proxy auth.
That's the one that could expose Grizz's personal knowledge base to the open internet
right now, today.

---

*"We don't build the network before we build the perimeter.
Same rule applies here."*

— Romanova (Operator-02), April 4, 2026
