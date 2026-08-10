"""Grove FastAPI application."""

from __future__ import annotations

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from grovemd import __version__
from grovemd import filesystem as fs
from grovemd.config import settings
from grovemd.paths import PathError
from grovemd.search import search_markdown
from grovemd.watcher import broker, suppress_path, watch_workspace

logger = logging.getLogger(__name__)


class WriteFileBody(BaseModel):
    path: str
    content: str
    expected_mtime: str | None = None


class CreateFileBody(BaseModel):
    path: str
    content: str = ""


class CreateDirectoryBody(BaseModel):
    path: str


class RenameBody(BaseModel):
    from_path: str = Field(alias="from")
    to_path: str = Field(alias="to")

    model_config = {"populate_by_name": True}


@asynccontextmanager
async def lifespan(app: FastAPI):
    root = settings.data_root
    root.mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(watch_workspace(root))
    logger.info("Grove data root: %s", root.resolve())
    try:
        yield
    finally:
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass


app = FastAPI(title="Grove", version=__version__, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(PathError)
async def path_error_handler(_request: Request, exc: PathError) -> JSONResponse:
    return JSONResponse({"detail": exc.message}, status_code=exc.status_code)


@app.get("/api/health")
async def health() -> dict[str, Any]:
    return {"status": "ok", "version": __version__}


@app.get("/api/tree")
async def get_tree() -> list[dict[str, Any]]:
    return fs.build_tree(settings.data_root)


@app.get("/api/file")
async def get_file(path: str = Query(...)) -> dict[str, Any]:
    return fs.read_file(settings.data_root, path)


@app.put("/api/file")
async def put_file(body: WriteFileBody) -> dict[str, Any]:
    suppress_path(body.path)
    return fs.write_file(
        settings.data_root,
        body.path,
        body.content,
        expected_mtime=body.expected_mtime,
    )


@app.post("/api/file")
async def post_file(body: CreateFileBody) -> dict[str, Any]:
    suppress_path(body.path)
    return fs.create_file(settings.data_root, body.path, body.content)


@app.post("/api/directory")
async def post_directory(body: CreateDirectoryBody) -> dict[str, Any]:
    suppress_path(body.path)
    return fs.create_directory(settings.data_root, body.path)


@app.patch("/api/path")
async def patch_path(body: RenameBody) -> dict[str, Any]:
    suppress_path(body.from_path)
    suppress_path(body.to_path)
    return fs.rename_path(settings.data_root, body.from_path, body.to_path)


@app.delete("/api/path")
async def delete_path_route(path: str = Query(...)) -> dict[str, Any]:
    suppress_path(path)
    return fs.delete_path(settings.data_root, path)


@app.get("/api/search")
async def search(q: str = Query("")) -> list[dict[str, Any]]:
    return search_markdown(settings.data_root, q, limit=settings.search_result_limit)


@app.get("/api/files")
async def list_files() -> list[str]:
    return fs.list_markdown_paths(settings.data_root)


@app.get("/api/events")
async def events(request: Request) -> StreamingResponse:
    queue = await broker.subscribe()

    async def gen():
        try:
            yield "event: ready\ndata: {}\n\n"
            while True:
                if await request.is_disconnected():
                    break
                try:
                    message = await asyncio.wait_for(queue.get(), timeout=25.0)
                    yield f"data: {message}\n\n"
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
        finally:
            await broker.unsubscribe(queue)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


def _mount_static(application: FastAPI) -> None:
    static = settings.static_dir
    if static is None:
        candidates = [
            Path(__file__).resolve().parents[2] / "frontend" / "dist",
            Path("/app/frontend/dist"),
        ]
        for candidate in candidates:
            if candidate.is_dir():
                static = candidate
                break
    if static is None or not Path(static).is_dir():
        logger.warning("No frontend static dir found; API-only mode")
        return

    static_path = Path(static)
    assets = static_path / "assets"
    if assets.is_dir():
        application.mount("/assets", StaticFiles(directory=assets), name="assets")

    @application.get("/{full_path:path}")
    async def spa(full_path: str) -> FileResponse:
        candidate = static_path / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(static_path / "index.html")


_mount_static(app)


def create_app() -> FastAPI:
    return app
