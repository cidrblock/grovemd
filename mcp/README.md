# Grove MCP

Part of the [Grove (`grovemd`)](../) monorepo. Streamable-HTTP MCP tools over the same `Documents/Grove` tree as the UI.

## Tools

- `grove_search` — filename + content search (case-insensitive)
- `grove_list` — list `.md` notes
- `grove_read` — read a note
- `grove_write` — create/overwrite a note

## Local run

```bash
cd mcp
export DATA_ROOT=/var/home/bthornto/Documents/Grove
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

The quadlet mounts this `mcp/` directory and `Documents/Grove` as `/data`.
