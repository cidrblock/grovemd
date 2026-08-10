"""Full-text search via ripgrep."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

from grovemd.paths import PathError, data_root, to_relative


def search_markdown(root: Path, query: str, limit: int = 200) -> list[dict[str, Any]]:
    q = (query or "").strip()
    if not q:
        return []

    root = data_root(root)
    rg = shutil.which("rg")
    if rg is None:
        raise PathError("ripgrep (rg) is not installed", 500)

    try:
        proc = subprocess.run(
            [
                rg,
                "--json",
                "-i",
                "--glob",
                "*.md",
                "--max-count",
                "20",
                "--",
                q,
                str(root),
            ],
            capture_output=True,
            text=True,
            check=False,
        )
    except OSError as exc:
        raise PathError(f"failed to run ripgrep: {exc}", 500) from exc

    # rg exits 1 when no matches; 2 on error
    if proc.returncode not in (0, 1):
        raise PathError(proc.stderr.strip() or "ripgrep failed", 500)

    results: list[dict[str, Any]] = []
    for line in proc.stdout.splitlines():
        if len(results) >= limit:
            break
        try:
            event = json.loads(line)
        except json.JSONDecodeError:
            continue
        if event.get("type") != "match":
            continue
        data = event.get("data") or {}
        path_text = data.get("path", {}).get("text")
        lines = data.get("lines", {}).get("text", "")
        line_number = data.get("line_number")
        if not path_text or line_number is None:
            continue
        abs_path = Path(path_text)
        try:
            rel = to_relative(root, abs_path)
        except Exception:
            continue
        results.append(
            {
                "path": rel,
                "line": int(line_number),
                "preview": lines.rstrip("\n"),
            }
        )
    return results
