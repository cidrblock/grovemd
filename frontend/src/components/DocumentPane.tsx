import { Editor } from "./Editor";
import { EditorTabs } from "./EditorTabs";
import { useWorkspace } from "../state/WorkspaceContext";

export function DocumentPane({ isMobile = false }: { isMobile?: boolean }) {
  const { openDocument, save, saveState, tabs } = useWorkspace();

  if (tabs.length === 0 || !openDocument) {
    return (
      <div className="document-empty">
        <h1>Grove</h1>
        <p>
          {isMobile
            ? "Open the file menu to pick a note."
            : "Select a note from the tree, or create one to begin."}
        </p>
      </div>
    );
  }

  return (
    <div className="document-pane">
      <EditorTabs />
      <header className="document-header">
        <div className="breadcrumb" title={openDocument.path}>
          {openDocument.path}
        </div>
        <div className="document-actions">
          <button
            type="button"
            className="save-btn"
            onClick={() => void save()}
            disabled={saveState === "saving" || saveState === "saved"}
            title="Ctrl/Cmd-S"
          >
            Save
          </button>
        </div>
      </header>
      <div className="document-body">
        <div className="editor-pane">
          <Editor />
        </div>
      </div>
    </div>
  );
}
