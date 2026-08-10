"""Filesystem watcher that fans out events to SSE subscribers."""

from __future__ import annotations

import asyncio
import json
import logging
import time
from pathlib import Path
from typing import Any

from watchfiles import Change, awatch

from grovemd.paths import data_root, to_relative

logger = logging.getLogger(__name__)

CHANGE_MAP = {
    Change.added: "created",
    Change.modified: "modified",
    Change.deleted: "deleted",
}

# Ignore watcher events for paths we just mutated via the API
_suppress_until: dict[str, float] = {}
_SUPPRESS_SECONDS = 2.5


def suppress_path(relative: str, seconds: float = _SUPPRESS_SECONDS) -> None:
    rel = relative.strip().strip("/")
    if not rel:
        return
    _suppress_until[rel] = time.monotonic() + seconds


def _is_suppressed(relative: str) -> bool:
    until = _suppress_until.get(relative)
    if until is None:
        return False
    if time.monotonic() > until:
        _suppress_until.pop(relative, None)
        return False
    return True


class EventBroker:
    def __init__(self) -> None:
        self._subscribers: set[asyncio.Queue[str]] = set()
        self._lock = asyncio.Lock()

    async def subscribe(self) -> asyncio.Queue[str]:
        queue: asyncio.Queue[str] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subscribers.add(queue)
        return queue

    async def unsubscribe(self, queue: asyncio.Queue[str]) -> None:
        async with self._lock:
            self._subscribers.discard(queue)

    async def publish(self, payload: dict[str, Any]) -> None:
        message = json.dumps(payload)
        async with self._lock:
            dead: list[asyncio.Queue[str]] = []
            for queue in self._subscribers:
                try:
                    queue.put_nowait(message)
                except asyncio.QueueFull:
                    dead.append(queue)
            for queue in dead:
                self._subscribers.discard(queue)


broker = EventBroker()


async def watch_workspace(root: Path) -> None:
    root = data_root(root)
    logger.info("watching %s", root)
    try:
        async for changes in awatch(root, recursive=True, step=200):
            by_path: dict[str, str] = {}
            for change, path_str in changes:
                path = Path(path_str)
                if any(part.startswith(".") for part in path.parts):
                    continue
                try:
                    rel = to_relative(root, path)
                except Exception:
                    continue
                if rel == "":
                    continue
                if _is_suppressed(rel):
                    continue
                event = CHANGE_MAP.get(change, "modified")
                by_path[rel] = event

            for rel, event in by_path.items():
                await broker.publish({"event": event, "path": rel})
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("watcher stopped unexpectedly")
