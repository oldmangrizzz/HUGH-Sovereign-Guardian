"""LOOM — entity lookup route (node + 1-hop neighborhood)."""

import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from kuzu_utils import kfetch
from fastapi import APIRouter, Request, HTTPException, Path

router = APIRouter()


@router.get("/entity/{entity_id}")
async def get_entity(
    request: Request,
    entity_id: str = Path(..., description="Node ID to look up"),
):
    conn = request.app.state.kuzu_conn

    # Try each node type
    node_types = ["Document", "Concept", "Person", "Project", "Tag", "MediaFile"]
    node = None
    node_type = None

    for nt in node_types:
        try:
            result = conn.execute(
                f"MATCH (n:{nt} {{id: $id}}) RETURN n", {"id": entity_id}
            )
            rows = kfetch(result)
            if rows:
                node = rows[0][0]
                node_type = nt
                break
        except Exception:
            continue

    if node is None:
        raise HTTPException(status_code=404, detail=f"Entity {entity_id} not found")

    # 1-hop outbound
    try:
        out_result = conn.execute(
            "MATCH (n {id: $id})-[r]->(m) RETURN type(r), m.id, labels(m) LIMIT 50",
            {"id": entity_id},
        )
        outbound = [
            {"rel": row[0], "target_id": row[1], "target_type": row[2]}
            for row in kfetch(out_result)
        ]
    except Exception:
        outbound = []

    # 1-hop inbound
    try:
        in_result = conn.execute(
            "MATCH (m)-[r]->(n {id: $id}) RETURN type(r), m.id, labels(m) LIMIT 50",
            {"id": entity_id},
        )
        inbound = [
            {"rel": row[0], "source_id": row[1], "source_type": row[2]}
            for row in kfetch(in_result)
        ]
    except Exception:
        inbound = []

    return {
        "id": entity_id,
        "type": node_type,
        "node": node,
        "outbound": outbound,
        "inbound": inbound,
    }
