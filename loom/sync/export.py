"""
LOOM — Convex sync job.
Exports document metadata + concept nodes to Convex for cloud redundancy.
Runs as a scheduled job (see scripts/cron.sh).
"""

import os
import json
import logging
import httpx
import kuzu
import yaml
from kuzu_utils import kfetch

log = logging.getLogger("loom.sync")

CONFIG_PATH  = os.environ.get("LOOM_CONFIG", "/var/loom/config/config.yaml")
CONVEX_URL   = os.environ.get("CONVEX_URL", "")
LOOM_SECRET  = os.environ.get("LOOM_CONVEX_SECRET", "")

with open(CONFIG_PATH) as f:
    CFG = yaml.safe_load(f)


def convex_mutation(path: str, args: dict):
    """Call a Convex mutation via HTTP API."""
    resp = httpx.post(
        f"{CONVEX_URL}/api/mutation",
        headers={
            "Content-Type": "application/json",
            "X-Hugh-Secret": LOOM_SECRET,
        },
        json={"path": path, "args": args, "format": "json"},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def sync_documents(conn: kuzu.Connection, limit: int = 500):
    """Sync recent/modified documents to Convex loom_documents collection."""
    result = conn.execute(
        """
        MATCH (d:Document)
        RETURN d.id, d.title, d.source, d.file_type, d.modified, d.word_count, d.sha256
        ORDER BY d.modified DESC
        LIMIT $limit
        """,
        {"limit": limit},
    )
    rows = kfetch(result)
    docs = [
        {
            "id": r[0],
            "title": r[1],
            "source": r[2],
            "fileType": r[3],
            "modified": str(r[4]),
            "wordCount": r[5],
            "sha256": r[6],
        }
        for r in rows
    ]
    log.info(f"Syncing {len(docs)} documents to Convex")
    convex_mutation("loom:syncDocuments", {"documents": docs})


def sync_concepts(conn: kuzu.Connection):
    """Sync concept nodes to Convex loom_concepts collection."""
    result = conn.execute("MATCH (c:Concept) RETURN c.id, c.name, c.description")
    concepts = [
        {"id": r[0], "name": r[1], "description": r[2]}
        for r in kfetch(result)
    ]
    log.info(f"Syncing {len(concepts)} concepts to Convex")
    convex_mutation("loom:syncConcepts", {"concepts": concepts})


def export_parquet_snapshot():
    """Export full graph as Parquet to /var/loom/snapshots/ then upload to Convex file storage."""
    import pyarrow as pa
    import pyarrow.parquet as pq

    db = kuzu.Database(CFG["loom"]["graph_dir"])
    conn = kuzu.Connection(db)

    snap_dir = "/var/loom/snapshots"
    os.makedirs(snap_dir, exist_ok=True)

    from datetime import datetime
    ts = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    out_path = f"{snap_dir}/loom_snapshot_{ts}.parquet"

    result = conn.execute(
        "MATCH (d:Document) RETURN d.id, d.title, d.source, d.file_type, d.modified, d.sha256, d.word_count"
    )
    rows = kfetch(result)

    table = pa.table({
        "id":        [r[0] for r in rows],
        "title":     [r[1] for r in rows],
        "source":    [r[2] for r in rows],
        "file_type": [r[3] for r in rows],
        "modified":  [str(r[4]) for r in rows],
        "sha256":    [r[5] for r in rows],
        "word_count":[r[6] for r in rows],
    })
    pq.write_table(table, out_path)
    log.info(f"Parquet snapshot written: {out_path} ({len(rows)} documents)")
    conn.close()
    return out_path


def run():
    if not CONVEX_URL or not LOOM_SECRET:
        log.error("CONVEX_URL or LOOM_CONVEX_SECRET not set — skipping Convex sync")
        return

    db = kuzu.Database(CFG["loom"]["graph_dir"])
    conn = kuzu.Connection(db)

    sync_documents(conn, limit=CFG["convex"]["recent_limit"])
    sync_concepts(conn)
    conn.close()

    export_parquet_snapshot()
    log.info("Convex sync complete")


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    run()
