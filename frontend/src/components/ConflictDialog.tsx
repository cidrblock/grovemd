import { useWorkspace } from "../state/WorkspaceContext";

export function ConflictDialog() {
  const { conflictVisible, reloadFromDisk, overwrite, dismissConflict } = useWorkspace();
  if (!conflictVisible) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal conflict-modal" role="alertdialog" aria-label="Document conflict">
        <h2>This document changed on disk</h2>
        <p>
          Another process updated this file while you were editing. Reload to take the disk
          version, or overwrite to keep your edits.
        </p>
        <div className="modal-actions">
          <button type="button" onClick={() => void reloadFromDisk()}>
            Reload
          </button>
          <button type="button" className="danger" onClick={() => void overwrite()}>
            Overwrite
          </button>
          <button type="button" className="ghost" onClick={dismissConflict}>
            Keep editing
          </button>
        </div>
      </div>
    </div>
  );
}
