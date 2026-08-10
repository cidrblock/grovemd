# Grove — Design Document

## 1. Overview

Grove is a lightweight, self-hosted web application for browsing, editing, rendering, and searching a filesystem hierarchy of Markdown documents.

The primary design principle is:

> **The filesystem is the source of truth.**

The application does not maintain a separate note database or proprietary document format. Markdown documents exist as normal `.md` files in normal directories.

This allows humans, scripts, Git, command-line tools, and AI agents to interact with exactly the same data without requiring application-specific APIs.

For example:

```text
/data
├── home/
│   ├── solar.md
│   ├── electrical.md
│   └── hvac.md
├── projects/
│   ├── shop.md
│   └── rv.md
└── research/
    ├── batteries.md
    └── self-hosting.md
```

The web application mounts `/data`.

An agent may mount the same directory and manipulate it directly:

```text
Web UI ─────────┐
                ├── /data
Agent ──────────┤
                ├── filesystem
Git ────────────┘
```

No synchronization database is required.

---

# 2. Goals

The initial application should provide:

* Filesystem-backed Markdown storage
* Recursive directory navigation
* Monaco-based Markdown editing
* Rendered Markdown preview
* Create file
* Create directory
* Rename file or directory
* Delete file or directory
* Move files/directories
* Full-text search
* Automatic detection of files created or changed outside the application
* Browser notification of filesystem changes
* Direct compatibility with agents manipulating the filesystem

The application should remain usable without an agent.

The agent should remain usable without the application.

Neither should depend upon the other for data integrity.

---

# 3. Non-Goals

The initial version should deliberately avoid becoming a knowledge-management platform.

Specifically, V1 does not require:

* proprietary databases
* block-based editing
* collaborative editing
* CRDT synchronization
* graph visualization
* embedded AI chat
* vector databases
* note databases
* Notion-style tables
* workflow engines
* publishing systems
* custom query languages
* SilverBullet-style scripting

These can be considered later if actual usage demonstrates a need.

---

# 4. Technology Stack

## Frontend

Recommended:

```text
React
TypeScript
Vite

Monaco Editor
@monaco-editor/react

React Arborist
react-arborist

Markdown renderer
react-markdown

Markdown plugins
remark-gfm
rehype-highlight or Shiki
rehype-slug
```

Optional:

```text
TanStack Query
Zustand
Lucide React
```

TanStack Query is useful for server-state caching but isn't strictly necessary for the first implementation.

Application state should remain small enough that React context or Zustand is sufficient.

---

# 5. Monaco Editor

Use:

```text
monaco-editor
@monaco-editor/react
```

Monaco is assumed as the primary text editor.

The React wrapper simplifies Monaco initialization and lifecycle management.

Suggested editor configuration:

```typescript
<Editor
  language="markdown"
  value={document.content}
  onChange={handleChange}
  options={{
    wordWrap: "on",
    minimap: {
      enabled: false
    },
    lineNumbers: "off",
    folding: true,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    fontSize: 15,
    padding: {
      top: 20
    }
  }}
/>
```

This should feel more like a document editor than a source-code editor.

Users who prefer source-oriented editing could optionally enable:

```text
line numbers
minimap
visible whitespace
```

through preferences later.

---

# 6. File Tree

## Recommended component

Use:

```text
react-arborist
```

React Arborist is a good match because the desired interface is effectively a VS Code-style filesystem explorer.

Required tree functionality includes:

* hierarchical directories
* expand/collapse
* selection
* keyboard navigation
* virtualization
* inline rename
* drag-and-drop
* multi-selection if desired later

The tree should not attempt to maintain an independent canonical hierarchy.

Its contents come from the backend filesystem API.

Example model:

```typescript
interface TreeNode {
  id: string;
  name: string;
  path: string;
  type: "file" | "directory";
  children?: TreeNode[];
}
```

For example:

```json
{
  "id": "projects",
  "name": "projects",
  "path": "projects",
  "type": "directory",
  "children": [
    {
      "id": "projects/shop.md",
      "name": "shop.md",
      "path": "projects/shop.md",
      "type": "file"
    }
  ]
}
```

The filesystem path can serve as the node ID.

---

# 7. Tree Behavior

The tree should resemble a file manager rather than a note database.

Example:

```text
▼ home
    solar.md
    electrical.md
    hvac.md

▼ projects
    shop.md
    rv.md

▶ research
```

Context menu:

```text
New Note
New Folder
Rename
Move
Delete
Copy Path
```

Potential later additions:

```text
Duplicate
Open in New Tab
Reveal in Search
Git History
```

Double-clicking a directory expands it.

Selecting a Markdown file opens it.

Dragging files between directories performs a filesystem move.

---

# 8. Markdown Rendering

## Recommended renderer

Use:

```text
react-markdown
```

The renderer should initially support GitHub-Flavored Markdown.

Recommended pipeline:

```text
Markdown
    ↓
react-markdown
    ↓
remark-gfm
    ↓
rehype-slug
    ↓
syntax highlighting
    ↓
React DOM
```

Dependencies might resemble:

```bash
npm install \
  react-markdown \
  remark-gfm \
  rehype-slug
```

Syntax highlighting could use either:

```text
rehype-highlight
```

or eventually:

```text
Shiki
```

I would favor Shiki if rendered code blocks are important because its output can closely match modern editor highlighting.

For a simple notes system, `rehype-highlight` is perfectly adequate initially.

---

# 9. Markdown Extensions

V1 should support standard Markdown plus GitHub-Flavored Markdown.

That provides:

* tables
* task lists
* strikethrough
* autolinks

Example:

```markdown
# Shop Project

## Tasks

- [x] Install panel
- [ ] Install contactor
- [ ] Finish automation

| Device | Status |
|---|---|
| Inverter | Online |
| Battery | Online |
```

---

# 10. Wiki Links

One extension worth considering early is wiki-style links:

```markdown
[[solar]]
[[projects/shop]]
[[projects/shop|Shop Project]]
```

This is useful for human notes and exceptionally easy for agents to generate.

Internally the renderer could translate:

```text
[[projects/shop]]
```

into:

```text
/projects/shop.md
```

or an application route:

```text
/note/projects/shop
```

This should remain a presentation/linking feature.

The underlying Markdown remains ordinary text.

---

# 11. Application Layout

Desktop layout:

```text
┌──────────────────────────────────────────────────────────┐
│ Grove                            Search 🔍  │
├───────────────┬──────────────────────────────────────────┤
│               │ projects/shop.md                         │
│ FILES         ├──────────────────────────────────────────┤
│               │                                          │
│ ▼ home        │                                          │
│   solar.md    │              Monaco                      │
│   hvac.md     │                                          │
│               │                                          │
│ ▼ projects    │                                          │
│   shop.md     │                                          │
│   rv.md       │                                          │
│               │                                          │
│ ▶ research    │                                          │
│               │                                          │
├───────────────┴──────────────────────────────────────────┤
│ Saved                                                     │
└──────────────────────────────────────────────────────────┘
```

The editor area should support three modes:

```text
Edit
Preview
Split
```

Split view:

```text
┌────────────────────────┬────────────────────────┐
│                        │                        │
│        Monaco          │    Markdown Preview    │
│                        │                        │
│                        │                        │
└────────────────────────┴────────────────────────┘
```

---

# 12. Backend

A small backend service is sufficient.

Recommended:

```text
Python
FastAPI
```

The backend owns filesystem safety and browser communication.

It does **not** own document storage.

Directory:

```text
app/
├── backend/
│   ├── main.py
│   ├── filesystem.py
│   ├── search.py
│   └── watcher.py
│
└── frontend/
    └── React application
```

---

# 13. Filesystem API

Suggested API:

## Tree

```http
GET /api/tree
```

Returns the current directory hierarchy.

---

## Read

```http
GET /api/file?path=projects/shop.md
```

Response:

```json
{
  "path": "projects/shop.md",
  "content": "# Shop",
  "mtime": 1786372194
}
```

---

## Save

```http
PUT /api/file
```

Request:

```json
{
  "path": "projects/shop.md",
  "content": "# Shop\n\nUpdated..."
}
```

---

## Create file

```http
POST /api/file
```

```json
{
  "path": "projects/new-project.md"
}
```

---

## Create directory

```http
POST /api/directory
```

```json
{
  "path": "projects/new-project"
}
```

---

## Rename or move

```http
PATCH /api/path
```

```json
{
  "from": "projects/foo.md",
  "to": "research/foo.md"
}
```

---

## Delete

```http
DELETE /api/path?path=projects/foo.md
```

---

# 14. Filesystem Security

All filesystem operations must be constrained underneath one configured root.

For example:

```text
DATA_ROOT=/data
```

A browser request for:

```text
../../../etc/passwd
```

must never escape `/data`.

Every path should be canonicalized before use.

Conceptually:

```python
candidate = (DATA_ROOT / requested_path).resolve()

if not candidate.is_relative_to(DATA_ROOT):
    raise Forbidden()
```

Symlinks deserve special attention.

The simplest V1 security policy is:

> Do not follow symlinks outside the workspace.

---

# 15. External Filesystem Changes

This is important for agent integration.

The application must assume that files can change without going through its API.

Examples include:

```text
AI agent
shell scripts
Git
rsync
SSH
another editor
```

The backend therefore watches `/data`.

Python implementation could use:

```text
watchfiles
```

or an equivalent filesystem notification library.

Events include:

```text
created
modified
deleted
moved
```

---

# 16. Browser Event Channel

Use Server-Sent Events initially.

Endpoint:

```http
GET /api/events
```

Example message:

```json
{
  "event": "created",
  "path": "research/new-document.md"
}
```

The browser reacts by refreshing the appropriate tree node.

SSE is preferable to WebSockets initially because communication is primarily:

```text
server → browser
```

rather than bidirectional realtime messaging.

If richer realtime functionality arrives later, moving to WebSockets is straightforward.

---

# 17. Agent Interaction

Agents do not need to use the application API.

This is intentional.

Example container arrangement:

```yaml
services:

  notes:
    image: grovemd
    volumes:
      - ./notes:/data

  agent:
    image: agent
    volumes:
      - ./notes:/data
```

The agent can simply execute:

```python
Path("/data/research/solar.md").write_text(...)
```

The sequence becomes:

```text
Agent
  │
  │ writes file
  ▼
Filesystem
  │
  │ filesystem event
  ▼
Backend watcher
  │
  │ SSE
  ▼
Browser
  │
  ▼
Tree refresh
```

This creates extremely loose coupling.

---

# 18. Concurrent Modification

There is one race condition we should explicitly handle.

Suppose:

1. Human opens `solar.md`.
2. Human starts editing.
3. Agent changes `solar.md`.
4. Human presses Save.

Blindly saving would overwrite the agent's changes.

Therefore each document read should return something like:

```json
{
  "path": "solar.md",
  "content": "...",
  "mtime": 1786372194
}
```

When saving, send:

```json
{
  "path": "solar.md",
  "content": "...",
  "expected_mtime": 1786372194
}
```

If the file changed after it was opened:

```http
409 Conflict
```

The UI can say:

```text
This document changed on disk.

[View Changes] [Reload] [Overwrite]
```

Eventually this could present a Monaco diff editor.

Monaco already makes that a particularly attractive future feature.

---

# 19. Autosave

I would **not** initially save every keystroke.

Instead:

```text
Ctrl-S             immediate save

Idle 1–2 seconds   optional autosave
```

If autosave is enabled, the same modification/version check should apply.

Status indicator:

```text
Saved
Saving…
Modified
Changed externally
Conflict
```

---

# 20. Search

Search should initially use:

```text
ripgrep
```

There is little reason to create a search database for a filesystem Markdown application.

API:

```http
GET /api/search?q=solark
```

Backend roughly performs:

```bash
rg \
  --json \
  --glob '*.md' \
  'solark' \
  /data
```

Return:

```json
[
  {
    "path": "home/solar.md",
    "line": 42,
    "preview": "The Sol-Ark inverter..."
  }
]
```

This provides very fast search without indexing infrastructure.

---

# 21. Search Interface

A command-palette style search would work well.

Keyboard shortcut:

```text
Ctrl-P
```

Search filenames:

```text
shop
```

Potential full-text search shortcut:

```text
Ctrl-Shift-F
```

Result:

```text
Search: solark

home/solar.md
  42  The Sol-Ark inverter is...

projects/shop.md
  88  Communication with the Sol-Ark...
```

Selecting a result opens the file and jumps to the relevant line in Monaco.

---

# 22. URL Scheme

Every document should have a stable browser URL.

Example:

```text
/note/home/solar
/note/projects/shop
```

The filesystem representation remains:

```text
home/solar.md
projects/shop.md
```

This enables:

* bookmarking
* browser history
* links between notes
* sharing internal URLs

---

# 23. Git

Git integration should initially happen outside the application.

Because the files are ordinary files:

```bash
cd notes

git init
git add .
git commit
```

The application doesn't need to understand Git.

Later the UI could expose:

```text
History
Diff
Last modified
Restore version
```

without changing the storage architecture.

---

# 24. Optional Front Matter

Documents may optionally use YAML front matter:

```markdown
---
title: Shop Electrical
tags:
  - electrical
  - shop
created: 2026-08-10
---

# Shop Electrical
```

However, metadata should never be required.

A perfectly valid document remains:

```markdown
# Shop Electrical

Some notes.
```

This makes agent document creation trivial.

---

# 25. API Philosophy

The REST API exists primarily for the web UI.

Agents should normally prefer the filesystem.

That distinction is important.

```text
Humans
   │
   ▼
Web UI
   │
   ▼
REST API
   │
   ▼
Filesystem
   ▲
   │
Agents
```

The filesystem is therefore the integration boundary.

---

# 26. Suggested React Component Structure

```text
App
│
├── Workspace
│   │
│   ├── Sidebar
│   │   ├── WorkspaceHeader
│   │   ├── FileTree
│   │   │   └── TreeNode
│   │   └── SearchButton
│   │
│   └── DocumentPane
│       │
│       ├── DocumentHeader
│       │   ├── Breadcrumb
│       │   └── ViewMode
│       │
│       └── DocumentView
│           ├── Editor
│           ├── Preview
│           └── SplitView
│
├── SearchDialog
│
├── NewDocumentDialog
│
├── DeleteDialog
│
└── ConflictDialog
```

---

# 27. State Model

Keep state simple.

Something approximately like:

```typescript
interface WorkspaceState {
  selectedPath?: string;

  openDocument?: {
    path: string;
    content: string;
    originalContent: string;
    mtime: number;
  };

  viewMode:
    | "edit"
    | "preview"
    | "split";

  saveState:
    | "saved"
    | "modified"
    | "saving"
    | "conflict";
}
```

The filesystem tree is server state and can be cached separately.

---

# 28. Recommended Libraries

### Editor

```text
@monaco-editor/react
monaco-editor
```

Purpose:

```text
Markdown source editing
Diff editor later
keyboard handling
syntax highlighting
```

### Tree

```text
react-arborist
```

Purpose:

```text
filesystem explorer
virtualization
drag/drop
rename
keyboard navigation
selection
```

### Markdown

```text
react-markdown
remark-gfm
rehype-slug
```

Purpose:

```text
safe React-based Markdown rendering
GFM extensions
stable heading IDs
```

### Search

```text
ripgrep
```

Purpose:

```text
filesystem-native full-text search
```

### Filesystem Events

Backend:

```text
watchfiles
```

Transport:

```text
Server-Sent Events
```

---

# 29. Deployment

A single container should ultimately be possible.

Example:

```text
grovemd
├── React static assets
└── FastAPI server
```

Runtime:

```yaml
services:
  markdown:
    image: grovemd
    ports:
      - "8080:8080"
    volumes:
      - ./notes:/data
```

Access:

```text
https://grove.20665.net
```

The only persistent data that matters is:

```text
./notes
```

Destroying and recreating the application container must not affect the notes.

---

# 30. MVP

The first useful release only needs:

```text
React
Monaco
React Arborist
react-markdown
FastAPI
filesystem watcher
SSE
ripgrep
```

Features:

```text
Browse
Open
Edit
Save
Preview
Create
Rename
Move
Delete
Search
Detect external changes
```

That is enough to make the application genuinely useful.

---

# 31. Phase Two

After using the MVP, possible additions include:

```text
Wiki links
Backlinks
Front-matter tags
Command palette
Recently opened documents
Monaco diff conflict resolution
Git history
Image/attachment browser
Paste/upload images
Dark/light themes
Mobile read-only view
Markdown templates
```

Backlinks in particular could be implemented without a database initially by searching for references with `ripgrep`.

For example, when viewing:

```text
solar.md
```

search:

```bash
rg '\[\[solar(\||\]\])' /data
```

---

# 32. Design Principle

The application should resist acquiring responsibilities that belong to the filesystem.

In particular:

> Do not turn the filesystem into an implementation detail of the application.

Instead:

> Make the application an interface to the filesystem.

This distinction is what makes the project particularly well suited to agent interaction.

A human gets:

```text
Tree + Monaco + rendered Markdown + search
```

An agent gets:

```text
read
write
mkdir
rename
grep
git
```

And both operate on exactly the same documents.

---

# 33. Initial Recommendation

For the first implementation, use:

```text
Frontend
────────
React + TypeScript + Vite

Tree
────
react-arborist

Editor
──────
@monaco-editor/react

Rendering
─────────
react-markdown
remark-gfm
rehype-slug

Backend
───────
FastAPI

Filesystem notifications
────────────────────────
watchfiles + SSE

Search
──────
ripgrep

Storage
───────
ordinary directories and *.md files
```

This creates a deliberately small application whose core job can be summarized as:

> **VS Code's Markdown editing experience, reduced to a simple self-hosted filesystem notebook that is equally accessible to humans and agents.**
