from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import nh3
from markdown_it import MarkdownIt
from mcp.types import CallToolResult, TextContent


MCP_APP_MIME_TYPE = "text/html;profile=mcp-app"
GROVE_APP_URI = "ui://grove/notes"
_APP_SCRIPT = (Path(__file__).parent / "static" / "mcp-app.js").read_text(encoding="utf-8")
_MARKDOWN = MarkdownIt("commonmark", {"html": False, "linkify": False})
_ALLOWED_TAGS = {
  "a", "abbr", "blockquote", "br", "code", "del", "em", "h1", "h2",
  "h3", "h4", "h5", "h6", "hr", "img", "li", "ol", "p", "pre",
  "strong", "table", "tbody", "td", "th", "thead", "tr", "ul",
}
_ALLOWED_ATTRIBUTES = {
  "a": {"href", "title"},
  "img": {"src", "alt", "title"},
  "td": {"align"},
  "th": {"align"},
}


def _result_item(item: Any, index: int) -> dict[str, Any] | None:
    if not isinstance(item, dict) or not item.get("path"):
        return None
    path = str(item["path"])
    return {
        "n": item.get("n", index),
        "path": path,
        "title": str(item.get("title") or item.get("name") or path.rsplit("/", 1)[-1]),
        "preview": str(item.get("preview") or "")[:240],
        "line": item.get("line") or 0,
    }


def grove_app_data(payload: dict[str, Any]) -> dict[str, Any]:
    note = None
    if payload.get("path") and payload.get("content") is not None:
        note = {
            "path": str(payload.get("path") or ""),
            "title": str(payload.get("title") or payload.get("name") or "Grove note"),
          "content_html": nh3.clean(
            _MARKDOWN.render(str(payload.get("content") or "")),
            tags=_ALLOWED_TAGS,
            attributes=_ALLOWED_ATTRIBUTES,
          ),
            "truncated": bool(payload.get("truncated")),
        }

    raw_results = payload.get("results")
    if not isinstance(raw_results, list):
        raw_results = payload.get("notes") if isinstance(payload.get("notes"), list) else []
    results = [view for index, item in enumerate(raw_results, 1) if (view := _result_item(item, index))]
    return {
        "ok": bool(payload.get("ok", not payload.get("error"))),
        "kind": "note" if note else "results",
        "query": str(payload.get("query") or ""),
        "prefix": str(payload.get("prefix") or ""),
        "results": results,
        "note": note,
        "error": payload.get("error"),
        "canned_text": str(payload.get("canned_text") or ""),
    }


def grove_app_result(payload: dict[str, Any]) -> CallToolResult:
    app_data = grove_app_data(payload)
    text_payload = dict(payload)
    text_payload.setdefault("canned_text", app_data["canned_text"])
    return CallToolResult(
        content=[TextContent(type="text", text=json.dumps(text_payload, indent=2, default=str))],
        structuredContent=app_data,
        isError=not app_data["ok"],
    )


def render_grove_app() -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Grove</title>
<style>
  :root {{ color-scheme:light dark; --bg:#eef1f6; --shell:#fff; --tile:#f7f9fc;
    --text:#1a2332; --muted:#6b7a90; --border:#e2e8f0; --accent:#16834b; }}
  @media(prefers-color-scheme:dark) {{ :root {{ --bg:#0f1419; --shell:#151c27; --tile:#1a2332;
    --text:#e7ecf3; --muted:#8b9bb4; --border:#2a3548; --accent:#3dd68c; }} }}
  * {{ box-sizing:border-box; }}
  [hidden] {{ display:none !important; }}
  body {{ margin:0; padding:.65rem; color:var(--text); background:var(--bg);
    font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif; }}
  main {{ padding:.9rem .95rem 1rem; background:var(--shell); border:1px solid var(--border);
    border-radius:16px; box-shadow:0 1px 2px rgba(16,24,40,.04),0 4px 14px rgba(16,24,40,.06); }}
  header {{ display:flex; align-items:center; gap:.5rem; margin-bottom:.35rem; }}
  header svg {{ width:1.15rem; height:1.15rem; color:var(--accent); }}
  h1 {{ margin:0; font-size:1.05rem; font-weight:700; }}
  #context {{ min-height:1rem; margin:0 0 .7rem 1.65rem; color:var(--muted); font-size:.74rem; overflow-wrap:anywhere; }}
  #results {{ display:grid; gap:.45rem; }}
  .result {{ display:grid; gap:.25rem; width:100%; padding:.7rem .75rem; text-align:left; color:var(--text);
    background:var(--tile); border:1px solid var(--border); border-radius:10px; font:inherit; cursor:pointer; }}
  .result:hover {{ border-color:var(--accent); }} .result:disabled {{ opacity:.55; cursor:wait; }}
  .result-title {{ font-size:.88rem; font-weight:700; }}
  .path,.preview,.empty {{ color:var(--muted); font-size:.74rem; line-height:1.4; overflow-wrap:anywhere; }}
  .preview {{ margin-top:.1rem; }} .empty {{ margin:0; padding:.8rem; background:var(--tile); border:1px solid var(--border); border-radius:10px; }}
  #back {{ margin:0 0 .7rem; padding:0; color:var(--accent); background:none; border:0; font:inherit; font-size:.78rem; cursor:pointer; }}
  #back[hidden] {{ display:none; }}
  article {{ max-width:76ch; font-family:ui-serif,Georgia,serif; font-size:.94rem; line-height:1.58; overflow-wrap:anywhere; }}
  article h1,article h2,article h3 {{ margin:1.1em 0 .45em; font-family:ui-sans-serif,system-ui,sans-serif; line-height:1.25; }}
  article h1 {{ font-size:1.35rem; }} article h2 {{ font-size:1.15rem; }} article h3 {{ font-size:1rem; }}
  article p {{ margin:.6em 0; }} article pre {{ overflow:auto; padding:.7rem; background:var(--tile); border-radius:8px; font-size:.8rem; }}
  article code {{ padding:.08em .25em; background:var(--tile); border-radius:4px; font-family:ui-monospace,monospace; font-size:.85em; }}
  article pre code {{ padding:0; }} article blockquote {{ margin:.7rem 0; padding-left:.8rem; color:var(--muted); border-left:3px solid var(--border); }}
  article a {{ color:var(--accent); }} article img {{ max-width:100%; height:auto; }}
  article table {{ display:block; max-width:100%; overflow:auto; border-collapse:collapse; }}
  article th,article td {{ padding:.35rem .5rem; border:1px solid var(--border); }}
  .truncated {{ margin:.8rem 0 0; color:var(--muted); font-size:.75rem; }}
  .error {{ color:#b42318; }}
</style>
</head>
<body><main>
  <header><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V5l8-3 8 3v15l-8 2-8-2Zm8-18v20M4 5l8 3 8-3M4 20l8-3 8 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg><h1 id="title">Grove</h1></header>
  <p id="context"></p><button id="back" type="button" hidden>← Back to results</button>
  <div id="results"><p class="empty">Loading Grove…</p></div>
  <article id="note" hidden></article>
</main><script>{_APP_SCRIPT}</script></body>
</html>"""