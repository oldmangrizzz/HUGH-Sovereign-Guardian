"""
LOOM — file type extractors.
Each extractor takes a file path and returns a dict:
  { "text": str, "metadata": dict, "media_type": str|None }
"""

import os
import hashlib
from pathlib import Path


def sha256(path: str) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(65536), b""):
            h.update(chunk)
    return h.hexdigest()


def extract_pdf(path: str) -> dict:
    import fitz  # PyMuPDF
    doc = fitz.open(path)
    text = "\n".join(page.get_text() for page in doc)
    meta = doc.metadata or {}
    return {
        "text": text,
        "metadata": {
            "title": meta.get("title") or Path(path).stem,
            "author": meta.get("author", ""),
            "page_count": doc.page_count,
        },
        "media_type": None,
    }


def extract_text(path: str) -> dict:
    with open(path, "r", errors="replace") as f:
        text = f.read()
    return {
        "text": text,
        "metadata": {"title": Path(path).stem},
        "media_type": None,
    }


def extract_docx(path: str) -> dict:
    from docx import Document
    doc = Document(path)
    text = "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    return {
        "text": text,
        "metadata": {"title": Path(path).stem},
        "media_type": None,
    }


def extract_code(path: str) -> dict:
    with open(path, "r", errors="replace") as f:
        text = f.read()
    # Prepend path as context so embeddings know what codebase this is
    text = f"# File: {path}\n\n{text}"
    return {
        "text": text,
        "metadata": {"title": Path(path).name, "language": Path(path).suffix.lstrip(".")},
        "media_type": None,
    }


def extract_notebook(path: str) -> dict:
    import nbformat
    nb = nbformat.read(path, as_version=4)
    parts = []
    for cell in nb.cells:
        if cell.cell_type == "markdown":
            parts.append(cell.source)
        elif cell.cell_type == "code":
            parts.append(f"```python\n{cell.source}\n```")
    return {
        "text": "\n\n".join(parts),
        "metadata": {"title": Path(path).stem, "cell_count": len(nb.cells)},
        "media_type": None,
    }


def extract_spreadsheet(path: str) -> dict:
    import pandas as pd
    ext = Path(path).suffix.lower()
    if ext == ".csv":
        df = pd.read_csv(path, nrows=500)
    else:
        df = pd.read_excel(path, nrows=500)
    summary = f"Columns: {', '.join(str(c) for c in df.columns)}\nShape: {df.shape}\n\n"
    summary += df.head(20).to_string()
    return {
        "text": summary,
        "metadata": {"title": Path(path).stem, "rows": df.shape[0], "cols": df.shape[1]},
        "media_type": None,
    }


def extract_image(path: str) -> dict:
    """Returns stub — caption generated separately via CLIP/embedding endpoint."""
    return {
        "text": "",
        "metadata": {"title": Path(path).name},
        "media_type": "image",
        "image_path": path,
    }


EXTRACTORS = {
    ".pdf":   extract_pdf,
    ".md":    extract_text,
    ".txt":   extract_text,
    ".rst":   extract_text,
    ".docx":  extract_docx,
    ".py":    extract_code,
    ".ts":    extract_code,
    ".js":    extract_code,
    ".tsx":   extract_code,
    ".jsx":   extract_code,
    ".ipynb": extract_notebook,
    ".csv":   extract_spreadsheet,
    ".xlsx":  extract_spreadsheet,
    ".jpg":   extract_image,
    ".jpeg":  extract_image,
    ".png":   extract_image,
}


def extract(path: str) -> dict | None:
    ext = Path(path).suffix.lower()
    fn = EXTRACTORS.get(ext)
    if fn is None:
        return None
    result = fn(path)
    result["sha256"] = sha256(path)
    result["file_type"] = ext.lstrip(".")
    stat = os.stat(path)
    result["mtime"] = stat.st_mtime
    result["size"] = stat.st_size
    return result
