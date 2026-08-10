from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from grovemd.config import settings
from grovemd.main import app


@pytest.fixture()
def data_root(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = tmp_path / "grove"
    root.mkdir()
    monkeypatch.setattr(settings, "data_root", root)
    return root


@pytest.fixture()
def client(data_root: Path) -> TestClient:
    with TestClient(app) as c:
        yield c
