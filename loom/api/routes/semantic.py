"""LOOM — semantic search route (ANN vector search via ChromaDB)."""

from fastapi import APIRouter, Request, Query
from pydantic import BaseModel
from typing import Optional, List

from ingest.embedder import embed_texts

router = APIRouter()

class SemanticQuery(BaseModel):
    q: str
    limit: int = 10
    sources: Optional[List[str]] = None


@router.post("/semantic")
async def semantic_search(body: SemanticQuery, request: Request):
    chroma = request.app.state.chroma
    cfg = request.app.state.cfg
    limit = min(body.limit, cfg["api"]["max_results"])

    vec = embed_texts([body.q])[0]

    where = {"source": {"$in": body.sources}} if body.sources else None
    tbl = chroma.get_or_create_collection("text_chunks")

    kwargs = dict(query_embeddings=[vec], n_results=limit)
    if where:
        kwargs["where"] = where

    results = tbl.query(**kwargs)

    ids       = results["ids"][0]
    docs      = results["documents"][0]
    metas     = results["metadatas"][0]
    distances = results["distances"][0]

    return {
        "query": body.q,
        "count": len(ids),
        "results": [
            {
                "id": ids[i],
                "document_id": metas[i].get("document_id", ""),
                "source": metas[i].get("source", ""),
                "text": docs[i],
                "score": round(1 - distances[i], 4),
            }
            for i in range(len(ids))
        ],
    }
