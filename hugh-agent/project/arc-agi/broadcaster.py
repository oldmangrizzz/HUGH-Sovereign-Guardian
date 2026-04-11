#!/usr/bin/env python3
"""
HUGH ARC-AGI Broadcaster
WebSocket server that the harness pushes events to,
and the kiosk display listens from.

Usage:
    python broadcaster.py &
    then run:  python harness.py --broadcast

Port: 8765
"""

import asyncio
import json
import threading
import queue
import time
import logging
from typing import Optional

# Try websockets — install if missing: pip install websockets
try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    print("Installing websockets...")
    import subprocess, sys
    subprocess.check_call([sys.executable, "-m", "pip", "install", "websockets"])
    import websockets
    from websockets.server import WebSocketServerProtocol

logging.basicConfig(level=logging.INFO, format="%(asctime)s [BROADCAST] %(message)s")
log = logging.getLogger("broadcaster")

HOST = "localhost"
PORT = 8765

# ── Shared state ──────────────────────────────────────────────────────────────
_clients: set[WebSocketServerProtocol] = set()
_clients_lock = threading.Lock()
_queue: queue.Queue[str] = queue.Queue(maxsize=512)

# Module-level loop reference so emit() can schedule from any thread
_loop: Optional[asyncio.AbstractEventLoop] = None


# ── Public API (called from harness threads) ──────────────────────────────────

def emit(msg_type: str, payload) -> None:
    """Thread-safe: enqueue a message for broadcast to all display clients."""
    msg = json.dumps({"type": msg_type, "payload": payload})
    try:
        _queue.put_nowait(msg)
    except queue.Full:
        pass  # Drop oldest if backed up — display lag is acceptable


def emit_state(partial: dict) -> None:
    emit("state", partial)

def emit_event(text: str) -> None:
    emit("event", text)

def emit_score(score: float) -> None:
    emit("score", round(score, 4))

def emit_hypothesis(hypothesis: str, confidence: float, strategy: str) -> None:
    emit("hypothesis", {
        "hypothesis": hypothesis,
        "confidence": round(confidence, 3),
        "strategy": strategy,
    })

def emit_grid(grid: list[list[int]]) -> None:
    emit("grid", grid)

def emit_action(action: str) -> None:
    emit("state", {"action": action})

def emit_episode(episode: int, total: int, worker: str = "") -> None:
    emit("state", {"episode": episode, "totalEpisodes": total, "worker": worker})


# ── WebSocket server internals ────────────────────────────────────────────────

async def _handler(ws: WebSocketServerProtocol, _path: str) -> None:
    with _clients_lock:
        _clients.add(ws)
    log.info(f"Display connected: {ws.remote_address}  ({len(_clients)} total)")
    try:
        await ws.wait_closed()
    finally:
        with _clients_lock:
            _clients.discard(ws)
        log.info(f"Display disconnected: {ws.remote_address}  ({len(_clients)} remaining)")


async def _broadcaster() -> None:
    """Drain the queue and broadcast to all connected clients."""
    while True:
        # Collect everything available right now (non-blocking)
        messages = []
        while not _queue.empty():
            try:
                messages.append(_queue.get_nowait())
            except queue.Empty:
                break

        if messages:
            with _clients_lock:
                targets = list(_clients)
            if targets:
                # Broadcast last state + last event (deduplicate burst)
                # For simplicity send all; display handles duplicates gracefully
                for msg in messages:
                    dead = set()
                    for ws in targets:
                        try:
                            await ws.send(msg)
                        except Exception:
                            dead.add(ws)
                    if dead:
                        with _clients_lock:
                            _clients -= dead

        await asyncio.sleep(0.033)  # ~30 FPS cap


async def _main() -> None:
    global _loop
    _loop = asyncio.get_running_loop()
    log.info(f"HUGH Broadcaster starting on ws://{HOST}:{PORT}")
    async with websockets.serve(_handler, HOST, PORT):
        await asyncio.gather(_broadcaster())


def start_background() -> threading.Thread:
    """
    Start the broadcaster in a daemon background thread.
    Call this from harness.py before launching workers.
    Returns the thread (already started).
    """
    def _run():
        asyncio.run(_main())

    t = threading.Thread(target=_run, daemon=True, name="hugh-broadcaster")
    t.start()
    time.sleep(0.3)  # Give the loop a moment to start
    log.info("Broadcaster thread running")
    return t


if __name__ == "__main__":
    # Standalone mode: just run the server and demo-feed some data
    import random

    async def _demo():
        await asyncio.sleep(1.0)
        log.info("Sending demo data stream...")
        strategies = ["BFS_OPTIMAL", "HYPOTHESIS_FIRST", "RANDOM_WALK", "CENTER_FOCUS"]
        for ep in range(1, 401):
            emit_episode(ep, 400, random.choice(["W0-systematic", "W1-hypothesis", "W2-random", "W3-center"]))
            emit_event(f"Episode {ep} started")
            await asyncio.sleep(0.05)

            # Fake grid
            size = random.randint(3, 8)
            grid = [[random.randint(0, 9) for _ in range(size)] for _ in range(size)]
            emit_grid(grid)

            h = random.choice([
                "Pattern repeats with 2-cell offset",
                "Boundary cells mirror interior state",
                "Color substitution: 3→7 in target quadrant",
                "Rotation 90° clockwise applied to subgrid",
            ])
            emit_hypothesis(h, round(random.uniform(0.4, 0.98), 2), random.choice(strategies))

            score = min(100, ep * 0.25 + random.gauss(0, 1.5))
            emit_score(score)
            emit_action(random.choice(["MOVE_RIGHT", "MOVE_DOWN", "COLOR_3", "SUBMIT"]))
            emit_event(f"Episode {ep} complete — score {score:.2f}%")
            await asyncio.sleep(0.12)

    async def _main_demo():
        global _loop
        _loop = asyncio.get_running_loop()
        log.info(f"HUGH Broadcaster (demo mode) on ws://{HOST}:{PORT}")
        async with websockets.serve(_handler, HOST, PORT):
            await asyncio.gather(_broadcaster(), _demo())

    asyncio.run(_main_demo())
