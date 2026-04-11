"""
LOOM — Kuzu graph schema initialization.
Run once on a fresh CT-115 install. Safe to re-run (checks existence first).
"""

import kuzu
import os
import yaml

def init_schema(db_path: str):
    db = kuzu.Database(db_path)
    conn = kuzu.Connection(db)

    node_tables = {
        "Document": """
            id STRING PRIMARY KEY,
            title STRING,
            source STRING,
            path STRING,
            file_type STRING,
            created TIMESTAMP,
            modified TIMESTAMP,
            sha256 STRING,
            word_count INT64,
            char_count INT64
        """,
        "Chunk": """
            id STRING PRIMARY KEY,
            text STRING,
            document_id STRING,
            position INT64,
            token_count INT64
        """,
        "Concept": """
            id STRING PRIMARY KEY,
            name STRING,
            description STRING
        """,
        "Person": """
            id STRING PRIMARY KEY,
            name STRING
        """,
        "Project": """
            id STRING PRIMARY KEY,
            name STRING,
            description STRING,
            status STRING
        """,
        "Tag": """
            id STRING PRIMARY KEY,
            name STRING
        """,
        "MediaFile": """
            id STRING PRIMARY KEY,
            path STRING,
            media_type STRING,
            caption STRING,
            source STRING
        """,
    }

    rel_tables = [
        ("CONTAINS",   "Document", "Chunk",    ""),
        ("CITES",       "Document", "Document", "context STRING"),
        ("MENTIONS",    "Document", "Concept",  "frequency INT64"),
        ("AUTHORED_BY", "Document", "Person",   ""),
        ("PART_OF",     "Document", "Project",  ""),
        ("TAGGED_WITH", "Document", "Tag",      ""),
        ("RELATED_TO",  "Concept",  "Concept",  "weight DOUBLE"),
        ("INCLUDES",    "Document", "MediaFile",""),
        ("SIMILAR_TO",  "Chunk",    "Chunk",    "score DOUBLE"),
        ("EXPLORES",    "Document", "Concept",  ""),   # for OpenAI chat export
        ("CONTRADICTS", "Document", "Document", "context STRING"),
        ("RETURNS_TO",  "Document", "Concept",  "count INT64"),
    ]

    result = conn.execute("CALL show_tables() RETURN name")
    existing = set()
    while result.has_next():
        row = result.get_next()
        existing.add(row[0])


    for name, cols in node_tables.items():
        if name not in existing:
            conn.execute(f"CREATE NODE TABLE {name} ({cols})")
            print(f"  [+] NODE TABLE {name}")
        else:
            print(f"  [=] NODE TABLE {name} already exists")

    for rel_name, src, dst, extra in rel_tables:
        if rel_name not in existing:
            extra_col = f", {extra}" if extra else ""
            conn.execute(f"CREATE REL TABLE {rel_name} (FROM {src} TO {dst}{extra_col})")
            print(f"  [+] REL TABLE {rel_name}")
        else:
            print(f"  [=] REL TABLE {rel_name} already exists")

    conn.close()
    print("\nSchema initialized.")


if __name__ == "__main__":
    import sys
    cfg_path = os.environ.get("LOOM_CONFIG", "/var/loom/config/config.yaml")
    with open(cfg_path) as f:
        cfg = yaml.safe_load(f)
    graph_dir = cfg["loom"]["graph_dir"]
    os.makedirs(graph_dir, exist_ok=True)
    print(f"Initializing Kuzu schema at {graph_dir}")
    init_schema(graph_dir)
