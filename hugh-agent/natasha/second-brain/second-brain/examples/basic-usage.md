# Basic Usage — Second Brain

## Minimal (no Ollama, no embeddings)

```python
from semantic_gravity_memory import Memory

memory = Memory(db_path=":memory:")
memory.ingest("I'm building a Flask API with SQLite")
memory.ingest("The client deadline is next Friday")
memory.ingest("I always prefer single-file apps")

scene = memory.recall("what am I working on?")
for crystal in scene["crystals"]:
    print(f"  {crystal.title} (importance={crystal.gravitational_mass:.2f})")
print(scene["scene_narrative"])
```

## With Ollama embeddings

```python
memory = Memory(ollama_model="all-minilm")
memory.ingest("I deployed the app to Docker with Postgres")
scene = memory.recall("what infrastructure am I using?")
```

## Agent integration (any chatbot/framework)

```python
from semantic_gravity_memory import Memory

memory = Memory(ollama_model="all-minilm")

def handle_message(user_message):
    memory.ingest(user_message)
    scene = memory.recall(user_message)

    # Build context from recalled memories
    context = "\n".join(
        f"- {c.title}: {c.summary}" for c in scene["crystals"]
    )

    # Feed into your LLM prompt
    prompt = f"Context from memory:\n{context}\n\nUser: {user_message}"
    response = your_llm_call(prompt)

    # Store the response as memory too
    memory.ingest(response, actor="assistant")
    return response
```

## Contradiction tracking

```python
memory.ingest("I like JavaScript")
memory.ingest("I hate JavaScript")

scene = memory.recall("JavaScript")
# scene["contradictions"] will contain the tension
# Both claims preserved — not silently overwritten
```

## Background consolidation

```python
# Auto-consolidate every 5 minutes
memory.start_daemon(heartbeat_seconds=300)

# Or run once manually
stats = memory.consolidate()
print(f"Merged: {stats.get('merged', 0)}")
print(f"Decayed: {stats.get('decayed', 0)}")
print(f"Graduated: {stats.get('graduated', 0)}")
```

## 3D Brain

```bash
# Launch the visualization
second-brain --chat-model qwen3.5:2b --port 8487
# Open http://localhost:8487
```
