"""Path jail: all filesystem operations stay under DATA_ROOT."""

from __future__ import annotations

from pathlib import Path


class PathError(Exception):
    """Invalid or forbidden path."""

    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.message = message
        self.status_code = status_code


def data_root(root: Path) -> Path:
    resolved = root.expanduser().resolve()
    if not resolved.exists():
        resolved.mkdir(parents=True, exist_ok=True)
    if not resolved.is_dir():
        raise PathError(f"DATA_ROOT is not a directory: {resolved}", 500)
    return resolved


def resolve_under(root: Path, relative: str) -> Path:
    """Resolve a client-relative path under root; reject escapes and outside symlinks."""
    root = data_root(root)

    if relative is None:
        raise PathError("path is required")

    raw = relative.strip()
    if raw in ("", ".", "/"):
        return root

    if raw.startswith("/") or raw.startswith("~"):
        raise PathError("absolute paths are not allowed")

    # Normalize separators and reject empty / parent segments that sneak past Path
    parts = Path(raw).parts
    if any(p == ".." for p in parts):
        raise PathError("path escapes workspace")

    candidate = (root / raw).resolve(strict=False)

    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise PathError("path escapes workspace", 403) from exc

    # If the path exists and is a symlink (or contains one), ensure final target is inside
    if candidate.exists() or candidate.is_symlink():
        real = candidate.resolve(strict=False)
        try:
            real.relative_to(root)
        except ValueError as exc:
            raise PathError("symlink escapes workspace", 403) from exc
        return real

    # For new paths, ensure each existing parent stays inside root
    parent = candidate.parent
    while parent != root and parent != parent.parent:
        if parent.exists() or parent.is_symlink():
            real_parent = parent.resolve(strict=False)
            try:
                real_parent.relative_to(root)
            except ValueError as exc:
                raise PathError("symlink escapes workspace", 403) from exc
            break
        parent = parent.parent

    return candidate


def to_relative(root: Path, absolute: Path) -> str:
    root = data_root(root)
    abs_path = absolute.resolve(strict=False)
    rel = abs_path.relative_to(root)
    return "" if str(rel) == "." else rel.as_posix()


def is_markdown(path: Path) -> bool:
    return path.is_file() and path.suffix.lower() == ".md"
