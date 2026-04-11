"""
LOOM — FastAPI query service.
Read-only. No mutations. API key gated. Rate limited.
Run: uvicorn api.main:app --host 0.0.0.0 --port 7777
"""

import os
import logging
from contextlib import asynccontextmanager

import kuzu
import yaml
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

from .routes import semantic, graph, search, entities
from ingest.embedder import get_chroma_client
from kuzu_utils import kfetch

log = logging.getLogger("loom.api")

CONFIG_PATH = os.environ.get("LOOM_CONFIG", "/var/loom/config/config.yaml")
with open(CONFIG_PATH) as f:
    CFG = yaml.safe_load(f)

LOOM_API_KEY = os.environ.get("LOOM_API_KEY", "")
if not LOOM_API_KEY:
    raise RuntimeError("LOOM_API_KEY env var not set")

limiter = Limiter(key_func=get_remote_address, default_limits=[CFG["api"]["rate_limit"]])


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.kuzu_conn  = kuzu.Connection(kuzu.Database(CFG["loom"]["graph_dir"]))
    app.state.chroma     = get_chroma_client(CFG["loom"]["vectors_dir"])
    app.state.cfg        = CFG
    log.info("LOOM query API online")
    yield
    app.state.kuzu_conn.close()
    log.info("LOOM query API shutdown")


app = FastAPI(title="LOOM Knowledge Graph API", version="1.0.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def verify_key(request: Request):
    key = request.headers.get("X-Loom-Key", "")
    if key != LOOM_API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")


@app.get("/health")
async def health(request: Request):
    return {
        "status": "online",
        "graph_dir": CFG["loom"]["graph_dir"],
        "vectors_dir": CFG["loom"]["vectors_dir"],
    }


@app.get("/stats")
async def stats(request: Request, _=Depends(verify_key)):
    conn = request.app.state.kuzu_conn
    counts = {}
    for table in ["Document", "Chunk", "Concept", "Person", "Project", "Tag", "MediaFile"]:
        result = kfetch(conn.execute(f"MATCH (n:{table}) RETURN count(n)"))
        counts[table] = result[0][0] if result else 0
    return {"node_counts": counts}


app.include_router(semantic.router, prefix="/query", dependencies=[Depends(verify_key)])
app.include_router(graph.router,    prefix="/query", dependencies=[Depends(verify_key)])
app.include_router(search.router,   prefix="/query", dependencies=[Depends(verify_key)])
app.include_router(entities.router, prefix="/query", dependencies=[Depends(verify_key)])
