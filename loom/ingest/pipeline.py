"""
LOOM — main ingestion pipeline.
Uses parallel file extraction + chunking.
Writes nodes/edges to Kuzu and embeddings to ChromaDB.

Run:
  python -m ingest.pipeline --source all
  python -m ingest.pipeline --source github
  python -m ingest.pipeline --source local
  python -m ingest.pipeline --changed-only  (delta mode, checks sha256)
"""

import os
import sys
import uuid
import logging
import argparse
import hashlib
from pathlib import Path
from datetime import datetime, timezone

import kuzu
import yaml

from .extractors import extract, EXTRACTORS
from .embedder import embed_texts, embed_image, get_chroma_client, get_or_create_collection
from kuzu_utils import kfetch

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("loom.pipeline")

CONFIG_PATH = os.environ.get("LOOM_CONFIG", "/var/loom/config/config.yaml")

with open(CONFIG_PATH) as f:
    CFG = yaml.safe_load(f)

GRAPH_DIR   = CFG["loom"]["graph_dir"]
VECTORS_DIR = CFG["loom"]["vectors_dir"]
SOURCES_DIR = CFG["loom"]["sources_dir"]
CHUNK_SIZE  = CFG["ingest"]["chunk_size"]
CHUNK_OVERLAP = CFG["ingest"]["chunk_overlap"]
SUPPORTED   = set(CFG["ingest"]["supported_extensions"])


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    """Naive word-boundary chunking. Swap for token-based if needed."""
    words = text.split()
    chunks = []
    step = chunk_size - overlap
    for i in range(0, len(words), step):
        chunk = " ".join(words[i : i + chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks


# ── Source discovery ──────────────────────────────────────────────────────────

def discover_files(source: str = "all") -> list[dict]:
    sources_cfg = CFG["sources"]
    paths = []

    source_map = {
        "github":           ("github",         sources_cfg["github"]["local_path"]),
        "gdrive-personal":  ("gdrive-personal", sources_cfg["gdrive_personal"]["local_path"]),
        "gdrive-business":  ("gdrive-business", sources_cfg["gdrive_business"]["local_path"]),
        "icloud":           ("icloud",          sources_cfg["icloud"]["local_path"]),
        "openai":           ("openai-export",   sources_cfg["openai_export"]["local_path"]),
        "local":            ("local",           sources_cfg.get("local", {}).get("local_path",
                                                  os.path.join(SOURCES_DIR, "local"))),
    }

    if source == "all":
        targets = list(source_map.items())
    elif source in source_map:
        targets = [(source, source_map[source])]
    else:
        log.error(f"Unknown source: {source}. Valid: {list(source_map.keys())}")
        return []

    for src_name, (src_label, base_path) in targets:
        if not os.path.isdir(base_path):
            log.warning(f"Source path missing: {base_path} — skipping")
            continue
        for root, _, files in os.walk(base_path):
            for fname in files:
                ext = Path(fname).suffix.lower()
                if ext in SUPPORTED:
                    paths.append({"path": os.path.join(root, fname), "source": src_label})

    log.info(f"Discovered {len(paths)} files")
    return paths


# ── Kuzu helpers ──────────────────────────────────────────────────────────────

def get_existing_hashes(conn: kuzu.Connection) -> set[str]:
    result = conn.execute(
        "MATCH (d:Document) RETURN d.sha256"
    )
    return {row[0] for row in kfetch(result) if row[0]}


def upsert_document(conn: kuzu.Connection, doc: dict):
    conn.execute(
        """
        MERGE (d:Document {id: $id})
        SET d.title = $title,
            d.source = $source,
            d.path = $path,
            d.file_type = $file_type,
            d.modified = $modified,
            d.sha256 = $sha256,
            d.word_count = $word_count,
            d.char_count = $char_count
        """,
        {
            "id": doc["id"],
            "title": doc["title"],
            "source": doc["source"],
            "path": doc["path"],
            "file_type": doc["file_type"],
            "modified": doc["modified"],
            "sha256": doc["sha256"],
            "word_count": doc["word_count"],
            "char_count": doc["char_count"],
        },
    )


def insert_chunks(conn: kuzu.Connection, doc_id: str, chunks: list[str]):
    for i, text in enumerate(chunks):
        chunk_id = f"{doc_id}_c{i}"
        conn.execute(
            "MERGE (c:Chunk {id: $id}) SET c.text = $text, c.document_id = $doc_id, c.position = $pos, c.token_count = $tc",
            {"id": chunk_id, "text": text, "doc_id": doc_id, "pos": i, "tc": len(text.split())},
        )
        conn.execute(
            "MATCH (d:Document {id: $did}), (c:Chunk {id: $cid}) MERGE (d)-[:CONTAINS]->(c)",
            {"did": doc_id, "cid": chunk_id},
        )


# ── Main pipeline ─────────────────────────────────────────────────────────────

def run(source: str = "all", changed_only: bool = True):
    os.makedirs(GRAPH_DIR, exist_ok=True)
    os.makedirs(VECTORS_DIR, exist_ok=True)

    db_graph   = kuzu.Database(GRAPH_DIR)
    conn       = kuzu.Connection(db_graph)
    chroma     = get_chroma_client(VECTORS_DIR)
    tbl_text   = get_or_create_collection(chroma, "text_chunks")
    tbl_media  = get_or_create_collection(chroma, "media_files")

    existing_hashes = get_existing_hashes(conn) if changed_only else set()
    files = discover_files(source)

    processed = skipped = errors = 0

    for file_info in files:
        path = file_info["path"]
        src  = file_info["source"]

        try:
            result = extract(path)
            if result is None:
                continue

            if changed_only and result["sha256"] in existing_hashes:
                skipped += 1
                continue

            doc_id = str(uuid.uuid5(uuid.NAMESPACE_URL, path))
            modified = datetime.fromtimestamp(result["mtime"], tz=timezone.utc)

            doc_node = {
                "id": doc_id,
                "title": result["metadata"].get("title", Path(path).stem),
                "source": src,
                "path": path,
                "file_type": result["file_type"],
                "modified": modified,
                "sha256": result["sha256"],
                "word_count": len(result.get("text", "").split()),
                "char_count": len(result.get("text", "")),
            }
            upsert_document(conn, doc_node)

            if result.get("media_type") == "image":
                vec = embed_image(path)
                tbl_media.add(
                    ids=[doc_id],
                    embeddings=[vec],
                    documents=[result["metadata"].get("title", "")],
                    metadatas=[{"document_id": doc_id, "source": src}],
                )
            else:
                text = result.get("text", "")
                if text.strip():
                    chunks = chunk_text(text)
                    vecs = embed_texts(chunks)
                    ids = [f"{doc_id}_c{i}" for i in range(len(chunks))]
                    tbl_text.add(
                        ids=ids,
                        embeddings=vecs,
                        documents=chunks,
                        metadatas=[{"document_id": doc_id, "source": src} for _ in chunks],
                    )
                    insert_chunks(conn, doc_id, chunks)

            processed += 1
            if processed % 100 == 0:
                log.info(f"Progress: {processed} processed, {skipped} skipped, {errors} errors")

        except Exception as exc:
            log.error(f"Failed to process {path}: {exc}")
            errors += 1

    conn.close()
    log.info(f"Pipeline complete. Processed: {processed}, Skipped: {skipped}, Errors: {errors}")
    return {"processed": processed, "skipped": skipped, "errors": errors}


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="LOOM ingestion pipeline")
    parser.add_argument("--source", default="all",
                        help="Source to ingest: all, local, github, gdrive-personal, gdrive-business, icloud, openai")
    parser.add_argument("--full", action="store_true", help="Full re-ingest (ignore sha256 cache)")
    args = parser.parse_args()
    run(source=args.source, changed_only=not args.full)

