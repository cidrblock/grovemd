from __future__ import annotations

import json
import unittest
from pathlib import Path

from grove_mcp.mcp_app import (
    GROVE_APP_URI,
    MCP_APP_MIME_TYPE,
    grove_app_data,
    grove_app_result,
    render_grove_app,
)
from grove_mcp.server import mcp


class GroveMcpAppTests(unittest.TestCase):
    def test_search_list_and_read_tools_share_app_resource(self):
        for name in ("grove_search", "grove_list", "grove_read"):
            with self.subTest(tool=name):
                tool = mcp._tool_manager._tools[name]
                self.assertEqual(tool.meta["ui"]["resourceUri"], GROVE_APP_URI)
        resource = mcp._resource_manager._resources[GROVE_APP_URI]
        self.assertEqual(resource.mime_type, MCP_APP_MIME_TYPE)
        self.assertFalse(resource.meta["ui"]["prefersBorder"])

    def test_search_projection_bounds_preview_and_omits_note_content(self):
        data = grove_app_data({
            "ok": True,
            "query": "solar",
            "results": [{
                "path": "home/solar.md",
                "title": "Solar",
                "preview": "x" * 300,
                "line": 12,
                "content": "not included in picker payload",
            }],
        })
        result = data["results"][0]
        self.assertEqual(result["path"], "home/solar.md")
        self.assertEqual(len(result["preview"]), 240)
        self.assertNotIn("content", result)

    def test_note_projection_keeps_sanitized_html_and_back_query(self):
        data = grove_app_data({
            "ok": True,
            "path": "home/solar.md",
            "title": "Solar",
                "content": "# Solar status\n\n**Production**",
            "query": "solar",
        })
        self.assertEqual(data["kind"], "note")
        self.assertIn("<h1>Solar status</h1>", data["note"]["content_html"])
        self.assertIn("<strong>Production</strong>", data["note"]["content_html"])
        self.assertEqual(data["query"], "solar")

    def test_note_markdown_sanitization_removes_scripts_and_unsafe_urls(self):
        data = grove_app_data({
            "ok": True,
            "path": "untrusted.md",
            "content": '<script>alert("xss")</script>\n\n[bad](javascript:alert(1))',
        })
        rendered = data["note"]["content_html"]
        self.assertNotIn("<script", rendered.lower())
        self.assertNotIn('href="javascript:', rendered.lower())
        self.assertNotIn("<a href=", rendered.lower())

    def test_result_keeps_json_text_fallback(self):
        result = grove_app_result({
            "ok": True,
            "query": "solar",
            "results": [],
            "canned_text": "No matches.",
        })
        self.assertEqual(result.structuredContent["query"], "solar")
        self.assertEqual(json.loads(result.content[0].text)["canned_text"], "No matches.")

    def test_resource_uses_picker_and_sanitized_markdown_reader(self):
        html = render_grove_app()
        self.assertIn('id="results"', html)
        self.assertIn('id="note"', html)
        self.assertNotIn("<script src=", html)
        source = Path(__file__).parents[1] / "web" / "mcp-app.js"
        source_text = source.read_text(encoding="utf-8")
        self.assertIn("app.callServerTool", source_text)
        self.assertIn("app.sendMessage", source_text)


if __name__ == "__main__":
    unittest.main()