"""Grove MCP — Streamable HTTP tools over Documents/Grove Markdown."""

from __future__ import annotations

import argparse
import json
import logging
from typing import Any

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings

from . import notes

log = logging.getLogger(__name__)

mcp = FastMCP(
    "grove",
    host="0.0.0.0",
    transport_security=TransportSecuritySettings(
        enable_dns_rebinding_protection=True,
        allowed_hosts=[
            "127.0.0.1:*",
            "localhost:*",
            "grove-mcp:*",
            "grove-mcp.dns.podman:*",
            "[::1]:*",
        ],
    ),
)


def _dumps(data: Any) -> str:
    return json.dumps(data, indent=2, default=str)


def _err(exc: Exception) -> str:
    msg = getattr(exc, "message", None) or str(exc)
    return _dumps({"ok": False, "error": type(exc).__name__, "message": msg, "canned_text": msg})


@mcp.tool()
async def grove_search(query: str, limit: int = 10) -> str:
    """Search Grove notes by filename and Markdown content (case-insensitive).

    Args:
        query: Search text (e.g. "solar").
        limit: Max results (default 10).
    """
    try:
        hits = notes.search_notes(query, limit=max(1, min(int(limit), 50)))
        if not hits:
            canned = f"No Grove notes matched '{query}'."
            return _dumps({"ok": True, "query": query, "results": [], "canned_text": canned})

        lines = [f"Grove matches for '{query}':"]
        results = []
        for i, h in enumerate(hits, 1):
            path = h["path"]
            preview = (h.get("preview") or "").strip()
            if len(preview) > 120:
                preview = preview[:117] + "…"
            lines.append(f"{i}. {path}" + (f" — {preview}" if preview else ""))
            results.append(
                {
                    "n": i,
                    "path": path,
                    "title": _note_title(path),
                    "line": h.get("line") or 0,
                    "preview": preview,
                }
            )
        lines.append("Reply with a number to open one.")
        canned = "\n".join(lines)
        return _dumps(
            {"ok": True, "query": query, "results": results, "canned_text": canned}
        )
    except Exception as e:  # noqa: BLE001
        log.exception("grove_search failed")
        return _err(e)


def _note_title(path: str) -> str:
    name = path.rsplit("/", 1)[-1]
    if name.lower().endswith(".md"):
        name = name[:-3]
    return name.replace("-", " ").replace("_", " ")


@mcp.tool()
async def grove_list(prefix: str = "", limit: int = 50) -> str:
    """List Markdown notes under Grove (optional subdirectory prefix).

    Args:
        prefix: Relative directory (e.g. "home/technology"); empty = all.
        limit: Max notes to return.
    """
    try:
        items = notes.list_notes(prefix=prefix, limit=max(1, min(int(limit), 200)))
        if not items:
            where = prefix or "Grove"
            canned = f"No Markdown notes found under {where}."
            return _dumps({"ok": True, "prefix": prefix, "notes": [], "canned_text": canned})
        lines = [f"Grove notes ({len(items)}):"]
        for i, n in enumerate(items, 1):
            lines.append(f"{i}. {n['path']}")
        return _dumps(
            {
                "ok": True,
                "prefix": prefix,
                "notes": items,
                "canned_text": "\n".join(lines),
            }
        )
    except Exception as e:  # noqa: BLE001
        log.exception("grove_list failed")
        return _err(e)


@mcp.tool()
async def grove_read(path: str) -> str:
    """Read a Grove Markdown note by relative path.

    Args:
        path: Note path relative to Grove root (e.g. "home/solar.md").
    """
    try:
        doc = notes.read_note(path)
        title = doc["title"]
        body = doc["content"].strip()
        canned = f"# {title}\n\nPath: {doc['path']}\n\n{body}"
        return _dumps({**doc, "ok": True, "canned_text": canned})
    except Exception as e:  # noqa: BLE001
        log.exception("grove_read failed")
        return _err(e)


@mcp.tool()
async def grove_write(path: str, content: str) -> str:
    """Create or overwrite a Grove Markdown note.

    Args:
        path: Relative .md path (e.g. "home/new-note.md").
        content: Full Markdown content to write.
    """
    try:
        info = notes.write_note(path, content)
        canned = f"Wrote {info['path']} ({info['bytes']} bytes)."
        return _dumps({**info, "ok": True, "canned_text": canned})
    except Exception as e:  # noqa: BLE001
        log.exception("grove_write failed")
        return _err(e)


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    parser = argparse.ArgumentParser(description="Grove MCP")
    parser.add_argument(
        "--transport",
        default="streamable-http",
        choices=["streamable-http", "stdio"],
    )
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()

    if args.transport == "stdio":
        mcp.run(transport="stdio")
    else:
        mcp.settings.host = args.host
        mcp.settings.port = args.port
        mcp.run(transport="streamable-http")


if __name__ == "__main__":
    main()
