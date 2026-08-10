"""Filesystem helpers for Grove notes (DATA_ROOT jail)."""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any


class GroveError(Exception):
    def __init__(self, message: str) -> None:
        super().__init__(message)
        self.message = message


def data_root() -> Path:
    raw = os.environ.get("DATA_ROOT", "/data")
    root = Path(raw).expanduser().resolve()
    if not root.exists():
        root.mkdir(parents=True, exist_ok=True)
    if not root.is_dir():
        raise GroveError(f"DATA_ROOT is not a directory: {root}")
    return root


def resolve_under(relative: str) -> Path:
    root = data_root()
    raw = (relative or "").strip()
    if raw in ("", ".", "/"):
        return root
    if raw.startswith("/") or raw.startswith("~"):
        raise GroveError("absolute paths are not allowed")
    parts = Path(raw).parts
    if any(p == ".." for p in parts):
        raise GroveError("path escapes workspace")
    candidate = (root / raw).resolve(strict=False)
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise GroveError("path escapes workspace") from exc
    return candidate


def to_relative(absolute: Path) -> str:
    root = data_root()
    rel = absolute.resolve(strict=False).relative_to(root)
    return "" if str(rel) == "." else rel.as_posix()


def list_notes(prefix: str = "", limit: int = 100) -> list[dict[str, str]]:
    root = data_root()
    base = resolve_under(prefix) if prefix.strip() else root
    if not base.exists():
        return []
    if base.is_file():
        if base.suffix.lower() == ".md":
            return [{"path": to_relative(base), "name": base.name}]
        return []

    results: list[dict[str, str]] = []
    for dirpath, dirnames, filenames in os.walk(base):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in sorted(filenames):
            if name.startswith(".") or not name.lower().endswith(".md"):
                continue
            path = Path(dirpath) / name
            results.append({"path": to_relative(path), "name": name})
            if len(results) >= limit:
                return results
    return results


def search_notes(query: str, limit: int = 20) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []
    root = data_root()
    rg = shutil.which("rg")

    # Always include filename matches
    q_lower = q.lower()
    hits: list[dict[str, Any]] = []
    seen: set[str] = set()
    for note in list_notes(limit=500):
        if q_lower in note["path"].lower() or q_lower in note["name"].lower():
            hits.append(
                {
                    "path": note["path"],
                    "line": 0,
                    "preview": f"(filename) {note['name']}",
                    "source": "filename",
                }
            )
            seen.add(note["path"])
            if len(hits) >= limit:
                return hits

    if rg is None:
        # Fallback: scan .md bodies when ripgrep is not in the image
        for note in list_notes(limit=500):
            if note["path"] in seen:
                continue
            try:
                text = resolve_under(note["path"]).read_text(encoding="utf-8")
            except OSError:
                continue
            for i, line in enumerate(text.splitlines(), 1):
                if q_lower in line.lower():
                    hits.append(
                        {
                            "path": note["path"],
                            "line": i,
                            "preview": line.strip()[:200],
                            "source": "content",
                        }
                    )
                    seen.add(note["path"])
                    break
            if len(hits) >= limit:
                return hits
        return hits

    proc = subprocess.run(
        [
            rg,
            "--json",
            "-i",
            "--glob",
            "*.md",
            "--max-count",
            "3",
            "--",
            q,
            str(root),
        ],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode not in (0, 1):
        raise GroveError(proc.stderr.strip() or "ripgrep failed")

    for line in proc.stdout.splitlines():
        if len(hits) >= limit:
            break
        try:
            import json

            event = json.loads(line)
        except Exception:
            continue
        if event.get("type") != "match":
            continue
        data = event.get("data") or {}
        path_text = data.get("path", {}).get("text")
        preview = data.get("lines", {}).get("text", "")
        line_number = data.get("line_number") or 0
        if not path_text:
            continue
        rel = to_relative(Path(path_text))
        if rel in seen:
            # Keep first content preview if we already have filename hit
            for h in hits:
                if h["path"] == rel and h.get("source") == "filename":
                    h["line"] = int(line_number)
                    h["preview"] = preview.rstrip("\n")
                    h["source"] = "content"
                    break
            continue
        seen.add(rel)
        hits.append(
            {
                "path": rel,
                "line": int(line_number),
                "preview": preview.rstrip("\n"),
                "source": "content",
            }
        )
    return hits


def read_note(relative: str, max_chars: int = 12000) -> dict[str, Any]:
    path = resolve_under(relative)
    if not path.exists() or not path.is_file():
        raise GroveError(f"note not found: {relative}")
    if path.suffix.lower() != ".md":
        raise GroveError("only Markdown (.md) notes are readable")
    content = path.read_text(encoding="utf-8")
    truncated = False
    if len(content) > max_chars:
        content = content[:max_chars].rsplit("\n", 1)[0] + "\n\n…(truncated)…"
        truncated = True
    return {
        "path": to_relative(path),
        "name": path.name,
        "title": path.stem.replace("-", " ").replace("_", " "),
        "content": content,
        "truncated": truncated,
    }


def write_note(relative: str, content: str) -> dict[str, Any]:
    path = resolve_under(relative)
    if path.suffix.lower() != ".md":
        raise GroveError("only .md notes can be written")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {"path": to_relative(path), "name": path.name, "bytes": len(content.encode("utf-8"))}
