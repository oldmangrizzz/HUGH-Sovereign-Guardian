"""LOOM — graph query route (read-only Cypher via Kuzu)."""

import re
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from kuzu_utils import kfetch
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel

router = APIRouter()

# Whitelist: only MATCH/RETURN/WITH/WHERE/ORDER BY/LIMIT/SKIP allowed
ALLOWED_PATTERN = re.compile(
    r"^\s*(MATCH|OPTIONAL\s+MATCH|RETURN|WITH|WHERE|ORDER\s+BY|LIMIT|SKIP|CALL\s+show_tables)",
    re.IGNORECASE | re.MULTILINE,
)
BLOCKED_KEYWORDS = re.compile(
    r"\b(CREATE|DELETE|DETACH|MERGE|SET|REMOVE|DROP|ALTER|INSERT|UPDATE)\b",
    re.IGNORECASE,
)


class GraphQuery(BaseModel):
    cypher: str


def sanitize(cypher: str) -> str:
    if BLOCKED_KEYWORDS.search(cypher):
        raise HTTPException(status_code=400, detail="Mutation operations not permitted")
    return cypher.strip()


@router.post("/graph")
async def graph_query(body: GraphQuery, request: Request):
    conn = request.app.state.kuzu_conn
    cfg  = request.app.state.cfg

    cypher = sanitize(body.cypher)

    # Enforce result cap
    if "LIMIT" not in cypher.upper():
        cypher += f" LIMIT {cfg['api']['max_results']}"

    try:
        result = conn.execute(cypher)
        rows = kfetch(result)
        columns = result.get_column_names() if hasattr(result, "get_column_names") else []
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Query error: {exc}")

    return {
        "columns": columns,
        "count": len(rows),
        "rows": rows,
    }
