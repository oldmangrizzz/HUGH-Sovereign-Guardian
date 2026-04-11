"""LOOM — full-text keyword search route."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from kuzu_utils import kfetch
from fastapi import APIRouter, Request, Query
from typing import Optional

router = APIRouter()


@router.get("/search")
async def keyword_search(
    request: Request,
    q: str = Query(..., description="Search terms"),
    source: Optional[str] = Query(None, description="Filter by source"),
    file_type: Optional[str] = Query(None, description="Filter by file type"),
    limit: int = Query(20, le=100),
):
    conn = request.app.state.kuzu_conn

    where_clauses = ["toLower(d.title) CONTAINS toLower($q) OR toLower(c.text) CONTAINS toLower($q)"]
    params: dict = {"q": q}

    if source:
        where_clauses.append("d.source = $source")
        params["source"] = source
    if file_type:
        where_clauses.append("d.file_type = $file_type")
        params["file_type"] = file_type

    where_str = " AND ".join(where_clauses)

    cypher = f"""
        MATCH (d:Document)-[:CONTAINS]->(c:Chunk)
        WHERE {where_str}
        RETURN d.id, d.title, d.source, d.file_type, d.modified, c.text
        LIMIT {limit}
    """

    try:
        result = conn.execute(cypher, params)
        rows = kfetch(result)
    except Exception as exc:
        rows = []

    return {
        "query": q,
        "count": len(rows),
        "results": [
            {
                "document_id": r[0],
                "title": r[1],
                "source": r[2],
                "file_type": r[3],
                "modified": str(r[4]),
                "excerpt": r[5][:300] if r[5] else "",
            }
            for r in rows
        ],
    }
