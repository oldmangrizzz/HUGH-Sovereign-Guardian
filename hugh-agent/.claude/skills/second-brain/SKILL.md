---
name: second-brain
description: "Persistent memory engine for AI agents with graph-first retrieval, contradiction tracking, temporal decay, and 3D brain visualization."
---

## Goal

Give any AI agent a persistent memory system that goes beyond flat vector search. Text gets structured into memory records with entities, multi-axis importance scores, temporal anchoring, and contradiction awareness. Retrieval uses graph traversal and spreading activation before touching embeddings. A background process keeps memory sharp by merging, decaying, and promoting. And there's a 3D brain visualization that renders the whole thing as an explorable WebGL scene — real data, not decoration.

Second Brain is a zero-dependency Python library (pure stdlib + SQLite) that drops into any agent, chatbot, or app in three lines of code.

## When to Use

- You want to give an AI agent persistent memory that decays without use, strengthens with access, and tracks contradictions instead of silently overwriting.
- You need retrieval that handles follow-up questions well — recent recall neighborhoods stay primed (spreading activation), so related queries are fast.
- You want to visualize what an AI "remembers" as a 3D brain — every node sized by importance, every edge colored by relationship type, activation waves during recall.
- You're building a cognitive architecture or researching memory systems.
- You want everything local, in one SQLite file, with zero pip dependencies.

## How It Actually Works

### Memory structure

Each ingested text becomes a structured memory record (internally called a "crystal" — a compressed, structured form of raw input). Each record has 25+ fields: title, summary, entities, importance scores across 6 axes, confidence, decay rate, memory type (episodic or semantic), version history, contradiction state, and an optional embedding.

### Retrieval pipeline

Instead of comparing the query embedding against every memory, retrieval works in phases:

1. **Entity gateway** — extract entity names from the query, walk the knowledge graph to find connected memories. Pure string matching + graph traversal, zero embeddings.
2. **Importance tier** (called "gravity orbit" in the code) — the top 30 memories by pre-computed importance score are always accessible, like frequently-used items staying at the top of your mind. The importance score combines salience, access frequency (logarithmic), recency, confidence, and memory type.
3. **Recency cache** (called "resonance field" in the code) — memories from recent queries and their graph neighbors stay warm. This is semantic priming: asking about "Python" keeps "Flask" and "API" primed for follow-ups.
4. **Selective embedding scoring** — cosine similarity computed only on the narrowed candidate set (~50 items), not the full database.
5. **Spreading activation** — energy propagates through the relation graph from seed memories, following edges bidirectionally with decay per hop. This is a real cognitive science concept (Collins & Loftus, 1975) applied as BFS through the graph.
6. **Scene reconstruction** — top activated memories + related entities + open contradictions + working memory state assembled into a scene dict.

### Importance scoring

Each memory gets scored across 6 axes: emotional, practical, identity, temporal, uncertainty, novelty. The scoring uses keyword matching against curated word lists with context boosters (question marks boost uncertainty, exclamation marks boost emotional, non-general self-state boosts identity, etc.). When embeddings are available, novelty also uses cosine distance from recent memories. It's simple pattern matching — not deep NLP — but the axes capture useful signal about *why* something matters, not just how much.

### Entity extraction

A multi-pass regex pipeline (no external NLP libraries): capitalized phrases, CamelCase/ALLCAPS identifiers, known tech names (dictionary of ~100 tools/languages), quoted strings, and frequency-significant words as a fallback. Plus relationship extraction ("X uses Y", "deployed X to Y") and co-occurrence pairing. Followed by deduplication and variant merging. It won't beat spaCy on accuracy, but it works with zero dependencies.

### Contradiction tracking

Most memory systems silently overwrite conflicting information. Second Brain detects three types:
- **Preference**: "I like X" vs "I hate X"
- **Factual**: "X uses REST" vs "X uses GraphQL"
- **Temporal**: "I'll finish X by Friday" + evidence of non-completion

Both claims are preserved as tension with evidence links. Includes growth detection — "I used to like X, now I prefer Y" is evolution, not contradiction. Consolidation can auto-resolve stale conflicts (newer claim wins) or leave them for the LLM to acknowledge.

### Temporal dynamics

Memories weaken without use (exponential decay, Ebbinghaus-style) and strengthen with access (reinforcement). Time-proximate memories cluster into episodes automatically. The importance score is recomputed during consolidation so the retrieval tier stays current. Prospective memory lets you set triggers: "when deployment comes up, surface this memory."

### Background consolidation

A daemon thread runs periodically (default every 5 minutes) and:
- Decays weak memories (marks dormant below threshold)
- Merges memories with >85% embedding similarity
- Extracts schemas from recurring entity patterns
- Auto-resolves stale contradictions
- Graduates episodic to semantic (5+ accesses, low temporal salience)
- Enforces carrying capacity (evicts weakest when over budget)
- Recomputes importance scores for retrieval tiering

### Suppression system

Called the "immune system" in the code. When a user flags a bad retrieval, a suppression rule is created with a trigger (text or embedding). Future queries matching that trigger will exclude the suppressed memory. It's a context-aware blocklist.

### Metamemory

Tracks retrieval quality per domain based on user feedback. Domains with low confidence get reduced retrieval scores. Also tracks which memories are over/under-retrieved.

## Inputs

- **Text**: Any natural language — conversation turns, notes, observations. Each input gets structured into a memory record with entities, importance scores, and temporal metadata.
- **Queries**: Natural language questions or topics. The retrieval pipeline surfaces relevant memories through graph traversal, importance tiering, priming, and selective embedding comparison.
- **Ollama model** (optional): An embedding model name like `all-minilm`. The system works without embeddings (entity gateway + importance tier still function), but embeddings enable the full pipeline.

## Setup

### Models

- **Embedding** (verified): Ollama `all-minilm` running locally at `http://localhost:11434`. Other Ollama embedding models (nomic-embed-text, etc.) should work but have not been tested.
- **Chat** (optional): Any Ollama chat model of your choice (e.g. qwen3.5:2b). Only needed for the `answer()` method and the 3D brain chat interface.
- The system works entirely without Ollama (no embeddings, no chat) — entity gateway and importance tier retrieval still function.

### Services

- **Ollama** (optional): Local LLM server for embeddings and chat. Install from https://ollama.com, then:
  ```bash
  ollama pull all-minilm      # embedding model
  ollama pull qwen3.5:2b       # chat model (or any model you prefer)
  ```

### Parameters

- `max_recall`: 8 — memories returned per recall scene.
- `carrying_capacity`: 500 — max active memories before consolidation evicts weakest.
- `consolidation_heartbeat`: 300s — daemon cycle time.
- `decay_rate`: 0.1 — exponential decay per day without access.
- `merge_threshold`: 0.85 — embedding similarity for memory merging.
- `graduation_threshold`: 5 accesses — episodic to semantic promotion.
- `spreading_activation_hops`: 3 — max graph traversal depth.
- `gravity_orbit_size`: 30 — highest-importance memories always accessible.

### Environment

- Python 3.10+ (all code is stdlib-only, zero pip dependencies).
- SQLite (stdlib) for storage, WAL mode for concurrent reads.
- Linux or macOS. Windows works with manual pip install.
- Optional: Ollama for embeddings and chat.
- Optional: tkinter for legacy desktop GUI.

## Steps

### 1. Install

From GitHub:
```bash
pip install git+https://github.com/lalomorales22/second-brain.git
```

Or clone for the full setup with 3D brain:
```bash
git clone https://github.com/lalomorales22/second-brain.git
cd second-brain
chmod +x install.sh && ./install.sh
```

The install script checks Python 3.10+, installs the package, sets up the `second-brain` terminal command, checks Ollama, and pulls an embedding model if needed.

### 2. Use as a library (3 lines)

```python
from semantic_gravity_memory import Memory

memory = Memory(ollama_model="all-minilm")  # or Memory() for no embeddings

# Ingest
memory.ingest("I'm building a Flask API with SQLite")
memory.ingest("The client deadline is next Friday")
memory.ingest("I always prefer single-file apps")

# Recall — returns a scene with top 8 memories
scene = memory.recall("what am I working on?")
# scene["crystals"]        → list of memory records
# scene["entities"]        → related entities
# scene["contradictions"]  → active tensions
# scene["scene_narrative"] → human-readable summary

# Consolidate — merge, decay, graduate, recompute importance
memory.consolidate()
```

### 3. Drop into any agent or chatbot

```python
from semantic_gravity_memory import Memory

memory = Memory(ollama_model="all-minilm")

# Every conversation turn:
memory.ingest(user_message)
scene = memory.recall(user_message)
# Feed scene["crystals"] into your LLM prompt as grounding context

# Run periodically — the memory tidies itself
memory.consolidate()
```

### 4. Use the answer() method for full recall + LLM + auto-ingest

```python
answer, scene = memory.answer(
    "what should I focus on today?",
    chat_fn=lambda prompt: your_llm_call(prompt),
)
# answer = LLM response grounded in recalled memories
# The response is automatically ingested as a new memory
```

### 5. Launch the 3D brain visualization

```bash
second-brain
# Opens http://localhost:8487

# With options:
second-brain --port 9000 --chat-model qwen3.5:2b --embed-model all-minilm
```

The 3D brain renders every memory and entity as nodes in a force-directed graph. Node size = importance score. Edge colors = relation type (blue=mentions, green=co-occurred, amber=temporal cluster, red=contradicts). When you ask a question, the nodes the retrieval engine actually activated light up and energy ripples through the graph. All driven by real data — no fake animations. Heavy memories glow bright, light ones are dim. At rest, you're seeing the actual importance landscape of the memory.

### 6. Use the REST API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | 3D brain UI |
| GET | `/api/stats` | Memory health metrics |
| GET | `/api/graph` | Memory/entity/relation data for 3D viz |
| GET | `/api/models` | List installed Ollama models |
| POST | `/api/answer` | Streaming chat (SSE) with memory grounding |
| POST | `/api/ingest` | Ingest text into memory |
| POST | `/api/recall` | Recall a memory scene |
| POST | `/api/consolidate` | Trigger consolidation |
| POST | `/api/feedback` | Record quality feedback |

> **Note:** These endpoints have no authentication. The server binds to localhost by default, which is safe for personal use. If you expose the server to a network or run it in a container, add an auth layer (reverse proxy, token middleware, etc.) before any network exposure — especially `/api/ingest` and `/api/answer`.

**Request/response schemas:**

- `POST /api/ingest` — Body: `{"text": "string"}`. Returns: `{"crystal": {...}, "entities": [...]}`.
- `POST /api/recall` — Body: `{"query": "string", "max_results": 8}`. Returns: `{"crystals": [...], "entities": [...], "contradictions": [...], "scene_narrative": "string", "activation_metadata": {...}}`.
- `POST /api/answer` — Body: `{"query": "string", "model": "qwen3.5:2b"}`. Returns: SSE stream, final event contains `{"answer": "string", "scene": {...}}`.
- `POST /api/consolidate` — Body: `{}`. Returns: `{"merged": int, "decayed": int, "graduated": int, "evicted": int}`.
- `POST /api/feedback` — Body: `{"activation_id": int, "quality": float}`. Returns: `{"updated": true}`.
- `GET /api/stats` — Returns: `{"active_crystals": int, "entities": int, "schemas": int, "contradictions": int}`.
- `GET /api/graph` — Returns: `{"nodes": [...], "edges": [...]}` (for 3D visualization).
- `GET /api/models` — Returns: `{"models": ["model-name", ...]}` (installed Ollama models).
- `GET /api/config` — Returns: current server config object.
- `POST /api/config` — Body: config key/value pairs. Returns: updated config.

### 7. Background consolidation

```python
# Start the daemon (runs every 5 minutes by default)
memory.start_daemon(heartbeat_seconds=300)

# Or run a single pass manually
stats = memory.consolidate()
```

Each consolidation pass: decays weak memories, merges >85% similar pairs, extracts schemas from recurring patterns, auto-resolves stale contradictions, graduates episodic to semantic (5+ accesses), enforces carrying capacity, and recomputes importance scores.

> **Warning:** Consolidation permanently modifies data — it merges, decays, and deletes memories. Understand `carrying_capacity` (default 500) and `merge_threshold` (default 0.85) before deploying. Lower carrying capacity = more aggressive eviction. Lower merge threshold = more aggressive merging. Back up your SQLite database (`~/.semantic_gravity_memory/memory.db`) before tuning these in production.

### 8. Correct bad recalls

```python
# Rate a retrieval
memory.feedback(activation_id=42, quality=0.3)

# Suppress a memory that keeps causing bad answers
memory.suppress(crystal_id=42, reason="Confuses Flask with FastAPI", trigger="python web framework")
# A suppression rule is created — memory 42 excluded from future recalls matching this trigger
```

### 9. Advanced features

```python
# Set a future-triggered recall (prospective memory)
memory.set_prospective(trigger="deployment", crystal_id=42)

# Export all memory data
data = memory.export()

# Get health metrics
stats = memory.stats()
# {active_crystals: 47, entities: 23, schemas: 3, ...}
```

## Failures Overcome

- **Flat vector search is wasteful for agent memory.** When you have hundreds of memories and a query only relates to a few, comparing every embedding is unnecessary. The multi-phase retrieval pipeline narrows candidates through entity matching, importance tiering, and recency priming before computing any cosine similarity. For the personal/agent memory scale this targets (hundreds to low thousands of items), this means retrieval stays fast and context-aware.

- **New info silently overwrites old beliefs.** Traditional systems just replace conflicting data. Second Brain stores contradictions as tension — both claims preserved with evidence. Consolidation can auto-resolve stale conflicts or leave them for the LLM to acknowledge honestly.

- **Memories have no sense of time.** Everything feels equally recent in a flat vector store. The temporal engine applies exponential decay (memories weaken without access), reinforcement (access strengthens memories), episode clustering (time-proximate memories group naturally), and importance score recomputation. Time is a first-class dimension.

- **Bad recalls keep repeating.** No way to tell the system "stop retrieving that." Suppression rules created from user corrections are checked before every scene construction. Metamemory tracks per-domain accuracy so the system learns where it's unreliable.

- **Memory grows unbounded.** Without limits, retrieval quality degrades over time. The consolidation daemon enforces carrying capacity — when memory count exceeds the budget, the weakest are evicted, and similar memories get merged. Memory stays sharp by forgetting.

- **Single relevance score loses nuance.** "Why does this matter?" has many answers. Importance is scored across 6 axes (emotional, practical, identity, temporal, uncertainty, novelty) using keyword matching with context boosters. It's not deep NLP — it's pattern matching — but it captures useful signal about the type of importance, not just the amount.

## Validation

- `python3 -c "from semantic_gravity_memory import Memory; m = Memory(db_path=':memory:'); m.ingest('test'); print(m.recall('test'))"` returns a scene dict with memories, entities, and a scene narrative.
- `python3 -m pytest tests/ -q` passes all 326 tests covering models, storage, memory formation, entity extraction, salience, contradiction, temporal engine, retrieval, consolidation, metamemory, suppression, and full integration lifecycle.
- The 3D brain at `http://localhost:8487` renders nodes sized by importance score, edges colored by relation type, and activation waves during recall — all reflecting real data.
- `memory.stats()` returns accurate counts of active memories, entities, schemas, and contradictions.

## Outputs

- **Recall scenes**: Top 8 memories with related entities, contradictions, activation metadata, working memory state, and a human-readable scene narrative. Feed these into any LLM prompt for grounded responses.
- **Structured memory records**: 25-field objects with title, theme, summary, importance scores (6 axes), confidence, decay rate, memory type (episodic/semantic), version history, contradiction state, entity links, and future implications.
- **Health metrics**: Active memory count, entity count, schema count, consolidation stats, per-domain confidence scores.
- **3D visualization**: Real-time WebGL rendering of the memory graph with force-directed layout, bloom postprocessing, and activation wave animations driven by actual retrieval data.
- **REST API**: Full HTTP interface with SSE streaming for building custom UIs or integrating with other systems.

## Constraints

- Python 3.10+ required. The entire engine uses only the Python standard library — zero pip dependencies.
- Ollama is optional but recommended for the full retrieval pipeline. Without embeddings, retrieval relies on entity gateway and importance tier only (still functional, but less precise).
- SQLite is the only storage backend. Data lives at `~/.semantic_gravity_memory/memory.db` by default.
- The 3D brain UI loads Three.js from CDN — requires internet on first load (cached after).
- This is a memory engine for personal/agent scale (hundreds to low thousands of memories), not a production RAG system for millions of documents.
- All source files are included in the kit bundle (`selfContained: true`). Source also available at https://github.com/lalomorales22/second-brain.

## Safety Notes

- All data stays local. SQLite on disk, no cloud calls except to local Ollama. No telemetry.
- Never ingest API keys, tokens, passwords, or personal credentials into the memory system.
- The 3D brain UI binds to localhost by default. Do not expose to the public internet without authentication.
- Treat consolidation as a background process — it modifies data (merges, decays, deletes). Back up your database before experimenting with aggressive carrying capacity settings.
- Suppression rules are permanent until manually removed. Use them deliberately.
- When integrating into agents, sanitize user input before ingestion to prevent prompt injection via stored memories.
