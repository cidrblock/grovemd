# Grove (`grovemd`)

Filesystem-backed Markdown workspace. The UI brand is **Grove**; the package and image are **`grovemd`**.

> The filesystem is the source of truth.

Ordinary `.md` files in ordinary directories. Humans use the browser UI; agents, Home Bot, and Git use the same files on disk.

## Layout

| Path | Role |
|------|------|
| `frontend/` | React SPA (MDXEditor) |
| `backend/` | FastAPI UI API |
| `mcp/` | FastMCP tools for Home Bot / Open WebUI |
| `deploy/` | Grove UI quadlet + Traefik |
| `mcp/deploy/` | Grove MCP quadlet |

## Features (V1)

- Browse directories + Markdown files
- MDXEditor rich / source editing
- Create / rename / move / delete files and folders
- Full-text search via `ripgrep`
- Live tree updates when files change outside the app (SSE + `watchfiles`)
- Optimistic concurrency via `mtime` (409 Conflict)
- MCP: `grove_search` / `grove_list` / `grove_read` / `grove_write`

MIT licensed — see [LICENSE](LICENSE).

## Local development

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
export DATA_ROOT=/var/home/bthornto/Documents/Grove
mkdir -p "$DATA_ROOT"
uvicorn grovemd.main:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api` to `http://127.0.0.1:8080`.

### Tests

```bash
cd backend
pytest
```

## Production image

```bash
podman build -t localhost/grovemd:latest -f Containerfile .
mkdir -p /var/home/bthornto/Documents/Grove
podman run --rm -p 127.0.0.1:8096:8080 \
  -v /var/home/bthornto/Documents/Grove:/data:Z \
  -e DATA_ROOT=/data \
  --userns=keep-id:uid=1000,gid=1000 \
  localhost/grovemd:latest
```

## House deploy (pc.20665.net)

1. Build the image (above).
2. Install the user quadlet:

   ```bash
   cp deploy/grovemd.container ~/.config/containers/systemd/grovemd.container
   systemctl --user daemon-reload
   systemctl --user enable --now grovemd.service
   ```

3. Install Traefik route (root):

   ```bash
   sudo cp deploy/grovemd.traefik.yml /etc/traefik/dynamic/grovemd.yml
   ```

4. Add Firewalla DNS: `grove.20665.net` → `192.168.0.36`.

Notes live at `/var/home/bthornto/Documents/Grove`. Destroying the container does not delete notes.

Grove runs as your host UID (`UserNS=keep-id`) with SELinux labeling disabled on the container, so the notes directory stays normal home files. You can `mv` / `cp` Markdown into the tree from the host or an agent and it shows up without relabeling.

## Grove MCP (Home Bot / Open WebUI)

Same notes root; separate container on `home-chat.network`:

```bash
cp mcp/deploy/grove-mcp.container ~/.config/containers/systemd/grove-mcp.container
systemctl --user daemon-reload
systemctl --user enable --now grove-mcp.service
```

See [mcp/README.md](mcp/README.md).

## Design

See [design.md](design.md).
