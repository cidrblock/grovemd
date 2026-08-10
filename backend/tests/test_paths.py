from __future__ import annotations

from pathlib import Path

import pytest

from grovemd.paths import PathError, resolve_under


def test_resolve_relative(tmp_path: Path) -> None:
    root = tmp_path / "data"
    root.mkdir()
    (root / "a").mkdir()
    path = resolve_under(root, "a/note.md")
    assert path == (root / "a" / "note.md").resolve()


def test_reject_parent_escape(tmp_path: Path) -> None:
    root = tmp_path / "data"
    root.mkdir()
    with pytest.raises(PathError):
        resolve_under(root, "../outside.md")


def test_reject_absolute(tmp_path: Path) -> None:
    root = tmp_path / "data"
    root.mkdir()
    with pytest.raises(PathError):
        resolve_under(root, "/etc/passwd")


def test_reject_symlink_escape(tmp_path: Path) -> None:
    root = tmp_path / "data"
    root.mkdir()
    outside = tmp_path / "secret.txt"
    outside.write_text("nope")
    link = root / "leak.md"
    link.symlink_to(outside)
    with pytest.raises(PathError):
        resolve_under(root, "leak.md")
