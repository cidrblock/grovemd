import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { useWorkspace } from "../state/WorkspaceContext";
import type { SearchHit } from "../types";

type Mode = "files" | "content";

export function SearchDialog({
  open,
  mode,
  onClose,
}: {
  open: boolean;
  mode: Mode;
  onClose: () => void;
}) {
  const { openFile, setRevealLine } = useWorkspace();
  const [query, setQuery] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHits([]);
    if (mode === "files") {
      void api.files().then(setFiles).catch(() => setFiles([]));
    }
  }, [open, mode]);

  useEffect(() => {
    if (!open || mode !== "content") return;
    if (!query.trim()) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      setLoading(true);
      void api
        .search(query.trim())
        .then(setHits)
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 200);
    return () => window.clearTimeout(t);
  }, [query, open, mode]);

  const fileMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return files.slice(0, 50);
    return files.filter((f) => f.toLowerCase().includes(q)).slice(0, 50);
  }, [files, query]);

  if (!open) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal search-modal"
        role="dialog"
        aria-label={mode === "files" ? "Open file" : "Search notes"}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          autoFocus
          className="search-input"
          placeholder={mode === "files" ? "Search filenames…" : "Search note contents…"}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
          }}
        />
        <div className="search-results">
          {mode === "files" &&
            fileMatches.map((path) => (
              <button
                key={path}
                type="button"
                className="search-result"
                onClick={() => {
                  void openFile(path);
                  onClose();
                }}
              >
                {path}
              </button>
            ))}
          {mode === "content" && loading && <p className="muted">Searching…</p>}
          {mode === "content" &&
            !loading &&
            hits.map((hit) => (
              <button
                key={`${hit.path}:${hit.line}:${hit.preview}`}
                type="button"
                className="search-result"
                onClick={() => {
                  void openFile(hit.path).then(() => setRevealLine(hit.line));
                  onClose();
                }}
              >
                <span className="search-path">
                  {hit.path}:{hit.line}
                </span>
                <span className="search-preview">{hit.preview}</span>
              </button>
            ))}
          {mode === "content" && !loading && query.trim() && hits.length === 0 && (
            <p className="muted">No matches</p>
          )}
        </div>
      </div>
    </div>
  );
}
