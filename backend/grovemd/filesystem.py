"""Filesystem operations for the Grove workspace."""

from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Any, Literal

from grovemd.paths import PathError, is_markdown, resolve_under, to_relative


def mtime_token(path: Path) -> str:
    """Nanosecond mtime as a string — JS cannot safely hold ns as Number."""
    return str(path.stat().st_mtime_ns)


def build_tree(root: Path) -> list[dict[str, Any]]:
    root = resolve_under(root, "")
    return _dir_children(root, root)


def _dir_children(root: Path, directory: Path) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    try:
        entries = sorted(directory.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower()))
    except OSError:
        return nodes

    for entry in entries:
        # Skip hidden files/dirs
        if entry.name.startswith("."):
            continue
        try:
            if entry.is_symlink():
                target = entry.resolve(strict=False)
                try:
                    target.relative_to(root.resolve())
                except ValueError:
                    continue
            if entry.is_dir() and not entry.is_symlink():
                rel = to_relative(root, entry)
                nodes.append(
                    {
                        "id": rel,
                        "name": entry.name,
                        "path": rel,
                        "type": "directory",
                        "children": _dir_children(root, entry),
                    }
                )
            elif is_markdown(entry):
                rel = to_relative(root, entry)
                nodes.append(
                    {
                        "id": rel,
                        "name": entry.name,
                        "path": rel,
                        "type": "file",
                    }
                )
        except OSError:
            continue
    return nodes


def read_file(root: Path, relative: str) -> dict[str, Any]:
    path = resolve_under(root, relative)
    if not path.exists():
        raise PathError("file not found", 404)
    if not path.is_file():
        raise PathError("not a file", 400)
    if not is_markdown(path):
        raise PathError("only Markdown files are readable via API", 400)
    content = path.read_text(encoding="utf-8")
    return {
        "path": to_relative(root, path),
        "content": content,
        "mtime": mtime_token(path),
    }


def write_file(
    root: Path,
    relative: str,
    content: str,
    expected_mtime: str | None = None,
) -> dict[str, Any]:
    path = resolve_under(root, relative)
    if path.suffix.lower() != ".md":
        raise PathError("only .md files can be written", 400)
    if path.exists() and not path.is_file():
        raise PathError("path is not a file", 400)

    if path.exists() and expected_mtime is not None:
        current = mtime_token(path)
        if current != str(expected_mtime):
            raise PathError("document changed on disk", 409)

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    return {
        "path": to_relative(root, path),
        "content": content,
        "mtime": mtime_token(path),
    }


def create_file(root: Path, relative: str, content: str = "") -> dict[str, Any]:
    path = resolve_under(root, relative)
    if path.suffix.lower() != ".md":
        raise PathError("only .md files can be created", 400)
    if path.exists():
        raise PathError("already exists", 409)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not content:
        stem = path.stem.replace("-", " ").replace("_", " ").title()
        content = f"# {stem}\n"
    path.write_text(content, encoding="utf-8")
    return {
        "path": to_relative(root, path),
        "content": content,
        "mtime": mtime_token(path),
    }


def create_directory(root: Path, relative: str) -> dict[str, str]:
    path = resolve_under(root, relative)
    if path.exists():
        raise PathError("already exists", 409)
    path.mkdir(parents=True, exist_ok=False)
    return {"path": to_relative(root, path), "type": "directory"}


def rename_path(root: Path, from_path: str, to_path: str) -> dict[str, str]:
    src = resolve_under(root, from_path)
    dst = resolve_under(root, to_path)
    if not src.exists():
        raise PathError("source not found", 404)
    if dst.exists():
        raise PathError("destination already exists", 409)
    if src == root.resolve():
        raise PathError("cannot rename workspace root", 400)
    dst.parent.mkdir(parents=True, exist_ok=True)
    src.rename(dst)
    kind: Literal["file", "directory"] = "directory" if dst.is_dir() else "file"
    return {
        "from": from_path.strip().strip("/"),
        "to": to_relative(root, dst),
        "type": kind,
    }


def delete_path(root: Path, relative: str) -> dict[str, str]:
    path = resolve_under(root, relative)
    if path == root.resolve() or relative.strip() in ("", ".", "/"):
        raise PathError("cannot delete workspace root", 400)
    if not path.exists():
        raise PathError("not found", 404)
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
        kind = "directory"
    else:
        path.unlink()
        kind = "file"
    return {"path": relative.strip("/"), "type": kind}


def list_markdown_paths(root: Path) -> list[str]:
    root = resolve_under(root, "")
    results: list[str] = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if not d.startswith(".")]
        for name in filenames:
            if name.startswith("."):
                continue
            if name.lower().endswith(".md"):
                results.append(to_relative(root, Path(dirpath) / name))
    return sorted(results)
