import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { useWorkspace } from "../state/WorkspaceContext";
import { noteUrlToFsPath } from "../utils/paths";
import { ConflictDialog } from "./ConflictDialog";
import { DocumentPane } from "./DocumentPane";
import { FileTree } from "./FileTree";
import { SearchDialog } from "./SearchDialog";

const SIDEBAR_KEY = "grove.sidebarOpen";
const MOBILE_MQ = "(max-width: 860px)";

function loadSidebarOpen(isMobile: boolean): boolean {
  if (isMobile) return false;
  try {
    const raw = localStorage.getItem(SIDEBAR_KEY);
    if (raw === null) return true;
    return raw !== "0";
  } catch {
    return true;
  }
}

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia(MOBILE_MQ).matches : false,
  );
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const onChange = () => setMobile(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

export function Workspace() {
  const location = useLocation();
  const { openFile, activePath, statusMessage, saveState } = useWorkspace();
  const isMobile = useIsMobile();
  const [fileSearchOpen, setFileSearchOpen] = useState(false);
  const [contentSearchOpen, setContentSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => loadSidebarOpen(false));
  const deepLinked = useRef(false);
  const prevPath = useRef<string | null>(null);

  // Mobile defaults: drawer closed
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
    else setSidebarOpen(loadSidebarOpen(false));
  }, [isMobile]);

  // Close drawer after navigating to a note on mobile
  useEffect(() => {
    if (!isMobile) return;
    if (activePath && activePath !== prevPath.current) {
      setSidebarOpen(false);
    }
    prevPath.current = activePath;
  }, [activePath, isMobile]);

  const setSidebar = (open: boolean) => {
    setSidebarOpen(open);
    if (!isMobile) {
      try {
        localStorage.setItem(SIDEBAR_KEY, open ? "1" : "0");
      } catch {
        /* ignore */
      }
    }
  };

  const toggleSidebar = () => setSidebar(!sidebarOpen);

  useEffect(() => {
    const match = location.pathname.match(/^\/note\/(.+)$/);
    if (!match) return;
    const fsPath = noteUrlToFsPath(match[1]);
    if (!fsPath) return;
    if (activePath === fsPath) {
      deepLinked.current = true;
      return;
    }
    if (deepLinked.current) return;
    deepLinked.current = true;
    void openFile(fsPath).catch(() => {
      /* missing note */
    });
  }, [location.pathname, openFile, activePath]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && e.key.toLowerCase() === "p") {
        e.preventDefault();
        setFileSearchOpen(true);
      }
      if (meta && e.shiftKey && e.key.toLowerCase() === "f") {
        e.preventDefault();
        setContentSearchOpen(true);
      }
      if (meta && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setSidebarOpen((open) => {
          const next = !open;
          const mobile = window.matchMedia(MOBILE_MQ).matches;
          if (!mobile) {
            try {
              localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
            } catch {
              /* ignore */
            }
          }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div
      className={`workspace${sidebarOpen ? "" : " sidebar-collapsed"}${isMobile ? " is-mobile" : ""}`}
    >
      <header className="topbar">
        <div className="topbar-left">
          <button
            type="button"
            className="sidebar-toggle"
            onClick={toggleSidebar}
            title={sidebarOpen ? "Hide files" : "Show files"}
            aria-label={sidebarOpen ? "Hide files" : "Show files"}
            aria-pressed={sidebarOpen}
          >
            {sidebarOpen ? "⟨" : "☰"}
          </button>
          <div className="brand">Grove</div>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => setFileSearchOpen(true)}>
            Open
          </button>
          <button type="button" onClick={() => setContentSearchOpen(true)}>
            Search
          </button>
        </div>
      </header>
      <div className="workspace-body">
        {isMobile && sidebarOpen && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Close files"
            onClick={() => setSidebar(false)}
          />
        )}
        <aside className="sidebar" aria-hidden={!sidebarOpen}>
          <div className="sidebar-header">
            <div className="sidebar-label">Files</div>
            <button
              type="button"
              className="sidebar-toggle sidebar-toggle-inline"
              onClick={() => setSidebar(false)}
              title="Hide files"
              aria-label="Hide files"
            >
              ⟨
            </button>
          </div>
          <FileTree />
        </aside>
        <main className="main">
          <DocumentPane isMobile={isMobile} />
        </main>
      </div>
      <footer className="status-bar">
        <span className={`status status-${saveState}`}>{statusMessage}</span>
        <span className="muted status-hints">
          Ctrl/Cmd-B files · Ctrl/Cmd-P open · Ctrl/Cmd-Shift-F search · Ctrl/Cmd-S save
        </span>
      </footer>
      <SearchDialog
        open={fileSearchOpen}
        mode="files"
        onClose={() => setFileSearchOpen(false)}
      />
      <SearchDialog
        open={contentSearchOpen}
        mode="content"
        onClose={() => setContentSearchOpen(false)}
      />
      <ConflictDialog />
    </div>
  );
}
