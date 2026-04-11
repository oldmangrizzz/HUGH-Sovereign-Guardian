# Basic Usage Examples

## Starting the server

```bash
python -m semantic_gravity_memory.api
```

Open http://localhost:8487 in your browser to see the 3D brain visualization.

## Python API

```python
from semantic_gravity_memory import Memory

# Initialize (auto-detects Ollama models)
mem = Memory()

# Ingest a memory
event_id, crystal_id = mem.ingest(
    "Semantic Gravity Memory uses gravitational retrieval to surface relevant memories.",
    actor="user",
    kind="note",
)

# Recall with a query
scene = mem.recall("How does retrieval work?")

# The scene contains activated memories ranked by gravitational pull
for crystal in scene["crystals"]:
    print(crystal["text"], "— importance:", crystal["importance"])

# Full answer pipeline (recall + chat + ingest response)
def my_chat_fn(prompt: str) -> str:
    # Replace with your LLM call
    return "This is a mock response."

answer, scene = mem.answer("What is semantic gravity?", chat_fn=my_chat_fn)
print(answer)

# Run consolidation (merge duplicates, decay stale memories)
log = mem.consolidate()
print(log)

# Close when done
mem.close()
```

## REST API

```bash
# Ingest
curl -X POST http://localhost:8487/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"text": "The quick brown fox jumps over the lazy dog.", "actor": "user"}'

# Recall
curl -X POST http://localhost:8487/api/recall \
  -H "Content-Type: application/json" \
  -d '{"query": "What did the fox do?"}'

# Streaming answer (SSE)
curl -N -X POST http://localhost:8487/api/answer/stream \
  -H "Content-Type: application/json" \
  -d '{"query": "Tell me about the fox."}'

# Stats
curl http://localhost:8487/api/stats

# Graph data (for custom visualizations)
curl http://localhost:8487/api/graph
```

## Using with Ollama (recommended)

```python
# With explicit models
mem = Memory(
    ollama_model="all-minilm",      # embedding model
    ollama_url="http://localhost:11434",
)
```

The server auto-detects available Ollama models. Preferred embed model: `all-minilm`.
Preferred chat models: `qwen`, `llama`, `gemma`, `mistral`, `deepseek`, `phi`, `lfm`.

## Without Ollama

```python
# Entity gateway + importance tier still work without embeddings
mem = Memory()  # no ollama_model
scene = mem.recall("query")  # slower, less precise, but functional
```
