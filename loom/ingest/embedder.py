"""
LOOM — embedding client and vector store (ChromaDB).
Calls the lightweight embedding endpoint on CT-105 (port 8083).
Falls back to local sentence-transformers if endpoint unavailable.
"""

import httpx
import os
import logging
import chromadb
from typing import List

log = logging.getLogger("loom.embedder")

EMBED_ENDPOINT = os.environ.get("LOOM_EMBED_URL", "http://192.168.7.123:8083/v1/embeddings")
EMBED_MODEL    = os.environ.get("LOOM_EMBED_MODEL", "all-MiniLM-L6-v2")
EMBED_DIM      = 384
TIMEOUT        = 30

_local_model = None


def embed_texts(texts: List[str], batch_size: int = 64) -> List[List[float]]:
    """Embed a list of text strings. Returns list of float vectors."""
    all_embeddings = []
    # Skip remote endpoint if disabled, go straight to local model
    if EMBED_ENDPOINT.lower() in ("disabled", "none", ""):
        return _local_embed(texts)
    for i in range(0, len(texts), batch_size):
        batch = texts[i : i + batch_size]
        try:
            resp = httpx.post(
                EMBED_ENDPOINT,
                json={"model": EMBED_MODEL, "input": batch},
                timeout=TIMEOUT,
            )
            resp.raise_for_status()
            data = resp.json()["data"]
            all_embeddings.extend(e["embedding"] for e in sorted(data, key=lambda x: x["index"]))
        except Exception as exc:
            log.warning(f"Embedding endpoint failed ({exc}), falling back to local model")
            all_embeddings.extend(_local_embed(batch))
    return all_embeddings


def _local_embed(texts: List[str]) -> List[List[float]]:
    """Local fallback using sentence-transformers (CPU)."""
    global _local_model
    if _local_model is None:
        from sentence_transformers import SentenceTransformer
        _local_model = SentenceTransformer(EMBED_MODEL)
    return _local_model.encode(texts, normalize_embeddings=True).tolist()


def embed_image(image_path: str) -> List[float]:
    """Embed an image. Falls back to zero vector if endpoint unavailable."""
    try:
        import base64
        with open(image_path, "rb") as f:
            b64 = base64.b64encode(f.read()).decode()
        resp = httpx.post(
            EMBED_ENDPOINT.replace("/v1/embeddings", "/v1/embeddings/image"),
            json={"image_base64": b64},
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        return resp.json()["embedding"]
    except Exception as exc:
        log.warning(f"Image embedding failed ({exc}), returning zero vector")
        return [0.0] * 512


def get_chroma_client(vectors_dir: str) -> chromadb.PersistentClient:
    """Return a persistent ChromaDB client."""
    return chromadb.PersistentClient(path=vectors_dir)


def get_or_create_collection(client: chromadb.PersistentClient, name: str):
    """Get or create a ChromaDB collection."""
    return client.get_or_create_collection(
        name=name,
        metadata={"hnsw:space": "cosine"},
    )
