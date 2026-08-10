import { basename } from "../utils/paths";
import { useWorkspace } from "../state/WorkspaceContext";

export function EditorTabs() {
  const { tabs, activePath, activateTab, closeTab } = useWorkspace();
  if (tabs.length === 0) return null;

  return (
    <div className="editor-tabs" role="tablist" aria-label="Open documents">
      {tabs.map((tab) => {
        const dirty = tab.saveState === "modified" || tab.saveState === "conflict";
        const active = tab.path === activePath;
        return (
          <div
            key={tab.path}
            role="tab"
            aria-selected={active}
            className={`editor-tab ${active ? "is-active" : ""} ${dirty ? "is-dirty" : ""}`}
            title={tab.path}
            onClick={() => activateTab(tab.path)}
            onMouseDown={(e) => {
              // Middle-click close
              if (e.button === 1) {
                e.preventDefault();
                closeTab(tab.path);
              }
            }}
          >
            <span className="editor-tab-label">
              {dirty ? "● " : ""}
              {basename(tab.path)}
            </span>
            <button
              type="button"
              className="editor-tab-close"
              aria-label={`Close ${tab.path}`}
              onClick={(e) => {
                e.stopPropagation();
                closeTab(tab.path);
              }}
            >
              ×
            </button>
          </div>
        );
      })}
    </div>
  );
}
