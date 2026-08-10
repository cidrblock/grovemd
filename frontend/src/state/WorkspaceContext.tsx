import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { subscribeFsEvents } from "../api/events";
import type { OpenTab, SaveState, TreeNode } from "../types";
import { fsPathToNoteUrl } from "../utils/paths";

type WorkspaceContextValue = {
  tree: TreeNode[];
  treeLoading: boolean;
  refreshTree: () => Promise<void>;
  tabs: OpenTab[];
  activePath: string | null;
  openDocument: OpenTab | null;
  saveState: SaveState;
  statusMessage: string;
  openFile: (path: string) => Promise<void>;
  activateTab: (path: string) => void;
  closeTab: (path: string) => void;
  setContent: (content: string) => void;
  save: () => Promise<void>;
  reloadFromDisk: () => Promise<void>;
  overwrite: () => Promise<void>;
  createFile: (path: string) => Promise<void>;
  createDirectory: (path: string) => Promise<void>;
  renamePath: (from: string, to: string) => Promise<void>;
  deletePath: (path: string) => Promise<void>;
  movePath: (from: string, to: string) => Promise<void>;
  conflictVisible: boolean;
  dismissConflict: () => void;
  revealLine: number | null;
  setRevealLine: (line: number | null) => void;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

function statusFor(state: SaveState): string {
  switch (state) {
    case "saved":
      return "Saved";
    case "modified":
      return "Modified";
    case "saving":
      return "Saving…";
    case "conflict":
      return "Conflict";
    case "changed-externally":
      return "Changed externally";
  }
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [conflictVisible, setConflictVisible] = useState(false);
  const [revealLine, setRevealLine] = useState<number | null>(null);

  const tabsRef = useRef<OpenTab[]>([]);
  const activePathRef = useRef<string | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const saveInFlight = useRef<Set<string>>(new Set());
  /** Paths we just wrote — ignore watcher echoes briefly */
  const selfWrites = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    tabsRef.current = tabs;
  }, [tabs]);

  useEffect(() => {
    activePathRef.current = activePath;
  }, [activePath]);

  const openDocument = useMemo(
    () => tabs.find((t) => t.path === activePath) ?? null,
    [tabs, activePath],
  );

  const saveState: SaveState = openDocument?.saveState ?? "saved";

  const refreshTree = useCallback(async () => {
    try {
      setTree(await api.tree());
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  const markSelfWrite = useCallback((path: string) => {
    selfWrites.current.set(path, Date.now() + 4000);
  }, []);

  const isSelfWrite = useCallback((path: string) => {
    const until = selfWrites.current.get(path);
    if (!until) return false;
    if (Date.now() > until) {
      selfWrites.current.delete(path);
      return false;
    }
    return true;
  }, []);

  const updateTab = useCallback((path: string, patch: Partial<OpenTab>) => {
    setTabs((prev) => {
      const next = prev.map((t) => (t.path === path ? { ...t, ...patch } : t));
      tabsRef.current = next;
      return next;
    });
  }, []);

  const activateTab = useCallback(
    (path: string) => {
      setActivePath(path);
      activePathRef.current = path;
      const tab = tabsRef.current.find((t) => t.path === path);
      if (tab) {
        setStatusMessage(statusFor(tab.saveState));
        setConflictVisible(tab.saveState === "conflict");
      }
      navigate(fsPathToNoteUrl(path), { replace: true });
    },
    [navigate],
  );

  const openFile = useCallback(
    async (path: string) => {
      const existing = tabsRef.current.find((t) => t.path === path);
      if (existing) {
        activateTab(path);
        return;
      }
      const doc = await api.read(path);
      const tab: OpenTab = {
        path: doc.path,
        content: doc.content,
        originalContent: doc.content,
        mtime: doc.mtime,
        saveState: "saved",
      };
      setTabs((prev) => [...prev, tab]);
      tabsRef.current = [...tabsRef.current.filter((t) => t.path !== path), tab];
      activateTab(doc.path);
      setStatusMessage("Saved");
      setConflictVisible(false);
    },
    [activateTab],
  );

  const closeTab = useCallback(
    (path: string) => {
      const current = tabsRef.current;
      const idx = current.findIndex((t) => t.path === path);
      if (idx < 0) return;
      const nextTabs = current.filter((t) => t.path !== path);
      setTabs(nextTabs);
      tabsRef.current = nextTabs;

      if (activePathRef.current !== path) return;

      const fallback = nextTabs[idx] ?? nextTabs[idx - 1] ?? nextTabs[0] ?? null;
      if (fallback) {
        activateTab(fallback.path);
      } else {
        setActivePath(null);
        activePathRef.current = null;
        setStatusMessage("Ready");
        setConflictVisible(false);
        navigate("/", { replace: true });
      }
    },
    [activateTab, navigate],
  );

  const setContent = useCallback((content: string) => {
    const path = activePathRef.current;
    if (!path) return;
    const current = tabsRef.current.find((t) => t.path === path);
    if (!current) return;
    // Ignore no-op / editor echo when value is set programmatically
    if (current.content === content) return;
    updateTab(path, { content, saveState: "modified" });
    setStatusMessage("Modified");
  }, [updateTab]);

  const save = useCallback(async () => {
    const path = activePathRef.current;
    if (!path) return;
    if (saveInFlight.current.has(path)) return;
    const tab = tabsRef.current.find((t) => t.path === path);
    if (!tab) return;
    if (tab.saveState === "saving") return;
    // Nothing to write
    if (tab.saveState === "saved" && tab.content === tab.originalContent) return;

    saveInFlight.current.add(path);
    markSelfWrite(path);
    updateTab(path, { saveState: "saving" });
    setStatusMessage("Saving…");
    try {
      const result = await api.save(path, tab.content, tab.mtime);
      markSelfWrite(path);
      updateTab(path, {
        content: result.content,
        originalContent: result.content,
        mtime: result.mtime,
        saveState: "saved",
      });
      setStatusMessage("Saved");
      setConflictVisible(false);
      void refreshTree();
    } catch (err) {
      const status = (err as Error & { status?: number }).status;
      if (status === 409) {
        // Re-check: only conflict if disk actually differs from what we're saving
        try {
          const disk = await api.read(path);
          if (disk.content === tab.content) {
            markSelfWrite(path);
            updateTab(path, {
              content: disk.content,
              originalContent: disk.content,
              mtime: disk.mtime,
              saveState: "saved",
            });
            setStatusMessage("Saved");
            setConflictVisible(false);
            return;
          }
        } catch {
          /* fall through */
        }
        updateTab(path, { saveState: "conflict" });
        setStatusMessage("Conflict");
        setConflictVisible(true);
        return;
      }
      updateTab(path, { saveState: "modified" });
      setStatusMessage((err as Error).message || "Save failed");
    } finally {
      saveInFlight.current.delete(path);
    }
  }, [markSelfWrite, refreshTree, updateTab]);

  const reloadFromDisk = useCallback(async () => {
    const path = activePathRef.current;
    if (!path) return;
    const doc = await api.read(path);
    updateTab(path, {
      content: doc.content,
      originalContent: doc.content,
      mtime: doc.mtime,
      saveState: "saved",
    });
    setStatusMessage("Saved");
    setConflictVisible(false);
  }, [updateTab]);

  const overwrite = useCallback(async () => {
    const path = activePathRef.current;
    if (!path) return;
    const tab = tabsRef.current.find((t) => t.path === path);
    if (!tab) return;
    markSelfWrite(path);
    updateTab(path, { saveState: "saving" });
    try {
      const latest = await api.read(path);
      const result = await api.save(path, tab.content, latest.mtime);
      markSelfWrite(path);
      updateTab(path, {
        content: result.content,
        originalContent: result.content,
        mtime: result.mtime,
        saveState: "saved",
      });
      setStatusMessage("Saved");
      setConflictVisible(false);
    } catch (err) {
      updateTab(path, { saveState: "conflict" });
      setStatusMessage((err as Error).message || "Overwrite failed");
    }
  }, [markSelfWrite, updateTab]);

  // Idle autosave for active tab only
  useEffect(() => {
    if (!openDocument || openDocument.saveState !== "modified") return;
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void save();
    }, 1500);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [openDocument?.content, openDocument?.path, openDocument?.saveState, save]);

  const onFsEvent = useEffectEvent((event: { event: string; path: string }) => {
    void refreshTree();

    if (isSelfWrite(event.path)) return;

    const open = tabsRef.current.find((t) => t.path === event.path);
    if (!open) return;

    // Never interrupt an in-flight save with conflict UI
    if (open.saveState === "saving") return;

    if (event.event === "deleted") {
      updateTab(event.path, { saveState: "conflict" });
      if (activePathRef.current === event.path) {
        setStatusMessage("Deleted on disk");
        setConflictVisible(true);
      }
      return;
    }

    if (event.event !== "modified" && event.event !== "created") return;

    void api.read(event.path).then((doc) => {
      if (isSelfWrite(event.path)) return;
      const current = tabsRef.current.find((t) => t.path === event.path);
      if (!current || current.saveState === "saving") return;

      // Same bytes we already have — just sync mtime (our write echo or no-op)
      if (doc.content === current.content) {
        updateTab(event.path, {
          mtime: doc.mtime,
          originalContent:
            current.saveState === "saved" ? doc.content : current.originalContent,
          saveState: current.saveState === "conflict" ? "saved" : current.saveState,
        });
        return;
      }

      // Same as last saved original and we're dirty — someone else wrote different content
      // Clean tab: quietly take disk version
      if (current.saveState === "saved") {
        updateTab(event.path, {
          content: doc.content,
          originalContent: doc.content,
          mtime: doc.mtime,
          saveState: "saved",
        });
        if (activePathRef.current === event.path) {
          setStatusMessage("Reloaded from disk");
        }
        return;
      }

      // Dirty in editor and disk differs from editor — real conflict
      if (doc.content !== current.content) {
        updateTab(event.path, { saveState: "conflict", mtime: doc.mtime });
        if (activePathRef.current === event.path) {
          setStatusMessage("Changed externally");
          setConflictVisible(true);
        }
      }
    }).catch(() => {
      /* file may have vanished mid-flight */
    });
  });

  useEffect(() => subscribeFsEvents(onFsEvent), [onFsEvent]);

  // Global Ctrl/Cmd-S (capture so the editor / browser can't steal it)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        e.stopPropagation();
        void save();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [save]);

  const createFile = useCallback(
    async (path: string) => {
      markSelfWrite(path);
      const doc = await api.createFile(path);
      await refreshTree();
      await openFile(doc.path);
    },
    [markSelfWrite, openFile, refreshTree],
  );

  const createDirectory = useCallback(
    async (path: string) => {
      await api.createDirectory(path);
      await refreshTree();
    },
    [refreshTree],
  );

  const renamePath = useCallback(
    async (from: string, to: string) => {
      markSelfWrite(from);
      markSelfWrite(to);
      const result = await api.rename(from, to);
      await refreshTree();
      setTabs((prev) =>
        prev.map((t) =>
          t.path === from
            ? { ...t, path: result.to, saveState: t.saveState }
            : t.path.startsWith(`${from}/`)
              ? { ...t, path: result.to + t.path.slice(from.length) }
              : t,
        ),
      );
      if (activePathRef.current === from) {
        activateTab(result.to);
      }
    },
    [activateTab, markSelfWrite, refreshTree],
  );

  const deletePath = useCallback(
    async (path: string) => {
      markSelfWrite(path);
      await api.remove(path);
      await refreshTree();
      const doomed = tabsRef.current.filter(
        (t) => t.path === path || t.path.startsWith(`${path}/`),
      );
      for (const t of doomed) closeTab(t.path);
    },
    [closeTab, markSelfWrite, refreshTree],
  );

  const movePath = useCallback(
    async (from: string, to: string) => {
      await renamePath(from, to);
    },
    [renamePath],
  );

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      tree,
      treeLoading,
      refreshTree,
      tabs,
      activePath,
      openDocument,
      saveState,
      statusMessage,
      openFile,
      activateTab,
      closeTab,
      setContent,
      save,
      reloadFromDisk,
      overwrite,
      createFile,
      createDirectory,
      renamePath,
      deletePath,
      movePath,
      conflictVisible,
      dismissConflict: () => setConflictVisible(false),
      revealLine,
      setRevealLine,
    }),
    [
      tree,
      treeLoading,
      refreshTree,
      tabs,
      activePath,
      openDocument,
      saveState,
      statusMessage,
      openFile,
      activateTab,
      closeTab,
      setContent,
      save,
      reloadFromDisk,
      overwrite,
      createFile,
      createDirectory,
      renamePath,
      deletePath,
      movePath,
      conflictVisible,
      revealLine,
    ],
  );

  return (
    <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
  );
}

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace requires WorkspaceProvider");
  return ctx;
}
