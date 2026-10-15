# Grove MCP

Part of the [Grove (`grovemd`)](../) monorepo. Streamable-HTTP MCP tools over the same `/mnt/space16/grove-data` tree as the UI.

## Tools

- `grove_search` — filename + content search (case-insensitive)
- `grove_list` — list `.md` notes
- `grove_read` — read a note
- `grove_write` — create/overwrite a note

`grove_search`, `grove_list`, and `grove_read` share the `ui://grove/notes` MCP
App. Search results show a document picker; opening a note shows sanitized
Markdown with a Back to results action when the search query is available.
Cogsworth hosts the service App and routes picker messages through its existing
per-user selection flow. Other MCP App hosts may call `grove_read` directly.

The App frontend source is `web/mcp-app.js`; rebuild the inline resource bundle
after source changes:

```bash
npm ci && npm run build:app
```

## Local run

```bash
cd mcp
export DATA_ROOT=/mnt/space16/grove-data
uv run grove-mcp --transport streamable-http --host 127.0.0.1 --port 8000
```

## House deploy

```bash
cp deploy/grove-mcp.container ~/.config/containers/systemd/grove-mcp.container
systemctl --user daemon-reload
systemctl --user enable --now grove-mcp.service
```

- Debug: `http://127.0.0.1:3093/mcp`
- Home Bot / OWUI (podman network): `http://grove-mcp:8000/mcp`

The quadlet mounts this `mcp/` directory and `/mnt/space8/grove-data` as `/data`.
