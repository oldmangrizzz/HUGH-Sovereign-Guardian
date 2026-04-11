"""Semantic Gravity Memory — persistent memory engine for AI agents.

Public API surface::

    from semantic_gravity_memory import Memory

    mem = Memory()
    mem.ingest("The sky is blue.", actor="user")
    scene = mem.recall("What colour is the sky?")
    answer, scene = mem.answer("What colour is the sky?", chat_fn=my_llm)
    mem.close()

Everything else (engine, storage, embeddings, models) is internal.  Import
``Memory`` and use it; don't reach into submodules unless you need the
advanced API.
"""
from __future__ import annotations

import os
from typing import Any, Callable, Dict, List, Optional, Tuple

from semantic_gravity_memory.models import (
    Activation,
    AntibodyMemory,
    Crystal,
    Contradiction,
    Entity,
    Event,
    ProspectiveMemory,
    Relation,
    SalienceVector,
    Schema,
)
from semantic_gravity_memory.storage.sqlite_backend import SQLiteBackend
from semantic_gravity_memory.embeddings.ollama import OllamaEmbedder
from semantic_gravity_memory.core.engine import MemoryEngine

__version__ = "0.1.0"

_DEFAULT_DIR = os.path.join(os.path.expanduser("~"), ".semantic_gravity_memory")
_DEFAULT_DB = os.path.join(_DEFAULT_DIR, "memory.db")


class Memory:
    """One-line entry point for the Semantic Gravity Memory engine.

    Parameters
    ----------
    db_path:
        Path to the SQLite database.  Defaults to
        ``~/.semantic_gravity_memory/memory.db``.
    ollama_model:
        Name of the Ollama embedding model (e.g. ``"all-minilm"``).
        When *None* (default) the engine runs without embeddings — retrieval
        still works via entity gateway and importance tier.
    ollama_url:
        Base URL for the local Ollama server.  Defaults to
        ``http://localhost:11434``.
    carrying_capacity:
        Maximum number of active crystals before consolidation trims the
        weakest.  Defaults to 2000.
    daemon_interval:
        Seconds between automatic background consolidation passes.
        Set to 0 to disable the daemon.  Defaults to 300 (5 min).
    """

    def __init__(
        self,
        db_path: Optional[str] = None,
        ollama_model: Optional[str] = None,
        ollama_url: str = "http://localhost:11434",
        carrying_capacity: int = 2000,
        daemon_interval: int = 300,
    ) -> None:
        if db_path is None:
            os.makedirs(_DEFAULT_DIR, exist_ok=True)
            db_path = _DEFAULT_DB

        embedder: Optional[OllamaEmbedder] = None
        if ollama_model:
            embedder = OllamaEmbedder(model=ollama_model, url=ollama_url)

        self._storage = SQLiteBackend(db_path)
        self._engine = MemoryEngine(
            storage=self._storage,
            embedder=embedder,
            carrying_capacity=carrying_capacity,
            daemon_interval=daemon_interval,
        )

    # ----- Core API ----------------------------------------------------------

    def ingest(
        self,
        text: str,
        actor: str = "user",
        kind: str = "chat_message",
        context: Optional[Dict[str, Any]] = None,
        now_ts: Optional[str] = None,
    ) -> Tuple[int, int]:
        """Store *text* as a new event and update/create the matching crystal.

        Returns ``(event_id, crystal_id)``.
        """
        return self._engine.ingest(text, actor, kind, context, now_ts)

    def recall(
        self,
        query: str,
        self_state: Optional[str] = None,
        now_ts: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Return a *scene* — the gravitationally ranked memory landscape for
        *query*.

        The scene dict contains:

        * ``crystals`` — list of activated crystal dicts, highest pull first
        * ``entities`` — relevant entity nodes
        * ``schemas`` — matching schema templates
        * ``prospective`` — pending intentions/reminders
        * ``antibody`` — suppressed patterns to avoid
        * ``contradictions`` — open contradictions related to the query
        * ``activation_id`` — ID for :meth:`feedback`
        """
        return self._engine.recall(query, self_state, now_ts)

    def answer(
        self,
        query: str,
        chat_fn: Callable[[str], str],
        self_state: Optional[str] = None,
        now_ts: Optional[str] = None,
    ) -> Tuple[str, Dict[str, Any]]:
        """Recall → call *chat_fn* with grounded prompt → ingest response.

        Returns ``(answer_text, scene)``.
        """
        return self._engine.answer(query, chat_fn, self_state, now_ts)

    # ----- Consolidation --------------------------------------------

    def consolidate(self, now_ts: Optional[str] = None) -> Dict[str, Any]:
        """Run a single consolidation pass. Returns a log dict."""
        return self._engine.consolidate(now_ts)

    def start_daemon(self, interval: Optional[int] = None) -> None:
        """Start the background consolidation daemon thread."""
        self._engine.start_daemon(interval)

    def stop_daemon(self) -> None:
        """Stop the background consolidation daemon thread."""
        self._engine.stop_daemon()

    # ----- Feedback & control ----------------------------------------

    def feedback(
        self,
        activation_id: int,
        quality: float,
        self_state: str = "general",
    ) -> None:
        """Reinforce or penalise memories from a prior :meth:`recall`.

        *quality* should be in ``[0.0, 1.0]``; values above 0.5 strengthen,
        below weaken.
        """
        self._engine.feedback(activation_id, quality, self_state)

    def set_prospective(
        self,
        text: str,
        trigger: str,
        priority: float = 0.5,
        expires_ts: Optional[str] = None,
    ) -> int:
        """Register a prospective memory (intention/reminder).

        Returns the new prospective memory ID.
        """
        return self._engine.set_prospective(text, trigger, priority, expires_ts)

    def suppress(self, pattern: str, reason: str = "") -> int:
        """Add a suppression rule (antibody) for *pattern*.

        Returns the new antibody ID.
        """
        return self._engine.suppress(pattern, reason)

    # ----- Inspection ------------------------------------------------

    def stats(self) -> Dict[str, Any]:
        """Return engine statistics (crystal counts, entity counts, etc.)."""
        return self._engine.stats()

    def export(self) -> Dict[str, Any]:
        """Export the full memory store as a JSON-serialisable dict."""
        return self._engine.export()

    # ----- Lifecycle ---------------------------------------------------------

    def close(self) -> None:
        """Shut down daemon and close database connection."""
        self._engine.stop_daemon()
        self._storage.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()

    def __repr__(self) -> str:
        s = self._engine.stats()
        return (
            f"<Memory crystals={s['active_crystals']} "
            f"entities={s['total_entities']} "
            f"schemas={s['schemas']}>"
        )


__all__ = [
    # Public API
    "Memory",
    # Models
    "SalienceVector",
    "Event",
    "Entity",
    "Crystal",
    "Relation",
    "Contradiction",
    "Activation",
    "ProspectiveMemory",
    "Schema",
    "AntibodyMemory",
    # Backends
    "SQLiteBackend",
    "OllamaEmbedder",
    # Engine (for advanced use)
    "MemoryEngine",
]
