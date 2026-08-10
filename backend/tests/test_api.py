from __future__ import annotations

from pathlib import Path

from fastapi.testclient import TestClient


def test_health(client: TestClient) -> None:
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"


def test_crud_and_conflict(client: TestClient, data_root: Path) -> None:
    res = client.post("/api/directory", json={"path": "home"})
    assert res.status_code == 200

    res = client.post("/api/file", json={"path": "home/solar.md"})
    assert res.status_code == 200
    body = res.json()
    assert "Solar" in body["content"]
    mtime = body["mtime"]

    res = client.get("/api/file", params={"path": "home/solar.md"})
    assert res.status_code == 200
    assert res.json()["mtime"] == mtime

    res = client.put(
        "/api/file",
        json={
            "path": "home/solar.md",
            "content": "# Solar\n\nUpdated\n",
            "expected_mtime": mtime,
        },
    )
    assert res.status_code == 200
    new_mtime = res.json()["mtime"]

    # External change
    path = data_root / "home" / "solar.md"
    path.write_text("# Solar\n\nExternal\n", encoding="utf-8")

    res = client.put(
        "/api/file",
        json={
            "path": "home/solar.md",
            "content": "# Solar\n\nStale save\n",
            "expected_mtime": new_mtime,
        },
    )
    assert res.status_code == 409

    tree = client.get("/api/tree").json()
    assert tree[0]["name"] == "home"
    assert tree[0]["children"][0]["path"] == "home/solar.md"

    res = client.patch(
        "/api/path",
        json={"from": "home/solar.md", "to": "home/power.md"},
    )
    assert res.status_code == 200
    assert (data_root / "home" / "power.md").exists()

    res = client.delete("/api/path", params={"path": "home/power.md"})
    assert res.status_code == 200
    assert not (data_root / "home" / "power.md").exists()


def test_tree_hides_non_md(client: TestClient, data_root: Path) -> None:
    (data_root / "notes").mkdir()
    (data_root / "notes" / "a.md").write_text("# A\n")
    (data_root / "notes" / "image.png").write_bytes(b"\x89PNG")
    tree = client.get("/api/tree").json()
    children = tree[0]["children"]
    assert len(children) == 1
    assert children[0]["name"] == "a.md"


def test_path_escape_rejected(client: TestClient) -> None:
    res = client.get("/api/file", params={"path": "../secret.md"})
    assert res.status_code in (400, 403)


def test_mtime_is_string(client: TestClient) -> None:
    res = client.post("/api/file", json={"path": "t.md", "content": "# T\n"})
    assert res.status_code == 200
    mtime = res.json()["mtime"]
    assert isinstance(mtime, str)
    assert mtime.isdigit()
    # Must be full nanosecond precision (too large for JS Number)
    assert int(mtime) > 2**53


def test_search(client: TestClient, data_root: Path) -> None:
    (data_root / "home").mkdir()
    (data_root / "home" / "solar.md").write_text(
        "# Solar\n\nThe Sol-Ark inverter is online.\n",
        encoding="utf-8",
    )
    res = client.get("/api/search", params={"q": "Sol-Ark"})
    if res.status_code == 500 and "ripgrep" in res.json().get("detail", ""):
        import pytest

        pytest.skip("ripgrep not installed")
    assert res.status_code == 200
    hits = res.json()
    assert hits
    assert hits[0]["path"] == "home/solar.md"

    # Case-insensitive
    res_ci = client.get("/api/search", params={"q": "sol-ark"})
    assert res_ci.status_code == 200
    assert res_ci.json()
