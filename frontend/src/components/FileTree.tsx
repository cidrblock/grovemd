import { useEffect, useMemo, useRef, useState } from "react";
import { Tree, type NodeApi, type NodeRendererProps, type TreeApi } from "react-arborist";
import { useWorkspace } from "../state/WorkspaceContext";
import type { TreeNode } from "../types";
import { basename, joinPath, parentDir } from "../utils/paths";

type MenuState = {
  x: number;
  y: number;
  node: TreeNode;
} | null;

function TreeNodeRow({
  node,
  style,
  dragHandle,
  onMenu,
  onOpenFile,
}: NodeRendererProps<TreeNode> & {
  onMenu: (e: React.MouseEvent, data: TreeNode) => void;
  onOpenFile: (path: string) => void;
}) {
  const icon = node.data.type === "directory" ? (node.isOpen ? "▾" : "▸") : "·";
  return (
    <div
      ref={dragHandle}
      style={style}
      className={`tree-node ${node.isSelected ? "is-selected" : ""}`}
      onContextMenu={(e) => onMenu(e, node.data)}
      onClick={(e) => {
        e.stopPropagation();
        if (node.data.type === "directory") {
          node.toggle();
          return;
        }
        onOpenFile(node.data.path);
      }}
    >
      <span className="tree-icon">{icon}</span>
      {node.isEditing ? (
        <input
          autoFocus
          defaultValue={node.data.name}
          onBlur={() => node.reset()}
          onKeyDown={(e) => {
            if (e.key === "Escape") node.reset();
            if (e.key === "Enter") node.submit((e.target as HTMLInputElement).value);
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="tree-label">{node.data.name}</span>
      )}
    </div>
  );
}

export function FileTree() {
  const {
    tree,
    treeLoading,
    openFile,
    createFile,
    createDirectory,
    renamePath,
    deletePath,
    movePath,
    activePath,
  } = useWorkspace();
  const treeRef = useRef<TreeApi<TreeNode> | null>(null);
  const treeBoxRef = useRef<HTMLDivElement | null>(null);
  const [menu, setMenu] = useState<MenuState>(null);
  const [treeHeight, setTreeHeight] = useState(400);

  const data = useMemo(() => tree, [tree]);

  useEffect(() => {
    const el = treeBoxRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.floor(el.getBoundingClientRect().height);
      if (h > 0) setTreeHeight(h);
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [treeLoading, tree.length]);

  async function promptName(title: string, initial: string): Promise<string | null> {
    const value = window.prompt(title, initial);
    return value?.trim() ? value.trim() : null;
  }

  async function onCreate(type: "file" | "directory", parentPath: string) {
    const name = await promptName(
      type === "file" ? "New note name" : "New folder name",
      type === "file" ? "untitled.md" : "folder",
    );
    if (!name) return;
    const finalName = type === "file" && !name.endsWith(".md") ? `${name}.md` : name;
    const path = joinPath(parentPath, finalName);
    if (type === "file") await createFile(path);
    else await createDirectory(path);
  }

  function openMenu(e: React.MouseEvent, node: TreeNode) {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, node });
  }

  return (
    <div
      className="file-tree"
      onContextMenu={(e) => {
        if ((e.target as HTMLElement).closest(".tree-node")) return;
        openMenu(e, { id: "", name: "", path: "", type: "directory", children: tree });
      }}
    >
      <div className="file-tree-toolbar">
        <button type="button" onClick={() => void onCreate("file", "")} title="New note">
          + Note
        </button>
        <button type="button" onClick={() => void onCreate("directory", "")} title="New folder">
          + Folder
        </button>
      </div>
      {treeLoading && tree.length === 0 ? (
        <p className="muted tree-empty">Loading…</p>
      ) : tree.length === 0 ? (
        <p className="muted tree-empty">No notes yet</p>
      ) : (
        <div className="file-tree-scroll" ref={treeBoxRef}>
          <Tree
            ref={treeRef}
            data={data}
            idAccessor={(d: TreeNode) => d.id}
            childrenAccessor={(d: TreeNode) => d.children ?? null}
            openByDefault
            width="100%"
            height={treeHeight}
            indent={14}
            rowHeight={36}
            selection={activePath ?? undefined}
            disableMultiSelection
            // Do not open files from arborist's activate — that fires on data refresh
            onActivate={(node: NodeApi<TreeNode>) => {
              if (node.data.type === "directory") node.toggle();
            }}
            onRename={async (args: { id: string | number; name: string }) => {
              const from = String(args.id);
              const to = joinPath(parentDir(from), args.name);
              if (from !== to) await renamePath(from, to);
            }}
            onMove={async (args: {
              dragIds: (string | number)[];
              parentId: string | number | null;
            }) => {
              const parent = args.parentId ? String(args.parentId) : "";
              for (const id of args.dragIds) {
                const from = String(id);
                const name = basename(from);
                const to = joinPath(parent, name);
                if (from === to) continue;
                try {
                  await movePath(from, to);
                } catch {
                  await movePath(from, joinPath(parent, `moved-${name}`));
                }
              }
            }}
          >
            {(props) => (
              <TreeNodeRow
                {...props}
                onMenu={openMenu}
                onOpenFile={(path) => void openFile(path)}
              />
            )}
          </Tree>
        </div>
      )}

      {menu && (
        <div
          className="context-menu"
          style={{ left: menu.x, top: menu.y }}
          onMouseLeave={() => setMenu(null)}
        >
          <button
            type="button"
            onClick={() => {
              const parent =
                menu.node.type === "directory" ? menu.node.path : parentDir(menu.node.path);
              void onCreate("file", parent);
              setMenu(null);
            }}
          >
            New Note
          </button>
          <button
            type="button"
            onClick={() => {
              const parent =
                menu.node.type === "directory" ? menu.node.path : parentDir(menu.node.path);
              void onCreate("directory", parent);
              setMenu(null);
            }}
          >
            New Folder
          </button>
          {menu.node.path && (
            <>
              <button
                type="button"
                onClick={() => {
                  treeRef.current?.edit(menu.node.id);
                  setMenu(null);
                }}
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(menu.node.path);
                  setMenu(null);
                }}
              >
                Copy Path
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (window.confirm(`Delete ${menu.node.path}?`)) {
                    void deletePath(menu.node.path);
                  }
                  setMenu(null);
                }}
              >
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
